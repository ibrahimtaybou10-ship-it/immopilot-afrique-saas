"use server";
export async function createSasPayCheckoutSession(paymentId: string, amountFCFA: number, tenantPhone: string) {
  const response = await fetch("https://api.saspay.africa/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SASPAY_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountFCFA,
      currency: "XOF",
      customer_phone: tenantPhone,
      channels: ["WAVE", "ORANGE_MONEY", "MTN_MOMO", "CARD"],
      metadata: { payment_id: paymentId },
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/saspay`,
    }),
  });
  return response.json();
}
