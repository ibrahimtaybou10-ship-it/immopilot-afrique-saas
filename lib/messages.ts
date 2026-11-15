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
  /** Reste dû sur les autres échéances (impayés antérieurs, mois précédents). */
  otherDue?: number;
}

/** Message de relance (WhatsApp : accents conservés). Les impayés et le total dû sont inclus. */
export function reminderMessage(i: ReminderInput): string {
  const amount = formatMoneyPlain(i.balance, i.currency);
  const due = i.dueDate ? formatDate(i.dueDate) : "";
  const isArrears = /impay/i.test(i.periodLabel);
  const what = isArrears ? `vos impayés antérieurs (${amount})` : `votre loyer de ${i.periodLabel} (${amount})`;
  const body = isArrears
    ? `sauf erreur de notre part, ${what} restent à régler.`
    : i.overdue
      ? `sauf erreur de notre part, ${what} reste à régler${due ? ` depuis le ${due}` : ""}.`
      : `${what} est attendu${due ? ` pour le ${due}` : ""}.`;
  const other = Math.max(i.otherDue ?? 0, 0);
  const arrears = other > 0
    ? ` Vous avez aussi ${formatMoneyPlain(other, i.currency)} d'impayés, soit un total dû de ${formatMoneyPlain(i.balance + other, i.currency)}.`
    : "";
  return `Bonjour ${i.tenantName}, ${body}${arrears} Détail et paiement : ${i.payUrl} — ${i.agencyName}`;
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
