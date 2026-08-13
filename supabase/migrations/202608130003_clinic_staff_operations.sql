-- Give the consultation lifecycle a real staff authority.
--
-- Until now every queue transition was attempted under the patient's session.
-- RLS silently filtered those updates to zero rows, PostgREST reported no error,
-- and the appointment row drifted out of sync with its queue entry.
--
-- This migration moves the three transitions into SECURITY DEFINER functions that
-- verify clinic-staff membership themselves and write both tables in one statement,
-- and it narrows the patient UPDATE policy so a patient can no longer set the
-- statuses that belong to staff.
--
-- Run 202608130002_consultation_lifecycle.sql first and let it commit. The
-- 'consulting' enum value must already exist before this file references it.

-- ---------------------------------------------------------------------------
-- 1. Membership helper
-- ---------------------------------------------------------------------------

create or replace function public.is_clinic_staff(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = p_clinic_id
      and membership.user_id = (select auth.uid())
  );
$$;

comment on function public.is_clinic_staff(uuid) is
  'True when the calling user staffs the given clinic. Definer rights so it can read clinic_staff without widening the caller''s own SELECT policy.';

revoke all on function public.is_clinic_staff(uuid) from anon;
grant execute on function public.is_clinic_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Patients may no longer write staff-owned statuses
-- ---------------------------------------------------------------------------
-- The original policy allowed a patient to set their appointment to any status,
-- including 'consulting' and 'completed'. Booking, checking in and cancelling are
-- the only transitions a patient legitimately performs.

drop policy if exists "Patients can update their own appointments" on public.appointments;

create policy "Patients can update their own appointments"
  on public.appointments
  for update
  to authenticated
  using ((select auth.uid()) = patient_id)
  with check (
    (select auth.uid()) = patient_id
    and status in ('booked', 'checked_in', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- 3. Queue transitions
-- ---------------------------------------------------------------------------
-- Each function raises 42501 when the caller does not staff the clinic and 22023
-- when the entry is not in the expected source state, so an out-of-order tap
-- surfaces as a real PostgREST error instead of a silent no-op.

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

  if not public.is_clinic_staff(v_entry.clinic_id) then
    raise exception 'Only clinic staff can advance the queue'
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

  if not public.is_clinic_staff(v_entry.clinic_id) then
    raise exception 'Only clinic staff can start a consultation'
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

  if not public.is_clinic_staff(v_entry.clinic_id) then
    raise exception 'Only clinic staff can complete a visit'
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

revoke all on function public.advance_queue_entry(uuid) from anon;
revoke all on function public.start_consultation(uuid) from anon;
revoke all on function public.complete_consultation(uuid) from anon;

grant execute on function public.advance_queue_entry(uuid) to authenticated;
grant execute on function public.start_consultation(uuid) to authenticated;
grant execute on function public.complete_consultation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Staff provisioning
-- ---------------------------------------------------------------------------
-- handle_new_user() makes every signup a patient, profiles.role has no UPDATE
-- grant, and clinic_staff has no INSERT policy, so a staff member cannot be
-- created through the API by design. This helper is the deliberate exception and
-- is callable only by the service role / SQL Editor.

create or replace function public.promote_to_staff(p_email text, p_clinic_slug text)
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
  set role = 'staff'::public.app_role
  where id = v_user_id;

  insert into public.clinic_staff (clinic_id, user_id)
  values (v_clinic_id, v_user_id)
  on conflict (clinic_id, user_id) do nothing;
end;
$$;

comment on function public.promote_to_staff(text, text) is
  'SQL Editor / service-role only. Grants an existing account clinic-staff rights for one clinic.';

revoke all on function public.promote_to_staff(text, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Let staff read the profile of any patient queued at their clinic
-- ---------------------------------------------------------------------------
-- The existing staff profile policy only covers patients reached through an
-- appointment join. A queue entry is the row staff actually work from.

drop policy if exists "Clinic staff can view queued patients" on public.profiles;

create policy "Clinic staff can view queued patients"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.queue_entries entry
      where entry.patient_id = profiles.id
        and public.is_clinic_staff(entry.clinic_id)
    )
  );
