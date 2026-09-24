create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  class_date date not null,
  status text not null default 'completed',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.class_sessions drop constraint if exists class_sessions_status_check;
alter table public.class_sessions
  add constraint class_sessions_status_check
  check (status in ('completed', 'cancelled_notice', 'cancelled_no_notice', 'cancelled_trainer', 'no_show', 'makeup'));

create index if not exists class_sessions_client_id_idx on public.class_sessions(client_id);
create index if not exists class_sessions_class_date_idx on public.class_sessions(class_date);

alter table public.class_sessions enable row level security;

drop policy if exists "authenticated can select sessions" on public.class_sessions;
create policy "authenticated can select sessions"
  on public.class_sessions for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert sessions" on public.class_sessions;
create policy "authenticated can insert sessions"
  on public.class_sessions for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can update sessions" on public.class_sessions;
create policy "authenticated can update sessions"
  on public.class_sessions for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can delete sessions" on public.class_sessions;
create policy "authenticated can delete sessions"
  on public.class_sessions for delete
  to authenticated
  using (true);
