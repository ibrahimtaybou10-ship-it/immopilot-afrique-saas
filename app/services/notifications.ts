export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
}

export async function sendRentReminder(
  tenantPhone: string,
  tenantName: string,
  amount: number,
  dueDate: string,
  periodLabel = "Novembre 2026",
  paymentUrl = "https://pay.saspay.africa/loyer"
) {
  const message = `Bonjour ${tenantName}, votre loyer de ${formatFCFA(amount)} pour le mois de ${periodLabel} est attendu pour le ${dueDate}. Merci de régulariser via votre lien sécurisé : ${paymentUrl}`;
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID || "IMMOPILOT";
  if (!apiKey) return { success: true, simulated: true, message };

  const res = await fetch("https://api.infobip.com/sms/2/text/advanced", {
    method: "POST",
    headers: { Authorization: `App ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ from: senderId, destinations: [{ to: tenantPhone }], text: message }] }),
  });
  return { success: res.ok, message };
}

export async function sendPaymentConfirmation(
  tenantPhone: string,
  tenantName: string,
  amount: number,
  periodLabel: string,
  receiptNumber: string,
  receiptDownloadUrl: string
) {
  const message = `Bonjour ${tenantName}, nous confirmons la réception de votre loyer de ${formatFCFA(amount)} (${periodLabel}). Téléchargez votre quittance officielle ${receiptNumber} ici : ${receiptDownloadUrl}`;
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID || "IMMOPILOT";
  if (!apiKey) return { success: true, simulated: true, message };

  const res = await fetch("https://api.infobip.com/sms/2/text/advanced", {
    method: "POST",
    headers: { Authorization: `App ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ from: senderId, destinations: [{ to: tenantPhone }], text: message }] }),
  });
  return { success: res.ok, message };
}
