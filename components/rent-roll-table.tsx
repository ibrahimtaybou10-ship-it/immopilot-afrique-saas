"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Banknote, Link2, LoaderCircle, MessageCircle, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { recordPaymentAction, sendReminderAction } from "@/app/actions/payments";
import { formatDate, formatMoney, MANUAL_METHODS, METHOD_LABELS } from "@/lib/format";
import { reminderMessage, whatsappUrl } from "@/lib/messages";
import type { AgencyCard, Invoice } from "@/lib/types";
import { ReceiptButton } from "./receipt-button";
import { StatusBadge } from "./status-badge";

type Filter = "ALL" | "OPEN" | "LATE" | "PAID";

interface Props {
  invoices: Invoice[];
  agency: AgencyCard;
  appUrl: string;
  /** Affiche la colonne « Période » (vues multi-mois). */
  showPeriod?: boolean;
  showFilters?: boolean;
  initialFilter?: Filter;
  emptyMessage?: string;
}

export function RentRollTable({
  invoices,
  agency,
  appUrl,
  showPeriod = false,
  showFilters = true,
  initialFilter = "ALL",
  emptyMessage = "Aucune échéance à afficher.",
}: Props) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const counts = useMemo(
    () => ({
      ALL: invoices.length,
      OPEN: invoices.filter((i) => i.status !== "PAID").length,
      LATE: invoices.filter((i) => i.overdue).length,
      PAID: invoices.filter((i) => i.status === "PAID").length,
    }),
    [invoices],
  );

  // Filtrage instantané côté navigateur : aucune requête pendant la recherche.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((i) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "PAID" && i.status === "PAID") ||
        (filter === "OPEN" && i.status !== "PAID") ||
        (filter === "LATE" && i.overdue);
      if (!matchesFilter) return false;
      if (!q) return true;
      return `${i.tenantName} ${i.propertyName} ${i.unitNumber} ${i.tenantPhone}`.toLowerCase().includes(q);
    });
  }, [invoices, filter, query]);

  const payUrl = (invoice: Invoice) => `${appUrl}/pay/${invoice.payToken}`;

  // Référence stable : PaymentForm s'en sert dans un effet.
  const closeDialog = useCallback(() => dialogRef.current?.close(), []);

  function openPayment(invoice: Invoice) {
    setSelected(invoice);
    dialogRef.current?.showModal();
  }

  async function copyLink(invoice: Invoice) {
    try {
      await navigator.clipboard.writeText(payUrl(invoice));
      toast.success("Lien de paiement copié");
    } catch {
      toast.error("Copie impossible sur cet appareil");
    }
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: "ALL", label: "Tous" },
    { id: "OPEN", label: "À encaisser" },
    { id: "LATE", label: "En retard" },
    { id: "PAID", label: "Payés" },
  ];

  return (
    <div className="card overflow-hidden">
      {showFilters ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer les échéances">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`btn btn-sm ${filter === tab.id ? "btn-dark" : "btn-ghost"}`}
              >
                {tab.label}
                <span className={`money rounded-full px-1.5 text-[10px] ${filter === tab.id ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Rechercher</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Locataire, bien, lot…"
              className="input py-2 pl-9"
            />
          </label>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Locataire</th>
                <th className="hidden md:table-cell">Bien & lot</th>
                {showPeriod ? <th>Période</th> : null}
                <th className="hidden sm:table-cell">Échéance</th>
                <th className="text-right">Attendu</th>
                <th className="hidden text-right lg:table-cell">Perçu</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <p className="font-semibold text-slate-900">{invoice.tenantName}</p>
                    <p className="money text-xs text-slate-500">{invoice.tenantPhone}</p>
                    <p className="text-xs text-slate-500 md:hidden">
                      {invoice.propertyName} · {invoice.unitNumber}
                    </p>
                  </td>
                  <td className="hidden md:table-cell">
                    <p className="text-slate-700">{invoice.propertyName}</p>
                    <p className="text-xs text-slate-500">{invoice.unitNumber}</p>
                  </td>
                  {showPeriod ? <td className="text-xs font-medium whitespace-nowrap text-slate-700">{invoice.periodLabel}</td> : null}
                  <td className="money hidden text-xs whitespace-nowrap text-slate-600 sm:table-cell">{formatDate(invoice.dueDate)}</td>
                  <td className="money text-right font-semibold whitespace-nowrap text-slate-900">
                    {formatMoney(invoice.expected, "")}
                    {invoice.status === "PARTIAL" ? (
                      <span className="block text-[11px] font-medium text-amber-700">reste {formatMoney(invoice.balance, "")}</span>
                    ) : null}
                  </td>
                  <td className="money hidden text-right whitespace-nowrap text-emerald-700 lg:table-cell">{formatMoney(invoice.paid, "")}</td>
                  <td>
                    <StatusBadge status={invoice.status} overdue={invoice.overdue} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      {invoice.status === "PAID" ? (
                        invoice.receiptNumber ? (
                          <ReceiptButton
                            data={{
                              agency,
                              receiptNumber: invoice.receiptNumber,
                              periodLabel: invoice.periodLabel,
                              paidAt: invoice.paidAt,
                              method: invoice.method,
                              tenantName: invoice.tenantName,
                              propertyName: invoice.propertyName,
                              propertyAddress: invoice.propertyAddress,
                              propertyCity: invoice.propertyCity,
                              unitNumber: invoice.unitNumber,
                              expected: invoice.expected,
                              charges: invoice.charges,
                            }}
                          />
                        ) : null
                      ) : (
                        <>
                          <ReminderButton invoiceId={invoice.id} />
                          <a
                            className="btn btn-secondary btn-sm"
                            title="Relancer par WhatsApp"
                            aria-label={`Relancer ${invoice.tenantName} par WhatsApp`}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={whatsappUrl(
                              invoice.tenantPhone,
                              reminderMessage({
                                tenantName: invoice.tenantName,
                                balance: invoice.balance,
                                currency: agency.currency,
                                periodLabel: invoice.periodLabel,
                                dueDate: invoice.dueDate,
                                overdue: invoice.overdue,
                                agencyName: agency.name,
                                payUrl: payUrl(invoice),
                              }),
                            )}
                          >
                            <MessageCircle className="size-3.5" aria-hidden="true" />
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Copier le lien de paiement"
                            aria-label="Copier le lien de paiement"
                            onClick={() => copyLink(invoice)}
                          >
                            <Link2 className="size-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => openPayment(invoice)}>
                            <Banknote className="size-3.5" aria-hidden="true" />
                            Encaisser
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="modal"
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        {selected ? (
          <PaymentForm key={selected.id} invoice={selected} currency={agency.currency} onClose={closeDialog} />
        ) : null}
      </dialog>
    </div>
  );
}

function ReminderButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendReminderAction(invoiceId);
      if (result?.ok) toast.success(result.message ?? "Relance envoyée");
      else if (result) toast.error(result.error);
    });
  }

  return (
    <button type="button" className="btn btn-secondary btn-sm" title="Relancer par SMS" aria-label="Relancer par SMS" disabled={pending} onClick={send}>
      {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
      <span className="hidden xl:inline">SMS</span>
    </button>
  );
}

function PaymentForm({ invoice, currency, onClose }: { invoice: Invoice; currency: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Paiement enregistré");
      onClose();
    }
  }, [state, onClose]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit}>
      <header className="modal-head">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Encaisser un loyer</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {invoice.tenantName} · {invoice.unitNumber} · {invoice.periodLabel}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm -mr-2" aria-label="Fermer" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="modal-body">
        <input type="hidden" name="invoice_id" value={invoice.id} />
        <div className="flex items-baseline justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">Reste à payer</span>
          <span className="money text-lg font-bold text-slate-900">{formatMoney(invoice.balance, currency)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pay-amount" className="label">Montant reçu ({currency})</label>
            <input
              id="pay-amount"
              name="amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={invoice.balance}
              step={1}
              required
              defaultValue={invoice.balance}
              className="input money"
            />
          </div>
          <div>
            <label htmlFor="pay-method" className="label">Mode de paiement</label>
            <select id="pay-method" name="method" className="input" defaultValue="ESPECES">
              {MANUAL_METHODS.map((method) => (
                <option key={method} value={method}>
                  {METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="pay-note" className="label">Note (facultatif)</label>
          <input id="pay-note" name="note" maxLength={200} className="input" placeholder="Référence du transfert, n° de chèque…" />
        </div>
        <p className="hint">Un montant inférieur au reste à payer est enregistré comme paiement partiel.</p>
        {state && !state.ok ? (
          <p role="alert" className="alert-error">
            {state.error}
          </p>
        ) : null}
      </div>

      <footer className="modal-foot">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          Enregistrer le paiement
        </button>
      </footer>
    </form>
  );
}
