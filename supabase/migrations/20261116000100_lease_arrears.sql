-- ============================================================================
-- Impayés antérieurs à l'enregistrement d'un locataire
--
-- À la création du bail, l'agence peut indiquer que le locataire doit déjà de l'argent
-- (loyers impayés avant son arrivée dans Loyéo). Ce montant devient une échéance
-- « Impayés antérieurs », en retard dès sa création : elle est relancée, encaissée
-- (même en plusieurs fois) et quittancée comme n'importe quel loyer.
-- ============================================================================

drop function if exists public.create_lease_with_tenant(uuid, text, text, date, bigint, bigint, bigint, integer, text, text, text);

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
  p_id_card_number text default null,
  p_arrears_amount bigint default 0,
  p_arrears_note text default null
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_unit public.units;
  v_tenant uuid;
  v_lease uuid;
  v_arrears_month date;
begin
  if coalesce(p_arrears_amount, 0) < 0 then
    raise exception 'Le montant des impayés ne peut pas être négatif';
  end if;

  select * into v_unit from public.units where id = p_unit_id for update;
  if not found then
    raise exception 'Lot introuvable' using errcode = 'P0002';
  end if;
  if v_unit.is_occupied then
    raise exception 'Ce lot est déjà occupé par un bail actif';
  end if;

  insert into public.lease_tenants (agency_id, full_name, phone, email, profession, id_card_number, payment_status)
  values (v_unit.agency_id, btrim(p_full_name), btrim(p_phone),
          nullif(btrim(p_email), ''), nullif(btrim(p_profession), ''), nullif(btrim(p_id_card_number), ''),
          case when coalesce(p_arrears_amount, 0) > 0 then 'LATE' else 'UP_TO_DATE' end)
  returning id into v_tenant;

  insert into public.leases
    (agency_id, property_id, unit_id, tenant_id, start_date, monthly_rent, charges_amount, deposit_amount, due_day, status)
  values
    (v_unit.agency_id, v_unit.property_id, v_unit.id, v_tenant, p_start_date, p_monthly_rent,
     coalesce(p_charges_amount, 0), coalesce(p_deposit_amount, 0), coalesce(p_due_day, 5), 'ACTIVE')
  returning id into v_lease;

  -- Impayés antérieurs : une échéance rattachée au mois qui précède l'entrée dans les lieux
  -- (jamais généré automatiquement pour ce bail, donc sans conflit), due la veille : en retard.
  if coalesce(p_arrears_amount, 0) > 0 then
    v_arrears_month := (date_trunc('month', p_start_date) - interval '1 month')::date;
    insert into public.rent_payments
      (agency_id, lease_id, period_month, period_label, due_date, expected_amount, charges_amount, status, notes)
    values
      (v_unit.agency_id, v_lease, to_char(v_arrears_month, 'YYYY-MM'), 'Impayés antérieurs',
       current_date - 1, p_arrears_amount, 0, 'UNPAID', nullif(btrim(p_arrears_note), ''));
  end if;

  -- Première échéance : celle du mois en cours si le bail a déjà commencé (appel idempotent).
  perform public.generate_rent_invoices(null, v_unit.agency_id);

  return v_lease;
end $$;

revoke all on function public.create_lease_with_tenant(uuid, text, text, date, bigint, bigint, bigint, integer, text, text, text, bigint, text) from public, anon;
grant execute on function public.create_lease_with_tenant(uuid, text, text, date, bigint, bigint, bigint, integer, text, text, text, bigint, text) to authenticated;
