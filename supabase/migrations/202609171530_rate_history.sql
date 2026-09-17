create table if not exists public.workplace_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  effective_from date not null,
  note text,
  created_at timestamptz not null default now(),
  unique(workplace_id, effective_from)
);
create index if not exists workplace_rates_lookup_idx on public.workplace_rates(workplace_id,effective_from desc);
alter table public.workplace_rates enable row level security;
create policy "Users read own workplace rates" on public.workplace_rates for select to authenticated using ((select auth.uid())=user_id);
create policy "Users insert own workplace rates" on public.workplace_rates for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users update own workplace rates" on public.workplace_rates for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users delete own workplace rates" on public.workplace_rates for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.workplace_rates to authenticated;
revoke all on public.workplace_rates from anon;

alter table public.shifts add column if not exists hourly_rate_snapshot numeric(10,2) check (hourly_rate_snapshot is null or hourly_rate_snapshot >= 0);

-- Preserve the rate that was in use before this feature for existing shifts.
update public.shifts s
set hourly_rate_snapshot=w.hourly_rate
from public.workplaces w
where s.workplace_id=w.id and s.hourly_rate_snapshot is null and w.hourly_rate is not null;

-- Seed one historical rate per workplace where a rate already exists.
insert into public.workplace_rates(user_id,workplace_id,hourly_rate,effective_from,note)
select w.user_id,w.id,w.hourly_rate,coalesce((select min(s.shift_date) from public.shifts s where s.workplace_id=w.id),current_date),'Imported current rate'
from public.workplaces w
where w.hourly_rate is not null
on conflict (workplace_id,effective_from) do nothing;

create or replace function public.rate_for_workplace(p_workplace uuid,p_date date)
returns numeric language sql stable security definer set search_path=public as $$
  select r.hourly_rate from public.workplace_rates r
  where r.workplace_id=p_workplace and r.user_id=(select auth.uid()) and r.effective_from<=p_date
  order by r.effective_from desc limit 1
$$;

grant execute on function public.rate_for_workplace(uuid,date) to authenticated;
