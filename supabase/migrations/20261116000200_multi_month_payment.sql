-- ============================================================================
-- Encaissement de plusieurs mois en une fois
--
-- Le locataire paie le mois choisi ET les suivants (paiement d'avance) : chaque mois
-- devient une échéance soldée, avec sa propre quittance. Les échéances futures qui
-- n'existent pas encore sont créées. Tout se fait dans une seule transaction.
-- ============================================================================

create or replace function public.pay_months(
  p_rent_payment_id uuid,
  p_months integer,
  p_method text,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.rent_payments;
  v_lease public.leases;
  v_row public.rent_payments;
  v_first date;
  v_period text;
  v_label text;
  v_id uuid;
  v_balance bigint;
  v_paid integer := 0;
  v_total bigint := 0;
  v_receipts text[] := '{}';
  v_last_label text;
  k integer;
begin
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'Nombre de mois invalide (1 à 24)';
  end if;

  select * into v_inv from public.rent_payments where id = p_rent_payment_id;
  if not found then
    raise exception 'Échéance introuvable' using errcode = 'P0002';
  end if;
  if v_uid is null or v_inv.agency_id not in (select public.my_agency_ids()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select * into v_lease from public.leases where id = v_inv.lease_id for update;

  for k in 0 .. p_months - 1 loop
    if k = 0 then
      v_id := v_inv.id;
    else
      v_first := (to_date(v_inv.period_month, 'YYYY-MM') + make_interval(months => k))::date;
      if v_lease.status <> 'ACTIVE' then
        raise exception 'Bail résilié : impossible d''encaisser des mois à venir';
      end if;
      if v_lease.end_date is not null and v_lease.end_date < v_first then
        raise exception 'Le bail se termine avant %', to_char(v_first, 'MM/YYYY');
      end if;

      v_period := to_char(v_first, 'YYYY-MM');
      v_label := (array['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
                        'Septembre', 'Octobre', 'Novembre', 'Décembre'])[extract(month from v_first)::int]
                 || ' ' || extract(year from v_first)::int;

      insert into public.rent_payments
        (agency_id, lease_id, period_month, period_label, due_date, expected_amount, charges_amount, status)
      values
        (v_lease.agency_id, v_lease.id, v_period, v_label,
         greatest(make_date(extract(year from v_first)::int, extract(month from v_first)::int, v_lease.due_day), v_lease.start_date),
         v_lease.monthly_rent + v_lease.charges_amount, v_lease.charges_amount, 'UNPAID')
      on conflict do nothing;

      select id into v_id from public.rent_payments where lease_id = v_lease.id and period_month = v_period;
    end if;

    select * into v_row from public.rent_payments where id = v_id;
    v_balance := v_row.expected_amount - v_row.amount_paid;
    if v_row.status <> 'PAID' and v_balance > 0 then
      v_row := public.apply_payment(v_id, v_balance, p_method, 'MANUAL', null,
                                    coalesce(nullif(btrim(p_note), ''), 'Paiement groupé de ' || p_months || ' mois'));
      v_paid := v_paid + 1;
      v_total := v_total + v_balance;
      if v_row.receipt_number is not null then
        v_receipts := v_receipts || v_row.receipt_number;
      end if;
    end if;
    v_last_label := v_row.period_label;
  end loop;

  if v_paid = 0 then
    raise exception 'Ces mois sont déjà tous payés';
  end if;

  return jsonb_build_object('months_paid', v_paid, 'total', v_total, 'receipts', to_jsonb(v_receipts),
                            'first_period', v_inv.period_label, 'last_period', v_last_label);
end $$;

revoke all on function public.pay_months(uuid, integer, text, text) from public, anon;
grant execute on function public.pay_months(uuid, integer, text, text) to authenticated;
