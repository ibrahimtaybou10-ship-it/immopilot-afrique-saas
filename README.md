# 🌍 ImmoPilot Afrique — SaaS B2B de Gestion Locative & Collecte de Loyers

Plateforme SaaS B2B full-stack conçue pour les agences immobilières et propriétaires en Afrique francophone (**Koffi & Associés Immobilier**).

## 🚀 Liens en Direct
- **Application Web Live (GitHub Pages)** : https://ibrahimtaybou10-ship-it.github.io/immopilot-afrique-saas/
- **Application Web Live (Supabase Edge)** : https://htmlpreview.github.io/?https://ylcotthjwikggxytolol.supabase.co/functions/v1/simcity-immo/web
- **Base de données Supabase PostgreSQL (RLS)** : `https://ylcotthjwikggxytolol.supabase.co`

## 🏗️ Architecture du Projet
- `supabase/schema.sql` : Schéma PostgreSQL Multi-Tenant complet + Politiques Row Level Security (RLS) + Index d'unicité anti-doublon.
- `middleware.ts` & `app/(auth)/login/page.tsx` : Authentification `@supabase/ssr` et protection des routes `/dashboard/*`.
- `app/actions/mutations.ts` : Server Actions (`createProperty`, `createTenantAndLease`) avec `revalidatePath`.
- `app/actions/payments.ts` & `app/api/webhooks/saspay/route.ts` : Paiement Mobile Money (**Wave, Orange Money, MTN MoMo**) en FCFA et confirmation automatique par SMS.
- `app/api/cron/generate-rents/route.ts` & `vercel.json` : Facturation automatique des loyers chaque 1er du mois à 06h00 UTC (idempotente).
- `app/services/notifications.ts` & `app/actions/notifications.ts` : Service d'envoi de relances SMS/WhatsApp (`sendRentReminder`) et de confirmations de paiement (`sendPaymentConfirmation`).
- `app/dashboard/rent-roll/DownloadReceiptButton.tsx` : Génération instantanée de Quittances de Loyer légales en PDF (`jsPDF`).
- `index.html` : Interface SaaS B2B autonome connectée en temps réel à Supabase.
