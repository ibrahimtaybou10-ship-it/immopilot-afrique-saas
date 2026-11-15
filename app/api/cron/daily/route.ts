import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { reminderMessage } from "@/lib/messages";
import { addDaysISO, currentPeriod, todayISO } from "@/lib/periods";
import { PLANS, effectivePlan } from "@/lib/plans";
import { INVOICE_SELECT, toInvoice } from "@/lib/queries";
import { sendSms } from "@/lib/sms";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { Agency } from "@/lib/types";
import { getAppUrl } from "@/lib/url";

export const maxDuration = 60;

type ReminderAgency = Pick<
  Agency,
  "name" | "currency" | "sms_sender_id" | "subscription_plan" | "subscription_status" | "trial_ends_at" | "current_period_end"
>;

/** Relances : 3 jours avant l'échéance, puis 1, 7 et 15 jours après. */
const REMINDER_OFFSETS = [3, -1, -7, -15];
const MAX_REMINDERS_PER_RUN = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // jamais ouvert par défaut
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Tâche quotidienne (Vercel Cron, 06:00 UTC) :
 *   1. crée les échéances du mois pour tous les baux actifs — idempotent, donc rejouable
 *      chaque jour : un bail créé en cours de mois ou un passage manqué est rattrapé ;
 *   2. envoie les relances automatiques des agences qui les ont activées (offre Pro et plus).
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquant" }, { status: 503 });
  }

  const admin = createAdminClient();
  const period = currentPeriod();

  const { data: created, error } = await admin.rpc("generate_rent_invoices", { p_period: period, p_agency: null });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = todayISO();
  const { data: rows } = await admin
    .from("rent_payments")
    .select(
      `${INVOICE_SELECT}, agencies!inner(name, currency, sms_sender_id, auto_reminders, subscription_plan, subscription_status, trial_ends_at, current_period_end)`,
    )
    .neq("status", "PAID")
    .in("due_date", REMINDER_OFFSETS.map((offset) => addDaysISO(today, offset)))
    .eq("agencies.auto_reminders", true)
    .limit(MAX_REMINDERS_PER_RUN);

  const appUrl = await getAppUrl();
  const due = (rows ?? [])
    .map((row) => ({
      invoice: toInvoice(row, today),
      agency: (row as unknown as { agencies: ReminderAgency }).agencies,
    }))
    .filter(
      ({ invoice, agency }) =>
        PLANS[effectivePlan(agency)].autoReminders &&
        invoice.balance > 0 &&
        // Déjà relancé aujourd'hui (tâche rejouée ou relance manuelle) : on n'insiste pas.
        (invoice.lastReminderAt ?? "").slice(0, 10) !== today,
    );

  let sent = 0;
  let failed = 0;
  // Envois par lots de 10 pour rester dans la durée maximale de la fonction.
  for (let i = 0; i < due.length; i += 10) {
    await Promise.all(
      due.slice(i, i + 10).map(async ({ invoice, agency }) => {
        const result = await sendSms(
          invoice.tenantPhone,
          reminderMessage({
            tenantName: invoice.tenantName,
            balance: invoice.balance,
            currency: agency.currency,
            periodLabel: invoice.periodLabel,
            dueDate: invoice.dueDate,
            overdue: invoice.overdue,
            agencyName: agency.name,
            payUrl: `${appUrl}/pay/${invoice.payToken}`,
          }),
          agency.sms_sender_id,
        );
        if (!result.ok) {
          failed += 1;
          return;
        }
        sent += 1;
        await admin
          .from("rent_payments")
          .update({ reminder_count: invoice.reminderCount + 1, last_reminder_at: new Date().toISOString() })
          .eq("id", invoice.id);
      }),
    );
  }

  return NextResponse.json({
    success: true,
    period,
    invoices_created: Number(created ?? 0),
    reminders_sent: sent,
    reminders_failed: failed,
  });
}
