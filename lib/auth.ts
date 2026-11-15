import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import type { Agency } from "./types";

interface Claims {
  sub?: string;
  email?: string;
  user_metadata?: { full_name?: string; agency_name?: string; account_type?: string; country?: string };
}

/**
 * Session courante, mémorisée pour la durée de la requête (layout + page = 1 seule vérification).
 * getClaims() valide le JWT localement quand le projet utilise des clés asymétriques :
 * pas d'aller-retour réseau vers le serveur d'authentification à chaque page.
 */
export const getSession = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Claims | undefined;
  if (!claims?.sub) return null;

  return {
    supabase,
    userId: claims.sub,
    email: claims.email ?? "",
    fullName: claims.user_metadata?.full_name ?? "",
    metadata: claims.user_metadata ?? {},
  };
});

/** Session obligatoire (aucun appel réseau : le jeton est validé localement). */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Session + agence de l'utilisateur. Redirige vers /login ou /onboarding si nécessaire.
 * À lancer EN PARALLÈLE des requêtes de la page (Promise.all) : la RLS cloisonne déjà les
 * données par agence, il est donc inutile d'attendre l'identifiant de l'agence pour interroger.
 */
export const getAgencyContext = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data } = await session.supabase
    .from("agency_members")
    .select("role, agencies(*)")
    .eq("user_id", session.userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const agency = (data?.agencies ?? null) as unknown as Agency | null;
  if (!agency) redirect("/onboarding");

  return { ...session, role: (data?.role ?? "ADMIN") as string, agency };
});
