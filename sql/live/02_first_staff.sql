-- Run this second, in Supabase > SQL Editor, AFTER 01_schema.sql.
-- It makes you Chaos Master (the top login), so you can log in at my-mainstreet.com.au/admin
-- and set everything else up from there.
--
-- Change the email below to the one you will log in with (lowercase), then press Run.

insert into staff (email, role, area, shop)
values ('PUT-YOUR-EMAIL-HERE@example.com', 'chaos', null, null)
on conflict (email) do update set role = 'chaos', area = null, shop = null;
