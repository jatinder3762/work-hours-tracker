# Supabase setup

Database migrations in `migrations/` create the per-user `shifts` table and enable Row Level Security (RLS).

The browser application uses only a Supabase publishable key. Never add a secret/service-role key to client-side files.

Authentication uses email/password. Each shift row is tied to `auth.uid()`, and RLS policies restrict select, insert, update, and delete operations to the signed-in owner.
