import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// trim : un espace ou un retour à la ligne copié avec la clé rend les en-têtes HTTP invalides.
const serviceKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "").trim();

export const isAdminConfigured = () => Boolean(SUPABASE_URL && serviceKey());

/**
 * Client « service » : contourne la RLS. Réservé au webhook de paiement, à la tâche
 * planifiée et à l'initialisation d'un paiement public. Jamais importé côté navigateur.
 */
export function createAdminClient() {
  if (!isAdminConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
  }
  return createClient(SUPABASE_URL, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
