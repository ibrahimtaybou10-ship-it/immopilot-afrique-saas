import type { Metadata } from "next";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="page-title">Nouveau mot de passe</h1>
      <p className="page-sub">Choisissez le mot de passe que vous utiliserez désormais.</p>

      <div className="mt-6">
        <ActionForm action={resetPasswordAction} submitLabel="Enregistrer le mot de passe">
          <div>
            <label htmlFor="password" className="label">Nouveau mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="input" />
            <p className="hint">8 caractères minimum.</p>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
