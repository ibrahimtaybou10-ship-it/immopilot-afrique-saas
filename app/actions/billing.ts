"use server";

import { redirect } from "next/navigation";
import { fail } from "@/lib/action-utils";
import { getAgencyContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { countryCode } from "@/lib/countries";
import { createCheckout, isPaymentProviderConfigured, isRentOnlinePaymentEnabled } from "@/lib/payments/saspay";
import { PLANS, effectivePlan } from "@/lib/plans";
import { createAdminClient, isAdminConfigured, serviceKeyIssue } from "@/lib/supabase/admin";
import type { ActionResult, Agency, PlanId } from "@/lib/types";
import { getAppUrl } from "@/lib/url";

const ONLINE_PAYMENT_OFF =
  "Le paiement en ligne n'est pas encore activé. Contactez votre agence pour régler autrement.";

/** SasPay exige un e-mail client : celui du locataire, sinon celui de l'agence, sinon une adresse technique. */
function payerEmail(...candidates: (string | null | undefined)[]): string {
  const found = candidates.find((value) => value && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value));
  return found ?? process.env.SASPAY_FALLBACK_EMAIL ?? "paiements@loyeo.app";
}

/** Paiement de l'abonnement au logiciel par l'agence : l'argent arrive sur le compte SasPay de la plateforme. */
export async function startSubscriptionCheckoutAction(planId: PlanId): Promise<ActionResult> {
  const plan = PLANS[planId];
  if (!plan || plan.price <= 0) return fail("Offre invalide.");

  const { agency, role, email } = await getAgencyContext();
  if (role !== "OWNER" && role !== "ADMIN") return fail("Seul un administrateur peut modifier l'abonnement.");
  if (!isPaymentProviderConfigured()) {
    return fail("Le paiement en ligne de l'abonnement n'est pas encore activé. Contactez-nous pour changer d'offre.");
  }
  // Message précis pour l'administrateur : c'est lui qui configure les clés dans Vercel.
  const keyIssue = serviceKeyIssue();
  if (keyIssue) return fail(`Paiement indisponible : ${keyIssue}`);

  const appUrl = await getAppUrl();
  const checkout = await createCheckout({
    amount: plan.price,
    description: `Abonnement ${BRAND.name} ${plan.name} — 1 mois`,
    customerName: agency.name,
    customerEmail: payerEmail(agency.email, email),
    customerPhone: agency.phone,
    country: countryCode(agency.country),
    returnUrl: `${appUrl}/dashboard/settings?paiement=retour`,
    metadata: { kind: "SUBSCRIPTION", agency_id: agency.id, plan: plan.id },
  });
  if (!checkout.ok) return fail(checkout.error);

  const admin = createAdminClient();
  const { error } = await admin.from("payment_transactions").insert({
    agency_id: agency.id,
    kind: "SUBSCRIPTION",
    amount: plan.price,
    method: "SASPAY",
    provider: "SASPAY",
    provider_reference: checkout.sessionId,
    status: "PENDING",
    metadata: { plan: plan.id, checkout_url: checkout.checkoutUrl },
  });
  if (error) {
    console.error("[billing] enregistrement du paiement d'abonnement impossible :", error.code ?? "", error.message);
    return fail(`Impossible d'enregistrer le paiement : ${error.message.slice(0, 160)}`);
  }

  redirect(checkout.checkoutUrl);
}

/**
 * Paiement d'un loyer par le locataire depuis sa page publique (/pay/<jeton>).
 * Action publique : seul le jeton secret de l'échéance donne accès, et le montant est
 * toujours recalculé côté serveur.
 */
export async function startRentCheckoutAction(token: string): Promise<ActionResult> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return fail("Lien de paiement invalide.");
  if (!isRentOnlinePaymentEnabled() || !isAdminConfigured()) return fail(ONLINE_PAYMENT_OFF);

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("rent_payments")
    .select(
      `id, agency_id, period_label, expected_amount, amount_paid, status,
       leases!inner(lease_tenants!inner(full_name, phone, email)),
       agencies!inner(name, email, country, subscription_plan, subscription_status, trial_ends_at, current_period_end)`,
    )
    .eq("pay_token", token)
    .maybeSingle();
  if (!invoice) return fail("Lien de paiement invalide.");
  if (invoice.status === "PAID") return fail("Ce loyer est déjà réglé.");

  const agency = invoice.agencies as unknown as Pick<
    Agency,
    "name" | "email" | "country" | "subscription_plan" | "subscription_status" | "trial_ends_at" | "current_period_end"
  >;
  const tenant = (invoice.leases as unknown as { lease_tenants: { full_name: string; phone: string; email: string | null } })
    .lease_tenants;
  if (effectivePlan(agency) === "STARTER") return fail(ONLINE_PAYMENT_OFF);

  const balance = Number(invoice.expected_amount) - Number(invoice.amount_paid);
  if (balance <= 0) return fail("Ce loyer est déjà réglé.");

  // Réutilise une session créée il y a moins de 15 minutes pour le même montant (double clic, retour arrière).
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: pending } = await admin
    .from("payment_transactions")
    .select("metadata")
    .eq("rent_payment_id", invoice.id)
    .eq("provider", "SASPAY")
    .eq("status", "PENDING")
    .eq("amount", balance)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existingUrl = (pending?.metadata as { checkout_url?: string } | null)?.checkout_url;
  if (existingUrl) redirect(existingUrl);

  const appUrl = await getAppUrl();
  const checkout = await createCheckout({
    amount: balance,
    description: `Loyer ${invoice.period_label} — ${agency.name}`,
    customerName: tenant.full_name,
    customerEmail: payerEmail(tenant.email, agency.email),
    customerPhone: tenant.phone,
    country: countryCode(agency.country),
    returnUrl: `${appUrl}/pay/${token}?retour=1`,
    metadata: { kind: "RENT", agency_id: invoice.agency_id, rent_payment_id: invoice.id },
  });
  if (!checkout.ok) return fail(checkout.error);

  const { error } = await admin.from("payment_transactions").insert({
    agency_id: invoice.agency_id,
    rent_payment_id: invoice.id,
    kind: "RENT",
    amount: balance,
    method: "SASPAY",
    provider: "SASPAY",
    provider_reference: checkout.sessionId,
    status: "PENDING",
    metadata: { checkout_url: checkout.checkoutUrl },
  });
  if (error) {
    console.error("[billing] enregistrement du paiement de loyer impossible :", error.code ?? "", error.message);
    return fail("Impossible d'initialiser le paiement. Réessayez.");
  }

  redirect(checkout.checkoutUrl);
}
