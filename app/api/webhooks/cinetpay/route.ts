import { NextResponse, type NextRequest } from "next/server";
import { confirmationMessage } from "@/lib/messages";
import { checkTransaction, type TransactionState } from "@/lib/payments/cinetpay";
import { PLANS } from "@/lib/plans";
import { INVOICE_SELECT, toInvoice } from "@/lib/queries";
import { sendSms } from "@/lib/sms";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/types";
import { getAppUrl } from "@/lib/url";

interface PendingTransaction {
  id: string;
  agency_id: string;
  rent_payment_id: string | null;
  kind: "RENT" | "SUBSCRIPTION";
  amount: number;
  status: string;
  metadata: { plan?: string } | null;
}

type AdminClient = ReturnType<typeof createAdminClient>;

const received = () => NextResponse.json({ received: true });

/** CinetPay vérifie la disponibilité de l'URL de notification par un GET. */
export function GET() {
  return received();
}

/**
 * Notification de paiement CinetPay.
 *
 * Le contenu reçu n'est jamais cru sur parole : on n'en retient que l'identifiant de
 * transaction, puis on relit son état auprès de CinetPay avec notre clé API. Un appel
 * forgé ne peut donc ni valider un paiement, ni en modifier le montant. Le traitement
 * est idempotent : une notification rejouée n'encaisse pas deux fois.
 */
export async function POST(request: NextRequest) {
  let transactionId: string | null = null;
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      transactionId = String(body.cpm_trans_id ?? body.transaction_id ?? "");
    } else {
      const form = await request.formData();
      transactionId = String(form.get("cpm_trans_id") ?? form.get("transaction_id") ?? "");
    }
  } catch {
    return received();
  }
  if (!transactionId || !/^[A-Za-z0-9]{8,40}$/.test(transactionId)) return received();

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const admin = createAdminClient();

  const { data } = await admin
    .from("payment_transactions")
    .select("id, agency_id, rent_payment_id, kind, amount, status, metadata")
    .eq("provider", "CINETPAY")
    .eq("provider_reference", transactionId)
    .maybeSingle();
  const tx = data as PendingTransaction | null;
  if (!tx || tx.status !== "PENDING") return received();

  const state = await checkTransaction(transactionId);
  if (!state) {
    // Vérification impossible : on répond en erreur pour que CinetPay renvoie la notification.
    return NextResponse.json({ error: "verification unavailable" }, { status: 502 });
  }
  if (state.status === "PENDING") return received();

  if (state.status === "REFUSED" || state.amount < Number(tx.amount)) {
    if (state.status === "ACCEPTED") {
      console.error(`[cinetpay] montant inattendu pour ${transactionId} : ${state.amount} < ${tx.amount}`);
    }
    await admin.from("payment_transactions").update({ status: "FAILED" }).eq("id", tx.id).eq("status", "PENDING");
    return received();
  }

  if (tx.kind === "SUBSCRIPTION") {
    await activateSubscription(admin, tx, state);
  } else if (tx.rent_payment_id) {
    await settleRent(admin, tx, state, transactionId);
  }
  return received();
}

async function settleRent(admin: AdminClient, tx: PendingTransaction, state: TransactionState, reference: string) {
  const { error } = await admin.rpc("apply_payment", {
    p_rent_payment_id: tx.rent_payment_id,
    p_amount: state.amount,
    p_method: state.method,
    p_provider: "CINETPAY",
    p_reference: reference,
    p_note: null,
  });
  if (error) {
    console.error("[cinetpay] apply_payment a échoué", error.message);
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
  const appUrl = await getAppUrl();
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

async function activateSubscription(admin: AdminClient, tx: PendingTransaction, state: TransactionState) {
  const planId = tx.metadata?.plan as PlanId | undefined;
  if (!planId || !PLANS[planId] || PLANS[planId].price <= 0) return;

  // Verrou optimiste : seule la première notification fait passer la transaction à SUCCEEDED.
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
