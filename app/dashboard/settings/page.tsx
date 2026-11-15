import type { Metadata } from "next";
import { Check } from "lucide-react";
import { startSubscriptionCheckoutAction } from "@/app/actions/billing";
import { updateAgencyAction } from "@/app/actions/settings";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { getAgencyContext, requireSession } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { formatDate, formatMoney } from "@/lib/format";
import { isPaymentProviderConfigured, isTestMode } from "@/lib/payments/saspay";
import { settleRecentPending } from "@/lib/payments/settle";
import { createAdminClient, isAdminConfigured, serviceKeyIssue } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/url";
import { PLANS, PLAN_ORDER, effectivePlan, trialDaysLeft } from "@/lib/plans";
import { isSmsConfigured } from "@/lib/sms";

export const metadata: Metadata = { title: "Paramètres" };

interface Props {
  searchParams: Promise<{ paiement?: string }>;
}

export default async function SettingsPage({ searchParams }: Props) {
  const { paiement } = await searchParams;
  const { supabase, userId } = await requireSession();

  // Retour depuis la page SasPay : l'abonnement est confirmé tout de suite (revérifié chez SasPay).
  let justPaid = false;
  if (paiement === "retour" && isPaymentProviderConfigured() && isAdminConfigured()) {
    const admin = createAdminClient();
    const { data: member } = await admin.from("agency_members").select("agency_id").eq("user_id", userId).limit(1).maybeSingle();
    if (member) {
      const counts = await settleRecentPending(admin, await getAppUrl(), { agencyId: member.agency_id, limit: 5 });
      justPaid = counts.paid > 0;
    }
  }

  const [{ agency, role }, { count: unitCount }] = await Promise.all([
    getAgencyContext(),
    supabase.from("units").select("id", { count: "exact", head: true }),
  ]);

  const currentId = effectivePlan(agency);
  const current = PLANS[currentId];
  const daysLeft = trialDaysLeft(agency);
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const units = unitCount ?? 0;
  const usage = current.maxUnits ? Math.min(Math.round((units / current.maxUnits) * 100), 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Paramètres</h1>
        <p className="page-sub">Coordonnées de l'agence, relances et abonnement.</p>
      </div>

      {isAdmin && isPaymentProviderConfigured() && serviceKeyIssue() ? (
        <p className="alert-error" role="alert">
          Paiement en ligne bloqué : {serviceKeyIssue()}
        </p>
      ) : null}

      {justPaid ? (
        <p className="alert-success" role="status">
          Paiement confirmé : votre abonnement est actif. Merci !
        </p>
      ) : paiement === "retour" ? (
        <p className="alert-info" role="status">
          Paiement en cours de confirmation. Votre offre est mise à jour dès que le prestataire valide la transaction ;
          actualisez cette page dans un instant.
        </p>
      ) : null}

      {/* Abonnement */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-base font-bold text-slate-900">Abonnement</h2>
            <p className="mt-1 text-sm text-slate-600">
              Offre actuelle : <strong>{current.name}</strong>
              {daysLeft > 0 ? ` (essai gratuit, ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""})` : ""}
              {agency.subscription_status === "ACTIVE" && agency.current_period_end && currentId !== "STARTER"
                ? ` · valable jusqu'au ${formatDate(agency.current_period_end)}`
                : ""}
            </p>
          </div>
          <div className="sm:w-64">
            <div className="flex items-baseline justify-between text-xs text-slate-600">
              <span>Lots gérés</span>
              <span className="money font-semibold">
                {units} / {current.maxUnits ?? "illimité"}
              </span>
            </div>
            {current.maxUnits ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className={`h-full rounded-full ${usage >= 100 ? "bg-rose-500" : "bg-brand-600"}`} style={{ width: `${usage}%` }} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = id === currentId;
            return (
              <article key={id} className={`flex flex-col rounded-xl border p-5 ${isCurrent ? "border-brand-600 ring-1 ring-brand-600" : "border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{plan.name}</h3>
                  {isCurrent ? <span className="badge badge-blue">Offre actuelle</span> : null}
                </div>
                <p className="mt-2">
                  <span className="money text-2xl font-bold text-slate-900">{formatMoney(plan.price, "").trim()}</span>{" "}
                  <span className="text-xs text-slate-500">FCFA / mois</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-xs text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.price > 0 && isAdmin && (!isCurrent || agency.subscription_status !== "ACTIVE") ? (
                  <ActionButton action={startSubscriptionCheckoutAction.bind(null, id)} className="btn btn-primary mt-5 w-full">
                    {isCurrent ? "S'abonner" : `Passer à ${plan.name}`}
                  </ActionButton>
                ) : null}
              </article>
            );
          })}
        </div>
        {!isPaymentProviderConfigured() ? (
          <p className="hint mt-4">
            Le paiement en ligne de l'abonnement n'est pas encore activé sur cette plateforme (clé SasPay non renseignée).
          </p>
        ) : isTestMode() ? (
          <p className="hint mt-4">Mode test SasPay : aucun argent réel n'est débité.</p>
        ) : (
          <p className="hint mt-4">Paiement sécurisé par SasPay : mobile money ou carte bancaire.</p>
        )}
      </section>

      {/* Agence */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900">Coordonnées de l'agence</h2>
        <p className="mt-1 text-sm text-slate-600">Elles figurent sur les quittances et dans les messages envoyés aux locataires.</p>

        <div className="mt-5 max-w-3xl">
          <ActionForm action={updateAgencyAction} submitLabel="Enregistrer" submitClassName="btn btn-primary">
            <fieldset disabled={!isAdmin} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="ag-name" className="label">Nom</label>
                  <input id="ag-name" name="name" required maxLength={80} className="input" defaultValue={agency.name} />
                </div>
                <div>
                  <label htmlFor="ag-phone" className="label">Téléphone</label>
                  <input id="ag-phone" name="phone" type="tel" className="input money" defaultValue={agency.phone ?? ""} placeholder="+225 27 22 44 88 00" />
                </div>
                <div>
                  <label htmlFor="ag-email" className="label">E-mail de contact</label>
                  <input id="ag-email" name="email" type="email" className="input" defaultValue={agency.email ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ag-address" className="label">Adresse</label>
                  <input id="ag-address" name="address" maxLength={160} className="input" defaultValue={agency.address ?? ""} placeholder="Boulevard Latrille, Cocody" />
                </div>
                <div>
                  <label htmlFor="ag-city" className="label">Ville</label>
                  <input id="ag-city" name="city" maxLength={60} className="input" defaultValue={agency.city ?? ""} />
                </div>
                <div>
                  <label htmlFor="ag-country" className="label">Pays</label>
                  <input id="ag-country" name="country" maxLength={60} className="input" defaultValue={agency.country ?? ""} />
                </div>
                <div>
                  <label htmlFor="ag-rccm" className="label">N° RCCM</label>
                  <input id="ag-rccm" name="rccm_number" maxLength={60} className="input money" defaultValue={agency.rccm_number ?? ""} />
                </div>
                <div>
                  <label htmlFor="ag-nif" className="label">N° contribuable (NIF / NCC)</label>
                  <input id="ag-nif" name="nif_number" maxLength={60} className="input money" defaultValue={agency.nif_number ?? ""} />
                </div>
              </div>

              <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ag-due" className="label">Jour d'échéance par défaut</label>
                  <input id="ag-due" name="default_due_day" type="number" min={1} max={28} required className="input money" defaultValue={agency.default_due_day} />
                  <p className="hint">Proposé à la création de chaque nouveau bail.</p>
                </div>
                <div>
                  <label htmlFor="ag-sender" className="label">Nom d'expéditeur des SMS</label>
                  <input id="ag-sender" name="sms_sender_id" maxLength={11} className="input money" defaultValue={agency.sms_sender_id ?? ""} placeholder={BRAND.smsSender} />
                  <p className="hint">
                    3 à 11 lettres ou chiffres.{" "}
                    {isSmsConfigured() ? "" : "Aucune passerelle SMS n'est configurée : les SMS sont simulés."}
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input type="checkbox" name="auto_reminders" defaultChecked={agency.auto_reminders} className="mt-0.5 size-4 rounded border-slate-300 accent-brand-700" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Relances automatiques</span>
                  <span className="block text-xs text-slate-600">
                    Un SMS part 3 jours avant l'échéance, puis 1, 7 et 15 jours après si le loyer n'est pas soldé.
                    {current.autoReminders ? "" : ` Disponible à partir de l'offre ${PLANS.PRO.name}.`}
                  </span>
                </span>
              </label>
            </fieldset>
          </ActionForm>
          {!isAdmin ? <p className="hint">Seul un administrateur de l'agence peut modifier ces informations.</p> : null}
        </div>
      </section>
    </div>
  );
}
