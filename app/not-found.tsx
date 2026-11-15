import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo />
      <p className="money mt-10 text-sm font-bold text-brand-700">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Page introuvable</h1>
      <p className="mt-3 max-w-sm text-sm text-slate-600">
        Ce lien n'existe pas ou n'est plus valide. S'il s'agit d'un lien de paiement, demandez-en un nouveau à votre agence.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Retour à l'accueil
      </Link>
    </main>
  );
}
