import "server-only";
import { BRAND } from "./brand";
import { phoneDigits } from "./format";
import { gsmSafe } from "./messages";

export interface SmsResult {
  ok: boolean;
  /** true quand aucune passerelle n'est configurée : le message est seulement journalisé. */
  simulated: boolean;
  error?: string;
}

export const isSmsConfigured = () => Boolean(process.env.INFOBIP_API_KEY ?? process.env.SMS_API_KEY);

/** Envoi d'un SMS via Infobip. Sans clé API, l'envoi est simulé (utile en développement). */
export async function sendSms(to: string, text: string, senderId?: string | null): Promise<SmsResult> {
  const phone = phoneDigits(to);
  if (phone.length < 8) {
    return { ok: false, simulated: false, error: "Numéro de téléphone invalide" };
  }

  const message = gsmSafe(text);
  const apiKey = process.env.INFOBIP_API_KEY ?? process.env.SMS_API_KEY;
  if (!apiKey) {
    console.info(`[sms simulé] vers …${phone.slice(-4)} (${message.length} caractères)`);
    return { ok: true, simulated: true };
  }

  const base = (process.env.INFOBIP_BASE_URL ?? "https://api.infobip.com").replace(/\/+$/, "");
  const from = (senderId || process.env.SMS_SENDER_ID || BRAND.smsSender).slice(0, 11);

  try {
    const res = await fetch(`${base}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ messages: [{ from, destinations: [{ to: phone }], text: message }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, simulated: false, error: `La passerelle SMS a répondu ${res.status}` };
    }
    return { ok: true, simulated: false };
  } catch {
    return { ok: false, simulated: false, error: "Passerelle SMS injoignable" };
  }
}
