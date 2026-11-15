import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/saspay";
import { settleRecentPending } from "@/lib/payments/settle";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/url";

export const maxDuration = 30;

/**
 * Webhook SasPay du compte de la PLATEFORME (abonnements).
 * Les loyers ont leur propre webhook par agence : /api/webhooks/saspay/agences/{agencyId}.
 *
 * 1. La signature HMAC et l'horodatage sont vérifiés sur le corps BRUT : un appel forgé est rejeté.
 * 2. Le contenu n'est jamais cru sur parole : le webhook sert seulement de signal, et chaque
 *    paiement en attente est revérifié directement auprès de SasPay avant d'être appliqué.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const valid = verifyWebhookSignature(
    rawBody,
    request.headers.get("x-webhook-signature"),
    request.headers.get("x-webhook-timestamp"),
  );
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  let event = "";
  try {
    event = String((JSON.parse(rawBody) as { event?: string }).event ?? "");
  } catch {
    return NextResponse.json({ received: true });
  }

  if (!["transaction.success", "transaction.failed", "transaction.cancelled"].includes(event)) {
    return NextResponse.json({ received: true });
  }
  if (!isAdminConfigured()) {
    // 503 : SasPay retentera la livraison plus tard (5 tentatives).
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const counts = await settleRecentPending(createAdminClient(), await getAppUrl(), { kind: "SUBSCRIPTION", limit: 25 });
  if (counts.unverifiable > 0 && counts.paid === 0) {
    // Vérification impossible pour l'instant : on demande à SasPay de renvoyer la notification.
    return NextResponse.json({ error: "verification unavailable" }, { status: 502 });
  }
  return NextResponse.json({ received: true, ...counts });
}
