import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="page-title">Mot de passe oublié</h1>
      <p className="page-sub">Indiquez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>

      <div className="mt-6">
        <ActionForm action={forgotPasswordAction} submitLabel="Envoyer le lien">
          <div>
            <label htmlFor="email" className="label">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="vous@agence.ci" />
          </div>
        </ActionForm>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
