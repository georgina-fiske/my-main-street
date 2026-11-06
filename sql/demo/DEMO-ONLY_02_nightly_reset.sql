-- ===== STOP: THIS FILE IS FOR THE DEMO ONLY. IT DELETES EVERYTHING. =====
-- Never run it on the live database. If you do, the check below stops it before anything is deleted.
do $$ begin
  if to_regprocedure('public.staff_me()') is not null then
    raise exception 'STOP. This is the LIVE database (it has the staff logins). This file is for the demo only and would delete everything. Nothing was changed.';
  end if;
end $$;

-- Resets the demo every night at 14:00 UTC (about 1am in Melbourne).
-- Before you run this: Supabase > Database > Extensions > turn on "pg_cron".
-- Then run this one line. Running it again just replaces the schedule.
select cron.schedule('nightly-demo-reset', '0 14 * * *', 'select public.reset_demo()');
