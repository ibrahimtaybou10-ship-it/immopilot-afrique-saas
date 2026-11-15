import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Adaptateur CinetPay (agrégateur Mobile Money : Wave, Orange Money, MTN MoMo, Moov, cartes).
 * Remplace l'ancien appel à « api.saspay.africa », domaine qui n'existe pas.
 *
 * Sécurité : le webhook ne fait jamais confiance au contenu reçu. Il relit systématiquement
 * l'état de la transaction auprès de CinetPay (checkTransaction), authentifié par notre clé API.
 *
 * Pour changer de prestataire, réimplémentez ces trois fonctions avec la même signature.
 */
const BASE_URL = "https://api-checkout.cinetpay.com/v2";

const credentials = () => ({
  apikey: process.env.CINETPAY_API_KEY ?? "",
  site_id: process.env.CINETPAY_SITE_ID ?? "",
});

export const isPaymentProviderConfigured = () => {
  const c = credentials();
  return Boolean(c.apikey && c.site_id);
};

/** Identifiant de transaction unique, alphanumérique (exigence CinetPay). */
export function newTransactionId(): string {
  return `IMP${Date.now().toString(36).toUpperCase()}${randomBytes(5).toString("hex").toUpperCase()}`;
}

export interface CheckoutInput {
  transactionId: string;
  amount: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
}

export type CheckoutResult = { ok: true; paymentUrl: string } | { ok: false; error: string };

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!isPaymentProviderConfigured()) {
    return { ok: false, error: "Le paiement en ligne n'est pas configuré." };
  }
  if (input.amount <= 0 || input.amount % 5 !== 0) {
    return { ok: false, error: "Le montant à payer en ligne doit être un multiple de 5 FCFA." };
  }

  try {
    const res = await fetch(`${BASE_URL}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...credentials(),
        transaction_id: input.transactionId,
        amount: input.amount,
        currency: process.env.CINETPAY_CURRENCY ?? "XOF",
        // CinetPay refuse les caractères spéciaux dans la description.
        description: input.description.normalize("NFD").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 100),
        notify_url: input.notifyUrl,
        return_url: input.returnUrl,
        channels: "ALL",
        lang: "fr",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { code?: string; message?: string; data?: { payment_url?: string } };
    if (json.code === "201" && json.data?.payment_url) {
      return { ok: true, paymentUrl: json.data.payment_url };
    }
    console.error("[cinetpay] initialisation refusée", json.code, json.message);
    return { ok: false, error: "Le prestataire de paiement a refusé la demande. Réessayez plus tard." };
  } catch {
    return { ok: false, error: "Prestataire de paiement injoignable. Réessayez plus tard." };
  }
}

export interface TransactionState {
  status: "ACCEPTED" | "REFUSED" | "PENDING";
  amount: number;
  /** Mode de paiement, dans notre nomenclature. */
  method: string;
}

/** Source de vérité : état d'une transaction relu directement chez CinetPay. */
export async function checkTransaction(transactionId: string): Promise<TransactionState | null> {
  if (!isPaymentProviderConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...credentials(), transaction_id: transactionId }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as {
      code?: string;
      data?: { status?: string; amount?: string | number; payment_method?: string };
    };
    const raw = json.data?.status;
    const status = json.code === "00" && raw === "ACCEPTED" ? "ACCEPTED" : raw === "REFUSED" ? "REFUSED" : "PENDING";
    return { status, amount: Number(json.data?.amount ?? 0), method: mapMethod(json.data?.payment_method) };
  } catch {
    return null;
  }
}

function mapMethod(code: string | undefined): string {
  const c = (code ?? "").toUpperCase();
  if (c.startsWith("WAVE")) return "WAVE";
  if (c.startsWith("OM")) return "ORANGE_MONEY";
  if (c.startsWith("MOMO") || c.startsWith("MTN")) return "MTN_MOMO";
  if (c.startsWith("FLOOZ") || c.startsWith("MOOV")) return "MOOV_MONEY";
  if (c.includes("VISA") || c.includes("CARD") || c.includes("MASTER")) return "CARTE";
  return "MOBILE_MONEY";
}
