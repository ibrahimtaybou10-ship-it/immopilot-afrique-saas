-- ============================================================================
-- ImmoPilot Afrique — écritures atomiques, plafond de lots en base, correctifs
--
--   * Création d'un bien (+ lots) et d'un bail (+ locataire + 1re échéance) en UN appel,
--     dans une seule transaction : plus rapide, et jamais d'état à moitié écrit.
--   * La première échéance n'est jamais antérieure à l'entrée dans les lieux.
--   * Le plafond de lots de l'offre est appliqué par la base (non contournable par l'API).
--   * Le pays de l'agence est demandé à l'inscription (plus de « Côte d'Ivoire » par défaut).
-- ============================================================================

-- Indication au planificateur : un compte appartient à une agence (la RLS exploite les index).
alter function public.my_agency_ids() rows 1;

-- ---------------------------------------------------------------------------
-- 1. Échéances
-- ---------------------------------------------------------------------------
-- Idempotent : une seule échéance par bail et par mois.
--   * utilisateur connecté : p_agency facultatif (son agence par défaut), sinon doit être la sienne ;
--   * rôle service (cron)  : p_agency null = toutes les agences.
create or replace function public.generate_rent_invoices(
  p_period text default null,
  p_agency uuid default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_agency uuid := p_agency;
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

  if v_uid is not null then
    if v_agency is null then
      select a into v_agency from public.my_agency_ids() a limit 1;
    end if;
    if v_agency is null or v_agency not in (select public.my_agency_ids()) then
      raise exception 'Accès refusé' using errcode = '42501';
    end if;
  end if;

  v_year := split_part(v_period, '-', 1)::int;
  v_month := split_part(v_period, '-', 2)::int;
  v_first := make_date(v_year, v_month, 1);
  v_label := (array['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
                    'Septembre', 'Octobre', 'Novembre', 'Décembre'])[v_month] || ' ' || v_year;

  insert into public.rent_payments
    (agency_id, lease_id, period_month, period_label, due_date, expected_amount, charges_amount, status)
  select l.agency_id, l.id, v_period, v_label,
         -- bail commencé après le jour d'échéance : le premier loyer est dû à l'entrée, pas « en retard »
         greatest(make_date(v_year, v_month, l.due_day), l.start_date),
         l.monthly_rent + l.charges_amount, l.charges_amount, 'UNPAID'
    from public.leases l
   where l.status = 'ACTIVE'
     and (v_agency is null or l.agency_id = v_agency)
     and l.start_date < (v_first + interval '1 month')::date
     and (l.end_date is null or l.end_date >= v_first)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Échéances déjà créées avec une date antérieure à l'entrée dans les lieux
update public.rent_payments rp
   set due_date = l.start_date
  from public.leases l
 where l.id = rp.lease_id
   and rp.status <> 'PAID'
   and rp.due_date < l.start_date;

-- ---------------------------------------------------------------------------
-- 2. Plafond de lots par offre (mêmes valeurs que lib/plans.ts — à modifier ensemble)
-- ---------------------------------------------------------------------------
create or replace function public.agency_unit_limit(p_agency uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case
           when a.subscription_status = 'TRIALING' and a.trial_ends_at > now() then 50  -- essai = offre Pro
           when a.subscription_status = 'ACTIVE'
                and (a.current_period_end is null or a.current_period_end > now()) then
             case a.subscription_plan when 'BUSINESS' then null when 'PRO' then 50 else 5 end
           else 5                                                                         -- offre Starter
         end
    from public.agencies a
   where a.id = p_agency
$$;

create or replace function public.enforce_unit_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_count integer;
begin
  v_limit := public.agency_unit_limit(new.agency_id);
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from public.units where agency_id = new.agency_id;
  if v_count >= v_limit then
    raise exception 'Votre offre est limitée à % lots. Passez à l''offre supérieure dans Paramètres.', v_limit;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_unit_limit on public.units;
create trigger trg_enforce_unit_limit
  before insert on public.units
  for each row execute function public.enforce_unit_limit();

-- ---------------------------------------------------------------------------
-- 3. Écritures atomiques (SECURITY INVOKER : la RLS s'applique à chaque ligne)
-- ---------------------------------------------------------------------------
create or replace function public.create_property_with_units(
  p_name text,
  p_property_type text,
  p_address text,
  p_city text,
  p_units_count integer,
  p_unit_type text,
  p_base_rent bigint,
  p_charges_amount bigint default 0
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_agency uuid;
  v_property uuid;
begin
  select a into v_agency from public.my_agency_ids() a limit 1;
  if v_agency is null then
    raise exception 'Aucune agence n''est associée à ce compte' using errcode = '42501';
  end if;
  if p_units_count is null or p_units_count < 1 or p_units_count > 200 then
    raise exception 'Nombre de lots invalide (1 à 200)';
  end if;

  insert into public.properties (agency_id, name, property_type, address, city)
  values (v_agency, btrim(p_name), p_property_type, btrim(p_address), btrim(p_city))
  returning id into v_property;

  insert into public.units (agency_id, property_id, unit_number, unit_type, base_rent, charges_amount)
  select v_agency, v_property,
         case when p_units_count = 1 then 'Lot unique' else 'Lot ' || n end,
         p_unit_type, p_base_rent, coalesce(p_charges_amount, 0)
    from generate_series(1, p_units_count) as n;

  return v_property;
end $$;

create or replace function public.create_unit(
  p_property_id uuid,
  p_unit_number text,
  p_unit_type text,
  p_base_rent bigint,
  p_charges_amount bigint default 0
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_agency uuid;
  v_unit uuid;
begin
  select agency_id into v_agency from public.properties where id = p_property_id;
  if v_agency is null then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;

  insert into public.units (agency_id, property_id, unit_number, unit_type, base_rent, charges_amount)
  values (v_agency, p_property_id, btrim(p_unit_number), p_unit_type, p_base_rent, coalesce(p_charges_amount, 0))
  returning id into v_unit;

  return v_unit;
end $$;

create or replace function public.create_lease_with_tenant(
  p_unit_id uuid,
  p_full_name text,
  p_phone text,
  p_start_date date,
  p_monthly_rent bigint,
  p_charges_amount bigint default 0,
  p_deposit_amount bigint default 0,
  p_due_day integer default 5,
  p_email text default null,
  p_profession text default null,
  p_id_card_number text default null
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_unit public.units;
  v_tenant uuid;
  v_lease uuid;
begin
  select * into v_unit from public.units where id = p_unit_id for update;
  if not found then
    raise exception 'Lot introuvable' using errcode = 'P0002';
  end if;
  if v_unit.is_occupied then
    raise exception 'Ce lot est déjà occupé par un bail actif';
  end if;

  insert into public.lease_tenants (agency_id, full_name, phone, email, profession, id_card_number)
  values (v_unit.agency_id, btrim(p_full_name), btrim(p_phone),
          nullif(btrim(p_email), ''), nullif(btrim(p_profession), ''), nullif(btrim(p_id_card_number), ''))
  returning id into v_tenant;

  insert into public.leases
    (agency_id, property_id, unit_id, tenant_id, start_date, monthly_rent, charges_amount, deposit_amount, due_day, status)
  values
    (v_unit.agency_id, v_unit.property_id, v_unit.id, v_tenant, p_start_date, p_monthly_rent,
     coalesce(p_charges_amount, 0), coalesce(p_deposit_amount, 0), coalesce(p_due_day, 5), 'ACTIVE')
  returning id into v_lease;

  -- Première échéance : celle du mois en cours si le bail a déjà commencé (appel idempotent).
  perform public.generate_rent_invoices(null, v_unit.agency_id);

  return v_lease;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tableau de bord : agence déduite du compte si absente (un aller-retour de moins par page)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_agency uuid, p_period text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_agency uuid := p_agency;
begin
  if v_agency is null then
    select a into v_agency from public.my_agency_ids() a limit 1;
  end if;

  return jsonb_build_object(
    'properties', (select count(*) from public.properties where agency_id = v_agency),
    'total_units', (select count(*) from public.units where agency_id = v_agency),
    'occupied_units', (select count(*) from public.units where agency_id = v_agency and is_occupied),
    'active_leases', (select count(*) from public.leases where agency_id = v_agency and status = 'ACTIVE'),
    'expected', coalesce((select sum(expected_amount) from public.rent_payments
                           where agency_id = v_agency and period_month = p_period), 0),
    'collected', coalesce((select sum(least(amount_paid, expected_amount)) from public.rent_payments
                            where agency_id = v_agency and period_month = p_period), 0),
    'invoices', (select count(*) from public.rent_payments where agency_id = v_agency and period_month = p_period),
    'outstanding_total', coalesce((select sum(greatest(expected_amount - amount_paid, 0)) from public.rent_payments
                                    where agency_id = v_agency and status <> 'PAID'), 0),
    'overdue_count', (select count(*) from public.rent_payments
                       where agency_id = v_agency and status <> 'PAID' and due_date < current_date),
    'overdue_amount', coalesce((select sum(greatest(expected_amount - amount_paid, 0)) from public.rent_payments
                                 where agency_id = v_agency and status <> 'PAID' and due_date < current_date), 0),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('period', s.period_month, 'expected', s.expected, 'collected', s.collected)
                       order by s.period_month)
        from (
          select period_month,
                 sum(expected_amount) as expected,
                 sum(least(amount_paid, expected_amount)) as collected
            from public.rent_payments
           where agency_id = v_agency
             and period_month <= p_period
             and period_month > to_char(to_date(p_period, 'YYYY-MM') - interval '6 months', 'YYYY-MM')
           group by period_month
        ) s
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5. Création d'agence : pays demandé, plus de ville ni de pays par défaut
-- ---------------------------------------------------------------------------
drop function if exists public.create_agency(text, text, text, text);

create or replace function public.create_agency(
  p_name text,
  p_account_type text default 'AGENCY',
  p_city text default null,
  p_phone text default null,
  p_country text default null
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

  insert into public.agencies (name, slug, plan, city, country, phone, email)
  values (
    btrim(p_name),
    v_slug,
    case when p_account_type = 'OWNER' then 'OWNER' else 'AGENCY' end,
    nullif(btrim(p_city), ''),
    nullif(btrim(p_country), ''),
    nullif(btrim(p_phone), ''),
    (select email from auth.users where id = v_uid)
  )
  returning id into v_id;

  insert into public.agency_members (agency_id, user_id, role) values (v_id, v_uid, 'OWNER');
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Privilèges
-- ---------------------------------------------------------------------------
revoke all on function public.enforce_unit_limit() from public, anon, authenticated;
revoke all on function public.agency_unit_limit(uuid) from public, anon, authenticated;

revoke all on function public.create_agency(text, text, text, text, text) from public, anon;
revoke all on function public.create_property_with_units(text, text, text, text, integer, text, bigint, bigint) from public, anon;
revoke all on function public.create_unit(uuid, text, text, bigint, bigint) from public, anon;
revoke all on function public.create_lease_with_tenant(uuid, text, text, date, bigint, bigint, bigint, integer, text, text, text) from public, anon;

grant execute on function public.create_agency(text, text, text, text, text) to authenticated;
grant execute on function public.create_property_with_units(text, text, text, text, integer, text, bigint, bigint) to authenticated;
grant execute on function public.create_unit(uuid, text, text, bigint, bigint) to authenticated;
grant execute on function public.create_lease_with_tenant(uuid, text, text, date, bigint, bigint, bigint, integer, text, text, text) to authenticated;
