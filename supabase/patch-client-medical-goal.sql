alter table public.clients
  add column if not exists medical_condition text;

alter table public.clients
  add column if not exists fitness_goal text;

-- Lets the admin dashboard add a client with just a name and phone (age/height/weight/diet
-- filled in later, or never). No-op if these were already nullable.
alter table public.clients alter column age drop not null;
alter table public.clients alter column height_cm drop not null;
alter table public.clients alter column weight_kg drop not null;
alter table public.clients alter column diet drop not null;
