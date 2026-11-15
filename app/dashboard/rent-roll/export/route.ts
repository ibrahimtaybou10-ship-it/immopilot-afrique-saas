import { NextResponse, type NextRequest } from "next/server";
import { getAgencyContext } from "@/lib/auth";
import { formatDate, methodLabel } from "@/lib/format";
import { currentPeriod, isValidPeriod } from "@/lib/periods";
import { effectivePlan } from "@/lib/plans";
import { INVOICE_SELECT, toInvoices } from "@/lib/queries";

const STATUS: Record<string, string> = { PAID: "Payé", PARTIAL: "Partiel", UNPAID: "En attente" };

/** Échappe une cellule CSV et neutralise les formules (=, +, -, @) interprétées par les tableurs. */
function cell(value: string | number | null): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Export comptable des échéances d'une période (CSV « ; » + BOM pour Excel en français). */
export async function GET(request: NextRequest) {
  const { supabase, agency } = await getAgencyContext();
  if (effectivePlan(agency) === "STARTER") {
    return NextResponse.redirect(new URL("/dashboard/settings", request.url));
  }

  const requested = request.nextUrl.searchParams.get("period");
  const period = isValidPeriod(requested) ? requested : currentPeriod();

  const { data } = await supabase
    .from("rent_payments")
    .select(INVOICE_SELECT)
    .eq("agency_id", agency.id)
    .eq("period_month", period)
    .order("due_date")
    .limit(5000);

  const header = [
    "Période", "Locataire", "Téléphone", "Bien", "Lot", "Échéance", "Attendu", "Dont charges",
    "Encaissé", "Reste dû", "Statut", "Mode de paiement", "Payé le", "N° quittance",
  ];
  const lines = toInvoices(data).map((i) =>
    [
      i.periodLabel, i.tenantName, i.tenantPhone, i.propertyName, i.unitNumber, formatDate(i.dueDate),
      i.expected, i.charges, i.paid, i.balance, STATUS[i.status] ?? i.status,
      i.method ? methodLabel(i.method) : "", i.paidAt ? formatDate(i.paidAt) : "", i.receiptNumber ?? "",
    ]
      .map(cell)
      .join(";"),
  );

  const csv = `﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}\r\n`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="loyers-${period}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
