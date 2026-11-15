"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Settings, Users, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/properties", label: "Biens", short: "Biens", icon: Building2, exact: false },
  { href: "/dashboard/tenants", label: "Locataires & baux", short: "Locataires", icon: Users, exact: false },
  { href: "/dashboard/rent-roll", label: "Collecte des loyers", short: "Loyers", icon: Wallet, exact: false },
  { href: "/dashboard/settings", label: "Paramètres", short: "Réglages", icon: Settings, exact: false },
];

const isActive = (pathname: string, href: string, exact: boolean) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1 px-3" aria-label="Navigation de l'espace">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              active ? "bg-brand-50 font-semibold text-brand-800" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre d'onglets fixe en bas d'écran sur mobile. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navigation de l'espace"
    >
      {ITEMS.map(({ href, short, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? "text-brand-700" : "text-slate-500"}`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
