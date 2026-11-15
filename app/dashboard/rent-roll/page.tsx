import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Zap } from "lucide-react";
import { generateInvoicesAction } from "@/app/actions/payments";
import { ActionButton } from "@/components/action-button";
import { RentRollTable } from "@/components/rent-roll-table";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { formatMoney, percent } from "@/lib/format";
import { currentPeriod, isValidPeriod, periodLabel, shiftPeriod } from "@/lib/periods";
import { PLANS, effectivePlan } from "@/lib/plans";
import { INVOICE_SELECT, agencyCard, toInvoices, withOtherDue } from "@/lib/queries";
import { getAppUrl } from "@/lib/url";

export const metadata: Metadata = { title: "Collecte des loyers" };

interface Props {
  searchParams: Promise<{ period?: string; vue?: string }>;
}

export default async function RentRollPage({ searchParams }: Props) {
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();
  const unpaidView = sp.vue === "impayes";

  const { supabase } = await requireSession();

  const base = supabase.from("rent_payments").select(INVOICE_SELECT);
  const filtered = unpaidView ? base.neq("status", "PAID") : base.eq("period_month", period);

  const [{ agency }, { data }, appUrl] = await Promise.all([
    getAgencyContext(),
    filtered.order("due_date").limit(1000),
    getAppUrl(),
  ]);

  // Non soldés d'abord, puis par nom de locataire.
  const invoices = (await withOtherDue(supabase, toInvoices(data))).sort(
    (a, b) =>
      Number(a.status === "PAID") - Number(b.status === "PAID") ||
      (unpaidView ? (a.dueDate ?? "").localeCompare(b.dueDate ?? "") : 0) ||
      a.tenantName.localeCompare(b.tenantName, "fr"),
  );

  const expected = invoices.reduce((sum, i) => sum + i.expected, 0);
  const collected = invoices.reduce((sum, i) => sum + Math.min(i.paid, i.expected), 0);
  const outstanding = invoices.reduce((sum, i) => sum + i.balance, 0);
  const currency = agency.currency;
  const canExport = PLANS[effectivePlan(agency)].id !== "STARTER";
  const label = periodLabel(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="page-title">Collecte des loyers</h1>
          <p className="page-sub">
            {unpaidView ? "Toutes les échéances non soldées, toutes périodes confondues." : `Échéances de ${label.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <Link
              href={`/dashboard/rent-roll?period=${period}`}
              className={`btn btn-sm ${!unpaidView ? "btn-dark" : "btn-ghost"}`}
              aria-current={!unpaidView ? "page" : undefined}
            >
              Par mois
            </Link>
            <Link
              href="/dashboard/rent-roll?vue=impayes"
              className={`btn btn-sm ${unpaidView ? "btn-dark" : "btn-ghost"}`}
              aria-current={unpaidView ? "page" : undefined}
            >
              Tous les impayés
            </Link>
          </div>
          {!unpaidView ? (
            <>
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                <Link href={`/dashboard/rent-roll?period=${shiftPeriod(period, -1)}`} className="btn btn-ghost btn-sm" aria-label="Mois précédent">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Link>
                <span className="min-w-32 px-2 text-center text-sm font-semibold text-slate-800">{label}</span>
                <Link href={`/dashboard/rent-roll?period=${shiftPeriod(period, 1)}`} className="btn btn-ghost btn-sm" aria-label="Mois suivant">
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <ActionButton action={generateInvoicesAction.bind(null, period)} className="btn btn-dark" title="Crée les échéances manquantes des baux actifs pour ce mois">
                <Zap className="size-4" aria-hidden="true" /> Générer les échéances
              </ActionButton>
              {canExport ? (
                <a href={`/dashboard/rent-roll/export?period=${period}`} className="btn btn-secondary" download>
                  <Download className="size-4" aria-hidden="true" /> CSV
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Attendu</dt>
          <dd className="money mt-2 text-2xl font-bold text-slate-900">{formatMoney(expected, currency)}</dd>
        </div>
        <div className="card p-5">
          <dt className="flex items-center justify-between text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Encaissé <span className="badge badge-blue normal-case">{percent(collected, expected)}%</span>
          </dt>
          <dd className="money mt-2 text-2xl font-bold text-emerald-700">{formatMoney(collected, currency)}</dd>
        </div>
        <div className="card p-5">
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Reste à encaisser</dt>
          <dd className={`money mt-2 text-2xl font-bold ${outstanding > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {formatMoney(outstanding, currency)}
          </dd>
        </div>
      </dl>

      <RentRollTable
        key={unpaidView ? "impayes" : period}
        invoices={invoices}
        agency={agencyCard(agency)}
        appUrl={appUrl}
        showPeriod={unpaidView}
        initialFilter="ALL"
        emptyMessage={
          unpaidView
            ? "Aucun impayé : toutes les échéances sont soldées."
            : `Aucune échéance pour ${label.toLowerCase()}. Cliquez sur « Générer les échéances » pour les créer à partir des baux actifs.`
        }
      />
    </div>
  );
}
