-- Clinque backend foundation
-- PostgreSQL schema, authentication profiles, clinic roles, and row-level security.

create type public.app_role as enum ('patient', 'staff');
create type public.appointment_status as enum (
  'booked',
  'checked_in',
  'waiting',
  'called',
  'completed',
  'cancelled'
);
create type public.queue_status as enum ('waiting', 'called', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'patient',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  specialty text not null,
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_staff (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  confirmation_code text not null unique,
  doctor_name text not null,
  reason text not null,
  scheduled_at timestamptz not null,
  status public.appointment_status not null default 'booked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  position integer not null check (position >= 0),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  room text,
  status public.queue_status not null default 'waiting',
  checked_in_at timestamptz not null default now(),
  called_at timestamptz,
  updated_at timestamptz not null default now()
);

create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_clinic_scheduled_idx on public.appointments (clinic_id, scheduled_at);
create index queue_entries_clinic_status_idx on public.queue_entries (clinic_id, status);
create index queue_entries_patient_id_idx on public.queue_entries (patient_id);
create index clinic_staff_user_id_idx on public.clinic_staff (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger clinics_set_updated_at
before update on public.clinics
for each row execute function public.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create trigger queue_entries_set_updated_at
before update on public.queue_entries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_staff enable row level security;
alter table public.appointments enable row level security;
alter table public.queue_entries enable row level security;

create policy "Clinics are visible to everyone"
on public.clinics for select
to anon, authenticated
using (is_active);

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Clinic staff can view their patients"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.appointments appointment
    join public.clinic_staff membership on membership.clinic_id = appointment.clinic_id
    where appointment.patient_id = profiles.id
      and membership.user_id = (select auth.uid())
  )
);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Staff can view their own clinic memberships"
on public.clinic_staff for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Patients can view their own appointments"
on public.appointments for select
to authenticated
using ((select auth.uid()) = patient_id);

create policy "Clinic staff can view clinic appointments"
on public.appointments for select
to authenticated
using (
  exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = appointments.clinic_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "Patients can create their own bookings"
on public.appointments for insert
to authenticated
with check (
  (select auth.uid()) = patient_id
  and status = 'booked'
);

create policy "Patients can update their own appointments"
on public.appointments for update
to authenticated
using ((select auth.uid()) = patient_id)
with check ((select auth.uid()) = patient_id);

create policy "Clinic staff can update clinic appointments"
on public.appointments for update
to authenticated
using (
  exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = appointments.clinic_id
      and membership.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = appointments.clinic_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "Patients can view their own queue entry"
on public.queue_entries for select
to authenticated
using ((select auth.uid()) = patient_id);

create policy "Clinic staff can view clinic queues"
on public.queue_entries for select
to authenticated
using (
  exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = queue_entries.clinic_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "Patients can check into their own appointment"
on public.queue_entries for insert
to authenticated
with check (
  (select auth.uid()) = patient_id
  and status = 'waiting'
  and exists (
    select 1
    from public.appointments appointment
    where appointment.id = queue_entries.appointment_id
      and appointment.patient_id = (select auth.uid())
      and appointment.clinic_id = queue_entries.clinic_id
  )
);

create policy "Clinic staff can manage clinic queues"
on public.queue_entries for all
to authenticated
using (
  exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = queue_entries.clinic_id
      and membership.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.clinic_staff membership
    where membership.clinic_id = queue_entries.clinic_id
      and membership.user_id = (select auth.uid())
  )
);

grant select on public.clinics to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.clinic_staff to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update, delete on public.queue_entries to authenticated;

alter table public.queue_entries replica identity full;
alter publication supabase_realtime add table public.queue_entries;

insert into public.clinics (slug, name, specialty, address)
values
  ('novena-medical', 'Novena Medical Clinic', 'Family Medicine', '10 Sinaran Drive, Singapore'),
  ('orchard-family', 'Orchard Family Clinic', 'General Practice', '290 Orchard Road, Singapore');
