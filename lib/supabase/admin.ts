import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// trim : un espace ou un retour à la ligne copié avec la clé rend les en-têtes HTTP invalides.
const serviceKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "").trim();

/**
 * Diagnostic de la clé serveur, sans jamais en révéler la valeur.
 * Renvoie null si le format est plausible, sinon une explication à afficher à l'administrateur.
 */
export function serviceKeyIssue(): string | null {
  const key = serviceKey();
  if (!key) return "La variable SUPABASE_SERVICE_ROLE_KEY est absente dans Vercel.";
  if (!/^[\x21-\x7e]+$/.test(key)) {
    return "La clé SUPABASE_SERVICE_ROLE_KEY contient un caractère invalide (accent, espace ou retour à la ligne au milieu) : recopiez-la depuis Supabase.";
  }
  if (key.startsWith("sb_publishable_")) {
    return "SUPABASE_SERVICE_ROLE_KEY contient la clé publique (sb_publishable_…) : il faut la clé secrète (sb_secret_… ou service_role).";
  }
  if (key.startsWith("sb_secret_")) return null;
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8")) as { role?: string };
      if (payload.role === "service_role") return null;
      return `SUPABASE_SERVICE_ROLE_KEY contient une clé de rôle « ${payload.role ?? "inconnu"} » : il faut la clé service_role.`;
    } catch {
      return "La clé SUPABASE_SERVICE_ROLE_KEY est incomplète ou mal copiée : recopiez-la depuis Supabase.";
    }
  }
  return "La valeur de SUPABASE_SERVICE_ROLE_KEY ne ressemble pas à une clé Supabase (sb_secret_… ou eyJ…).";
}

export const isAdminConfigured = () => Boolean(SUPABASE_URL && serviceKey()) && serviceKeyIssue() === null;

/**
 * Client « service » : contourne la RLS. Réservé au webhook de paiement, à la tâche
 * planifiée et à l'initialisation d'un paiement public. Jamais importé côté navigateur.
 */
export function createAdminClient() {
  if (!isAdminConfigured()) {
    throw new Error(serviceKeyIssue() ?? "SUPABASE_SERVICE_ROLE_KEY manquant");
  }
  return createClient(SUPABASE_URL, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
