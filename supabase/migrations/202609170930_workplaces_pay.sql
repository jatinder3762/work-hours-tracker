create table if not exists public.workplaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  company_name text,
  address text,
  hourly_rate numeric(10,2) check (hourly_rate is null or hourly_rate >= 0),
  pay_frequency text not null default 'biweekly' check (pay_frequency in ('weekly','biweekly','monthly')),
  pay_anchor_date date,
  accent text not null default '#2563EB',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workplaces_user_idx on public.workplaces(user_id, archived, updated_at desc);
alter table public.workplaces enable row level security;
create policy "Users read own workplaces" on public.workplaces for select to authenticated using ((select auth.uid())=user_id);
create policy "Users insert own workplaces" on public.workplaces for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users update own workplaces" on public.workplaces for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users delete own workplaces" on public.workplaces for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.workplaces to authenticated; revoke all on public.workplaces from anon;

alter table public.shifts add column if not exists workplace_id uuid references public.workplaces(id) on delete restrict;
create index if not exists shifts_workplace_idx on public.shifts(workplace_id, shift_date desc);

create table if not exists public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workplace_id, period_start, period_end),
  check(period_end >= period_start)
);
create index if not exists pay_periods_user_workplace_idx on public.pay_periods(user_id, workplace_id, period_start desc);
alter table public.pay_periods enable row level security;
create policy "Users read own pay periods" on public.pay_periods for select to authenticated using ((select auth.uid())=user_id);
create policy "Users insert own pay periods" on public.pay_periods for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users update own pay periods" on public.pay_periods for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users delete own pay periods" on public.pay_periods for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.pay_periods to authenticated; revoke all on public.pay_periods from anon;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workplace_view text not null default 'cards' check (workplace_view in ('cards','list')),
  workplace_sort text not null default 'recent' check (workplace_sort in ('recent','name','hours','earnings')),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "Users read own preferences" on public.user_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy "Users insert own preferences" on public.user_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users update own preferences" on public.user_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.user_preferences to authenticated; revoke all on public.user_preferences from anon;

create or replace function public.prevent_paid_shift_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_workplace uuid; v_date date; v_locked boolean;
begin
  v_user := coalesce(old.user_id,new.user_id); v_workplace := coalesce(old.workplace_id,new.workplace_id); v_date := coalesce(old.shift_date,new.shift_date);
  if v_workplace is null then return coalesce(new,old); end if;
  select exists(select 1 from public.pay_periods p where p.user_id=v_user and p.workplace_id=v_workplace and p.paid=true and v_date between p.period_start and p.period_end) into v_locked;
  if v_locked then raise exception 'This shift belongs to a paid pay period. Mark the period unpaid before changing it.'; end if;
  return coalesce(new,old);
end;$$;
drop trigger if exists protect_paid_shifts on public.shifts;
create trigger protect_paid_shifts before update or delete on public.shifts for each row execute function public.prevent_paid_shift_change();

create trigger workplaces_set_updated_at before update on public.workplaces for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
