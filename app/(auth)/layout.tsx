import { Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const POINTS = [
  "Échéances mensuelles générées automatiquement",
  "Relances SMS et WhatsApp en un clic",
  "Paiement Mobile Money et quittances PDF",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {!isSupabaseConfigured ? (
            <p className="alert-info mb-6">
              Configuration requise : renseignez les variables Supabase dans <code className="font-mono">.env.local</code>{" "}
              (voir <code className="font-mono">.env.example</code>) pour activer les comptes.
            </p>
          ) : null}
          {children}
        </div>
      </main>

      <aside className="relative hidden overflow-hidden bg-[#0b1020] text-white lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(50rem 28rem at 80% 0%, rgba(59,102,246,0.35), transparent 60%), radial-gradient(36rem 22rem at 0% 100%, rgba(16,185,129,0.18), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-balance">
            Vos loyers encaissés à l'heure, <span className="text-emerald-400">chaque mois.</span>
          </h2>
          <ul className="mt-8 space-y-4 text-slate-300">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
