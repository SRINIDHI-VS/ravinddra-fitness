alter table public.payments alter column screenshot_path drop not null;

alter table public.payments
  add column if not exists source text not null default 'client_form';

alter table public.payments drop constraint if exists payments_source_check;
alter table public.payments
  add constraint payments_source_check check (source in ('client_form', 'admin_manual'));

drop policy if exists "authenticated can insert clients" on public.clients;
create policy "authenticated can insert clients"
  on public.clients for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can insert payments" on public.payments;
create policy "authenticated can insert payments"
  on public.payments for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can delete manual payments" on public.payments;
create policy "authenticated can delete manual payments"
  on public.payments for delete
  to authenticated
  using (source = 'admin_manual');
