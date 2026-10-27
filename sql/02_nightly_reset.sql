-- Resets the demo every night at 14:00 UTC (about 1am in Melbourne).
-- Run once in Supabase > SQL Editor, after 01_schema.sql.
-- If it says pg_cron is missing: Dashboard > Database > Extensions > turn on "pg_cron", then run again.

create extension if not exists pg_cron;

select cron.unschedule('nightly-demo-reset')
 where exists (select 1 from cron.job where jobname = 'nightly-demo-reset');

select cron.schedule('nightly-demo-reset', '0 14 * * *', $$select public.reset_demo()$$);
