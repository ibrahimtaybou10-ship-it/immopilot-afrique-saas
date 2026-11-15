-- ============================================================================
-- ImmoPilot Afrique — schéma SaaS multi-agences (PostgreSQL / Supabase)
--
-- Migration idempotente :
--   * base vierge  -> crée tout le schéma ;
--   * base de démo -> met à niveau les tables existantes sans rien supprimer.
--
-- Points clés :
--   * RLS stricte : un utilisateur ne voit que les données de son agence.
--     (remplace les anciennes politiques "USING (true)" ouvertes à anon)
--   * Encaissements atomiques via apply_payment() + journal payment_transactions.
--   * Génération mensuelle idempotente via generate_rent_invoices().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  rccm_number text,
  nif_number text,
  phone text,
  email text,
  address text,
  city text default 'Abidjan',
  country text default 'Côte d''Ivoire',
  currency text not null default 'FCFA',
  -- type de compte : OWNER = propriétaire bailleur, AGENCY = agence immobilière
  plan text not null default 'AGENCY' check (plan in ('OWNER', 'AGENCY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agencies
  add column if not exists subscription_plan text not null default 'STARTER'
    check (subscription_plan in ('STARTER', 'PRO', 'BUSINESS')),
  add column if not exists subscription_status text not null default 'TRIALING'
    check (subscription_status in ('TRIALING', 'ACTIVE', 'CANCELED')),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists current_period_end timestamptz,
  add column if not exists default_due_day integer not null default 5
    check (default_due_day between 1 and 28),
  add column if not exists sms_sender_id text,
  add column if not exists auto_reminders boolean not null default true,
  add column if not exists receipt_counter integer not null default 0;

create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'ADMIN' check (role in ('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT')),
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  property_type text not null default 'IMMEUBLE'
    check (property_type in ('IMMEUBLE', 'RESIDENCE', 'VILLA', 'COMMERCIAL')),
  address text not null,
  city text not null default 'Abidjan',
  -- compteurs maintenus par trigger (voir sync_property_counters)
  total_units integer not null default 0,
  occupied_units integer not null default 0 check (occupied_units >= 0),
  monthly_expected_revenue bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  unit_number text not null,
  unit_type text not null default 'F3',
  floor_number integer default 0,
  base_rent bigint not null check (base_rent >= 0),
  charges_amount bigint not null default 0 check (charges_amount >= 0),
  meter_electricity text,
  meter_water text,
  is_occupied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lease_tenants (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  profession text,
  employer text,
  id_card_number text,
  emergency_contact text,
  payment_status text not null default 'UP_TO_DATE'
    check (payment_status in ('UP_TO_DATE', 'PARTIAL', 'LATE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  tenant_id uuid not null references public.lease_tenants (id) on delete restrict,
  lease_reference text not null,
  start_date date not null,
  end_date date,
  monthly_rent bigint not null check (monthly_rent >= 0),
  deposit_amount bigint not null default 0 check (deposit_amount >= 0),
  deposit_paid boolean not null default true,
  due_day integer not null default 5 check (due_day between 1 and 28),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'TERMINATED', 'PENDING')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leases
  add column if not exists charges_amount bigint not null default 0 check (charges_amount >= 0),
  add column if not exists terminated_at timestamptz;

alter table public.leases
  alter column lease_reference set default
    ('BAIL-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)));

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  lease_id uuid not null references public.leases (id) on delete cascade,
  period_month text not null,          -- 'YYYY-MM'
  period_label text not null,          -- 'Novembre 2026'
  expected_amount bigint not null check (expected_amount >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  balance_due bigint generated always as (greatest(expected_amount - amount_paid, 0)) stored,
  status text not null default 'UNPAID' check (status in ('PAID', 'PARTIAL', 'UNPAID')),
  payment_method text,
  receipt_number text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rent_payments
  add column if not exists due_date date,
  add column if not exists charges_amount bigint not null default 0 check (charges_amount >= 0),
  add column if not exists pay_token text not null
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  add column if not exists reminder_count integer not null default 0,
  add column if not exists last_reminder_at timestamptz;

alter table public.rent_payments alter column payment_method drop default;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  rent_payment_id uuid references public.rent_payments (id) on delete cascade,
  kind text not null default 'RENT' check (kind in ('RENT', 'SUBSCRIPTION')),
  amount bigint not null check (amount > 0),
  method text not null,
  provider text not null default 'MANUAL' check (provider in ('MANUAL', 'CINETPAY')),
  provider_reference text unique,
  status text not null default 'SUCCEEDED' check (status in ('PENDING', 'SUCCEEDED', 'FAILED')),
  metadata jsonb not null default '{}'::jsonb,
  note text,
  recorded_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. CONTRAINTES HÉRITÉES DE LA BASE DE DÉMO (élargies / corrigées)
-- ---------------------------------------------------------------------------
alter table public.properties drop constraint if exists properties_total_units_check;
alter table public.properties alter column total_units set default 0;

alter table public.units drop constraint if exists units_unit_type_check;
alter table public.units add constraint units_unit_type_check
  check (unit_type in ('STUDIO', 'CHAMBRE', 'F2', 'F3', 'F4', 'F5', 'VILLA', 'DUPLEX', 'MAGASIN', 'BUREAU', 'ENTREPOT'));

alter table public.rent_payments drop constraint if exists rent_payments_payment_method_check;
alter table public.rent_payments add constraint rent_payments_payment_method_check
  check (payment_method is null or payment_method in (
    'ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY', 'WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'MOOV_MONEY', 'CARTE', 'SASPAY'));

-- Le numéro de quittance est unique par agence (et non plus globalement).
alter table public.rent_payments drop constraint if exists rent_payments_receipt_number_key;

-- Échéance des lignes existantes
update public.rent_payments rp
   set due_date = make_date(split_part(rp.period_month, '-', 1)::int, split_part(rp.period_month, '-', 2)::int, l.due_day)
  from public.leases l
 where l.id = rp.lease_id
   and rp.due_date is null
   and rp.period_month ~ '^\d{4}-(0[1-9]|1[0-2])$';

-- ---------------------------------------------------------------------------
-- 3. INDEX
-- ---------------------------------------------------------------------------
create index if not exists idx_agency_members_user_id on public.agency_members (user_id);
create index if not exists idx_properties_agency_id on public.properties (agency_id);
create index if not exists idx_units_agency_id on public.units (agency_id);
create index if not exists idx_units_property_id on public.units (property_id);
create index if not exists idx_lease_tenants_agency_id on public.lease_tenants (agency_id);
create index if not exists idx_leases_agency_status on public.leases (agency_id, status);
create index if not exists idx_leases_tenant_id on public.leases (tenant_id);
create index if not exists idx_leases_unit_id on public.leases (unit_id);
create index if not exists idx_leases_property_id on public.leases (property_id);
create unique index if not exists leases_one_active_per_unit on public.leases (unit_id) where status = 'ACTIVE';
create index if not exists idx_rent_payments_lease_id on public.rent_payments (lease_id);
create index if not exists idx_rent_payments_agency_period on public.rent_payments (agency_id, period_month);
create index if not exists idx_rent_payments_open on public.rent_payments (agency_id, due_date) where status <> 'PAID';
create unique index if not exists rent_payments_lease_period_month_key on public.rent_payments (lease_id, period_month);
create unique index if not exists rent_payments_pay_token_key on public.rent_payments (pay_token);
create unique index if not exists rent_payments_agency_receipt_key on public.rent_payments (agency_id, receipt_number);
create index if not exists idx_payment_transactions_rent_payment on public.payment_transactions (rent_payment_id);
create index if not exists idx_payment_transactions_agency on public.payment_transactions (agency_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. FONCTIONS UTILITAIRES & TRIGGERS
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['agencies', 'properties', 'units', 'lease_tenants', 'leases', 'rent_payments'] loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format('create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Agences de l'utilisateur courant (SECURITY DEFINER pour éviter la récursion RLS).
create or replace function public.my_agency_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select agency_id from public.agency_members where user_id = (select auth.uid())
$$;

create or replace function public.is_agency_admin(p_agency uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members
     where agency_id = p_agency and user_id = (select auth.uid()) and role in ('OWNER', 'ADMIN')
  )
$$;

-- Un lot est occupé s'il porte un bail actif.
create or replace function public.sync_unit_occupancy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new uuid;
  v_old uuid;
begin
  if tg_op <> 'DELETE' then v_new := new.unit_id; end if;
  if tg_op <> 'INSERT' then v_old := old.unit_id; end if;

  update public.units u
     set is_occupied = exists (select 1 from public.leases l where l.unit_id = u.id and l.status = 'ACTIVE')
   where u.id in (v_new, v_old);
  return null;
end $$;

drop trigger if exists trg_sync_unit_occupancy on public.leases;
create trigger trg_sync_unit_occupancy
  after insert or delete or update of status, unit_id on public.leases
  for each row execute function public.sync_unit_occupancy();

-- Compteurs dénormalisés des biens (lecture O(1) de la liste des biens).
create or replace function public.sync_property_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new uuid;
  v_old uuid;
begin
  if tg_op <> 'DELETE' then v_new := new.property_id; end if;
  if tg_op <> 'INSERT' then v_old := old.property_id; end if;

  update public.properties p
     set total_units = s.total,
         occupied_units = s.occupied,
         monthly_expected_revenue = s.revenue
    from (
      select p2.id,
             count(u.id) as total,
             count(u.id) filter (where u.is_occupied) as occupied,
             coalesce(sum(u.base_rent + u.charges_amount) filter (where u.is_occupied), 0) as revenue
        from public.properties p2
        left join public.units u on u.property_id = p2.id
       where p2.id in (v_new, v_old)
       group by p2.id
    ) s
   where p.id = s.id;
  return null;
end $$;

drop trigger if exists trg_sync_property_counters on public.units;
create trigger trg_sync_property_counters
  after insert or delete or update of is_occupied, base_rent, charges_amount, property_id on public.units
  for each row execute function public.sync_property_counters();

-- Remise à niveau des compteurs existants
update public.units u
   set is_occupied = exists (select 1 from public.leases l where l.unit_id = u.id and l.status = 'ACTIVE')
 where u.is_occupied is distinct from
       exists (select 1 from public.leases l where l.unit_id = u.id and l.status = 'ACTIVE');

update public.properties p
   set total_units = s.total, occupied_units = s.occupied, monthly_expected_revenue = s.revenue
  from (
    select p2.id,
           count(u.id) as total,
           count(u.id) filter (where u.is_occupied) as occupied,
           coalesce(sum(u.base_rent + u.charges_amount) filter (where u.is_occupied), 0) as revenue
      from public.properties p2
      left join public.units u on u.property_id = p2.id
     group by p2.id
  ) s
 where p.id = s.id;

-- ---------------------------------------------------------------------------
-- 5. FONCTIONS MÉTIER (RPC)
-- ---------------------------------------------------------------------------

-- Crée l'agence de l'utilisateur connecté et l'en rend propriétaire (onboarding).
create or replace function public.create_agency(
  p_name text,
  p_account_type text default 'AGENCY',
  p_city text default null,
  p_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select agency_id into v_id from public.agency_members where user_id = v_uid order by created_at limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Le nom de l''agence est requis';
  end if;

  v_slug := btrim(regexp_replace(
    translate(lower(btrim(p_name)), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc'), '[^a-z0-9]+', '-', 'g'), '-');
  v_slug := left(coalesce(nullif(v_slug, ''), 'agence'), 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.agencies (name, slug, plan, city, phone, email)
  values (
    btrim(p_name),
    v_slug,
    case when p_account_type = 'OWNER' then 'OWNER' else 'AGENCY' end,
    coalesce(nullif(btrim(p_city), ''), 'Abidjan'),
    nullif(btrim(p_phone), ''),
    (select email from auth.users where id = v_uid)
  )
  returning id into v_id;

  insert into public.agency_members (agency_id, user_id, role) values (v_id, v_uid, 'OWNER');
  return v_id;
end $$;

-- Enregistre un encaissement de façon atomique et idempotente.
--   * verrouille l'échéance, journalise la transaction, met à jour le solde ;
--   * attribue un numéro de quittance séquentiel par agence au solde complet ;
--   * p_reference (référence prestataire) rend l'appel rejouable sans doublon.
create or replace function public.apply_payment(
  p_rent_payment_id uuid,
  p_amount bigint,
  p_method text,
  p_provider text default 'MANUAL',
  p_reference text default null,
  p_note text default null
) returns public.rent_payments language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.rent_payments;
  v_uid uuid := auth.uid();
  v_new_paid bigint;
  v_counter integer;
  v_receipt text;
begin
  select * into v_inv from public.rent_payments where id = p_rent_payment_id for update;
  if not found then
    raise exception 'Échéance introuvable' using errcode = 'P0002';
  end if;

  if v_uid is not null and v_inv.agency_id not in (select public.my_agency_ids()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant doit être supérieur à zéro';
  end if;

  if p_reference is not null and exists (
    select 1 from public.payment_transactions where provider_reference = p_reference and status = 'SUCCEEDED'
  ) then
    return v_inv; -- déjà appliqué (webhook rejoué)
  end if;

  if p_provider = 'MANUAL' and p_amount > v_inv.expected_amount - v_inv.amount_paid then
    raise exception 'Le montant dépasse le reste à payer';
  end if;

  update public.payment_transactions
     set status = 'SUCCEEDED', amount = p_amount, method = p_method, paid_at = now()
   where p_reference is not null and provider_reference = p_reference;
  if not found then
    insert into public.payment_transactions
      (agency_id, rent_payment_id, kind, amount, method, provider, provider_reference, status, note, recorded_by, paid_at)
    values
      (v_inv.agency_id, v_inv.id, 'RENT', p_amount, p_method, p_provider, p_reference, 'SUCCEEDED', p_note, v_uid, now());
  end if;

  v_new_paid := v_inv.amount_paid + p_amount;

  if v_new_paid >= v_inv.expected_amount and v_inv.receipt_number is null then
    update public.agencies set receipt_counter = receipt_counter + 1
     where id = v_inv.agency_id
     returning receipt_counter into v_counter;
    v_receipt := 'QUIT-' || to_char(now(), 'YYYY') || '-' || lpad(v_counter::text, 5, '0');
  end if;

  update public.rent_payments
     set amount_paid = v_new_paid,
         status = case when v_new_paid >= expected_amount then 'PAID' else 'PARTIAL' end,
         payment_method = p_method,
         receipt_number = coalesce(receipt_number, v_receipt),
         paid_at = case when v_new_paid >= expected_amount then now() else paid_at end
   where id = v_inv.id
   returning * into v_inv;

  return v_inv;
end $$;

-- Génère les échéances d'une période ('YYYY-MM') pour les baux actifs.
-- Idempotent : une seule échéance par bail et par mois.
--   * utilisateur connecté : p_agency obligatoire et doit être la sienne ;
--   * rôle service (cron)  : p_agency null = toutes les agences.
create or replace function public.generate_rent_invoices(
  p_period text default null,
  p_agency uuid default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_period text := coalesce(p_period, to_char(now() at time zone 'UTC', 'YYYY-MM'));
  v_year integer;
  v_month integer;
  v_first date;
  v_label text;
  v_count integer;
begin
  if v_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Période invalide (format attendu : AAAA-MM)';
  end if;

  if v_uid is not null and (p_agency is null or p_agency not in (select public.my_agency_ids())) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  v_year := split_part(v_period, '-', 1)::int;
  v_month := split_part(v_period, '-', 2)::int;
  v_first := make_date(v_year, v_month, 1);
  v_label := (array['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
                    'Septembre', 'Octobre', 'Novembre', 'Décembre'])[v_month] || ' ' || v_year;

  insert into public.rent_payments
    (agency_id, lease_id, period_month, period_label, due_date, expected_amount, charges_amount, status)
  select l.agency_id, l.id, v_period, v_label, make_date(v_year, v_month, l.due_day),
         l.monthly_rent + l.charges_amount, l.charges_amount, 'UNPAID'
    from public.leases l
   where l.status = 'ACTIVE'
     and (p_agency is null or l.agency_id = p_agency)
     and l.start_date < (v_first + interval '1 month')::date
     and (l.end_date is null or l.end_date >= v_first)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Indicateurs du tableau de bord en un seul aller-retour (RLS appliquée : SECURITY INVOKER).
create or replace function public.dashboard_summary(p_agency uuid, p_period text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'properties', (select count(*) from public.properties where agency_id = p_agency),
    'total_units', (select count(*) from public.units where agency_id = p_agency),
    'occupied_units', (select count(*) from public.units where agency_id = p_agency and is_occupied),
    'active_leases', (select count(*) from public.leases where agency_id = p_agency and status = 'ACTIVE'),
    'expected', coalesce((select sum(expected_amount) from public.rent_payments
                           where agency_id = p_agency and period_month = p_period), 0),
    'collected', coalesce((select sum(least(amount_paid, expected_amount)) from public.rent_payments
                            where agency_id = p_agency and period_month = p_period), 0),
    'invoices', (select count(*) from public.rent_payments where agency_id = p_agency and period_month = p_period),
    'outstanding_total', coalesce((select sum(greatest(expected_amount - amount_paid, 0)) from public.rent_payments
                                    where agency_id = p_agency and status <> 'PAID'), 0),
    'overdue_count', (select count(*) from public.rent_payments
                       where agency_id = p_agency and status <> 'PAID' and due_date < current_date),
    'overdue_amount', coalesce((select sum(greatest(expected_amount - amount_paid, 0)) from public.rent_payments
                                 where agency_id = p_agency and status <> 'PAID' and due_date < current_date), 0),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('period', s.period_month, 'expected', s.expected, 'collected', s.collected)
                       order by s.period_month)
        from (
          select period_month,
                 sum(expected_amount) as expected,
                 sum(least(amount_paid, expected_amount)) as collected
            from public.rent_payments
           where agency_id = p_agency
             and period_month <= p_period
             and period_month > to_char(to_date(p_period, 'YYYY-MM') - interval '6 months', 'YYYY-MM')
           group by period_month
        ) s
    ), '[]'::jsonb)
  )
$$;

-- Vue publique d'une échéance à partir de son jeton secret (page de paiement locataire).
-- N'expose que le strict nécessaire ; le jeton fait 64 caractères hexadécimaux.
create or replace function public.public_invoice(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', rp.id,
    'period_month', rp.period_month,
    'period_label', rp.period_label,
    'due_date', rp.due_date,
    'expected_amount', rp.expected_amount,
    'charges_amount', rp.charges_amount,
    'amount_paid', rp.amount_paid,
    'status', rp.status,
    'payment_method', rp.payment_method,
    'receipt_number', rp.receipt_number,
    'paid_at', rp.paid_at,
    'tenant_name', t.full_name,
    'unit_number', u.unit_number,
    'property_name', p.name,
    'property_address', p.address,
    'property_city', p.city,
    -- paiement en ligne : essai en cours ou abonnement payant non échu (même règle que lib/plans.ts)
    'online_payment',
      (a.subscription_status = 'TRIALING' and a.trial_ends_at > now())
      or (a.subscription_status = 'ACTIVE' and a.subscription_plan <> 'STARTER'
          and (a.current_period_end is null or a.current_period_end > now())),
    'agency', jsonb_build_object(
      'name', a.name, 'phone', a.phone, 'email', a.email, 'address', a.address,
      'city', a.city, 'country', a.country, 'rccm_number', a.rccm_number, 'currency', a.currency)
  )
    from public.rent_payments rp
    join public.leases l on l.id = rp.lease_id
    join public.lease_tenants t on t.id = l.tenant_id
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = l.property_id
    join public.agencies a on a.id = rp.agency_id
   where length(p_token) >= 32 and rp.pay_token = p_token
$$;

-- ---------------------------------------------------------------------------
-- 6. SÉCURITÉ : RLS + PRIVILÈGES
-- ---------------------------------------------------------------------------
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.lease_tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_payments enable row level security;
alter table public.payment_transactions enable row level security;

-- Anciennes politiques de démo : USING (true) pour anon => données ouvertes à tous.
drop policy if exists agency_isolation_agencies on public.agencies;
drop policy if exists agency_isolation_agency_members on public.agency_members;
drop policy if exists agency_isolation_properties on public.properties;
drop policy if exists agency_isolation_units on public.units;
drop policy if exists agency_isolation_lease_tenants on public.lease_tenants;
drop policy if exists agency_isolation_leases on public.leases;
drop policy if exists agency_isolation_rent_payments on public.rent_payments;

drop policy if exists agencies_select_member on public.agencies;
create policy agencies_select_member on public.agencies
  for select to authenticated
  using (id in (select public.my_agency_ids()));

drop policy if exists agencies_update_admin on public.agencies;
create policy agencies_update_admin on public.agencies
  for update to authenticated
  using ((select public.is_agency_admin(id)))
  with check ((select public.is_agency_admin(id)));

drop policy if exists agency_members_select_member on public.agency_members;
create policy agency_members_select_member on public.agency_members
  for select to authenticated
  using (agency_id in (select public.my_agency_ids()));

do $$
declare t text;
begin
  foreach t in array array['properties', 'units', 'lease_tenants', 'leases', 'rent_payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_member_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (agency_id in (select public.my_agency_ids()))
         with check (agency_id in (select public.my_agency_ids()))',
      t || '_member_all', t);
  end loop;
end $$;

-- Journal des transactions : lecture seule côté client (écriture via apply_payment / rôle service).
drop policy if exists payment_transactions_select_member on public.payment_transactions;
create policy payment_transactions_select_member on public.payment_transactions
  for select to authenticated
  using (agency_id in (select public.my_agency_ids()));

-- Aucun accès anonyme direct aux tables.
revoke all on public.agencies, public.agency_members, public.properties, public.units,
              public.lease_tenants, public.leases, public.rent_payments, public.payment_transactions
  from anon;

-- Agences : l'abonnement et le compteur de quittances ne sont pas modifiables par le client.
revoke insert, update, delete on public.agencies from authenticated;
grant update (name, plan, rccm_number, nif_number, phone, email, address, city, country,
              default_due_day, sms_sender_id, auto_reminders)
  on public.agencies to authenticated;

revoke insert, update, delete on public.agency_members from authenticated;
revoke insert, update, delete on public.payment_transactions from authenticated;

-- Fonctions : pas d'exécution anonyme, sauf la vue publique par jeton.
revoke all on function public.my_agency_ids() from public, anon;
revoke all on function public.is_agency_admin(uuid) from public, anon;
revoke all on function public.create_agency(text, text, text, text) from public, anon;
revoke all on function public.apply_payment(uuid, bigint, text, text, text, text) from public, anon;
revoke all on function public.generate_rent_invoices(text, uuid) from public, anon;
revoke all on function public.dashboard_summary(uuid, text) from public, anon;

grant execute on function public.my_agency_ids() to authenticated, service_role;
grant execute on function public.is_agency_admin(uuid) to authenticated, service_role;
grant execute on function public.create_agency(text, text, text, text) to authenticated;
grant execute on function public.apply_payment(uuid, bigint, text, text, text, text) to authenticated, service_role;
grant execute on function public.generate_rent_invoices(text, uuid) to authenticated, service_role;
grant execute on function public.dashboard_summary(uuid, text) to authenticated, service_role;
grant execute on function public.public_invoice(text) to anon, authenticated, service_role;
