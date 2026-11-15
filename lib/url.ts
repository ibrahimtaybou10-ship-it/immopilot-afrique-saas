import "server-only";
import { headers } from "next/headers";

/** URL publique de l'application, sans barre oblique finale. */
export async function getAppUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** N'accepte qu'un chemin interne : protège des redirections ouvertes (?next=https://…). */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\n")) return fallback;
  return value;
}
