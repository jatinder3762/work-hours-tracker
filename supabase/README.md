# Supabase setup

Database migrations in `migrations/` create the per-user `shifts` table and enable Row Level Security (RLS).

The browser application uses only a Supabase publishable key. Never add a secret/service-role key to client-side files.

Authentication uses email/password. Each shift row is tied to `auth.uid()`, and RLS policies restrict select, insert, update, and delete operations to the signed-in owner.

## Partial payments

Apply `migrations/202609221200_partial_payments.sql` in the Supabase SQL Editor before recording partial payments. It adds the nonnegative `amount_received` column to `public.pay_periods` with a default of zero. The migration can be run again safely and does not change previously paid periods.

An amount received is the cumulative amount for one period. The app estimates covered hours from the period's recorded gross shift rates; deductions on a paycheck can make this estimate differ from actual paid hours. A partially paid period remains `paid = false`, so its shifts remain editable. Mark the period Fully paid only after all hours have been paid; that uses the existing `paid = true` lock.
