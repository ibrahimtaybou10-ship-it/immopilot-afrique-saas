import "server-only";
import { confirmationMessage } from "@/lib/messages";
import { PLANS } from "@/lib/plans";
import { INVOICE_SELECT, toInvoice } from "@/lib/queries";
import { sendSms } from "@/lib/sms";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/types";
import { getAgencyCredentials } from "./accounts";
import { getCheckoutState, type CheckoutState } from "./saspay";

type AdminClient = ReturnType<typeof createAdminClient>;

interface PendingTransaction {
  id: string;
  agency_id: string;
  rent_payment_id: string | null;
  kind: "RENT" | "SUBSCRIPTION";
  amount: number;
  status: string;
  provider_reference: string;
  metadata: { plan?: string } | null;
}

const PENDING_SELECT = "id, agency_id, rent_payment_id, kind, amount, status, provider_reference, metadata";

export type SettleOutcome = "paid" | "failed" | "pending" | "unverifiable" | "ignored";

/**
 * Confirme (ou non) un paiement en ligne en attente, à partir de l'état relu chez SasPay.
 * Idempotent : appelé plusieurs fois (webhook, retour du client, tâche quotidienne),
 * un paiement n'est appliqué qu'une seule fois.
 */
export async function settlePendingTransaction(
  admin: AdminClient,
  tx: PendingTransaction,
  appUrl: string,
  keyCache: Map<string, string | null> = new Map(),
): Promise<SettleOutcome> {
  if (tx.status !== "PENDING") return "ignored";

  // Loyer : session créée sur le compte SasPay DE L'AGENCE. Abonnement : compte de la plateforme.
  let key: string | undefined;
  if (tx.kind === "RENT") {
    if (!keyCache.has(tx.agency_id)) {
      keyCache.set(tx.agency_id, (await getAgencyCredentials(admin, tx.agency_id))?.secretKey ?? null);
    }
    const agencyKey = keyCache.get(tx.agency_id);
    if (!agencyKey) return "unverifiable";
    key = agencyKey;
  }

  const state = await getCheckoutState(tx.provider_reference, key);
  if (!state) return "unverifiable";
  if (state.status === "PENDING") return "pending";

  if (state.status === "FAILED" || state.amount < Number(tx.amount)) {
    if (state.status === "PAID") {
      console.error(`[saspay] montant inattendu pour ${tx.provider_reference} : ${state.amount} < ${tx.amount}`);
    }
    await admin.from("payment_transactions").update({ status: "FAILED" }).eq("id", tx.id).eq("status", "PENDING");
    return "failed";
  }

  if (tx.kind === "SUBSCRIPTION") {
    await activateSubscription(admin, tx, state);
  } else if (tx.rent_payment_id) {
    await settleRent(admin, tx, state, appUrl);
  }
  return "paid";
}

/** Rattrapage : vérifie les paiements en attente (des dernières 72 h), du plus récent au plus ancien. */
export async function settleRecentPending(
  admin: AdminClient,
  appUrl: string,
  filter: { rentPaymentId?: string; agencyId?: string; kind?: "RENT" | "SUBSCRIPTION"; limit?: number } = {},
): Promise<Record<SettleOutcome, number>> {
  let query = admin
    .from("payment_transactions")
    .select(PENDING_SELECT)
    .eq("provider", "SASPAY")
    .eq("status", "PENDING")
    .gte("created_at", new Date(Date.now() - 72 * 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 50);
  if (filter.rentPaymentId) query = query.eq("rent_payment_id", filter.rentPaymentId);
  if (filter.agencyId) query = query.eq("agency_id", filter.agencyId);
  if (filter.kind) query = query.eq("kind", filter.kind);

  const { data } = await query;
  const counts: Record<SettleOutcome, number> = { paid: 0, failed: 0, pending: 0, unverifiable: 0, ignored: 0 };
  const keyCache = new Map<string, string | null>();
  for (const tx of (data ?? []) as PendingTransaction[]) {
    counts[await settlePendingTransaction(admin, tx, appUrl, keyCache)] += 1;
  }
  return counts;
}

async function settleRent(admin: AdminClient, tx: PendingTransaction, state: CheckoutState, appUrl: string) {
  const { error } = await admin.rpc("apply_payment", {
    p_rent_payment_id: tx.rent_payment_id,
    p_amount: state.amount,
    p_method: state.method,
    p_provider: "SASPAY",
    p_reference: tx.provider_reference,
    p_note: state.transactionId ? `SasPay ${state.transactionId}` : null,
  });
  if (error) {
    console.error("[saspay] apply_payment a échoué", error.message);
    return;
  }

  // Confirmation au locataire, avec le lien vers sa quittance.
  const { data: row } = await admin
    .from("rent_payments")
    .select(`${INVOICE_SELECT}, agencies!inner(name, currency, sms_sender_id)`)
    .eq("id", tx.rent_payment_id)
    .maybeSingle();
  if (!row) return;

  const invoice = toInvoice(row);
  const agency = (row as unknown as { agencies: { name: string; currency: string; sms_sender_id: string | null } }).agencies;
  await sendSms(
    invoice.tenantPhone,
    confirmationMessage({
      tenantName: invoice.tenantName,
      amount: state.amount,
      currency: agency.currency,
      periodLabel: invoice.periodLabel,
      receiptNumber: invoice.receiptNumber,
      agencyName: agency.name,
      payUrl: `${appUrl}/pay/${invoice.payToken}`,
    }),
    agency.sms_sender_id,
  );
}

async function activateSubscription(admin: AdminClient, tx: PendingTransaction, state: CheckoutState) {
  const planId = tx.metadata?.plan as PlanId | undefined;
  if (!planId || !PLANS[planId] || PLANS[planId].price <= 0) return;

  // Verrou optimiste : seule la première confirmation fait passer la transaction à SUCCEEDED.
  const { data: claimed } = await admin
    .from("payment_transactions")
    .update({ status: "SUCCEEDED", paid_at: new Date().toISOString(), method: state.method })
    .eq("id", tx.id)
    .eq("status", "PENDING")
    .select("id");
  if (!claimed?.length) return;

  const { data: agency } = await admin
    .from("agencies")
    .select("subscription_status, subscription_plan, current_period_end")
    .eq("id", tx.agency_id)
    .single();

  // Un renouvellement de la même offre prolonge la période en cours ; sinon elle repart d'aujourd'hui.
  const now = Date.now();
  const currentEnd = agency?.current_period_end ? new Date(agency.current_period_end).getTime() : 0;
  const renewing = agency?.subscription_status === "ACTIVE" && agency.subscription_plan === planId && currentEnd > now;
  const end = new Date(renewing ? currentEnd : now);
  end.setUTCMonth(end.getUTCMonth() + 1);

  await admin
    .from("agencies")
    .update({ subscription_plan: planId, subscription_status: "ACTIVE", current_period_end: end.toISOString() })
    .eq("id", tx.agency_id);
}
