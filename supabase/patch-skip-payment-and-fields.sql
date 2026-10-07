-- Allow a payment row to record "client enrolled but hasn't paid yet"
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status = any (array['submitted'::text, 'confirmed'::text, 'rejected'::text, 'skipped'::text]));

-- Extends submit_enrollment (full prior body preserved) with:
--   - wider diet options (Eggetarian added alongside the existing Veg/Non-veg)
--   - p_medical_condition / p_fitness_goal, stored on the client record
--   - p_skip_payment: when true, p_screenshot_path/p_amount may be null and the payment row is
--     inserted with status 'skipped' instead of the normal 'submitted'. Every other check
--     (name/phone/age/height/weight/diet/T&C/rate-limit/existing-client lookup) is unchanged —
--     skipping only skips the payment step itself, not the rest of enrollment.
CREATE OR REPLACE FUNCTION public.submit_enrollment(
  p_name text,
  p_phone text,
  p_client_type text,
  p_screenshot_path text,
  p_age integer DEFAULT NULL::integer,
  p_height_cm integer DEFAULT NULL::integer,
  p_weight_kg numeric DEFAULT NULL::numeric,
  p_diet text DEFAULT NULL::text,
  p_tc_agreed_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tc_version text DEFAULT NULL::text,
  p_amount numeric DEFAULT NULL::numeric,
  p_transaction_ref text DEFAULT NULL::text,
  p_medical_condition text DEFAULT NULL::text,
  p_fitness_goal text DEFAULT NULL::text,
  p_skip_payment boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client_id uuid;
  v_payment_id uuid;
  v_has_agreed boolean;
  v_recent_count int;
  v_status text;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'invalid_name';
  end if;
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'invalid_phone';
  end if;
  if p_client_type not in ('New','Existing') then
    raise exception 'invalid_client_type';
  end if;
  if not p_skip_payment and (p_screenshot_path is null or length(p_screenshot_path) = 0) then
    raise exception 'missing_screenshot';
  end if;

  if p_client_type = 'New' then
    if p_age is null or p_age < 10 or p_age > 90 then
      raise exception 'invalid_age';
    end if;
    if p_height_cm is null or p_height_cm < 100 or p_height_cm > 230 then
      raise exception 'invalid_height';
    end if;
    if p_weight_kg is null or p_weight_kg < 25 or p_weight_kg > 250 then
      raise exception 'invalid_weight';
    end if;
    if p_diet is null or p_diet not in ('Veg','Non-veg','Eggetarian') then
      raise exception 'invalid_diet';
    end if;
    if p_tc_agreed_at is null then
      raise exception 'terms_not_agreed';
    end if;
  end if;

  select count(*) into v_recent_count
  from public.payments pay
  join public.clients c on c.id = pay.client_id
  where c.phone = p_phone and pay.submitted_at > now() - interval '10 minutes';

  if v_recent_count >= 3 then
    raise exception 'rate_limited';
  end if;

  if p_client_type = 'Existing' then
    select exists (
      select 1
      from public.payments pay
      join public.clients c on c.id = pay.client_id
      where c.phone = p_phone and pay.tc_agreed_at is not null
    ) into v_has_agreed;

    if not v_has_agreed then
      raise exception 'not_yet_enrolled';
    end if;
  end if;

  insert into public.clients (name, phone, age, height_cm, weight_kg, diet, medical_condition, fitness_goal)
  values (p_name, p_phone, p_age, p_height_cm, p_weight_kg, p_diet, p_medical_condition, p_fitness_goal)
  on conflict (phone) do update
    set name = excluded.name,
        age = coalesce(excluded.age, public.clients.age),
        height_cm = coalesce(excluded.height_cm, public.clients.height_cm),
        weight_kg = coalesce(excluded.weight_kg, public.clients.weight_kg),
        diet = coalesce(excluded.diet, public.clients.diet),
        medical_condition = coalesce(excluded.medical_condition, public.clients.medical_condition),
        fitness_goal = coalesce(excluded.fitness_goal, public.clients.fitness_goal),
        updated_at = now()
  returning id into v_client_id;

  v_status := case when p_skip_payment then 'skipped' else 'submitted' end;

  insert into public.payments (client_id, client_type, screenshot_path, status, tc_agreed_at, tc_version, amount, transaction_ref)
  values (v_client_id, p_client_type, nullif(p_screenshot_path, ''), v_status, p_tc_agreed_at, p_tc_version, p_amount, nullif(trim(coalesce(p_transaction_ref, '')), ''))
  returning id into v_payment_id;

  return v_payment_id;
end;
$function$;
