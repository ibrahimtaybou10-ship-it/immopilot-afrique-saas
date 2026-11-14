"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (!error) router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form onSubmit={handleLogin} className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Connexion ImmoPilot Afrique</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="direction@koffi-immo.ci" className="w-full px-4 py-3 rounded-xl border border-slate-200" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-slate-200" required />
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
          {loading ? "Connexion..." : "Accéder au Dashboard"}
        </button>
      </form>
    </main>
  );
}
