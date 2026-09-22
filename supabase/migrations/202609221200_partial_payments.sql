-- A partial receipt remains unpaid in the existing paid boolean, so the
-- database keeps its current rule: only fully paid periods lock shifts.
alter table public.pay_periods
  add column if not exists amount_received numeric(12,2) not null default 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.pay_periods'::regclass
      and conname='pay_periods_amount_received_nonnegative'
  ) then
    alter table public.pay_periods
      add constraint pay_periods_amount_received_nonnegative
      check (amount_received >= 0);
  end if;
end $$;
