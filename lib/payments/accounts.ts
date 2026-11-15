import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface AgencyCredentials {
  secretKey: string;
  webhookSecret: string | null;
}

/**
 * Clés SasPay déchiffrées d'une agence (Supabase Vault), ou null si l'agence n'a pas
 * configuré son propre compte. À n'utiliser que côté serveur, jamais à renvoyer au navigateur.
 */
export async function getAgencyCredentials(admin: AdminClient, agencyId: string): Promise<AgencyCredentials | null> {
  const { data, error } = await admin.rpc("get_agency_saspay_credentials", { p_agency: agencyId });
  if (error) {
    console.error("[saspay] lecture des clés de l'agence impossible :", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { secret_key?: string | null; webhook_secret?: string | null } | undefined;
  if (!row?.secret_key) return null;
  return { secretKey: row.secret_key.trim(), webhookSecret: row.webhook_secret?.trim() || null };
}
