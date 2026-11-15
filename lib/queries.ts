import { todayISO } from "./periods";
import type { Agency, AgencyCard, Invoice, InvoiceStatus } from "./types";

/** Colonnes d'une échéance avec locataire, lot et bien (une seule requête, jointures PostgREST). */
export const INVOICE_SELECT = `
  id, lease_id, period_month, period_label, due_date, expected_amount, charges_amount, amount_paid,
  status, payment_method, receipt_number, paid_at, pay_token, reminder_count, last_reminder_at,
  leases!inner (
    monthly_rent, charges_amount,
    lease_tenants!inner ( full_name, phone ),
    units!inner ( unit_number ),
    properties!inner ( name, address, city )
  )`;

interface InvoiceRow {
  id: string;
  lease_id: string;
  period_month: string;
  period_label: string;
  due_date: string | null;
  expected_amount: number;
  charges_amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  payment_method: string | null;
  receipt_number: string | null;
  paid_at: string | null;
  pay_token: string;
  reminder_count: number;
  last_reminder_at: string | null;
  leases: {
    monthly_rent: number;
    charges_amount: number;
    lease_tenants: { full_name: string; phone: string };
    units: { unit_number: string };
    properties: { name: string; address: string; city: string };
  };
}

export function toInvoice(row: unknown, today: string = todayISO()): Invoice {
  const r = row as InvoiceRow;
  const expected = Number(r.expected_amount);
  const paid = Number(r.amount_paid);
  const dueDate = r.due_date ?? `${r.period_month}-05`;
  return {
    id: r.id,
    leaseId: r.lease_id,
    periodMonth: r.period_month,
    periodLabel: r.period_label,
    dueDate,
    expected,
    charges: Number(r.charges_amount ?? 0),
    paid,
    balance: Math.max(expected - paid, 0),
    status: r.status,
    overdue: r.status !== "PAID" && dueDate < today,
    method: r.payment_method,
    receiptNumber: r.receipt_number,
    paidAt: r.paid_at,
    payToken: r.pay_token,
    reminderCount: r.reminder_count ?? 0,
    lastReminderAt: r.last_reminder_at,
    tenantName: r.leases.lease_tenants.full_name,
    tenantPhone: r.leases.lease_tenants.phone,
    unitNumber: r.leases.units.unit_number,
    propertyName: r.leases.properties.name,
    propertyAddress: r.leases.properties.address,
    propertyCity: r.leases.properties.city,
    monthly: Number(r.leases.monthly_rent) + Number(r.leases.charges_amount),
    otherDue: 0,
  };
}

export const toInvoices = (rows: unknown[] | null | undefined): Invoice[] => {
  const today = todayISO();
  return (rows ?? []).map((row) => toInvoice(row, today));
};

export function agencyCard(agency: Agency): AgencyCard {
  return {
    name: agency.name,
    phone: agency.phone,
    email: agency.email,
    address: agency.address,
    city: agency.city,
    country: agency.country,
    rccm_number: agency.rccm_number,
    currency: agency.currency,
  };
}

type OpenRow = { id: string; lease_id: string; expected_amount: number; amount_paid: number };

/**
 * Renseigne `otherDue` : ce que le locataire doit encore sur ses AUTRES échéances
 * (impayés antérieurs, mois précédents). Une seule requête pour toute la liste.
 */
export async function withOtherDue(
  supabase: { from: (t: "rent_payments") => any },
  invoices: Invoice[],
): Promise<Invoice[]> {
  const leaseIds = [...new Set(invoices.map((i) => i.leaseId))];
  if (leaseIds.length === 0) return invoices;
  const { data } = await supabase
    .from("rent_payments")
    .select("id, lease_id, expected_amount, amount_paid")
    .in("lease_id", leaseIds)
    .neq("status", "PAID");
  const rows = (data ?? []) as OpenRow[];
  return invoices.map((invoice) => ({
    ...invoice,
    otherDue: rows
      .filter((r) => r.lease_id === invoice.leaseId && r.id !== invoice.id)
      .reduce((sum, r) => sum + Math.max(Number(r.expected_amount) - Number(r.amount_paid), 0), 0),
  }));
}
