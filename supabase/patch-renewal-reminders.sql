alter table public.clients
  add column if not exists last_reminded_at timestamptz;
