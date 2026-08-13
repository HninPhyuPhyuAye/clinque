-- Rename the clinical role from the generic "staff" to "nurse", and let an
-- account choose its role at sign-up.
--
-- Run 202608130003_clinic_staff_operations.sql first.
--
-- SECURITY NOTE on register_as_nurse: it lets any authenticated account claim a
-- nurse role at any active clinic. That is deliberate for a portfolio build with
-- an open sign-up form, and it is the single choke point for the privilege, so a
-- production system would replace its body with an invite-code check or an
-- admin approval queue without touching any calling code.

-- ---------------------------------------------------------------------------
-- 1. Role vocabulary
-- ---------------------------------------------------------------------------

alter type public.app_role rename value 'staff' to 'nurse';

alter table public.clinic_staff rename to clinic_nurses;

-- Policy USING/WITH CHECK expressions follow the table rename automatically
-- because Postgres stores them as parsed dependencies. Only the names need help.
alter policy "Staff can view their own clinic memberships"
  on public.clinic_nurses rename to "Nurses can view their own clinic assignments";
alter policy "Clinic staff can view clinic appointments"
  on public.appointments rename to "Clinic nurses can view clinic appointments";
alter policy "Clinic staff can update clinic appointments"
  on public.appointments rename to "Clinic nurses can update clinic appointments";
alter policy "Clinic staff can view clinic queues"
  on public.queue_entries rename to "Clinic nurses can view clinic queues";
alter policy "Clinic staff can manage clinic queues"
  on public.queue_entries rename to "Clinic nurses can manage clinic queues";
alter policy "Clinic staff can view their patients"
  on public.profiles rename to "Clinic nurses can view their patients";
alter policy "Clinic staff can view queued patients"
  on public.profiles rename to "Clinic nurses can view queued patients";

-- ---------------------------------------------------------------------------
-- 2. Membership helper
-- ---------------------------------------------------------------------------

create or replace function public.is_clinic_nurse(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_nurses assignment
    where assignment.clinic_id = p_clinic_id
      and assignment.user_id = (select auth.uid())
  );
$$;

comment on function public.is_clinic_nurse(uuid) is
  'True when the calling user is a nurse at the given clinic.';

revoke all on function public.is_clinic_nurse(uuid) from anon;
grant execute on function public.is_clinic_nurse(uuid) to authenticated;

-- The queued-patient policy still calls the old helper by name, so repoint it
-- before the old function is dropped.
drop policy if exists "Clinic nurses can view queued patients" on public.profiles;

create policy "Clinic nurses can view queued patients"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.queue_entries entry
      where entry.patient_id = profiles.id
        and public.is_clinic_nurse(entry.clinic_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Lifecycle functions, repointed at the renamed helper
-- ---------------------------------------------------------------------------

create or replace function public.advance_queue_entry(p_appointment_id uuid)
returns public.queue_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.queue_entries;
  v_next_position integer;
  v_next_status public.queue_status;
begin
  select * into v_entry
  from public.queue_entries
  where appointment_id = p_appointment_id
  for update;

  if not found then
    raise exception 'No queue entry for appointment %', p_appointment_id
      using errcode = 'P0002';
  end if;

  if not public.is_clinic_nurse(v_entry.clinic_id) then
    raise exception 'Only clinic nurses can advance the queue'
      using errcode = '42501';
  end if;

  if v_entry.status <> 'waiting'::public.queue_status then
    raise exception 'Queue entry % is % and cannot be advanced', v_entry.id, v_entry.status
      using errcode = '22023';
  end if;

  v_next_position := greatest(v_entry.position - 1, 0);
  v_next_status := case
    when v_next_position = 0 then 'called'::public.queue_status
    else 'waiting'::public.queue_status
  end;

  update public.queue_entries
  set position = v_next_position,
      status = v_next_status,
      estimated_minutes = case
        when v_next_position = 0 then 0
        else greatest(v_next_position * 3, 3)
      end,
      called_at = case
        when v_next_position = 0 then now()
        else called_at
      end
  where id = v_entry.id
  returning * into v_entry;

  update public.appointments
  set status = case
        when v_next_position = 0 then 'called'::public.appointment_status
        else 'waiting'::public.appointment_status
      end
  where id = p_appointment_id;

  return v_entry;
end;
$$;

create or replace function public.start_consultation(p_appointment_id uuid)
returns public.queue_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.queue_entries;
begin
  select * into v_entry
  from public.queue_entries
  where appointment_id = p_appointment_id
  for update;

  if not found then
    raise exception 'No queue entry for appointment %', p_appointment_id
      using errcode = 'P0002';
  end if;

  if not public.is_clinic_nurse(v_entry.clinic_id) then
    raise exception 'Only clinic nurses can start a consultation'
      using errcode = '42501';
  end if;

  if v_entry.status <> 'called'::public.queue_status then
    raise exception 'Queue entry % is % and cannot start a consultation', v_entry.id, v_entry.status
      using errcode = '22023';
  end if;

  update public.queue_entries
  set status = 'consulting'::public.queue_status,
      consultation_started_at = now()
  where id = v_entry.id
  returning * into v_entry;

  update public.appointments
  set status = 'consulting'::public.appointment_status
  where id = p_appointment_id;

  return v_entry;
end;
$$;

create or replace function public.complete_consultation(p_appointment_id uuid)
returns public.queue_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.queue_entries;
begin
  select * into v_entry
  from public.queue_entries
  where appointment_id = p_appointment_id
  for update;

  if not found then
    raise exception 'No queue entry for appointment %', p_appointment_id
      using errcode = 'P0002';
  end if;

  if not public.is_clinic_nurse(v_entry.clinic_id) then
    raise exception 'Only clinic nurses can complete a visit'
      using errcode = '42501';
  end if;

  if v_entry.status <> 'consulting'::public.queue_status then
    raise exception 'Queue entry % is % and cannot be completed', v_entry.id, v_entry.status
      using errcode = '22023';
  end if;

  update public.queue_entries
  set status = 'completed'::public.queue_status
  where id = v_entry.id
  returning * into v_entry;

  update public.appointments
  set status = 'completed'::public.appointment_status
  where id = p_appointment_id;

  return v_entry;
end;
$$;

drop function if exists public.is_clinic_staff(uuid);

-- ---------------------------------------------------------------------------
-- 4. Provisioning
-- ---------------------------------------------------------------------------

drop function if exists public.promote_to_staff(text, text);

create or replace function public.promote_to_nurse(p_email text, p_clinic_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_clinic_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(p_email);

  if v_user_id is null then
    raise exception 'No account found for %. Create it through the app first.', p_email;
  end if;

  select id into v_clinic_id
  from public.clinics
  where slug = p_clinic_slug;

  if v_clinic_id is null then
    raise exception 'No clinic with slug %', p_clinic_slug;
  end if;

  update public.profiles
  set role = 'nurse'::public.app_role
  where id = v_user_id;

  insert into public.clinic_nurses (clinic_id, user_id)
  values (v_clinic_id, v_user_id)
  on conflict (clinic_id, user_id) do nothing;
end;
$$;

comment on function public.promote_to_nurse(text, text) is
  'SQL Editor / service-role only. Assigns an existing account to a clinic as a nurse.';

revoke all on function public.promote_to_nurse(text, text) from anon, authenticated;

-- Self-service registration for the sign-up form. Acts only on the caller.
create or replace function public.register_as_nurse(p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'A signed-in account is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clinics
    where id = p_clinic_id and is_active
  ) then
    raise exception 'That clinic is not accepting nurse registrations'
      using errcode = '22023';
  end if;

  update public.profiles
  set role = 'nurse'::public.app_role
  where id = v_user_id;

  insert into public.clinic_nurses (clinic_id, user_id)
  values (p_clinic_id, v_user_id)
  on conflict (clinic_id, user_id) do nothing;
end;
$$;

comment on function public.register_as_nurse(uuid) is
  'Registers the CALLING account as a nurse at one active clinic. Replace the body with an invite or approval check to lock this down.';

revoke all on function public.register_as_nurse(uuid) from anon;
grant execute on function public.register_as_nurse(uuid) to authenticated;
