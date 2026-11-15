import { formatDate, formatMoneyPlain, phoneDigits } from "./format";

interface ReminderInput {
  tenantName: string;
  balance: number;
  currency: string;
  periodLabel: string;
  dueDate: string | null;
  overdue: boolean;
  agencyName: string;
  payUrl: string;
}

/** Message de relance (WhatsApp : accents conservés). */
export function reminderMessage(i: ReminderInput): string {
  const amount = formatMoneyPlain(i.balance, i.currency);
  const due = i.dueDate ? formatDate(i.dueDate) : "";
  const body = i.overdue
    ? `sauf erreur de notre part, votre loyer de ${i.periodLabel} (${amount}) reste à régler${due ? ` depuis le ${due}` : ""}.`
    : `votre loyer de ${i.periodLabel} (${amount}) est attendu${due ? ` pour le ${due}` : ""}.`;
  return `Bonjour ${i.tenantName}, ${body} Détail et paiement : ${i.payUrl} — ${i.agencyName}`;
}

interface ConfirmationInput {
  tenantName: string;
  amount: number;
  currency: string;
  periodLabel: string;
  receiptNumber: string | null;
  agencyName: string;
  payUrl: string;
}

export function confirmationMessage(i: ConfirmationInput): string {
  const receipt = i.receiptNumber ? ` Quittance ${i.receiptNumber} :` : " Détail :";
  return `Bonjour ${i.tenantName}, nous confirmons la réception de ${formatMoneyPlain(i.amount, i.currency)} pour le loyer de ${i.periodLabel}.${receipt} ${i.payUrl} — ${i.agencyName}`;
}

/**
 * Réduit le texte à l'alphabet GSM 7 bits : un SMS accentué hors GSM passe en UCS-2
 * (70 caractères par segment au lieu de 160) et coûte plus du double.
 */
export function gsmSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/ /g, " ");
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;
}
