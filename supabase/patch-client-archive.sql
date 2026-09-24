alter table public.clients
  add column if not exists archived boolean not null default false;

alter table public.clients
  add column if not exists archived_at timestamptz;

create index if not exists clients_archived_idx on public.clients(archived);
