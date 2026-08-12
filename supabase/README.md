# Clinque Supabase backend

The SQL files in `migrations/` are the version-controlled definition of Clinque's cloud backend.

The initial migration creates:

- patient and staff profiles linked to Supabase Auth;
- clinics and staff-to-clinic memberships;
- appointments and live queue entries;
- automatic timestamps and new-user profile creation;
- Row Level Security policies separating patient and clinic access;
- Realtime publication for queue changes;
- the two demonstration clinics used by the app.

Never add a Supabase database password, service-role key, or other secret to this directory or Git.
