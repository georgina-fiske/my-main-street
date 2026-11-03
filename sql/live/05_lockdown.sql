-- Run this in a NEW query (it does not wipe anything). It hides the budget limit from the public:
-- the public can read only the code style; staff can read everything in settings.
create or replace function _is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where email = _me() and role <> 'shop')
$$;
grant execute on function _is_staff() to anon, authenticated;
drop policy if exists "public read" on settings;
create policy "public read" on settings for select using (key = 'code_style' or _is_staff());
