-- Run this third, AFTER 01_schema.sql. It loads Croydon Main Street: the festival, the wheel and the shops.
-- You can change any of it later in Admin. Sign-ups start CLOSED ("setting up").
-- Open them in Admin (Overview, Open sign-ups) when you're ready.

insert into areas (id, name, type, council_area, status, created_by, sort_order, brand, email_name, email_address, reply_to)
values ('croydon', 'Croydon Main Street Association', 'Street Association', 'Maroondah', 'setting up', 'fruitbowl', 1,
  jsonb_build_object('place', 'Croydon Main Street', 'color', '#560CC9', 'accent', '#F9DE4B', 'logo', '',
    'welcome', 'Croydon Main Street is My Main Street! Scan, spin and win.', 'web', 'croydon.my-mainstreet.com.au'),
  'Croydon Main Street', 'croydon@my-mainstreet.com.au', 'hello@my-mainstreet.com.au')
on conflict (id) do nothing;

insert into area_private (area, contact) values ('croydon', '{"name":"","email":"","mobile":""}') on conflict (area) do nothing;

insert into events (area, name, starts_on, use_by)
select 'croydon', 'Maroondah Festival', '2026-11-08', '2026-11-30'
where not exists (select 1 from events where area = 'croydon');

-- The wheel: 12 slices, 5 prizes. The cap is how many can be given out in total.
-- $5 x 360 = $1,800, $10 x 180 = $1,800, $50 x 18 = $900. That is $4,500 of the $5,000 budget.
insert into prizes (area, name, value, stock, color, sort_order) values
  ('croydon', 'Chocolate bar', 0,   150, '#8B5A2B', 1),
  ('croydon', 'Bubbles',       0,   120, '#6BE0CF', 2),
  ('croydon', '$5 coupon',     5,   360, '#560CC9', 3),
  ('croydon', '$10 coupon',    10,  180, '#3E88F7', 4),
  ('croydon', '$50 coupon',    50,  18,  '#EB4870', 5);

-- The shops. Every shop takes coupons. Add one row per shop: (id, area, name, type, sort order).
-- The id is a short lowercase word with dashes. It is only used inside the system.
insert into shops (id, area, name, type, sort_order) values
  ('example-cafe', 'croydon', 'Example Cafe (delete me)', 'Cafe', 1);

insert into shop_private (shop) select id from shops on conflict (shop) do nothing;
