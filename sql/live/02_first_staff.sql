-- Run this second, in Supabase > SQL Editor, AFTER 01_schema.sql.
-- It makes you the first Fruitbowl staff member, so you can log in and set everything else up
-- from the Fruitbowl HQ page (Areas and Staff tabs).
--
-- Change the email below to the one you will log in with, then press Run.
-- (It must be lowercase.)

insert into staff (email, role, area)
values ('PUT-YOUR-EMAIL-HERE@example.com', 'fruitbowl', null)
on conflict (email) do update set role = 'fruitbowl', area = null;
