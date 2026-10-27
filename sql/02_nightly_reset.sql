-- Resets the demo every night at 14:00 UTC (about 1am in Melbourne).
-- Before you run this: Supabase > Database > Extensions > turn on "pg_cron".
-- Then run this one line. Running it again just replaces the schedule.
select cron.schedule('nightly-demo-reset', '0 14 * * *', 'select public.reset_demo()');
