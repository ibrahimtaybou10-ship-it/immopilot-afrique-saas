import type { Metadata } from "next";
import Link from "next/link";
import { signupAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { COUNTRIES } from "@/lib/countries";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
  return (
    <>
      <h1 className="page-title">Créer votre compte</h1>
      <p className="page-sub">{TRIAL_DAYS} jours d'essai de l'offre Pro, sans carte bancaire.</p>

      <div className="mt-6">
        <ActionForm action={signupAction} submitLabel="Créer mon compte">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className="label">Votre nom</label>
              <input id="full_name" name="full_name" autoComplete="name" required maxLength={80} className="input" placeholder="Awa Koffi" />
            </div>
            <div>
              <label htmlFor="account_type" className="label">Vous êtes</label>
              <select id="account_type" name="account_type" className="input" defaultValue="AGENCY">
                <option value="AGENCY">Une agence immobilière</option>
                <option value="OWNER">Un propriétaire bailleur</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <div>
              <label htmlFor="agency_name" className="label">Nom de l'agence ou du bailleur</label>
              <input id="agency_name" name="agency_name" autoComplete="organization" required maxLength={80} className="input" placeholder="Koffi & Associés Immobilier" />
            </div>
            <div>
              <label htmlFor="country" className="label">Pays</label>
              <select id="country" name="country" required className="input" defaultValue="">
                <option value="" disabled>Choisir…</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="email" className="label">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="vous@agence.ci" />
          </div>
          <div>
            <label htmlFor="password" className="label">Mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="input" />
            <p className="hint">8 caractères minimum.</p>
          </div>
        </ActionForm>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
