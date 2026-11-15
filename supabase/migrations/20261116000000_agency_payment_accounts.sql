-- ============================================================================
-- Compte d'encaissement propre à chaque agence (SasPay)
--
-- Les loyers payés en ligne arrivent sur le compte SasPay DE L'AGENCE ; la plateforme
-- n'encaisse que les abonnements. Les clés de l'agence sont chiffrées dans Supabase Vault :
-- la table ne contient que des références et un indice d'affichage (« sk_live_…ab12 »).
-- Seul le serveur (rôle service) peut écrire ou déchiffrer ces clés.
-- ============================================================================

create table if not exists public.agency_payment_accounts (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  provider text not null default 'SASPAY' check (provider in ('SASPAY')),
  secret_key_id uuid not null,
  webhook_secret_id uuid,
  key_hint text not null,
  mode text not null check (mode in ('TEST', 'LIVE')),
  verified_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agency_payment_accounts enable row level security;

-- Les membres voient l'état (indice, mode, webhook configuré ou non), jamais les clés.
drop policy if exists agency_payment_accounts_select_member on public.agency_payment_accounts;
create policy agency_payment_accounts_select_member on public.agency_payment_accounts
  for select to authenticated
  using (agency_id in (select public.my_agency_ids()));

revoke all on public.agency_payment_accounts from anon;
revoke insert, update, delete on public.agency_payment_accounts from authenticated;

-- ---------------------------------------------------------------------------
-- Enregistrer / remplacer les clés d'une agence (rôle service uniquement).
--   p_webhook_secret : null = inchangé, '' = supprimé.
-- ---------------------------------------------------------------------------
create or replace function public.set_agency_saspay_account(
  p_agency uuid,
  p_secret_key text,
  p_webhook_secret text,
  p_key_hint text,
  p_mode text,
  p_user uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_row public.agency_payment_accounts;
  v_secret_id uuid;
  v_webhook_id uuid;
begin
  if p_secret_key is null or p_secret_key !~ '^sk_(test|live)_[A-Za-z0-9_-]{8,}$' then
    raise exception 'Clé SasPay invalide';
  end if;

  select * into v_row from public.agency_payment_accounts where agency_id = p_agency for update;

  if found then
    perform vault.update_secret(v_row.secret_key_id, p_secret_key);
    v_secret_id := v_row.secret_key_id;
    v_webhook_id := v_row.webhook_secret_id;
  else
    v_secret_id := vault.create_secret(p_secret_key, 'saspay_secret_' || p_agency::text, 'Clé SasPay de l''agence');
  end if;

  if p_webhook_secret is not null then
    if p_webhook_secret = '' then
      if v_webhook_id is not null then
        delete from vault.secrets where id = v_webhook_id;
      end if;
      v_webhook_id := null;
    elsif v_webhook_id is not null then
      perform vault.update_secret(v_webhook_id, p_webhook_secret);
    else
      v_webhook_id := vault.create_secret(p_webhook_secret, 'saspay_webhook_' || p_agency::text, 'Secret webhook SasPay de l''agence');
    end if;
  end if;

  insert into public.agency_payment_accounts
    (agency_id, secret_key_id, webhook_secret_id, key_hint, mode, verified_at, updated_by)
  values
    (p_agency, v_secret_id, v_webhook_id, p_key_hint, p_mode, now(), p_user)
  on conflict (agency_id) do update
    set secret_key_id = excluded.secret_key_id,
        webhook_secret_id = excluded.webhook_secret_id,
        key_hint = excluded.key_hint,
        mode = excluded.mode,
        verified_at = excluded.verified_at,
        updated_by = excluded.updated_by,
        updated_at = now();
end $$;

-- Clés déchiffrées d'une agence (rôle service uniquement).
create or replace function public.get_agency_saspay_credentials(p_agency uuid)
returns table (secret_key text, webhook_secret text)
language sql stable security definer set search_path = '' as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where id = a.secret_key_id),
    (select decrypted_secret from vault.decrypted_secrets where id = a.webhook_secret_id)
  from public.agency_payment_accounts a
  where a.agency_id = p_agency
$$;

-- Supprime le compte d'encaissement d'une agence et ses clés (rôle service uniquement).
create or replace function public.delete_agency_saspay_account(p_agency uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_row public.agency_payment_accounts;
begin
  select * into v_row from public.agency_payment_accounts where agency_id = p_agency for update;
  if not found then
    return;
  end if;
  delete from vault.secrets where id in (v_row.secret_key_id, v_row.webhook_secret_id);
  delete from public.agency_payment_accounts where agency_id = p_agency;
end $$;

revoke all on function public.set_agency_saspay_account(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.get_agency_saspay_credentials(uuid) from public, anon, authenticated;
revoke all on function public.delete_agency_saspay_account(uuid) from public, anon, authenticated;
grant execute on function public.set_agency_saspay_account(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.get_agency_saspay_credentials(uuid) to service_role;
grant execute on function public.delete_agency_saspay_account(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Page publique du locataire : paiement en ligne seulement si l'agence a son propre compte.
-- ---------------------------------------------------------------------------
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
    -- paiement en ligne : compte SasPay de l'agence configuré ET essai ou offre payante en cours
    'online_payment',
      exists (select 1 from public.agency_payment_accounts pa where pa.agency_id = a.id)
      and (
        (a.subscription_status = 'TRIALING' and a.trial_ends_at > now())
        or (a.subscription_status = 'ACTIVE' and a.subscription_plan <> 'STARTER'
            and (a.current_period_end is null or a.current_period_end > now()))
      ),
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

grant execute on function public.public_invoice(text) to anon, authenticated, service_role;
