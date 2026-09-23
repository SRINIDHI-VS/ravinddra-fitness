-- Ravi Fitness — admin manual payment logging
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Why: clients who pay by UPI and never open the app again were leaving no
-- record at all — the trainer's own dashboard only ever showed a payment if
-- the client came back and submitted a screenshot. This patch lets the
-- trainer's own logged-in session log a payment directly (no screenshot),
-- for both a returning client and a brand-new walk-in.

-- A manually-logged payment has no screenshot — the trainer is vouching for
-- it himself, so it's no longer always required.
alter table public.payments alter column screenshot_path drop not null;

-- Tags every row as either self-submitted (with proof) or trainer-logged
-- (no proof), so the admin dashboard and CSV export can tell them apart.
alter table public.payments
  add column if not exists source text not null default 'client_form';

alter table public.payments drop constraint if exists payments_source_check;
alter table public.payments
  add constraint payments_source_check check (source in ('client_form', 'admin_manual'));

-- The trainer's authenticated session could previously only read and update
-- clients/payments (see supabase-setup.sql) — never insert. This adds just
-- enough to let the admin dashboard log a new payment, and register a new
-- walk-in client, without going through the public submit_enrollment() RPC.
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

-- Lets the trainer undo his own mis-taps. Deliberately scoped to
-- source = 'admin_manual' at the DATABASE level (not just hidden in the UI)
-- — a client-submitted row can never be deleted this way, so the one record
-- of what a client actually sent (proof screenshot included) can't be lost
-- to a stray click. Those get "Reject" instead, which keeps the row.
drop policy if exists "authenticated can delete manual payments" on public.payments;
create policy "authenticated can delete manual payments"
  on public.payments for delete
  to authenticated
  using (source = 'admin_manual');
