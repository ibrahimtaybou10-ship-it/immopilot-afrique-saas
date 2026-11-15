import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Connexion" };

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="page-title">Connexion</h1>
      <p className="page-sub">Accédez à votre espace de gestion locative.</p>

      {error ? (
        <p role="alert" className="alert-error mt-6">
          Ce lien n'est plus valide. Connectez-vous ou demandez un nouveau lien.
        </p>
      ) : null}

      <div className="mt-6">
        <ActionForm action={loginAction} submitLabel="Se connecter">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div>
            <label htmlFor="email" className="label">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="vous@agence.ci" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="label">Mot de passe</label>
              <Link href="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
        </ActionForm>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Créer un compte gratuit
        </Link>
      </p>
    </>
  );
}
