-- Run this in a NEW query. It deletes nothing from your data.
-- It makes sure the demo's nightly reset can never run on the live database:
-- it switches off any schedule called "nightly-demo-reset" and removes the reset function if it is there.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'nightly-demo-reset';
  end if;
end $$;

drop function if exists public.reset_demo();
