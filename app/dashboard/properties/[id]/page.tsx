import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Plus, Trash2 } from "lucide-react";
import { createUnitAction, deletePropertyAction, deleteUnitAction } from "@/app/actions/properties";
import { ActionButton } from "@/components/action-button";
import { ModalForm } from "@/components/modal-form";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { PROPERTY_TYPES, UNIT_TYPES, formatMoney } from "@/lib/format";
import type { Property } from "@/lib/types";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Détail du bien" };

interface UnitRow {
  id: string;
  unit_number: string;
  unit_type: string;
  base_rent: number;
  charges_amount: number;
  is_occupied: boolean;
  leases: { id: string; status: string; lease_tenants: { full_name: string } | null }[];
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { supabase } = await requireSession();
  const [{ agency }, propertyRes, unitsRes] = await Promise.all([
    getAgencyContext(),
    supabase
      .from("properties")
      .select("id, name, property_type, address, city, total_units, occupied_units, monthly_expected_revenue")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("units")
      .select("id, unit_number, unit_type, base_rent, charges_amount, is_occupied, leases(id, status, lease_tenants(full_name))")
      .eq("property_id", id),
  ]);

  const property = propertyRes.data as Property | null;
  if (!property) notFound();

  const units = ((unitsRes.data ?? []) as unknown as UnitRow[]).sort((a, b) =>
    a.unit_number.localeCompare(b.unit_number, "fr", { numeric: true }),
  );

  return (
    <div className="space-y-6">
      <Link href="/dashboard/properties" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ChevronLeft className="size-4" aria-hidden="true" /> Tous les biens
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <span className="badge badge-slate">{PROPERTY_TYPES[property.property_type] ?? property.property_type}</span>
          <h1 className="page-title mt-2">{property.name}</h1>
          <p className="page-sub flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {property.address}, {property.city}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModalForm
            trigger={
              <>
                <Plus className="size-4" aria-hidden="true" /> Ajouter un lot
              </>
            }
            title="Ajouter un lot"
            description={property.name}
            action={createUnitAction}
            submitLabel="Ajouter le lot"
          >
            <input type="hidden" name="property_id" value={property.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="unit-number" className="label">Référence du lot</label>
                <input id="unit-number" name="unit_number" required maxLength={40} className="input" placeholder="Appartement B4" />
              </div>
              <div>
                <label htmlFor="unit-type" className="label">Type</label>
                <select id="unit-type" name="unit_type" className="input" defaultValue="F3">
                  {Object.entries(UNIT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="unit-rent" className="label">Loyer mensuel ({agency.currency})</label>
                <input id="unit-rent" name="base_rent" type="number" inputMode="numeric" min={0} step={1} required className="input money" />
              </div>
              <div>
                <label htmlFor="unit-charges" className="label">Charges ({agency.currency})</label>
                <input id="unit-charges" name="charges_amount" type="number" inputMode="numeric" min={0} step={1} required className="input money" defaultValue={0} />
              </div>
            </div>
          </ModalForm>
          <ActionButton
            action={deletePropertyAction.bind(null, property.id)}
            confirm={`Supprimer définitivement « ${property.name} » et ses lots ? Cette action est irréversible.`}
            className="btn btn-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Supprimer
          </ActionButton>
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Lots</dt>
          <dd className="money mt-2 text-2xl font-bold text-slate-900">{property.total_units}</dd>
        </div>
        <div className="card p-5">
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Lots loués</dt>
          <dd className="money mt-2 text-2xl font-bold text-slate-900">
            {property.occupied_units} <span className="text-base font-medium text-slate-400">/ {property.total_units}</span>
          </dd>
        </div>
        <div className="card p-5">
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Revenu mensuel loué</dt>
          <dd className="money mt-2 text-2xl font-bold text-brand-800">
            {formatMoney(property.monthly_expected_revenue, agency.currency)}
          </dd>
        </div>
      </dl>

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-bold text-slate-900">Lots</h2>
        {units.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Ce bien n'a pas encore de lot.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th className="hidden sm:table-cell">Type</th>
                  <th className="text-right">Loyer</th>
                  <th className="hidden text-right sm:table-cell">Charges</th>
                  <th>Occupation</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const activeLease = unit.leases.find((lease) => lease.status === "ACTIVE");
                  return (
                    <tr key={unit.id}>
                      <td className="font-semibold text-slate-900">{unit.unit_number}</td>
                      <td className="hidden text-slate-600 sm:table-cell">{UNIT_TYPES[unit.unit_type] ?? unit.unit_type}</td>
                      <td className="money text-right font-semibold whitespace-nowrap">{formatMoney(unit.base_rent, "")}</td>
                      <td className="money hidden text-right whitespace-nowrap text-slate-600 sm:table-cell">
                        {formatMoney(unit.charges_amount, "")}
                      </td>
                      <td>
                        {activeLease ? (
                          <Link href={`/dashboard/tenants/${activeLease.id}`} className="badge badge-green hover:underline">
                            {activeLease.lease_tenants?.full_name ?? "Loué"}
                          </Link>
                        ) : (
                          <span className="badge badge-amber">Libre</span>
                        )}
                      </td>
                      <td className="text-right">
                        {unit.leases.length === 0 ? (
                          <ActionButton
                            action={deleteUnitAction.bind(null, unit.id)}
                            confirm={`Supprimer le lot « ${unit.unit_number} » ?`}
                            className="btn btn-ghost btn-sm text-rose-700 hover:bg-rose-50"
                            title="Supprimer ce lot"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            <span className="sr-only">Supprimer</span>
                          </ActionButton>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
