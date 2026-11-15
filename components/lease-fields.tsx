"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

export interface VacantUnit {
  id: string;
  label: string;
  propertyName: string;
  baseRent: number;
  charges: number;
}

interface Props {
  units: VacantUnit[];
  defaultDueDay: number;
  today: string;
  currency: string;
}

/** Champs du formulaire « Nouveau bail » : le choix du lot pré-remplit loyer, charges et caution. */
export function LeaseFields({ units, defaultDueDay, today, currency }: Props) {
  const first = units[0];
  const [unitId, setUnitId] = useState(first?.id ?? "");
  const [rent, setRent] = useState(String(first?.baseRent ?? 0));
  const [charges, setCharges] = useState(String(first?.charges ?? 0));
  const [deposit, setDeposit] = useState(String((first?.baseRent ?? 0) * 2));

  function selectUnit(id: string) {
    setUnitId(id);
    const unit = units.find((u) => u.id === id);
    if (unit) {
      setRent(String(unit.baseRent));
      setCharges(String(unit.charges));
      setDeposit(String(unit.baseRent * 2));
    }
  }

  const groups = Array.from(new Set(units.map((u) => u.propertyName)));

  return (
    <>
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-900">Locataire</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lease-name" className="label">Nom complet</label>
            <input id="lease-name" name="full_name" required maxLength={100} className="input" placeholder="Fatou Bamba" />
          </div>
          <div>
            <label htmlFor="lease-phone" className="label">Téléphone</label>
            <input id="lease-phone" name="phone" type="tel" required className="input money" placeholder="+225 07 09 44 55 66" />
          </div>
          <div>
            <label htmlFor="lease-email" className="label">E-mail (facultatif)</label>
            <input id="lease-email" name="email" type="email" className="input" />
          </div>
          <div>
            <label htmlFor="lease-profession" className="label">Profession (facultatif)</label>
            <input id="lease-profession" name="profession" maxLength={100} className="input" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-4">
        <legend className="sr-only">Bail</legend>
        <p className="text-sm font-bold text-slate-900">Bail</p>
        <div>
          <label htmlFor="lease-unit" className="label">Lot loué</label>
          <select id="lease-unit" name="unit_id" required className="input" value={unitId} onChange={(e) => selectUnit(e.target.value)}>
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {units
                  .filter((u) => u.propertyName === group)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label} — {formatMoney(u.baseRent, currency)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="lease-rent" className="label">Loyer mensuel</label>
            <input id="lease-rent" name="monthly_rent" type="number" inputMode="numeric" min={0} step={1} required className="input money" value={rent} onChange={(e) => setRent(e.target.value)} />
          </div>
          <div>
            <label htmlFor="lease-charges" className="label">Charges</label>
            <input id="lease-charges" name="charges_amount" type="number" inputMode="numeric" min={0} step={1} required className="input money" value={charges} onChange={(e) => setCharges(e.target.value)} />
          </div>
          <div>
            <label htmlFor="lease-deposit" className="label">Caution</label>
            <input id="lease-deposit" name="deposit_amount" type="number" inputMode="numeric" min={0} step={1} required className="input money" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lease-start" className="label">Date d'entrée</label>
            <input id="lease-start" name="start_date" type="date" required className="input money" defaultValue={today} />
          </div>
          <div>
            <label htmlFor="lease-due" className="label">Jour d'échéance</label>
            <input id="lease-due" name="due_day" type="number" min={1} max={28} required className="input money" defaultValue={defaultDueDay} />
            <p className="hint">Jour du mois où le loyer est attendu (1 à 28).</p>
          </div>
        </div>
      </fieldset>
    </>
  );
}
