-- 0006: make the streak grid, countdown, locked plan and shared lists live.
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.streak_days, public.countdowns, public.plan_items, public.shared_items;
  end if;
end
$rt$;
