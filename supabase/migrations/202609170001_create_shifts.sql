create extension if not exists pgcrypto;

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0 and break_minutes <= 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shifts_user_date_idx on public.shifts(user_id, shift_date desc);

alter table public.shifts enable row level security;

create policy "Users can read own shifts" on public.shifts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own shifts" on public.shifts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own shifts" on public.shifts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own shifts" on public.shifts for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at before update on public.shifts for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.shifts to authenticated;
revoke all on public.shifts from anon;
