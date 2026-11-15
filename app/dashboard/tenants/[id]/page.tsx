import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, DoorOpen, Mail, Phone } from "lucide-react";
import { terminateLeaseAction } from "@/app/actions/leases";
import { ModalForm } from "@/components/modal-form";
import { RentRollTable } from "@/components/rent-roll-table";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { todayISO } from "@/lib/periods";
import { INVOICE_SELECT, agencyCard, toInvoices, withOtherDue } from "@/lib/queries";
import type { LeaseStatus } from "@/lib/types";
import { getAppUrl } from "@/lib/url";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Dossier locataire" };

interface LeaseDetail {
  id: string;
  lease_reference: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  charges_amount: number;
  deposit_amount: number;
  due_day: number;
  status: LeaseStatus;
  lease_tenants: { full_name: string; phone: string; email: string | null; profession: string | null; id_card_number: string | null };
  units: { unit_number: string };
  properties: { id: string; name: string; address: string; city: string };
}

export default async function LeasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { supabase } = await requireSession();
  const [{ agency }, leaseRes, invoicesRes, appUrl] = await Promise.all([
    getAgencyContext(),
    supabase
      .from("leases")
      .select(
        "id, lease_reference, start_date, end_date, monthly_rent, charges_amount, deposit_amount, due_day, status, lease_tenants!inner(full_name, phone, email, profession, id_card_number), units!inner(unit_number), properties!inner(id, name, address, city)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("rent_payments").select(INVOICE_SELECT).eq("lease_id", id).order("period_month", { ascending: false }).limit(120),
    getAppUrl(),
  ]);

  const lease = leaseRes.data as unknown as LeaseDetail | null;
  if (!lease) notFound();

  const invoices = await withOtherDue(supabase, toInvoices(invoicesRes.data));
  const tenant = lease.lease_tenants;
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const currency = agency.currency;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/tenants" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ChevronLeft className="size-4" aria-hidden="true" /> Tous les baux
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <span className={`badge ${lease.status === "ACTIVE" ? "badge-green" : "badge-slate"}`}>
            {lease.status === "ACTIVE" ? "Bail actif" : `Résilié le ${formatDate(lease.end_date)}`}
          </span>
          <h1 className="page-title mt-2">{tenant.full_name}</h1>
          <p className="page-sub">
            <Link href={`/dashboard/properties/${lease.properties.id}`} className="hover:underline">
              {lease.properties.name}
            </Link>{" "}
            · {lease.units.unit_number} · <span className="money">{lease.lease_reference}</span>
          </p>
        </div>
        {lease.status === "ACTIVE" ? (
          <ModalForm
            trigger={
              <>
                <DoorOpen className="size-4" aria-hidden="true" /> Résilier le bail
              </>
            }
            triggerClassName="btn btn-danger"
            title="Résilier le bail"
            description={`${tenant.full_name} · ${lease.units.unit_number}`}
            action={terminateLeaseAction}
            submitLabel="Confirmer la résiliation"
          >
            <input type="hidden" name="lease_id" value={lease.id} />
            <div>
              <label htmlFor="end-date" className="label">Date de sortie</label>
              <input id="end-date" name="end_date" type="date" required className="input money" defaultValue={todayISO()} />
            </div>
            <p className="alert-info">
              Le lot redevient libre et plus aucune échéance n'est générée après cette date. L'historique des loyers est conservé.
            </p>
          </ModalForm>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Locataire</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 text-slate-400" aria-hidden="true" />
              <a href={`tel:${tenant.phone.replace(/\s/g, "")}`} className="money hover:underline">{tenant.phone}</a>
            </li>
            {tenant.email ? (
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-slate-400" aria-hidden="true" />
                <a href={`mailto:${tenant.email}`} className="truncate hover:underline">{tenant.email}</a>
              </li>
            ) : null}
            {tenant.profession ? <li className="text-slate-600">{tenant.profession}</li> : null}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Conditions du bail</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Loyer mensuel</dt>
              <dd className="money font-semibold">{formatMoney(lease.monthly_rent, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Charges</dt>
              <dd className="money font-semibold">{formatMoney(lease.charges_amount, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Caution</dt>
              <dd className="money font-semibold">{formatMoney(lease.deposit_amount, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Entrée · échéance</dt>
              <dd className="money font-semibold">
                {formatDate(lease.start_date)} · le {lease.due_day}
              </dd>
            </div>
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Situation</h2>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Total encaissé</dt>
              <dd className="money text-xl font-bold text-emerald-700">{formatMoney(totalPaid, currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reste dû</dt>
              <dd className={`money text-xl font-bold ${outstanding > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {formatMoney(outstanding, currency)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Historique des loyers</h2>
        <RentRollTable
          invoices={invoices}
          agency={agencyCard(agency)}
          appUrl={appUrl}
          showPeriod
          showFilters={false}
          emptyMessage="Aucune échéance n'a encore été générée pour ce bail."
        />
      </section>
    </div>
  );
}
