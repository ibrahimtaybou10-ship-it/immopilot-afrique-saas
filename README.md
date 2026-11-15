# Loyéo

SaaS de gestion locative et de collecte mensuelle des loyers pour les agences immobilières et les
propriétaires bailleurs d'Afrique francophone (FCFA).

Chaque agence dispose d'un espace cloisonné : biens, lots, locataires, baux, échéances mensuelles,
encaissements, relances et quittances.

## Fonctionnalités

| Domaine | Ce que fait l'application |
| --- | --- |
| Comptes | Inscription, connexion, mot de passe oublié, création de l'agence à l'inscription |
| Biens & lots | Création d'un bien avec ses lots, occupation et revenu mensuel tenus à jour par la base |
| Baux | Locataire + lot + loyer + charges + caution + jour d'échéance ; résiliation avec libération du lot |
| Échéances | Générées chaque jour pour le mois en cours (sans doublon), ou à la demande |
| Encaissements | Paiements partiels ou complets, journal des transactions, quittance numérotée au solde |
| Relances | SMS en un clic, lien WhatsApp pré-rempli, relances automatiques (J-3, J+1, J+7, J+15) |
| Paiement en ligne | Page publique par échéance (`/pay/<jeton>`) : Mobile Money ou carte via SasPay ; chaque agence encaisse sur son propre compte |
| Quittances | PDF généré dans le navigateur, téléchargeable par l'agence et par le locataire |
| Mobile | Application installable sur l'écran d'accueil (Android, iPhone), plein écran, page hors connexion |
| Pilotage | Tableau de bord (occupation, attendu, encaissé, retards, 6 derniers mois), export CSV |
| Abonnement | Offres Starter / Pro / Business, essai de 14 jours, plafond de lots par offre |

## Pile technique

- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack) et **React 19**
- **Supabase** : PostgreSQL, authentification, Row Level Security
- **Tailwind CSS 4**, polices auto-hébergées (`next/font`)
- **TypeScript** strict, validation des saisies avec **Zod**

## Démarrage

Prérequis : Node.js 20.9 ou plus récent, un projet Supabase.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Renseignez `.env.local` (voir le tableau ci-dessous), appliquez la migration SQL, puis :

```bash
npm run dev
```

L'application est disponible sur http://localhost:3000.

### Base de données

Le schéma est dans `supabase/migrations/` (trois fichiers, à appliquer dans l'ordre de leur nom).
Utilisez la CLI Supabase (`supabase db push`) ou collez-les dans l'éditeur SQL du tableau de bord.

| Fichier | Contenu |
| --- | --- |
| `20261114000000_immopilot_saas.sql` | Tables, index, triggers, RLS, encaissements, échéances |
| `20261114000100_revoke_trigger_function_execute.sql` | Fonctions de trigger retirées de l'API |
| `20261115000000_atomic_writes_and_fixes.sql` | Écritures atomiques, plafond de lots, pays de l'agence |

Les migrations sont **idempotentes** : elles créent le schéma sur une base vierge, ou mettent à
niveau les tables de l'ancienne démo sans supprimer de données. Elles remplacent notamment les
anciennes politiques `USING (true)`, qui laissaient toutes les données lisibles avec la clé publique.

### Variables d'environnement

| Variable | Requise | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | oui en production | URL publique (liens de paiement, e-mails, webhook) |
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | oui | Clé publique (`NEXT_PUBLIC_SUPABASE_ANON_KEY` est aussi acceptée) |
| `SUPABASE_SERVICE_ROLE_KEY` | pour le cron et le paiement en ligne | Clé serveur, jamais exposée au navigateur |
| `CRON_SECRET` | pour le cron | Secret envoyé par Vercel Cron (`Authorization: Bearer …`) |
| `SASPAY_SECRET_KEY` | non | Clé secrète du compte SasPay de la plateforme : paiement des abonnements |
| `SASPAY_WEBHOOK_SECRET` | avec SasPay | Secret de signature du webhook SasPay |
| `INFOBIP_API_KEY`, `INFOBIP_BASE_URL` | non | Active l'envoi réel des SMS ; sans clé, ils sont simulés |

Dans Supabase (Authentication > URL Configuration), ajoutez `https://votre-domaine/auth/callback`
aux URL de redirection autorisées.

## Déploiement (Vercel)

1. Importez le dépôt dans Vercel et renseignez les variables d'environnement.
2. `vercel.json` déclare la tâche quotidienne `/api/cron/daily` (06:00 UTC) et la région `cdg1`
   (Paris). Choisissez la région la plus proche de votre base Supabase.
3. Dans le tableau de bord SasPay (Webhooks), créez un webhook vers
   `https://votre-domaine/api/webhooks/saspay`, abonné à `transaction.success`, et copiez son
   secret de signature dans `SASPAY_WEBHOOK_SECRET` (il n'est affiché qu'une fois).

## Organisation du code

```
app/
  page.tsx                      Page d'accueil publique (statique)
  (auth)/                       Connexion, inscription, mot de passe, onboarding
  auth/callback/                Retour des liens envoyés par e-mail
  dashboard/                    Espace de gestion (tableau de bord, biens, baux, loyers, paramètres)
  pay/[token]/                  Page publique de paiement et de quittance du locataire
  actions/                      Server Actions (toutes les écritures)
  api/cron/daily/               Échéances du mois + relances automatiques
  api/webhooks/saspay/          Confirmation des paiements en ligne (signature HMAC)
components/                     Composants d'interface
lib/                            Accès Supabase, offres, formats, messages, paiement, SMS, validation
proxy.ts                        Rafraîchissement de session et protection des routes privées
supabase/migrations/            Schéma SQL, RLS, fonctions métier
```

## Paiement en ligne : qui encaisse quoi

| Paiement | Compte qui reçoit l'argent | Configuration |
| --- | --- | --- |
| Abonnement d'une agence à Loyéo | Compte SasPay de la plateforme | `SASPAY_SECRET_KEY` et `SASPAY_WEBHOOK_SECRET` dans Vercel |
| Loyer payé par un locataire | Compte SasPay **de l'agence** | Clé saisie par l'agence dans Paramètres > Encaissement des loyers |

Les clés des agences sont vérifiées auprès de SasPay puis chiffrées dans Supabase Vault ; seul le
serveur peut les déchiffrer. Chaque agence a son propre webhook :
`/api/webhooks/saspay/agences/<identifiant de l'agence>` (l'adresse exacte est affichée dans Paramètres).

## Sécurité

- **Isolation par agence** : politiques RLS sur toutes les tables ; aucun accès anonyme direct.
- **Encaissements** : `apply_payment()` verrouille l'échéance, journalise la transaction et attribue
  le numéro de quittance dans une seule transaction SQL. Une notification rejouée n'encaisse pas deux fois.
- **Webhook** : le contenu reçu n'est jamais cru sur parole ; l'état du paiement est relu auprès de
  SasPay avec la clé secrète avant toute écriture ; la signature HMAC et l'horodatage du webhook sont vérifiés.
- **Abonnement** : l'offre d'une agence n'est modifiable ni par l'interface ni par l'API publique
  (privilèges de colonnes), seulement par le webhook. Le plafond de lots de l'offre est appliqué
  par un trigger de la base : il ne peut pas être contourné en appelant l'API directement.
- **Page de paiement** : accès par jeton aléatoire de 64 caractères, données strictement limitées.
- En-têtes HTTP de sécurité, protection contre les redirections ouvertes, clé serveur isolée (`server-only`).

## Performance

- Pages rendues côté serveur ; l'agence et les données d'une page partent dans une seule vague
  d'appels parallèles, et la mise en page ne bloque sur aucune requête (squelettes en streaming).
- Chaque écriture tient en un appel SQL atomique (`create_property_with_units`,
  `create_lease_with_tenant`, `apply_payment`) : un aller-retour, une transaction.
- Indicateurs du tableau de bord calculés en un seul appel SQL (`dashboard_summary`).
- Compteurs d'occupation tenus à jour par triggers : la liste des biens se lit sans agrégation.
- Recherche et filtres des échéances instantanés, sans requête.
- jsPDF chargé uniquement au clic sur « Quittance » ; aucune bibliothèque de graphiques.
- Session validée sans appel réseau quand le projet Supabase utilise des clés de signature asymétriques.

## Offres

La grille tarifaire (prix, plafonds de lots, fonctionnalités) est définie dans `lib/plans.ts`.

## Nom du produit

Le nom, le slogan et l'expéditeur SMS par défaut sont définis dans `lib/brand.ts` : modifiez ce fichier pour renommer toute l'application.

## Ancienne démo

`index.html` est la maquette statique d'origine, encore servie par GitHub Pages. Elle n'est pas
utilisée par l'application Next.js et pourra être supprimée une fois celle-ci déployée.
