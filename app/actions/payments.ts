"use server";

import { revalidatePath } from "next/cache";
import { SESSION_EXPIRED, dbError, fail, firstIssue, formObject } from "@/lib/action-utils";
import { getAgencyContext, getSession } from "@/lib/auth";
import { reminderMessage } from "@/lib/messages";
import { isValidPeriod, periodLabel } from "@/lib/periods";
import { INVOICE_SELECT, toInvoice } from "@/lib/queries";
import { sendSms } from "@/lib/sms";
import type { ActionResult } from "@/lib/types";
import { getAppUrl } from "@/lib/url";
import { isUuid, paymentSchema } from "@/lib/validation";

/** Encaissement manuel (espèces, Mobile Money reçu en direct, virement, chèque…). */
export async function recordPaymentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  // apply_payment vérifie lui-même que l'échéance appartient à l'agence du compte.
  const { data, error } = await session.supabase.rpc("apply_payment", {
    p_rent_payment_id: v.invoice_id,
    p_amount: v.amount,
    p_method: v.method,
    p_provider: "MANUAL",
    p_reference: null,
    p_note: v.note,
  });
  if (error) return fail(dbError(error));

  const invoice = data as { status: string; receipt_number: string | null } | null;
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message:
      invoice?.status === "PAID"
        ? `Loyer soldé. Quittance ${invoice.receipt_number ?? ""} disponible.`
        : "Paiement partiel enregistré.",
  };
}

/** Génère les échéances d'une période pour tous les baux actifs de l'agence (sans doublon). */
export async function generateInvoicesAction(period: string): Promise<ActionResult> {
  if (!isValidPeriod(period)) return fail("Période invalide.");

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  const { data, error } = await session.supabase.rpc("generate_rent_invoices", { p_period: period, p_agency: null });
  if (error) return fail(dbError(error));

  const created = Number(data ?? 0);
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message:
      created > 0
        ? `${created} échéance${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""} pour ${periodLabel(period)}.`
        : `Aucune échéance à créer : ${periodLabel(period)} est déjà à jour.`,
  };
}

/** Relance par SMS d'une échéance impayée, avec lien vers la page de paiement du locataire. */
export async function sendReminderAction(invoiceId: string): Promise<ActionResult> {
  if (!isUuid(invoiceId)) return fail("Échéance invalide.");

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);
  const { supabase } = session;

  const [{ agency }, { data: row }, appUrl] = await Promise.all([
    getAgencyContext(),
    supabase.from("rent_payments").select(INVOICE_SELECT).eq("id", invoiceId).maybeSingle(),
    getAppUrl(),
  ]);
  if (!row) return fail("Échéance introuvable.");

  const invoice = toInvoice(row);
  if (invoice.status === "PAID") return fail("Ce loyer est déjà réglé.");

  const text = reminderMessage({
    tenantName: invoice.tenantName,
    balance: invoice.balance,
    currency: agency.currency,
    periodLabel: invoice.periodLabel,
    dueDate: invoice.dueDate,
    overdue: invoice.overdue,
    agencyName: agency.name,
    payUrl: `${appUrl}/pay/${invoice.payToken}`,
  });

  const result = await sendSms(invoice.tenantPhone, text, agency.sms_sender_id);
  if (!result.ok) return fail(result.error ?? "Échec de l'envoi du SMS.");

  await supabase
    .from("rent_payments")
    .update({ reminder_count: invoice.reminderCount + 1, last_reminder_at: new Date().toISOString() })
    .eq("id", invoice.id);

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: result.simulated
      ? `Relance enregistrée pour ${invoice.tenantName}. Aucune passerelle SMS n'est configurée : le SMS n'a pas été réellement envoyé.`
      : `SMS de relance envoyé à ${invoice.tenantName}.`,
  };
}
