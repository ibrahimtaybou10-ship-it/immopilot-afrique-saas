import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-sm ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
        <path d="m9 15 2.2 2.2L15.5 13" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label={`${BRAND.name} — accueil`}>
      <LogoMark />
      <span className={`text-[17px] font-extrabold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        {BRAND.name}
      </span>
    </Link>
  );
}
