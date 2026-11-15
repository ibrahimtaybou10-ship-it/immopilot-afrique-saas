import type { ZodError } from "zod";
import type { ActionResult } from "./types";

/** FormData -> objet de chaînes (les fichiers sont ignorés, les champs absents restent undefined). */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export const fail = (error: string): ActionResult => ({ ok: false, error });

export const SESSION_EXPIRED = "Votre session a expiré. Reconnectez-vous.";

export const firstIssue = (error: ZodError): string => error.issues[0]?.message ?? "Données invalides.";

/** Traduit une erreur PostgreSQL / PostgREST en message compréhensible. */
export function dbError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Une erreur est survenue. Réessayez.";
  switch (error.code) {
    case "23505":
      return "Cet élément existe déjà.";
    case "23503":
      return "Opération impossible : des éléments liés existent encore (baux, échéances).";
    case "23514":
      return "Une valeur saisie n'est pas acceptée.";
    case "42501":
      return "Action non autorisée.";
    case "P0001":
    case "P0002":
      // Messages métier levés par nos fonctions SQL (déjà en français).
      return error.message ?? "Opération refusée.";
    default:
      return "Une erreur est survenue. Réessayez.";
  }
}
