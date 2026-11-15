const NBSP = " ";

function group(n: number, separator: string): string {
  return Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** 1 250 000 FCFA — espaces insécables pour l'affichage web. */
export function formatMoney(amount: number | string | null | undefined, currency = "FCFA"): string {
  const n = Number(amount ?? 0);
  return `${n < 0 ? "-" : ""}${group(n, NBSP)}${NBSP}${currency}`;
}

/** Variante à espaces simples : SMS (alphabet GSM) et PDF (police standard). */
export function formatMoneyPlain(amount: number | string | null | undefined, currency = "FCFA"): string {
  const n = Number(amount ?? 0);
  return `${n < 0 ? "-" : ""}${group(n, " ")} ${currency}`;
}

/** '2026-11-05' ou date ISO -> '05/11/2026' (sans décalage de fuseau). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Chiffres uniquement, au format international sans « + » (ex. 2250708112233). */
export function phoneDigits(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.replace(/^00/, "");
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export const METHOD_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN_MOMO: "MTN MoMo",
  MOOV_MONEY: "Moov Money",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte bancaire",
  SASPAY: "Paiement en ligne",
};

/** Modes proposés pour un encaissement saisi à la main. */
export const MANUAL_METHODS = [
  "ESPECES", "WAVE", "ORANGE_MONEY", "MTN_MOMO", "MOOV_MONEY", "VIREMENT", "CHEQUE", "CARTE",
] as const;

export const methodLabel = (method: string | null | undefined) =>
  method ? (METHOD_LABELS[method] ?? method) : "—";

export const PROPERTY_TYPES: Record<string, string> = {
  IMMEUBLE: "Immeuble",
  RESIDENCE: "Résidence",
  VILLA: "Villa",
  COMMERCIAL: "Bureaux & commerces",
};

export const UNIT_TYPES: Record<string, string> = {
  STUDIO: "Studio",
  CHAMBRE: "Chambre",
  F2: "2 pièces (F2)",
  F3: "3 pièces (F3)",
  F4: "4 pièces (F4)",
  F5: "5 pièces (F5)",
  VILLA: "Villa",
  DUPLEX: "Duplex",
  MAGASIN: "Magasin",
  BUREAU: "Bureau",
  ENTREPOT: "Entrepôt",
};
