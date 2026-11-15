export type PlanId = "STARTER" | "PRO" | "BUSINESS";
export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID";
export type LeaseStatus = "ACTIVE" | "TERMINATED" | "PENDING";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  rccm_number: string | null;
  nif_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  /** Type de compte : propriétaire bailleur ou agence. */
  plan: "OWNER" | "AGENCY";
  subscription_plan: PlanId;
  subscription_status: "TRIALING" | "ACTIVE" | "CANCELED";
  trial_ends_at: string;
  current_period_end: string | null;
  default_due_day: number;
  sms_sender_id: string | null;
  auto_reminders: boolean;
}

export interface Property {
  id: string;
  name: string;
  property_type: string;
  address: string;
  city: string;
  total_units: number;
  occupied_units: number;
  monthly_expected_revenue: number;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: string;
  floor_number: number | null;
  base_rent: number;
  charges_amount: number;
  is_occupied: boolean;
}

/** Échéance de loyer « à plat », prête pour l'affichage et la quittance. */
export interface Invoice {
  id: string;
  leaseId: string;
  periodMonth: string;
  periodLabel: string;
  dueDate: string | null;
  expected: number;
  charges: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  overdue: boolean;
  method: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
  payToken: string;
  reminderCount: number;
  lastReminderAt: string | null;
  tenantName: string;
  tenantPhone: string;
  unitNumber: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  /** Loyer + charges du bail (montant d'un mois). */
  monthly: number;
  /** Reste dû sur les AUTRES échéances non soldées du même bail (impayés). */
  otherDue: number;
}

/** Coordonnées de l'agence imprimées sur les quittances et messages. */
export interface AgencyCard {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  rccm_number: string | null;
  currency: string;
}

export interface DashboardSummary {
  properties: number;
  total_units: number;
  occupied_units: number;
  active_leases: number;
  expected: number;
  collected: number;
  invoices: number;
  outstanding_total: number;
  overdue_count: number;
  overdue_amount: number;
  series: { period: string; expected: number; collected: number }[];
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null;
