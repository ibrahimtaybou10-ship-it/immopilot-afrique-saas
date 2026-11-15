import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/url";

/**
 * Retour des liens envoyés par e-mail (confirmation d'inscription, mot de passe oublié).
 * Gère les deux formats Supabase : ?code=… (PKCE) et ?token_hash=…&type=….
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;

    let ok = false;
    if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && type) {
      ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    }

    if (ok) {
      // Inscription confirmée : crée l'agence saisie à l'inscription (sans effet si elle existe déjà).
      const { data } = await supabase.auth.getUser();
      const meta = data.user?.user_metadata as
        | { agency_name?: string; account_type?: string; country?: string }
        | undefined;
      // Sans pays connu, on laisse l'utilisateur compléter le formulaire d'onboarding.
      if (meta?.agency_name && meta.country && next.startsWith("/onboarding")) {
        const { error } = await supabase.rpc("create_agency", {
          p_name: meta.agency_name,
          p_account_type: meta.account_type ?? "AGENCY",
          p_country: meta.country,
        });
        if (!error) return NextResponse.redirect(`${origin}/dashboard`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=lien`);
}
