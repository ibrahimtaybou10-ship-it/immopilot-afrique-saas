import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Toaster } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { InstallPrompt } from "@/components/install-prompt";
import { Logo, LogoMark } from "@/components/logo";
import { MobileNav, SidebarNav } from "@/components/nav-links";
import { getAgencyContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { initials } from "@/lib/format";
import { PLANS, effectivePlan, trialDaysLeft } from "@/lib/plans";

// Données propres à chaque utilisateur : jamais de pré-rendu ni de cache partagé.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Espace de gestion", template: `%s · ${BRAND.name}` },
  robots: { index: false, follow: false },
};

/**
 * La mise en page ne bloque sur aucune donnée : la coquille (navigation) s'affiche tout de
 * suite et la page démarre ses requêtes en même temps que les blocs « agence » ci-dessous.
 * getAgencyContext() est mémorisé par requête : un seul appel réseau pour tous ces blocs.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Logo href="/dashboard" />
        </div>
        <div className="p-4">
          <Suspense fallback={<div className="h-[74px] animate-pulse rounded-xl bg-slate-100" />}>
            <AgencyCard />
          </Suspense>
        </div>
        <SidebarNav />
        <div className="mt-auto space-y-3 p-4">
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
            <AccountBlock />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* En-tête (mobile) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="size-8" />
            <Suspense fallback={<span className="h-4 w-28 animate-pulse rounded bg-slate-100" />}>
              <MobileAgencyName />
            </Suspense>
          </Link>
          <LogoutButton />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-8 lg:py-9">
          <InstallPrompt />
          {children}
        </main>
      </div>

      <MobileNav />
      <Toaster richColors closeButton position="top-center" />
    </div>
  );
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn btn-ghost btn-sm" title="Se déconnecter" aria-label="Se déconnecter">
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

async function AgencyCard() {
  const { agency } = await getAgencyContext();
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
      <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
        {agency.plan === "OWNER" ? "Bailleur" : "Agence"}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{agency.name}</p>
      <p className="truncate text-xs text-slate-500">{[agency.city, agency.country].filter(Boolean).join(" · ")}</p>
    </div>
  );
}

async function MobileAgencyName() {
  const { agency } = await getAgencyContext();
  return <span className="truncate text-sm font-bold text-slate-900">{agency.name}</span>;
}

async function AccountBlock() {
  const { agency, email, fullName } = await getAgencyContext();
  const plan = PLANS[effectivePlan(agency)];
  const daysLeft = trialDaysLeft(agency);
  const displayName = fullName || email;

  return (
    <>
      <Link href="/dashboard/settings" className="block rounded-xl bg-[#0b1020] p-3.5 text-white transition hover:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Offre {plan.name}</span>
          {daysLeft > 0 ? (
            <span className="money rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
              ESSAI · {daysLeft} J
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          {plan.maxUnits === null ? "Lots illimités" : `Jusqu'à ${plan.maxUnits} lots`} · gérer l'abonnement
        </p>
      </Link>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
          {initials(displayName) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
        <LogoutButton />
      </div>
    </>
  );
}
