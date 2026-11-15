"use server";

import { revalidatePath } from "next/cache";
import { fail, formObject } from "@/lib/action-utils";
import { getAgencyContext } from "@/lib/auth";
import { getAgencyCredentials } from "@/lib/payments/accounts";
import { SECRET_KEY_RE, keyHint, validateKey } from "@/lib/payments/saspay";
import { createAdminClient, serviceKeyIssue } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/**
 * Enregistre le compte SasPay de l'agence : les loyers payés en ligne arriveront sur CE compte.
 * La clé est vérifiée auprès de SasPay puis chiffrée dans Supabase Vault ; elle n'est jamais
 * renvoyée au navigateur ni écrite dans les journaux.
 */
export async function saveSaspayAccountAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { agency, role, userId } = await getAgencyContext();
  if (role !== "OWNER" && role !== "ADMIN") return fail("Seul un administrateur de l'agence peut configurer l'encaissement.");

  const keyIssue = serviceKeyIssue();
  if (keyIssue) return fail(`Configuration de la plateforme incomplète : ${keyIssue}`);

  const values = formObject(formData);
  let secretKey = (values.secret_key ?? "").trim();
  const webhookSecret = (values.webhook_secret ?? "").trim();
  const admin = createAdminClient();

  // Clé laissée vide : on conserve celle déjà enregistrée (mise à jour du seul secret webhook).
  if (!secretKey) {
    const existing = await getAgencyCredentials(admin, agency.id);
    if (!existing) return fail("Collez la clé secrète de votre compte SasPay (elle commence par sk_live_ ou sk_test_).");
    if (!webhookSecret) return fail("Rien à enregistrer : renseignez une nouvelle clé ou un secret de webhook.");
    secretKey = existing.secretKey;
  } else if (!SECRET_KEY_RE.test(secretKey)) {
    return fail("Format de clé invalide : collez la clé secrète complète, qui commence par sk_live_ ou sk_test_ (pas la clé publique pk_…).");
  }
  if (webhookSecret && (webhookSecret.length < 8 || !/^[\x21-\x7e]+$/.test(webhookSecret))) {
    return fail("Secret de webhook invalide : recopiez-le tel qu'affiché par SasPay, sans espace.");
  }

  const check = await validateKey(secretKey);
  if (!check.ok) return fail(check.error);

  const { error } = await admin.rpc("set_agency_saspay_account", {
    p_agency: agency.id,
    p_secret_key: secretKey,
    p_webhook_secret: webhookSecret || null,
    p_key_hint: keyHint(secretKey),
    p_mode: secretKey.startsWith("sk_live_") ? "LIVE" : "TEST",
    p_user: userId,
  });
  if (error) {
    console.error("[saspay] enregistrement du compte de l'agence impossible :", error.code ?? "", error.message);
    return fail("Impossible d'enregistrer le compte d'encaissement. Réessayez.");
  }

  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    message: secretKey.startsWith("sk_test_")
      ? "Compte SasPay de test enregistré : les locataires peuvent payer en ligne, sans argent réel."
      : "Compte SasPay enregistré : les loyers payés en ligne arriveront directement sur votre compte.",
  };
}

/** Retire le compte d'encaissement de l'agence : le paiement en ligne des loyers est désactivé. */
export async function removeSaspayAccountAction(): Promise<ActionResult> {
  const { agency, role } = await getAgencyContext();
  if (role !== "OWNER" && role !== "ADMIN") return fail("Seul un administrateur de l'agence peut modifier l'encaissement.");
  if (serviceKeyIssue()) return fail("Configuration de la plateforme incomplète.");

  const { error } = await createAdminClient().rpc("delete_agency_saspay_account", { p_agency: agency.id });
  if (error) return fail("Impossible de retirer le compte d'encaissement. Réessayez.");

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Compte SasPay retiré : le paiement en ligne des loyers est désactivé." };
}
