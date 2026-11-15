import { NextResponse, type NextRequest } from "next/server";
import { getAgencyCredentials } from "@/lib/payments/accounts";
import { verifyWebhookSignature } from "@/lib/payments/saspay";
import { settleRecentPending } from "@/lib/payments/settle";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/url";
import { isUuid } from "@/lib/validation";

export const maxDuration = 30;

/**
 * Webhook SasPay du compte d'UNE AGENCE (paiements de loyers), à déclarer par l'agence dans
 * son propre tableau de bord SasPay. La signature est vérifiée avec le secret de l'agence ;
 * puis seuls les paiements en attente de cette agence sont revérifiés chez SasPay avec sa clé.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  if (!isUuid(agencyId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isAdminConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const rawBody = await request.text();
  const admin = createAdminClient();
  const credentials = await getAgencyCredentials(admin, agencyId);
  const valid =
    !!credentials?.webhookSecret &&
    verifyWebhookSignature(
      rawBody,
      request.headers.get("x-webhook-signature"),
      request.headers.get("x-webhook-timestamp"),
      credentials.webhookSecret,
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

  const counts = await settleRecentPending(admin, await getAppUrl(), { agencyId, kind: "RENT", limit: 25 });
  if (counts.unverifiable > 0 && counts.paid === 0) {
    return NextResponse.json({ error: "verification unavailable" }, { status: 502 });
  }
  return NextResponse.json({ received: true, ...counts });
}
