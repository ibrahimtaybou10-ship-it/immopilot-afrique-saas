import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarCheck,
  Check,
  FileText,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { PLANS, PLAN_ORDER, TRIAL_DAYS } from "@/lib/plans";

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Échéances générées chaque mois",
    text: "Le 1er du mois, chaque bail actif reçoit son échéance, sans doublon possible. Vous n'avez plus de tableau à recopier.",
  },
  {
    icon: BellRing,
    title: "Relances SMS et WhatsApp",
    text: "Relancez un locataire en un clic, ou laissez les rappels partir automatiquement avant et après la date d'échéance.",
  },
  {
    icon: Smartphone,
    title: "Paiement Mobile Money",
    text: "Chaque échéance a son lien de paiement sécurisé : Wave, Orange Money, MTN MoMo, Moov Money ou carte bancaire.",
  },
  {
    icon: Wallet,
    title: "Encaissements partiels et complets",
    text: "Espèces, virement, chèque ou Mobile Money : chaque versement est journalisé et le reste à payer se met à jour.",
  },
  {
    icon: FileText,
    title: "Quittances PDF numérotées",
    text: "Dès qu'un loyer est soldé, la quittance est disponible en PDF, avec les coordonnées de votre agence.",
  },
  {
    icon: ShieldCheck,
    title: "Données cloisonnées par agence",
    text: "Chaque agence ne voit que ses biens, ses locataires et ses loyers. L'isolation est appliquée dans la base de données.",
  },
];

const STEPS = [
  { title: "Ajoutez vos biens", text: "Immeubles, villas, magasins : créez vos lots avec leur loyer et leurs charges." },
  { title: "Enregistrez vos baux", text: "Un locataire, un lot, un loyer, un jour d'échéance. La première échéance est créée aussitôt." },
  { title: "Encaissez et suivez", text: "Relancez, encaissez, délivrez la quittance. Le tableau de bord montre ce qui reste dû." },
];

const FAQ = [
  {
    q: "Faut-il une carte bancaire pour essayer ?",
    a: `Non. L'inscription ouvre ${TRIAL_DAYS} jours d'essai de l'offre Pro, sans moyen de paiement. À la fin de l'essai, votre compte passe sur l'offre Starter gratuite et vos données sont conservées.`,
  },
  {
    q: "Mes locataires doivent-ils créer un compte ?",
    a: "Non. Ils reçoivent un lien par SMS ou WhatsApp qui ouvre directement leur échéance : montant, détail, paiement et quittance.",
  },
  {
    q: "Puis-je encaisser en espèces ?",
    a: "Oui. L'encaissement manuel couvre les espèces, le virement, le chèque et le Mobile Money reçu directement. Le paiement en ligne est une option en plus.",
  },
  {
    q: "Que se passe-t-il si un locataire paie en plusieurs fois ?",
    a: "Chaque versement est enregistré. L'échéance passe en « partiel » puis en « payé » lorsque le solde est atteint, et la quittance est alors numérotée.",
  },
];

const PREVIEW_ROWS = [
  { name: "A. Koné", unit: "Rés. Les Orchidées · A1", amount: 350000, status: "Payé", tone: "badge-green" },
  { name: "F. Bamba", unit: "Rés. Les Orchidées · B4", amount: 280000, status: "Partiel", tone: "badge-amber" },
  { name: "Y. Traoré", unit: "Villa Riviera 3", amount: 900000, status: "En retard", tone: "badge-red" },
  { name: "M. Diallo", unit: "Plateau · Bureau 12", amount: 450000, status: "Payé", tone: "badge-green" },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      {/* En-tête + accroche */}
      <div className="relative overflow-hidden bg-[#0b1020] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60rem 30rem at 15% -10%, rgba(59,102,246,0.35), transparent 60%), radial-gradient(40rem 24rem at 95% 10%, rgba(16,185,129,0.18), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo light />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex" aria-label="Navigation principale">
            <a href="#fonctionnalites" className="hover:text-white">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-white">Tarifs</a>
            <a href="#faq" className="hover:text-white">Questions</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-sm px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
              Se connecter
            </Link>
            <Link href="/signup" className="btn btn-accent btn-sm px-3.5 py-2 text-sm">
              Essai gratuit
            </Link>
          </div>
        </header>

        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Gestion locative pour l'Afrique francophone · FCFA
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
              Vos loyers encaissés à l'heure, <span className="text-emerald-400">chaque mois.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              {BRAND.name} génère les échéances, relance les locataires par SMS et WhatsApp, encaisse par Mobile Money et
              délivre les quittances. Vous gardez l'œil sur ce qui reste dû.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-accent px-6 py-3 text-base">
                Démarrer gratuitement <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a href="#tarifs" className="btn border border-white/20 px-6 py-3 text-base text-white hover:bg-white/10">
                Voir les tarifs
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              {TRIAL_DAYS} jours d'essai de l'offre Pro · sans carte bancaire · offre gratuite jusqu'à {PLANS.STARTER.maxUnits} lots
            </p>
          </div>

          {/* Aperçu illustratif du produit */}
          <div className="relative" aria-hidden="true">
            <div className="rounded-2xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Collecte des loyers</p>
                <span className="badge badge-slate">Exemple · Novembre</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {[
                  { label: "Attendu", value: "1 980 000", tone: "text-slate-900" },
                  { label: "Encaissé", value: "1 080 000", tone: "text-emerald-700" },
                  { label: "Reste dû", value: "900 000", tone: "text-rose-600" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{kpi.label}</p>
                    <p className={`money mt-1 text-sm font-bold sm:text-base ${kpi.tone}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[55%] rounded-full bg-emerald-500" />
              </div>
              <ul className="mt-4 divide-y divide-slate-100">
                {PREVIEW_ROWS.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.name}</p>
                      <p className="truncate text-xs text-slate-500">{row.unit}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="money hidden text-sm font-semibold sm:inline">{formatMoney(row.amount, "")}</span>
                      <span className={`badge ${row.tone}`}>{row.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Moyens de paiement */}
      <section className="border-b border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-5 text-sm font-semibold text-slate-500">
          <span className="text-xs tracking-wider uppercase">Encaissements pris en charge</span>
          {["Wave", "Orange Money", "MTN MoMo", "Moov Money", "Espèces", "Virement", "Chèque"].map((m) => (
            <span key={m} className="text-slate-700">{m}</span>
          ))}
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Fonctionnalités</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Tout le cycle du loyer, du bail à la quittance.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="card p-6 transition hover:border-brand-200 hover:shadow-md">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Étapes */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Prêt en trois étapes</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6">
                <span className="money inline-flex size-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Tarifs</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Un prix simple, selon le nombre de lots.
          </h2>
          <p className="mt-3 text-slate-600">Sans engagement. Changez d'offre quand votre portefeuille évolue.</p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  plan.highlighted ? "border-brand-600 bg-white shadow-xl ring-1 ring-brand-600" : "border-slate-200 bg-white"
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white">
                    Le plus choisi
                  </span>
                ) : null}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="money text-4xl font-bold tracking-tight text-slate-900">
                    {plan.price === 0 ? "0" : formatMoney(plan.price, "").trim()}
                  </span>
                  <span className="text-sm font-medium text-slate-500">FCFA / mois</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`btn mt-8 w-full ${plan.highlighted ? "btn-primary" : "btn-secondary"}`}>
                  {plan.price === 0 ? "Commencer gratuitement" : `Essayer ${TRIAL_DAYS} jours`}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* Questions fréquentes */}
      <section id="faq" className="scroll-mt-20 border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Questions fréquentes</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-slate-200 bg-white px-5 py-4">
                <summary className="flex list-none items-center justify-between gap-4 text-base font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="text-xl leading-none text-slate-400 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section className="bg-[#0b1020]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Votre prochain mois de loyers, sans relances à la main.
            </h2>
            <p className="mt-2 text-slate-400">Créez votre compte et ajoutez votre premier bien en quelques minutes.</p>
          </div>
          <Link href="/signup" className="btn btn-accent shrink-0 px-6 py-3 text-base">
            Créer mon compte <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Building2 className="size-4" aria-hidden="true" />
            <span>© {new Date().getFullYear()} {BRAND.name}</span>
          </div>
          <nav className="flex items-center gap-5" aria-label="Pied de page">
            <a href="#fonctionnalites" className="hover:text-slate-900">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-slate-900">Tarifs</a>
            <Link href="/login" className="hover:text-slate-900">Connexion</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
