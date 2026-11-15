const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Période courante 'AAAA-MM' (UTC = heure d'Abidjan/Dakar). */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidPeriod(value: unknown): value is string {
  return typeof value === "string" && PERIOD_RE.test(value);
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function shortPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTHS_SHORT[month - 1]} ${String(year).slice(2)}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return currentPeriod(d);
}

export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Date ISO décalée de n jours. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
