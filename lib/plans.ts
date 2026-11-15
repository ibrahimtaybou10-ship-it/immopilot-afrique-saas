import type { Agency, PlanId } from "./types";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Prix mensuel en FCFA. */
  price: number;
  /** Nombre maximal de lots gérés ; null = illimité. */
  maxUnits: number | null;
  autoReminders: boolean;
  features: string[];
  highlighted?: boolean;
}

// Grille tarifaire : modifiez librement les prix et libellés ici, tout le produit s'y réfère.
// Attention : les plafonds de lots (maxUnits) sont aussi appliqués par la base de données, dans
// la fonction SQL public.agency_unit_limit (supabase/migrations). Modifiez les deux ensemble.
export const PLANS: Record<PlanId, Plan> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    tagline: "Pour démarrer avec quelques biens",
    price: 0,
    maxUnits: 5,
    autoReminders: false,
    features: [
      "Jusqu'à 5 lots",
      "Échéances mensuelles générées automatiquement",
      "Quittances PDF illimitées",
      "Relances SMS et WhatsApp en 1 clic",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tagline: "Pour les bailleurs et agences en croissance",
    price: 15000,
    maxUnits: 50,
    autoReminders: true,
    highlighted: true,
    features: [
      "Jusqu'à 50 lots",
      "Tout le plan Starter",
      "Relances automatiques avant et après l'échéance",
      "Liens de paiement Mobile Money",
      "Export comptable CSV",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    tagline: "Pour les gros portefeuilles",
    price: 45000,
    maxUnits: null,
    autoReminders: true,
    features: ["Lots illimités", "Tout le plan Pro"],
  },
};

export const PLAN_ORDER: PlanId[] = ["STARTER", "PRO", "BUSINESS"];
export const TRIAL_DAYS = 14;

type Billing = Pick<Agency, "subscription_plan" | "subscription_status" | "trial_ends_at" | "current_period_end">;

/** Offre réellement applicable : essai Pro en cours, abonnement payé non échu, sinon Starter. */
export function effectivePlan(agency: Billing, now: number = Date.now()): PlanId {
  if (agency.subscription_status === "TRIALING") {
    return new Date(agency.trial_ends_at).getTime() > now ? "PRO" : "STARTER";
  }
  if (agency.subscription_status === "ACTIVE") {
    const end = agency.current_period_end ? new Date(agency.current_period_end).getTime() : Infinity;
    return end > now ? agency.subscription_plan : "STARTER";
  }
  return "STARTER";
}

export function trialDaysLeft(agency: Billing, now: number = Date.now()): number {
  if (agency.subscription_status !== "TRIALING") return 0;
  const ms = new Date(agency.trial_ends_at).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}
