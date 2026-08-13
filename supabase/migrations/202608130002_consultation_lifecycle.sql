-- Model the stage after a patient is called and before the visit is completed.

alter type public.appointment_status add value if not exists 'consulting' after 'called';
alter type public.queue_status add value if not exists 'consulting' after 'called';

alter table public.queue_entries
add column if not exists consultation_started_at timestamptz;
