-- Prestataire de paiement en ligne : SasPay (remplace CinetPay, jamais utilisé en production).
alter table public.payment_transactions drop constraint if exists payment_transactions_provider_check;
alter table public.payment_transactions add constraint payment_transactions_provider_check
  check (provider in ('MANUAL', 'SASPAY', 'CINETPAY'));

-- Rattrapage des paiements en attente (tâche quotidienne, retour du client).
create index if not exists idx_payment_transactions_pending
  on public.payment_transactions (provider, created_at desc)
  where status = 'PENDING';
