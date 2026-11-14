import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPaymentConfirmation } from "@/app/services/notifications";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-saspay-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 });

  const body = await req.json();
  if (body.event === "payment.succeeded") {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const receiptNo = `QUIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: payment } = await supabase
      .from("rent_payments")
      .update({
        status: "PAID",
        paid_amount: body.amount,
        payment_method: body.channel || "Wave Mobile Money",
        receipt_number: receiptNo,
        paid_at: new Date().toISOString(),
      })
      .eq("id", body.payment_id)
      .select("*")
      .single();

    if (payment && body.customer_phone) {
      await sendPaymentConfirmation(
        body.customer_phone,
        payment.tenant_name,
        payment.expected_amount,
        payment.period_label,
        receiptNo,
        `${process.env.NEXT_PUBLIC_APP_URL}/quittances/${receiptNo}`
      );
    }
  }
  return NextResponse.json({ received: true });
}
