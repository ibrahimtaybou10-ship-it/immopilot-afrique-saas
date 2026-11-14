"use client";
import { jsPDF } from "jspdf";
import { FileText } from "lucide-react";

export function DownloadReceiptButton({ payment }: { payment: any }) {
  function handleDownload() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("QUITTANCE DE LOYER", 20, 25);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Agence : Koffi & Associés Immobilier`, 20, 40);
    doc.text(`Locataire : ${payment.tenant_name}`, 20, 50);
    doc.text(`Bien loué : ${payment.property_name} - ${payment.unit_number}`, 20, 60);
    doc.text(`Période : ${payment.period_label}`, 20, 70);
    doc.text(`Montant payé : ${payment.paid_amount} FCFA`, 20, 80);
    doc.text("Mention légale : Pour acquit de la somme indiquée ci-dessus.", 20, 100);
    doc.save(`Quittance_${payment.tenant_name}.pdf`);
  }

  return (
    <button onClick={handleDownload} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100">
      <FileText className="w-3.5 h-3.5" /> Télécharger Quittance
    </button>
  );
}
