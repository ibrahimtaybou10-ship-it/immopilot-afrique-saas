"use server";

import { redirect } from "next/navigation";
import { fail } from "@/lib/action-utils";
import { getAgencyContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { createCheckout, isPaymentProviderConfigured, newTransactionId } from "@/lib/payments/cinetpay";
import { PLANS, effectivePlan } from "@/lib/plans";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { ActionResult, Agency, PlanId } from "@/lib/types";
import { getAppUrl } from "@/lib/url";

const ONLINE_PAYMENT_OFF =
  "Le paiement en ligne n'est pas encore activé sur cette plateforme. Contactez votre agence pour régler autrement.";

/** Paiement de l'abonnement au logiciel par l'agence (Mobile Money / carte). */
export async function startSubscriptionCheckoutAction(planId: PlanId): Promise<ActionResult> {
  const plan = PLANS[planId];
  if (!plan || plan.price <= 0) return fail("Offre invalide.");

  const { agency, role } = await getAgencyContext();
  if (role !== "OWNER" && role !== "ADMIN") return fail("Seul un administrateur peut modifier l'abonnement.");
  if (!isPaymentProviderConfigured() || !isAdminConfigured()) {
    return fail("Le paiement en ligne de l'abonnement n'est pas encore activé. Contactez-nous pour changer d'offre.");
  }

  const admin = createAdminClient();
  const appUrl = await getAppUrl();
  const transactionId = newTransactionId();

  const { error } = await admin.from("payment_transactions").insert({
    agency_id: agency.id,
    kind: "SUBSCRIPTION",
    amount: plan.price,
    method: "MOBILE_MONEY",
    provider: "CINETPAY",
    provider_reference: transactionId,
    status: "PENDING",
    metadata: { plan: plan.id },
  });
  if (error) return fail("Impossible d'initialiser le paiement. Réessayez.");

  const checkout = await createCheckout({
    transactionId,
    amount: plan.price,
    description: `Abonnement ${BRAND.name} ${plan.name}`,
    notifyUrl: `${appUrl}/api/webhooks/cinetpay`,
    returnUrl: `${appUrl}/dashboard/settings?paiement=retour`,
  });
  if (!checkout.ok) return fail(checkout.error);
  redirect(checkout.paymentUrl);
}

/**
 * Paiement d'un loyer par le locataire depuis sa page publique (/pay/<jeton>).
 * Action publique : seul le jeton secret de l'échéance donne accès, et le montant est
 * toujours recalculé côté serveur.
 */
export async function startRentCheckoutAction(token: string): Promise<ActionResult> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return fail("Lien de paiement invalide.");
  if (!isPaymentProviderConfigured() || !isAdminConfigured()) return fail(ONLINE_PAYMENT_OFF);

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("rent_payments")
    .select(
      "id, agency_id, period_label, expected_amount, amount_paid, status, agencies!inner(subscription_plan, subscription_status, trial_ends_at, current_period_end)",
    )
    .eq("pay_token", token)
    .maybeSingle();
  if (!invoice) return fail("Lien de paiement invalide.");
  if (invoice.status === "PAID") return fail("Ce loyer est déjà réglé.");

  const billing = invoice.agencies as unknown as Pick<
    Agency,
    "subscription_plan" | "subscription_status" | "trial_ends_at" | "current_period_end"
  >;
  if (effectivePlan(billing) === "STARTER") return fail(ONLINE_PAYMENT_OFF);

  const balance = Number(invoice.expected_amount) - Number(invoice.amount_paid);
  if (balance <= 0) return fail("Ce loyer est déjà réglé.");

  // Réutilise un paiement initié il y a moins de 15 minutes (évite les doublons en cas de double clic).
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: pending } = await admin
    .from("payment_transactions")
    .select("metadata")
    .eq("rent_payment_id", invoice.id)
    .eq("status", "PENDING")
    .eq("amount", balance)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existingUrl = (pending?.metadata as { payment_url?: string } | null)?.payment_url;
  if (existingUrl) redirect(existingUrl);

  const appUrl = await getAppUrl();
  const transactionId = newTransactionId();
  const checkout = await createCheckout({
    transactionId,
    amount: balance,
    description: `Loyer ${invoice.period_label}`,
    notifyUrl: `${appUrl}/api/webhooks/cinetpay`,
    returnUrl: `${appUrl}/pay/${token}?retour=1`,
  });
  if (!checkout.ok) return fail(checkout.error);

  const { error } = await admin.from("payment_transactions").insert({
    agency_id: invoice.agency_id,
    rent_payment_id: invoice.id,
    kind: "RENT",
    amount: balance,
    method: "MOBILE_MONEY",
    provider: "CINETPAY",
    provider_reference: transactionId,
    status: "PENDING",
    metadata: { payment_url: checkout.paymentUrl },
  });
  if (error) return fail("Impossible d'initialiser le paiement. Réessayez.");

  redirect(checkout.paymentUrl);
}
