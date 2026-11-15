import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAgencyAction, logoutAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { getSession } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bienvenue" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data: membership } = await session.supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", session.userId)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/dashboard");

  return (
    <>
      <h1 className="page-title">Bienvenue{session.fullName ? `, ${session.fullName.split(" ")[0]}` : ""}</h1>
      <p className="page-sub">Une dernière étape : présentez votre agence. Ces informations figureront sur vos quittances.</p>

      <div className="mt-6">
        <ActionForm action={createAgencyAction} submitLabel="Ouvrir mon espace">
          <div>
            <label htmlFor="agency_name" className="label">Nom de l'agence ou du bailleur</label>
            <input
              id="agency_name"
              name="agency_name"
              required
              maxLength={80}
              className="input"
              defaultValue={session.metadata.agency_name ?? ""}
              placeholder="Koffi & Associés Immobilier"
            />
          </div>
          <div>
            <label htmlFor="account_type" className="label">Vous êtes</label>
            <select id="account_type" name="account_type" className="input" defaultValue={session.metadata.account_type === "OWNER" ? "OWNER" : "AGENCY"}>
              <option value="AGENCY">Une agence immobilière</option>
              <option value="OWNER">Un propriétaire bailleur</option>
            </select>
          </div>
          <div>
            <label htmlFor="country" className="label">Pays</label>
            <select id="country" name="country" required className="input" defaultValue={session.metadata.country ?? ""}>
              <option value="" disabled>Choisir…</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="label">Ville</label>
              <input id="city" name="city" maxLength={60} className="input" />
            </div>
            <div>
              <label htmlFor="phone" className="label">Téléphone</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" placeholder="+225 07 08 11 22 33" />
            </div>
          </div>
        </ActionForm>
      </div>

      <form action={logoutAction} className="mt-6">
        <button type="submit" className="text-sm font-semibold text-slate-500 hover:text-slate-900 hover:underline">
          Se déconnecter ({session.email})
        </button>
      </form>
    </>
  );
}
