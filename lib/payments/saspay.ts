import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Adaptateur SasPay (https://docs.saspay.me) — mobile money et carte en Afrique de l'Ouest et du Centre.
 *
 * Parcours utilisé : « checkout hébergé ». Loyéo crée une session de paiement, le client est
 * redirigé vers la page SasPay où il choisit son opérateur (Wave, Orange Money, MTN, Moov…).
 *
 * Sécurité : on ne fait jamais confiance à un statut reçu. Avant toute écriture, l'état de la
 * session est relu chez SasPay (GET /checkout-sessions/{id}/status/), authentifié par la clé
 * secrète, qui ne quitte jamais le serveur.
 */
const BASE_URL = (process.env.SASPAY_API_URL ?? "https://api.saspay.me/api/v1").replace(/\/+$/, "");

const secretKey = () => process.env.SASPAY_SECRET_KEY ?? "";

export const isPaymentProviderConfigured = () => secretKey().startsWith("sk_");

/** true avec une clé sk_test_… : aucun argent réel ne circule. */
export const isTestMode = () => secretKey().startsWith("sk_test_");

/**
 * Les loyers payés en ligne arrivent sur le compte marchand SasPay de la plateforme : l'exploitant
 * doit ensuite les reverser aux agences. Désactivé par défaut ; à activer en connaissance de cause
 * avec SASPAY_RENT_PAYMENTS=enabled (les abonnements, eux, fonctionnent dès que la clé est présente).
 */
export const isRentOnlinePaymentEnabled = () =>
  isPaymentProviderConfigured() && process.env.SASPAY_RENT_PAYMENTS === "enabled";

async function call<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: T; error?: { message?: string; code?: string } | Record<string, string[]> }
      | null;

    if (!res.ok || json?.success === false) {
      const err = json?.error as { message?: string; code?: string } | undefined;
      console.error("[saspay]", path, res.status, err?.code ?? "", err?.message ?? "");
      return { ok: false, status: res.status, error: err?.message ?? `SasPay a répondu ${res.status}` };
    }
    // Réponse « enveloppée » ({ success, data }) ou objet direct, selon les routes.
    const data = (json && "data" in json && json.data !== undefined ? json.data : json) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: "SasPay est injoignable." };
  }
}

export interface CheckoutInput {
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  /** Code pays ISO2, présélectionné sur la page de paiement. */
  country?: string | null;
  returnUrl: string;
  metadata: Record<string, string>;
}

export type CheckoutResult = { ok: true; sessionId: string; checkoutUrl: string } | { ok: false; error: string };

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!isPaymentProviderConfigured()) {
    return { ok: false, error: "Le paiement en ligne n'est pas configuré." };
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Montant invalide." };
  }

  const result = await call<{ id?: string; checkout_url?: string }>("/checkout-sessions/", {
    method: "POST",
    body: JSON.stringify({
      amount: `${input.amount}.00`,
      currency: process.env.SASPAY_CURRENCY ?? "XOF",
      description: input.description.slice(0, 120),
      customer_name: input.customerName.slice(0, 100),
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone ?? "",
      ...(input.country ? { country: input.country } : {}),
      return_url: input.returnUrl,
      metadata: input.metadata,
    }),
  });

  if (!result.ok) {
    return { ok: false, error: "Le prestataire de paiement a refusé la demande. Réessayez plus tard." };
  }
  if (!result.data.id || !result.data.checkout_url) {
    return { ok: false, error: "Réponse inattendue du prestataire de paiement." };
  }
  return { ok: true, sessionId: result.data.id, checkoutUrl: result.data.checkout_url };
}

export interface CheckoutState {
  status: "PAID" | "FAILED" | "PENDING";
  /** Montant demandé (hors frais éventuellement ajoutés au client). */
  amount: number;
  /** Mode de paiement, dans la nomenclature de Loyéo. */
  method: string;
  transactionId: string | null;
}

/** Source de vérité : état d'une session relu directement chez SasPay. null = vérification impossible. */
export async function getCheckoutState(sessionId: string): Promise<CheckoutState | null> {
  if (!isPaymentProviderConfigured() || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;

  const status = await call<{ status?: string; transaction_id?: string | null; transaction_status?: string | null }>(
    `/checkout-sessions/${sessionId}/status/`,
  );
  if (!status.ok) return null;

  const sessionStatus = (status.data.status ?? "").toUpperCase();
  const txStatus = (status.data.transaction_status ?? "").toUpperCase();
  const transactionId = status.data.transaction_id ?? null;

  if (txStatus === "FAILED" || txStatus === "CANCELLED" || ["CANCELLED", "EXPIRED"].includes(sessionStatus)) {
    return { status: "FAILED", amount: 0, method: "SASPAY", transactionId };
  }
  if (!(sessionStatus === "PAID" && txStatus === "SUCCESS" && transactionId)) {
    return { status: "PENDING", amount: 0, method: "SASPAY", transactionId };
  }

  // Montant confirmé par la transaction elle-même (revérifiée côté gateway par SasPay).
  const tx = await call<{ status?: string; requested_amount?: string; network?: string }>(
    `/payments/${transactionId}/verify/`,
  );
  if (!tx.ok || (tx.data.status ?? "").toUpperCase() !== "SUCCESS") return null;

  return {
    status: "PAID",
    amount: Math.round(Number(tx.data.requested_amount ?? 0)),
    method: mapNetwork(tx.data.network),
    transactionId,
  };
}

/** Code réseau SasPay (ex. « orange_ci », « mtn_bj ») -> mode de paiement Loyéo. */
export function mapNetwork(network: string | null | undefined): string {
  const n = (network ?? "").toLowerCase();
  if (n.startsWith("wave")) return "WAVE";
  if (n.startsWith("orange") || n.startsWith("om_")) return "ORANGE_MONEY";
  if (n.startsWith("mtn") || n.startsWith("momo")) return "MTN_MOMO";
  if (n.startsWith("moov") || n.startsWith("flooz")) return "MOOV_MONEY";
  if (n.includes("card") || n.includes("visa") || n.includes("master")) return "CARTE";
  return "SASPAY";
}

/**
 * Vérifie un webhook SasPay : HMAC-SHA256 de « {timestamp}.{corps brut} » avec le secret de
 * signature, horodatage refusé au-delà de 5 minutes (anti-rejeu), comparaison en temps constant.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.SASPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
