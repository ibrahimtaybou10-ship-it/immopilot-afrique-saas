"use server";

import { redirect } from "next/navigation";
import { dbError, fail, firstIssue, formObject } from "@/lib/action-utils";
import { getSession } from "@/lib/auth";
import { CONFIG_ERROR, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { getAppUrl, safeNext } from "@/lib/url";
import { loginSchema, onboardingSchema, passwordSchema, signupSchema } from "@/lib/validation";

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (!isSupabaseConfigured) return fail(CONFIG_ERROR);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return fail(
      error.code === "email_not_confirmed"
        ? "Confirmez d'abord votre adresse e-mail grâce au lien que nous vous avons envoyé."
        : "E-mail ou mot de passe incorrect.",
    );
  }
  redirect(safeNext(formData.get("next")));
}

export async function signupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (!isSupabaseConfigured) return fail(CONFIG_ERROR);

  const { email, password, full_name, agency_name, account_type, country } = parsed.data;
  const supabase = await createClient();
  const appUrl = await getAppUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
      data: { full_name, agency_name, account_type, country },
    },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        return fail("Un compte existe déjà avec cette adresse e-mail. Connectez-vous.");
      case "weak_password":
        return fail("Mot de passe trop faible : choisissez-en un plus long ou moins courant.");
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return fail("Trop de tentatives. Patientez quelques minutes avant de réessayer.");
      default:
        return fail("Inscription impossible pour le moment. Réessayez plus tard.");
    }
  }
  // Supabase masque les doublons : un utilisateur sans identité signifie « e-mail déjà inscrit ».
  if (data.user && data.user.identities?.length === 0) {
    return fail("Un compte existe déjà avec cette adresse e-mail. Connectez-vous.");
  }
  if (!data.session) {
    return {
      ok: true,
      message: "Compte créé. Ouvrez l'e-mail de confirmation que nous venons de vous envoyer, puis connectez-vous.",
    };
  }

  await supabase.rpc("create_agency", { p_name: agency_name, p_account_type: account_type, p_country: country });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.pick({ email: true }).safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (!isSupabaseConfigured) return fail(CONFIG_ERROR);

  const supabase = await createClient();
  const appUrl = await getAppUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });
  // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
  return {
    ok: true,
    message: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.",
  };
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const session = await getSession();
  if (!session) return fail("Lien expiré. Recommencez la procédure de réinitialisation.");

  const { error } = await session.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(
      error.code === "same_password"
        ? "Choisissez un mot de passe différent de l'ancien."
        : "Impossible de modifier le mot de passe. Réessayez.",
    );
  }
  redirect("/dashboard");
}

export async function createAgencyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const session = await getSession();
  if (!session) redirect("/login");

  const { error } = await session.supabase.rpc("create_agency", {
    p_name: parsed.data.agency_name,
    p_account_type: parsed.data.account_type,
    p_city: parsed.data.city,
    p_phone: parsed.data.phone,
    p_country: parsed.data.country,
  });
  if (error) return fail(dbError(error));
  redirect("/dashboard");
}
