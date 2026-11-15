import Link from "next/link";
import { ArrowRight, Building2, CircleAlert, TrendingUp, Users, Wallet } from "lucide-react";
import { RevenueChart } from "@/components/revenue-chart";
import { StatusBadge } from "@/components/status-badge";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { formatDate, formatMoney, percent } from "@/lib/format";
import { currentPeriod, periodLabel, todayISO } from "@/lib/periods";
import { INVOICE_SELECT, toInvoices } from "@/lib/queries";
import type { DashboardSummary } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase } = await requireSession();
  const period = currentPeriod();

  // Une seule vague d'appels : l'agence et les données partent en même temps (la RLS cloisonne
  // déjà par agence), et les indicateurs arrivent en un seul appel SQL.
  const [{ agency, fullName }, summaryRes, recentRes, overdueRes] = await Promise.all([
    getAgencyContext(),
    supabase.rpc("dashboard_summary", { p_agency: null, p_period: period }),
    supabase
      .from("rent_payments")
      .select(INVOICE_SELECT)
      .eq("period_month", period)
      .order("status", { ascending: false })
      .order("due_date")
      .limit(8),
    supabase
      .from("rent_payments")
      .select(INVOICE_SELECT)
      .neq("status", "PAID")
      .lt("due_date", todayISO())
      .order("due_date")
      .limit(5),
  ]);

  if (summaryRes.error) {
    return (
      <div className="alert-error">
        Impossible de charger le tableau de bord. Vérifiez que la migration SQL du dossier{" "}
        <code className="font-mono">supabase/migrations</code> a bien été appliquée à la base.
      </div>
    );
  }

  const s = summaryRes.data as DashboardSummary;
  const recent = toInvoices(recentRes.data);
  const overdue = toInvoices(overdueRes.data);
  const currency = agency.currency;
  const occupancy = percent(s.occupied_units, s.total_units);
  const collectionRate = percent(s.collected, s.expected);
  const firstName = fullName.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="page-title">{firstName ? `Bonjour ${firstName}` : "Tableau de bord"}</h1>
          <p className="page-sub">Situation de {periodLabel(period)} · {agency.name}</p>
        </div>
        <Link href="/dashboard/rent-roll" className="btn btn-primary self-start sm:self-auto">
          <Wallet className="size-4" aria-hidden="true" />
          Encaisser un loyer
        </Link>
      </div>

      {s.properties === 0 ? (
        <section className="card border-brand-200 bg-brand-50/50 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">Mettez votre espace en route</h2>
          <p className="mt-1 text-sm text-slate-600">Trois étapes suffisent pour suivre vos premiers loyers.</p>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Building2, title: "1. Ajoutez un bien", text: "Immeuble, villa ou local, avec ses lots et leur loyer.", href: "/dashboard/properties" },
              { icon: Users, title: "2. Créez un bail", text: "Rattachez un locataire à un lot libre.", href: "/dashboard/tenants" },
              { icon: Wallet, title: "3. Encaissez", text: "L'échéance du mois est créée automatiquement.", href: "/dashboard/rent-roll" },
            ].map(({ icon: Icon, title, text, href }) => (
              <li key={title}>
                <Link href={href} className="block h-full rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm">
                  <Icon className="size-5 text-brand-700" aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{text}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicateurs">
        <article className="card p-5">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Taux d'occupation</p>
          <p className="money mt-3 text-3xl font-bold text-slate-900">{occupancy}%</p>
          <p className="mt-2 text-xs text-slate-500">
            {s.occupied_units} lot{s.occupied_units > 1 ? "s" : ""} loué{s.occupied_units > 1 ? "s" : ""} sur {s.total_units}
          </p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Loyers attendus</p>
          <p className="money mt-3 text-2xl font-bold text-slate-900">{formatMoney(s.expected, currency)}</p>
          <p className="mt-2 text-xs text-slate-500">
            {s.invoices} échéance{s.invoices > 1 ? "s" : ""} en {periodLabel(period).toLowerCase()}
          </p>
        </article>
        <article className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Encaissé</p>
            <span className="badge badge-blue">
              <TrendingUp className="size-3" aria-hidden="true" />
              {collectionRate}%
            </span>
          </div>
          <p className="money mt-3 text-2xl font-bold text-emerald-700">{formatMoney(s.collected, currency)}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(collectionRate, 100)}%` }} />
          </div>
        </article>
        <article className={`card p-5 ${s.overdue_count > 0 ? "border-rose-200 bg-rose-50/40" : ""}`}>
          <p className={`text-xs font-semibold tracking-wider uppercase ${s.overdue_count > 0 ? "text-rose-700" : "text-slate-500"}`}>
            Reste à encaisser
          </p>
          <p className={`money mt-3 text-2xl font-bold ${s.outstanding_total > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {formatMoney(s.outstanding_total, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {s.overdue_count > 0
              ? `dont ${formatMoney(s.overdue_amount, currency)} en retard (${s.overdue_count})`
              : "Aucun loyer en retard"}
          </p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Échéances de {periodLabel(period).toLowerCase()}</h2>
              <p className="text-xs text-slate-500">Les loyers non soldés apparaissent en premier</p>
            </div>
            <Link href="/dashboard/rent-roll" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              Tout voir <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">
              Aucune échéance pour ce mois. Elles sont créées à l'ajout d'un bail, ou depuis « Collecte des loyers ».
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Locataire</th>
                    <th className="hidden sm:table-cell">Bien & lot</th>
                    <th className="text-right">Montant</th>
                    <th className="text-right">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-semibold text-slate-900">{invoice.tenantName}</td>
                      <td className="hidden text-xs text-slate-600 sm:table-cell">
                        {invoice.propertyName} · {invoice.unitNumber}
                      </td>
                      <td className="money text-right font-semibold whitespace-nowrap">{formatMoney(invoice.expected, "")}</td>
                      <td className="text-right">
                        <StatusBadge status={invoice.status} overdue={invoice.overdue} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Loyers en retard</h2>
            {s.overdue_count > 0 ? <span className="badge badge-red">{s.overdue_count}</span> : null}
          </div>
          {overdue.length === 0 ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              Aucun retard : tous les loyers échus sont encaissés.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {overdue.map((invoice) => (
                <li key={invoice.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <p className="text-sm font-bold text-slate-900">{invoice.tenantName}</p>
                  <p className="text-xs text-slate-600">
                    {invoice.unitNumber} · {invoice.periodLabel}
                  </p>
                  <p className="money mt-1 flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                    <CircleAlert className="size-3.5" aria-hidden="true" />
                    {formatMoney(invoice.balance, currency)} · depuis le {formatDate(invoice.dueDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {s.overdue_count > 0 ? (
            <Link href="/dashboard/rent-roll?vue=impayes" className="btn btn-secondary mt-4 w-full">
              Relancer les impayés
            </Link>
          ) : null}
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900">Encaissements des 6 derniers mois</h2>
        <div className="mt-5">
          <RevenueChart series={s.series} currency={currency} />
        </div>
      </section>
    </div>
  );
}
