-- Run this any time, in a NEW query. It gives Croydon its own look: its logo, orange main colour, gold highlight.
-- (If you already ran 03_croydon.sql, run this to update Croydon. It does not touch any customers.)
-- You can also change these any time in Admin > Look.

update areas
set brand = brand || jsonb_build_object('color', '#F29400', 'accent', '#F9CD08', 'logo', '/img/croydon-logo.svg')
where id = 'croydon';
