import { BRAND } from "./brand";
import { formatDate, formatMoneyPlain, methodLabel } from "./format";
import type { AgencyCard } from "./types";

export interface ReceiptData {
  agency: AgencyCard;
  receiptNumber: string;
  periodLabel: string;
  paidAt: string | null;
  method: string | null;
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  unitNumber: string;
  expected: number;
  charges: number;
}

/**
 * Génère et télécharge la quittance de loyer en PDF.
 * jsPDF (~300 Ko) n'est chargé qu'au clic : il ne pèse pas sur le chargement des pages.
 * Les polices standard du PDF ne couvrent que le latin-1 : pas de tirets longs ni d'espaces fines.
 */
export async function downloadReceipt(data: ReceiptData): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { agency } = data;
  const money = (n: number) => formatMoneyPlain(n, agency.currency);
  const rent = Math.max(data.expected - data.charges, 0);

  // Bandeau agence
  doc.setFillColor(11, 16, 32);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(agency.name.toUpperCase(), 15, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const addressLine = [agency.address, agency.city, agency.country].filter(Boolean).join(", ");
  const contactLine = [agency.phone, agency.email, agency.rccm_number ? `RCCM ${agency.rccm_number}` : null]
    .filter(Boolean)
    .join("  |  ");
  if (addressLine) doc.text(addressLine, 15, 25);
  if (contactLine) doc.text(contactLine, 15, 31);

  // Titre
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, 48, 180, 24, 3, 3, "FD");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QUITTANCE DE LOYER", 22, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Loyer du mois de ${data.periodLabel}`, 22, 67);
  doc.setFont("courier", "bold");
  doc.setTextColor(30, 46, 175);
  doc.text(`Réf : ${data.receiptNumber}`, 188, 58, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Payé le : ${formatDate(data.paidAt)}`, 188, 66, { align: "right" });

  // Locataire / bien
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 80, 87, 40, 3, 3, "S");
  doc.roundedRect(108, 80, 87, 40, 3, 3, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("LOCATAIRE", 20, 89);
  doc.text("BIEN LOUÉ", 113, 89);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(data.tenantName, 77)[0], 20, 98);
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(data.propertyName, 77)[0], 113, 98);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Mode de règlement : ${methodLabel(data.method)}`, 20, 107);
  doc.text(`Lot : ${data.unitNumber}`, 113, 106);
  doc.text(doc.splitTextToSize([data.propertyAddress, data.propertyCity].filter(Boolean).join(", "), 77)[0], 113, 113);

  // Détail des sommes
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 130, 180, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("DÉSIGNATION", 20, 136.5);
  doc.text("MONTANT", 190, 136.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Loyer - ${data.periodLabel}`, 20, 149);
  doc.setFont("courier", "bold");
  doc.text(money(rent), 190, 149, { align: "right" });
  doc.line(15, 154, 195, 154);

  doc.setFont("helvetica", "normal");
  doc.text("Provisions sur charges", 20, 163);
  doc.setFont("courier", "bold");
  doc.text(money(data.charges), 190, 163, { align: "right" });
  doc.line(15, 168, 195, 168);

  doc.setFillColor(11, 16, 32);
  doc.roundedRect(15, 174, 180, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL REÇU", 20, 184);
  doc.setFont("courier", "bold");
  doc.setFontSize(13);
  doc.setTextColor(110, 231, 183);
  doc.text(money(data.expected), 190, 184, { align: "right" });

  // Texte de quittance
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const wording =
    `${agency.name} reconnaît avoir reçu de ${data.tenantName} la somme de ${money(data.expected)} ` +
    `au titre du loyer et des charges du bien désigné ci-dessus pour la période de ${data.periodLabel}, ` +
    "et lui en donne quittance, sous réserve de tous ses droits.";
  doc.text(doc.splitTextToSize(wording, 180), 15, 202);

  // Pour acquit
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(120, 222, 75, 30, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("POUR ACQUIT", 125, 230);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(30, 46, 175);
  doc.text(doc.splitTextToSize(agency.name, 65)[0], 125, 240);

  doc.setDrawColor(226, 232, 240);
  doc.line(15, 268, 195, 268);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Cette quittance annule tout reçu établi précédemment pour un paiement partiel de la même période.", 15, 274);
  doc.text(`Document généré électroniquement par ${BRAND.name}.`, 15, 279);

  const clean = (s: string) => s.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const filename = `Quittance_${clean(data.tenantName)}_${clean(data.periodLabel)}.pdf`;
  doc.save(filename);
  return filename;
}
