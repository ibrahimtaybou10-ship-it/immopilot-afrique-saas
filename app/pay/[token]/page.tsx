import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, Clock, Phone } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PayButton } from "@/components/pay-button";
import { ReceiptButton } from "@/components/receipt-button";
import { BRAND } from "@/lib/brand";
import { formatDate, formatMoney, methodLabel } from "@/lib/format";
import { isPaymentProviderConfigured } from "@/lib/payments/cinetpay";
import { todayISO } from "@/lib/periods";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AgencyCard, InvoiceStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Paiement du loyer",
  robots: { index: false, follow: false },
};

interface PublicInvoice {
  period_label: string;
  due_date: string | null;
  expected_amount: number;
  charges_amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  payment_method: string | null;
  receipt_number: string | null;
  paid_at: string | null;
  tenant_name: string;
  unit_number: string;
  property_name: string;
  property_address: string;
  property_city: string;
  online_payment: boolean;
  agency: AgencyCard;
}

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ retour?: string }>;
}

/**
 * Page publique du locataire, ouverte depuis le lien reçu par SMS ou WhatsApp.
 * Aucun compte requis : l'accès repose sur le jeton secret de l'échéance.
 */
export default async function PayPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { retour } = await searchParams;
  if (!isSupabaseConfigured || !/^[0-9a-f]{64}$/.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("public_invoice", { p_token: token });
  const invoice = data as PublicInvoice | null;
  if (!invoice) notFound();

  const { agency } = invoice;
  const currency = agency.currency;
  const expected = Number(invoice.expected_amount);
  const paid = Number(invoice.amount_paid);
  const balance = Math.max(expected - paid, 0);
  const isPaid = invoice.status === "PAID";
  const overdue = !isPaid && (invoice.due_date ?? "") < todayISO();
  const canPayOnline = !isPaid && invoice.online_payment && isPaymentProviderConfigured() && isAdminConfigured();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <header className="flex items-center gap-3">
        <LogoMark className="size-10" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{agency.name}</p>
          <p className="text-xs text-slate-500">Loyer de {invoice.period_label}</p>
        </div>
      </header>

      <section className="card mt-6 overflow-hidden">
        <div className={`px-6 py-7 text-center ${isPaid ? "bg-emerald-50" : overdue ? "bg-rose-50" : "bg-slate-50"}`}>
          {isPaid ? (
            <>
              <CircleCheck className="mx-auto size-10 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-emerald-800">Loyer réglé</p>
              <p className="money mt-1 text-3xl font-bold text-slate-900">{formatMoney(expected, currency)}</p>
              <p className="mt-1 text-xs text-slate-600">
                Payé le {formatDate(invoice.paid_at)} · {methodLabel(invoice.payment_method)}
              </p>
            </>
          ) : (
            <>
              <p className={`text-sm font-semibold ${overdue ? "text-rose-700" : "text-slate-600"}`}>
                {overdue ? "Reste à payer, échéance dépassée" : "Reste à payer"}
              </p>
              <p className="money mt-1 text-4xl font-bold tracking-tight text-slate-900">{formatMoney(balance, currency)}</p>
              <p className="mt-1 text-xs text-slate-600">Échéance : {formatDate(invoice.due_date)}</p>
            </>
          )}
        </div>

        <dl className="space-y-2.5 px-6 py-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Locataire</dt>
            <dd className="text-right font-semibold text-slate-900">{invoice.tenant_name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Logement</dt>
            <dd className="text-right font-semibold text-slate-900">
              {invoice.property_name} · {invoice.unit_number}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Loyer</dt>
            <dd className="money text-right">{formatMoney(expected - Number(invoice.charges_amount), currency)}</dd>
          </div>
          {Number(invoice.charges_amount) > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Charges</dt>
              <dd className="money text-right">{formatMoney(invoice.charges_amount, currency)}</dd>
            </div>
          ) : null}
          {!isPaid && paid > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Déjà versé</dt>
              <dd className="money text-right text-emerald-700">{formatMoney(paid, currency)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="border-t border-slate-100 px-6 py-5">
          {isPaid && invoice.receipt_number ? (
            <ReceiptButton
              className="btn btn-primary w-full py-3"
              label={`Télécharger la quittance ${invoice.receipt_number}`}
              data={{
                agency,
                receiptNumber: invoice.receipt_number,
                periodLabel: invoice.period_label,
                paidAt: invoice.paid_at,
                method: invoice.payment_method,
                tenantName: invoice.tenant_name,
                propertyName: invoice.property_name,
                propertyAddress: invoice.property_address,
                propertyCity: invoice.property_city,
                unitNumber: invoice.unit_number,
                expected,
                charges: Number(invoice.charges_amount),
              }}
            />
          ) : null}

          {!isPaid && retour ? (
            <p className="alert-info mb-4 flex items-start gap-2.5" role="status">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Paiement en cours de confirmation. Cette page se met à jour dès que l'opérateur valide la transaction : actualisez-la dans un instant.
            </p>
          ) : null}

          {canPayOnline ? (
            <>
              <PayButton token={token} label={`Payer ${formatMoney(balance, currency)}`} />
              <p className="mt-3 text-center text-xs text-slate-500">Wave · Orange Money · MTN MoMo · Moov Money · carte bancaire</p>
            </>
          ) : null}

          {!isPaid && !canPayOnline ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Comment régler ?</p>
              <p className="mt-1">
                Réglez ce loyer directement auprès de {agency.name} (espèces, Mobile Money ou virement). Votre quittance
                sera disponible sur cette page dès l'encaissement.
              </p>
              {agency.phone ? (
                <a href={`tel:${agency.phone.replace(/\s/g, "")}`} className="btn btn-secondary mt-3 w-full">
                  <Phone className="size-4" aria-hidden="true" /> {agency.phone}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <footer className="mt-auto pt-8 text-center text-xs text-slate-400">
        {[agency.address, agency.city].filter(Boolean).join(", ")}
        <br />
        Page sécurisée · propulsée par {BRAND.name}
      </footer>
    </main>
  );
}
