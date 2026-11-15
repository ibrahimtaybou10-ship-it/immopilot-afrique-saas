import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { createLeaseAction } from "@/app/actions/leases";
import { LeaseFields, type VacantUnit } from "@/components/lease-fields";
import { ModalForm } from "@/components/modal-form";
import { StatusBadge } from "@/components/status-badge";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { currentPeriod, todayISO } from "@/lib/periods";
import type { InvoiceStatus, LeaseStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Locataires & baux" };

interface LeaseRow {
  id: string;
  lease_reference: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  charges_amount: number;
  deposit_amount: number;
  status: LeaseStatus;
  lease_tenants: { full_name: string; phone: string };
  units: { unit_number: string };
  properties: { name: string };
}

interface VacantRow {
  id: string;
  unit_number: string;
  base_rent: number;
  charges_amount: number;
  properties: { name: string };
}

export default async function TenantsPage() {
  const { supabase } = await requireSession();
  const period = currentPeriod();
  const today = todayISO();

  const [{ agency }, leasesRes, vacantRes, invoicesRes] = await Promise.all([
    getAgencyContext(),
    supabase
      .from("leases")
      .select(
        "id, lease_reference, start_date, end_date, monthly_rent, charges_amount, deposit_amount, status, lease_tenants!inner(full_name, phone), units!inner(unit_number), properties!inner(name)",
      )
      .order("status")
      .order("created_at", { ascending: false }),
    supabase
      .from("units")
      .select("id, unit_number, base_rent, charges_amount, properties!inner(name)")
      .eq("is_occupied", false),
    supabase.from("rent_payments").select("lease_id, status, due_date").eq("period_month", period),
  ]);

  const leases = (leasesRes.data ?? []) as unknown as LeaseRow[];
  const monthStatus = new Map(
    ((invoicesRes.data ?? []) as { lease_id: string; status: InvoiceStatus; due_date: string | null }[]).map((row) => [
      row.lease_id,
      row,
    ]),
  );
  const vacantUnits: VacantUnit[] = ((vacantRes.data ?? []) as unknown as VacantRow[])
    .map((unit) => ({
      id: unit.id,
      label: unit.unit_number,
      propertyName: unit.properties.name,
      baseRent: Number(unit.base_rent),
      charges: Number(unit.charges_amount),
    }))
    .sort((a, b) => `${a.propertyName} ${a.label}`.localeCompare(`${b.propertyName} ${b.label}`, "fr", { numeric: true }));

  const activeCount = leases.filter((lease) => lease.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="page-title">Locataires & baux</h1>
          <p className="page-sub">
            {activeCount} {activeCount > 1 ? "baux actifs" : "bail actif"} · {vacantUnits.length} lot
            {vacantUnits.length > 1 ? "s" : ""} libre{vacantUnits.length > 1 ? "s" : ""}
          </p>
        </div>
        {vacantUnits.length > 0 ? (
          <ModalForm
            trigger={
              <>
                <Plus className="size-4" aria-hidden="true" /> Nouveau bail
              </>
            }
            title="Nouveau locataire et bail"
            description="L'échéance du mois en cours est créée automatiquement."
            action={createLeaseAction}
            submitLabel="Créer le bail"
            size="lg"
          >
            <LeaseFields units={vacantUnits} defaultDueDay={agency.default_due_day} today={today} currency={agency.currency} />
          </ModalForm>
        ) : (
          <Link href="/dashboard/properties" className="btn btn-secondary">
            <Plus className="size-4" aria-hidden="true" /> Ajouter un lot libre
          </Link>
        )}
      </div>

      {leases.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Aucun bail pour l'instant</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {vacantUnits.length > 0
              ? "Créez votre premier bail pour rattacher un locataire à un lot."
              : "Commencez par ajouter un bien et ses lots, puis revenez créer un bail."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Locataire</th>
                  <th className="hidden md:table-cell">Bien & lot</th>
                  <th className="text-right">Loyer + charges</th>
                  <th className="hidden text-right lg:table-cell">Caution</th>
                  <th className="hidden sm:table-cell">Depuis</th>
                  <th>Ce mois-ci</th>
                  <th>
                    <span className="sr-only">Ouvrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leases.map((lease) => {
                  const month = monthStatus.get(lease.id);
                  return (
                    <tr key={lease.id} className={lease.status !== "ACTIVE" ? "opacity-60" : ""}>
                      <td>
                        <Link href={`/dashboard/tenants/${lease.id}`} className="font-semibold text-slate-900 hover:text-brand-800 hover:underline">
                          {lease.lease_tenants.full_name}
                        </Link>
                        <p className="money text-xs text-slate-500">{lease.lease_tenants.phone}</p>
                        <p className="text-xs text-slate-500 md:hidden">
                          {lease.properties.name} · {lease.units.unit_number}
                        </p>
                      </td>
                      <td className="hidden md:table-cell">
                        <p className="text-slate-700">{lease.properties.name}</p>
                        <p className="text-xs text-slate-500">{lease.units.unit_number}</p>
                      </td>
                      <td className="money text-right font-semibold whitespace-nowrap text-slate-900">
                        {formatMoney(Number(lease.monthly_rent) + Number(lease.charges_amount), "")}
                      </td>
                      <td className="money hidden text-right whitespace-nowrap text-slate-600 lg:table-cell">
                        {formatMoney(lease.deposit_amount, "")}
                      </td>
                      <td className="money hidden text-xs whitespace-nowrap text-slate-600 sm:table-cell">{formatDate(lease.start_date)}</td>
                      <td>
                        {lease.status !== "ACTIVE" ? (
                          <span className="badge badge-slate">Résilié</span>
                        ) : month ? (
                          <StatusBadge status={month.status} overdue={month.status !== "PAID" && (month.due_date ?? "") < today} />
                        ) : (
                          <span className="text-xs text-slate-400">Pas d'échéance</span>
                        )}
                      </td>
                      <td className="text-right">
                        <Link href={`/dashboard/tenants/${lease.id}`} className="btn btn-ghost btn-sm" aria-label={`Ouvrir le dossier de ${lease.lease_tenants.full_name}`}>
                          <ChevronRight className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
