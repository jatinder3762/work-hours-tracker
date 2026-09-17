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
drop policy if exists "Users read own workplace rates" on public.workplace_rates;
drop policy if exists "Users insert own workplace rates" on public.workplace_rates;
drop policy if exists "Users update own workplace rates" on public.workplace_rates;
drop policy if exists "Users delete own workplace rates" on public.workplace_rates;
create policy "Users read own workplace rates" on public.workplace_rates for select to authenticated using ((select auth.uid())=user_id);
create policy "Users insert own workplace rates" on public.workplace_rates for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.workplaces w where w.id=workplace_id and w.user_id=(select auth.uid())));
create policy "Users update own workplace rates" on public.workplace_rates for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.workplaces w where w.id=workplace_id and w.user_id=(select auth.uid())));
create policy "Users delete own workplace rates" on public.workplace_rates for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.workplace_rates to authenticated;
revoke all on public.workplace_rates from anon;

alter table public.shifts add column if not exists hourly_rate_snapshot numeric(10,2) check (hourly_rate_snapshot is null or hourly_rate_snapshot >= 0);

-- Preserve the earnings users saw before this upgrade. The imported entry is explicitly labelled
-- so users can add a corrected effective-dated rate later without silently rewriting saved shifts.
update public.shifts s
set hourly_rate_snapshot=w.hourly_rate
from public.workplaces w
where s.workplace_id=w.id and s.hourly_rate_snapshot is null and w.hourly_rate is not null;

insert into public.workplace_rates(user_id,workplace_id,hourly_rate,effective_from,note)
select w.user_id,w.id,w.hourly_rate,coalesce((select min(s.shift_date) from public.shifts s where s.workplace_id=w.id),current_date),'Imported starting rate'
from public.workplaces w
where w.hourly_rate is not null
on conflict (workplace_id,effective_from) do nothing;

create or replace function public.rate_for_workplace(p_workplace uuid,p_date date)
returns numeric language sql stable security invoker set search_path=public as $$
  select r.hourly_rate from public.workplace_rates r
  where r.workplace_id=p_workplace and r.user_id=(select auth.uid()) and r.effective_from<=p_date
  order by r.effective_from desc limit 1
$$;
grant execute on function public.rate_for_workplace(uuid,date) to authenticated;

-- Enforce workplace ownership and fill a missing rate snapshot when a shift is first saved.
create or replace function public.prepare_shift_rate_snapshot()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.user_id <> (select auth.uid()) or not exists (
    select 1 from public.workplaces w where w.id=new.workplace_id and w.user_id=new.user_id
  ) then raise exception 'Invalid workplace for this user'; end if;
  if new.hourly_rate_snapshot is null then
    new.hourly_rate_snapshot := public.rate_for_workplace(new.workplace_id,new.shift_date);
  end if;
  return new;
end $$;
drop trigger if exists prepare_shift_rate_snapshot_trigger on public.shifts;
create trigger prepare_shift_rate_snapshot_trigger before insert or update of workplace_id,shift_date,hourly_rate_snapshot on public.shifts for each row execute function public.prepare_shift_rate_snapshot();

-- Replace the earlier paid-period guard so inserts, updates and deletes are all protected.
create or replace function public.prevent_paid_shift_changes()
returns trigger language plpgsql security invoker set search_path=public as $$
declare uid uuid; wid uuid; d date; locked boolean;
begin
  uid:=coalesce(old.user_id,new.user_id); wid:=coalesce(old.workplace_id,new.workplace_id); d:=coalesce(old.shift_date,new.shift_date);
  select exists(select 1 from public.pay_periods p where p.user_id=uid and p.workplace_id=wid and p.paid=true and d between p.period_start and p.period_end) into locked;
  if locked then raise exception 'This shift is in a paid period. Unlock the pay period first.'; end if;
  if tg_op='UPDATE' then
    select exists(select 1 from public.pay_periods p where p.user_id=new.user_id and p.workplace_id=new.workplace_id and p.paid=true and new.shift_date between p.period_start and p.period_end) into locked;
    if locked then raise exception 'Cannot move a shift into a paid period.'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists protect_paid_shifts on public.shifts;
drop trigger if exists prevent_paid_shift_changes_trigger on public.shifts;
create trigger prevent_paid_shift_changes_trigger before insert or update or delete on public.shifts for each row execute function public.prevent_paid_shift_changes();
