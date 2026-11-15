import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, Plus } from "lucide-react";
import { createPropertyAction } from "@/app/actions/properties";
import { ModalForm } from "@/components/modal-form";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { PROPERTY_TYPES, UNIT_TYPES, formatMoney, percent } from "@/lib/format";
import { PLANS, effectivePlan } from "@/lib/plans";
import type { Property } from "@/lib/types";

export const metadata: Metadata = { title: "Biens" };

export default async function PropertiesPage() {
  const { supabase } = await requireSession();
  const [{ agency }, { data }] = await Promise.all([
    getAgencyContext(),
    supabase
      .from("properties")
      .select("id, name, property_type, address, city, total_units, occupied_units, monthly_expected_revenue")
      .order("created_at", { ascending: false }),
  ]);

  const properties = (data ?? []) as Property[];
  const plan = PLANS[effectivePlan(agency)];
  const totalUnits = properties.reduce((sum, p) => sum + p.total_units, 0);

  const addButton = (
    <ModalForm
      trigger={
        <>
          <Plus className="size-4" aria-hidden="true" /> Ajouter un bien
        </>
      }
      title="Ajouter un bien"
      description="Les lots sont créés d'un coup ; vous pourrez ajuster chacun ensuite."
      action={createPropertyAction}
      submitLabel="Créer le bien"
      size="lg"
    >
      <div>
        <label htmlFor="prop-name" className="label">Nom du bien</label>
        <input id="prop-name" name="name" required maxLength={100} className="input" placeholder="Résidence Les Flamboyants" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="prop-type" className="label">Type de bien</label>
          <select id="prop-type" name="property_type" className="input" defaultValue="IMMEUBLE">
            {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="prop-city" className="label">Ville</label>
          <input id="prop-city" name="city" required maxLength={60} className="input" defaultValue={agency.city ?? "Abidjan"} />
        </div>
      </div>
      <div>
        <label htmlFor="prop-address" className="label">Adresse / quartier</label>
        <input id="prop-address" name="address" required maxLength={160} className="input" placeholder="Rue des Jardins, Cocody Vallon" />
      </div>
      <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <label htmlFor="prop-units" className="label">Nombre de lots</label>
          <input id="prop-units" name="units_count" type="number" min={1} max={200} required className="input money" defaultValue={1} />
        </div>
        <div>
          <label htmlFor="prop-unit-type" className="label">Type des lots</label>
          <select id="prop-unit-type" name="unit_type" className="input" defaultValue="F3">
            {Object.entries(UNIT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="prop-rent" className="label">Loyer mensuel par lot ({agency.currency})</label>
          <input id="prop-rent" name="base_rent" type="number" inputMode="numeric" min={0} step={1} required className="input money" placeholder="150000" />
        </div>
        <div>
          <label htmlFor="prop-charges" className="label">Charges par lot ({agency.currency})</label>
          <input id="prop-charges" name="charges_amount" type="number" inputMode="numeric" min={0} step={1} required className="input money" defaultValue={0} />
        </div>
      </div>
    </ModalForm>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="page-title">Biens</h1>
          <p className="page-sub">
            {properties.length} bien{properties.length > 1 ? "s" : ""} · {totalUnits} lot{totalUnits > 1 ? "s" : ""}
            {plan.maxUnits !== null ? ` sur ${plan.maxUnits} inclus dans l'offre ${plan.name}` : ""}
          </p>
        </div>
        {addButton}
      </div>

      {properties.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Aucun bien pour l'instant</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Ajoutez votre premier immeuble, villa ou local commercial pour commencer à suivre vos loyers.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const occupancy = percent(property.occupied_units, property.total_units);
            return (
              <Link
                key={property.id}
                href={`/dashboard/properties/${property.id}`}
                className="card group flex flex-col p-5 transition hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="badge badge-slate">{PROPERTY_TYPES[property.property_type] ?? property.property_type}</span>
                  <span className="money text-xs font-bold text-slate-700">{occupancy}% occupé</span>
                </div>
                <h2 className="mt-3 text-base font-bold text-slate-900 group-hover:text-brand-800">{property.name}</h2>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {property.address}, {property.city}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${occupancy}%` }} />
                </div>
                <dl className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4 text-xs">
                  <div>
                    <dt className="font-semibold tracking-wider text-slate-400 uppercase">Lots loués</dt>
                    <dd className="money mt-0.5 text-sm font-bold text-slate-800">
                      {property.occupied_units} / {property.total_units}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="font-semibold tracking-wider text-slate-400 uppercase">Revenu mensuel</dt>
                    <dd className="money mt-0.5 text-sm font-bold text-brand-800">
                      {formatMoney(property.monthly_expected_revenue, agency.currency)}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
