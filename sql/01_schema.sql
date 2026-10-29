-- My Main Street: demo database (version 2).
-- Run this whole file once in Supabase > SQL Editor. Press Run.
-- Safe to run again: it rebuilds everything and reloads the demo data.
-- (Running it wipes the demo, so don't run it on a live system.)
--
-- How it is locked:
--  * The public (anon key) can READ the demo tables.
--  * The public can NOT write to any table directly.
--  * Every change goes through the functions below. Each one does
--    only what a demo screen does, and checks its input.
--  * Private details live in tables the public cannot read:
--    signup_private (email, mobile, postcode), shop_private (PIN, invite link),
--    area_private (contact details), download_log.
--  * Reports with private details come only from report_rows(). In the live
--    version this will sit behind a real login. In the demo it is open.

-- ---------- clean slate ----------

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

drop table if exists download_log, bookings, workshops, campaigns, prizes,
  shop_private, shops, signup_private, signups, events, area_private, areas, settings cascade;

-- ---------- tables ----------

create table settings (
  key   text primary key,
  value text not null
);

-- A council or street association using My Main Street.
create table areas (
  id           text primary key,            -- the web address, e.g. 'croydon'
  name         text not null,               -- e.g. Croydon Main Street Association
  type         text not null check (type in ('Street Association','Council')),
  council_area text not null default '',    -- e.g. Maroondah
  status       text not null default 'invited' check (status in ('invited','waiting','setting up','live')),
  created_by   text not null default 'fruitbowl' check (created_by in ('fruitbowl','self')),
  sort_order   int not null default 0,
  brand        jsonb not null default '{}', -- place, color, accent, logo, welcome, web
  email_name   text not null default '',    -- the "From" name on emails
  email_address text not null default '',   -- e.g. croydon@mymainstreet.com.au
  reply_to     text not null default ''     -- the client's own email
);

create table area_private (
  area    text primary key references areas(id) on delete cascade,
  contact jsonb not null default '{}'       -- contact name, email, mobile, ABN
);

create table events (
  id        bigint generated always as identity primary key,
  area      text not null references areas(id) on delete cascade,
  name      text not null,
  starts_on date not null,
  use_by    date not null                   -- coupons won at this event must be used by this date
);

create table shops (
  id         text primary key,
  area       text not null references areas(id) on delete cascade,
  name       text not null,
  type       text not null default '',
  status     text not null default 'invited' check (status in ('invited','active')),
  sort_order int not null default 0
);

create table shop_private (
  shop    text primary key references shops(id) on delete cascade,
  pin     text unique check (pin ~ '^\d{4}$'),
  token   text not null unique,             -- the shop's invite link
  contact text not null default ''
);

create table signups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  area         text not null references areas(id) on delete cascade,
  event        bigint not null references events(id) on delete cascade,
  name         text not null,               -- first name
  last_initial text not null default '',    -- full last name is private
  contact      text not null default 'email' check (contact in ('email','text')),
  created_at   timestamptz not null default now(),
  prize        jsonb,                       -- {id, name, value, collect_at}
  spun_at      timestamptz,
  use_by       date,
  redeemed     boolean not null default false,
  redeemed_at  text,                        -- shop id, or 'desk'
  redeemed_time timestamptz,
  stamps       jsonb not null default '{}', -- shop id -> count
  rewards_used jsonb not null default '{}', -- shop id -> count
  cards        jsonb not null default '[]', -- Wallet passes: area ids (phase 2)
  card_stamps  jsonb not null default '{}'  -- area id -> stamps on that pass
);

create table signup_private (
  code      text primary key references signups(code) on delete cascade,
  event     bigint not null,
  last_name text not null default '',
  email     text not null default '',
  mobile    text not null default '',
  postcode  text not null default '',
  optin     boolean not null default false
);
-- the same email or mobile can only sign up once per event
create unique index signup_private_email_once  on signup_private (event, lower(email)) where email <> '';
create unique index signup_private_mobile_once on signup_private (event, mobile)       where mobile <> '';

create table campaigns (
  id           bigint generated always as identity primary key,
  area         text not null default 'croydon',
  title        text not null,
  month        text not null,
  blurb        text not null,
  posted_by    text not null check (posted_by in ('fruitbowl','council','street')),
  council      text not null default 'pending' check (council in ('pending','approved','declined')),
  street       text not null default 'pending' check (street in ('pending','yes','no')),
  street_extra text not null default '',
  traders      jsonb not null default '{}', -- shop id -> {status: in|out, offer}
  sort_order   int not null default 0
);

create table prizes (
  id         bigint generated always as identity primary key,
  area       text not null default 'croydon',
  name       text not null,
  value      int not null default 0,        -- 0 means a gift, not a coupon
  stock      int not null default 0,        -- how many in total. Left = stock - won
  collect_at text not null default '',      -- an optional note, e.g. a gift's pick-up spot
  added_by   text not null check (added_by in ('fruitbowl','council','street')),
  sort_order int not null default 0
);

create table workshops (
  id       bigint generated always as identity primary key,
  name     text not null,
  date     date not null,
  time     text not null,
  format   text not null check (format in ('Online','In person')),
  place    text not null default '',
  councils text[] not null default '{}'
);

create table bookings (
  id       bigint generated always as identity primary key,
  trader   text not null,
  workshop bigint not null references workshops(id) on delete cascade,
  at       timestamptz not null default now(),
  unique (trader, workshop)
);

create table download_log (
  id    bigint generated always as identity primary key,
  at    timestamptz not null default now(),
  who   text not null default 'Demo viewer',
  kind  text not null,
  area  text
);

-- ---------- helpers ----------

create function _err(msg text) returns jsonb
language sql immutable as $$ select jsonb_build_object('ok', false, 'error', msg) $$;

create function _clean(t text, n int) returns text
language sql immutable as $$ select left(btrim(coalesce(t, '')), n) $$;

-- "Sat 7 Nov, 6:42pm" in Melbourne time
create function _when(t timestamptz) returns text
language sql stable as $$ select to_char(t at time zone 'Australia/Melbourne', 'Dy FMDD Mon, FMHH12:MIam') $$;

create function _day(d date) returns text
language sql immutable as $$ select to_char(d, 'Dy FMDD Mon') $$;

create function _today() returns date
language sql stable as $$ select (now() at time zone 'Australia/Melbourne')::date $$;

-- ---------- demo data (also used by the reset button) ----------

create function reset_demo() returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev bigint; pid bigint;
begin
  truncate download_log, bookings, workshops, campaigns, prizes, shop_private, shops,
           signup_private, signups, events, area_private, areas, settings restart identity cascade;

  insert into settings values ('code_style', 'qr');

  insert into areas (id, name, type, council_area, status, created_by, sort_order, brand, email_name, email_address, reply_to) values
    ('croydon', 'Croydon Main Street Association', 'Street Association', 'Maroondah', 'live', 'fruitbowl', 1,
      jsonb_build_object('place','Croydon Main Street','color','#560CC9','accent','#F9DE4B','logo','',
        'welcome','Win something on Main Street','web','mymainstreet.com.au/croydon'),
      'Croydon Main Street', 'croydon@mymainstreet.com.au', 'hello@croydonmainstreet.example'),
    ('ringwood', 'Ringwood Village Traders', 'Street Association', 'Maroondah', 'invited', 'fruitbowl', 2,
      jsonb_build_object('place','Ringwood Village','color','#0E6E5C','accent','#FFC845','logo','',
        'welcome','Win something in Ringwood Village','web','mymainstreet.com.au/ringwood'),
      'Ringwood Village', 'ringwood@mymainstreet.com.au', ''),
    ('knox', 'Knox City Council', 'Council', 'Knox', 'waiting', 'self', 3,
      jsonb_build_object('place','Knox','color','#B0174F','accent','#FFD54F','logo','',
        'welcome','Shop local in Knox and win','web','mymainstreet.com.au/knox'),
      'Knox', 'knox@mymainstreet.com.au', '');

  insert into area_private (area, contact) values
    ('croydon',  '{"name":"Alex Demo","email":"alex@croydonmainstreet.example","mobile":"0400 000 001"}'),
    ('ringwood', '{"name":"Pat Demo","email":"pat@ringwood.example","mobile":"0400 000 002"}'),
    ('knox',     '{"name":"Robin Demo","email":"robin@knox.example","mobile":"0400 000 003"}');

  insert into events (area, name, starts_on, use_by) values
    ('croydon', 'Maroondah Festival', '2026-11-07', '2026-11-14') returning id into ev;

  insert into shops (id, area, name, type, status, sort_order) values
    ('espresso','croydon','Main St Espresso',       'Cafe',        'active', 1),
    ('lantern', 'croydon','Lantern Thai',           'Restaurant',  'active', 2),
    ('drover',  'croydon','The Drover Bar',         'Bar',         'active', 3),
    ('gelato',  'croydon','Gelato Lane',            'Dessert',     'active', 4),
    ('books',   'croydon','The Corner Bookshop',    'Bookshop',    'active', 5),
    ('opshop',  'croydon','Croydon Op Shop',        'Op shop',     'active', 6),
    ('optom',   'croydon','Clear View Optometrist', 'Optometrist', 'active', 7),
    ('dental',  'croydon','Smile Dental',           'Dentist',     'active', 8);
  insert into shop_private (shop, pin, token) values
    ('espresso','1111','demo-espresso'), ('lantern','2222','demo-lantern'), ('drover','3333','demo-drover'),
    ('gelato','4444','demo-gelato'), ('books','5555','demo-books'), ('opshop','6666','demo-opshop'),
    ('optom','7777','demo-optom'), ('dental','8888','demo-dental');

  insert into prizes (area, name, value, stock, collect_at, added_by, sort_order) values
    ('croydon', 'Free coffee',            5,  150, 'Main St Espresso',                       'fruitbowl', 1),
    ('croydon', 'Sweet treat',            5,   80, 'Gelato Lane',                            'fruitbowl', 2),
    ('croydon', 'Drink at a bar tonight', 10,  60, 'The Drover Bar, tonight only',           'street',    3),
    ('croydon', 'Shop voucher',           20,  30, 'The Corner Bookshop or Croydon Op Shop', 'street',    4),
    ('croydon', 'Dinner voucher',         25,  30, 'Lantern Thai',                           'council',   5),
    ('croydon', 'Big dining prize',      100,   3, 'Lantern Thai',                           'council',   6),
    ('croydon', 'Croydon tote bag',        0, 200, 'the marquee desk, right now',            'fruitbowl', 7);

  insert into campaigns (area, title, month, blurb, posted_by, council, street, street_extra, traders, sort_order) values
    ('croydon', 'Tinsel & Thongs: a Croydon Summer Christmas', 'December 2026',
     'An Aussie summer Christmas. Stamp trail, late-night Thursdays, Santa on a banana lounge.',
     'fruitbowl', 'approved', 'yes', 'Santa on a banana lounge, Saturday afternoons.',
     jsonb_build_object(
       'espresso', jsonb_build_object('status','in','offer','Free iced coffee upsize + a stamp'),
       'gelato',   jsonb_build_object('status','in','offer','Christmas pudding gelato, stamp with any scoop'),
       'books',    jsonb_build_object('status','in','offer','Free gift wrapping + a stamp'),
       'optom',    jsonb_build_object('status','in','offer','Free sunnies fitting + a stamp')),
     1),
    ('croydon', 'Hot Days, Cool Street', 'January 2027',
     'Beat the heat. Cold drink deals, chill stops in shops, water stations.',
     'fruitbowl', 'approved', 'pending', '', '{}', 2),
    ('croydon', 'Back to School', 'February 2027',
     'Shoes, books, haircuts, eye checks and lunchbox treats for families.',
     'fruitbowl', 'pending', 'pending', '', '{}', 3),
    ('croydon', 'Croydon Twilight Market', 'Friday 4 December 2026',
     'Shops stay open late. Stamps count double on the night.',
     'council', 'approved', 'pending', '', '{}', 4);

  insert into workshops (name, date, time, format, place, councils) values
    ('Christmas in a box',            '2026-11-10', '18:30', 'Online',    'Google Meet link sent on booking', array['Maroondah','Knox']),
    ('How to use My Main Street',     '2026-11-12', '14:00', 'Online',    'Google Meet link sent on booking', array['Maroondah']),
    ('Phone photos that sell',        '2026-11-17', '10:00', 'In person', 'Croydon, venue to be confirmed',   array['Maroondah']);

  -- three demo customers
  insert into signups (code, area, event, name, last_initial, contact, created_at, stamps) values
    ('CMS-1001', 'croydon', ev, 'Jo', 'D', 'email', now() - interval '20 minutes', '{}');
  select id into pid from prizes where name = 'Free coffee';
  insert into signups (code, area, event, name, last_initial, contact, created_at, prize, spun_at, use_by, stamps) values
    ('CMS-1002', 'croydon', ev, 'Priya', 'D', 'text', now() - interval '40 minutes',
     jsonb_build_object('id', pid, 'name', 'Free coffee', 'value', 5, 'collect_at', 'Main St Espresso'),
     now() - interval '30 minutes', '2026-11-14', '{}');
  insert into signups (code, area, event, name, last_initial, contact, created_at, stamps) values
    ('CMS-1003', 'croydon', ev, 'Alex', 'D', 'email', now() - interval '2 days', '{"espresso":4,"gelato":3,"books":2}');

  insert into signup_private (code, event, last_name, email, mobile, postcode, optin) values
    ('CMS-1001', ev, 'Demo', 'jo@example.com',    '',           '3136', true),
    ('CMS-1002', ev, 'Demo', '',                  '0400000002', '3136', false),
    ('CMS-1003', ev, 'Demo', 'alex@example.com',  '',           '3136', true);

  return jsonb_build_object('ok', true);
end $$;

-- ---------- customers ----------

create function signup(p_area text, p_name text, p_last text, p_contact text, p_email text,
                       p_mobile text, p_postcode text, p_optin boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n text := _clean(p_name, 40); l text := _clean(p_last, 40);
  e text := lower(_clean(p_email, 120)); m text := regexp_replace(coalesce(p_mobile, ''), '\s', '', 'g');
  ev events; c text; tries int := 0; existing text;
begin
  if n = '' then return _err('Please add your first name.'); end if;
  if l = '' then return _err('Please add your last name.'); end if;
  if p_contact not in ('email','text') then return _err('Choose email or text message.'); end if;
  if e <> '' and e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then e := ''; end if;
  if m <> '' and m !~ '^04\d{8}$' then m := ''; end if;
  if p_contact = 'email' and e = '' then return _err('Please add a real email, or choose text message.'); end if;
  if p_contact = 'text'  and m = '' then return _err('Mobile needs to look like 04xx xxx xxx.'); end if;
  if coalesce(p_postcode, '') !~ '^\d{4}$' then return _err('Postcode needs 4 numbers.'); end if;
  if not exists (select 1 from areas where id = p_area) then return _err('We can''t find that street.'); end if;
  select * into ev from events where area = p_area order by starts_on desc, id desc limit 1;
  if not found then return _err('No festival is open for this street yet.'); end if;

  -- stop doubles: the same email or mobile can sign up once per event
  select s.code into existing
    from signup_private sp join signups s on s.code = sp.code
   where sp.event = ev.id
     and ((e <> '' and lower(sp.email) = e) or (m <> '' and sp.mobile = m))
   limit 1;
  if existing is not null then
    return jsonb_build_object('ok', true, 'code', existing, 'existing', true);
  end if;

  if (select count(*) from signups) >= 400 then return _err('The demo is full. Press Reset demo.'); end if;
  loop
    c := 'CMS-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from signups where code = c);
    tries := tries + 1;
    if tries > 50 then return _err('Please try again.'); end if;
  end loop;
  insert into signups (code, area, event, name, last_initial, contact)
  values (c, p_area, ev.id, n, upper(left(l, 1)), p_contact);
  insert into signup_private (code, event, last_name, email, mobile, postcode, optin)
  values (c, ev.id, l, e, m, p_postcode, coalesce(p_optin, false));
  return jsonb_build_object('ok', true, 'code', c, 'existing', false);
end $$;

-- a stamp from a shop's counter QR code or sticker
create function give_stamp(p_code text, p_shop text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; sh text := _clean(p_shop, 30);
begin
  if not exists (select 1 from shops where id = sh) then return _err('We can''t find that shop.'); end if;
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  update signups
     set stamps = jsonb_set(stamps, array[sh], to_jsonb(coalesce((stamps->>sh)::int, 0) + 1))
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

create function use_reward(p_code text, p_shop text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; sh text := _clean(p_shop, 30); have int; used int;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  have := coalesce((s.stamps->>sh)::int, 0) / 6;
  used := coalesce((s.rewards_used->>sh)::int, 0);
  if have - used < 1 then return _err('No 6-stamp reward to use here.'); end if;
  update signups set rewards_used = jsonb_set(rewards_used, array[sh], to_jsonb(used + 1)) where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- phase 2: Wallet passes ----------

create function add_card(p_code text, p_area text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  if not exists (select 1 from areas where id = p_area) then return _err('We can''t find that street.'); end if;
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if p_area = s.area or s.cards ? p_area then return jsonb_build_object('ok', true); end if;
  update signups set cards = cards || to_jsonb(p_area) where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

create function card_stamp(p_code text, p_area text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if p_area = s.area then return _err('Use a shop to stamp the home pass.'); end if;
  if not (s.cards ? p_area) then return _err('Add that pass first.'); end if;
  update signups
     set card_stamps = jsonb_set(card_stamps, array[p_area], to_jsonb(coalesce((card_stamps->>p_area)::int, 0) + 1))
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- prize desk ----------

create function award_prize(p_code text, p_prize bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; p prizes; ev events;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if s.prize is not null then return _err(s.name || ' has already spun.'); end if;
  select * into p from prizes where id = p_prize for update;
  if not found then return _err('That coupon is gone.'); end if;
  if p.area <> s.area then return _err('That prize belongs to a different street.'); end if;
  if p.stock - (select count(*) from signups where (prize->>'id')::bigint = p.id) < 1 then
    return _err('That prize has run out.');
  end if;
  select * into ev from events where id = s.event;
  update signups
     set prize = jsonb_build_object('id', p.id, 'name', p.name, 'value', p.value, 'collect_at', p.collect_at),
         spun_at = now(),
         use_by = coalesce(ev.use_by, _today() + 7),
         -- gifts are handed over at the desk, so they are used straight away
         redeemed = (p.value = 0),
         redeemed_at = case when p.value = 0 then 'desk' else null end,
         redeemed_time = case when p.value = 0 then now() else null end
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

create function undo_prize(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if s.prize is null then return _err('No prize to undo.'); end if;
  if s.redeemed and s.redeemed_at is distinct from 'desk' then return _err('Already used. Cannot undo.'); end if;
  update signups
     set prize = null, spun_at = null, use_by = null, redeemed = false, redeemed_at = null, redeemed_time = null
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- coupons at the shop ----------

-- Which shop does this PIN belong to? (Used to log a shop in.)
create function shop_login(p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh shops;
begin
  select s.* into sh from shops s join shop_private sp on sp.shop = s.id
   where sp.pin = _clean(p_pin, 4) and s.status = 'active';
  if not found then return _err('That PIN doesn''t match a shop'); end if;
  return jsonb_build_object('ok', true, 'shop', sh.id, 'name', sh.name, 'area', sh.area, 'type', sh.type);
end $$;

-- Use a coupon in full. The shop PIN decides which shop gets paid back.
create function use_coupon(p_code text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh shops; s signups; at_name text;
begin
  select s2.* into sh from shops s2 join shop_private sp on sp.shop = s2.id
   where sp.pin = _clean(p_pin, 4) and s2.status = 'active';
  if not found then return _err('That PIN doesn''t match a shop'); end if;
  select * into s from signups where code = upper(_clean(p_code, 12)) for update;
  if not found then return _err('We can''t find this code. Check it and try again.'); end if;
  if s.prize is null then return _err('This code has no coupon yet.'); end if;
  if s.redeemed then
    select name into at_name from shops where id = s.redeemed_at;
    return _err('Already used at ' || coalesce(at_name, 'the prize desk') || ' on ' || _when(s.redeemed_time));
  end if;
  if s.use_by < _today() then return _err('This coupon ran out on ' || _day(s.use_by)); end if;
  if sh.area <> s.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'shop', sh.name, 'value', (s.prize->>'value')::int, 'name', s.name);
end $$;

create function add_shop(p_area text, p_name text, p_type text, p_contact text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text; base text; i int := 1; tok text;
begin
  if not exists (select 1 from areas where id = p_area) then return _err('We can''t find that street.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add the shop name.'); end if;
  if (select count(*) from shops) >= 120 then return _err('Too many shops. Press Reset demo.'); end if;
  base := trim(both '-' from regexp_replace(lower(_clean(p_name, 60)), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'shop'; end if;
  sid := base;
  while exists (select 1 from shops where id = sid) loop i := i + 1; sid := base || '-' || i; end loop;
  tok := md5(random()::text || clock_timestamp()::text);
  insert into shops (id, area, name, type, status, sort_order)
  values (sid, p_area, _clean(p_name, 60), _clean(p_type, 30), 'invited',
          coalesce((select max(sort_order) from shops where area = p_area), 0) + 1);
  insert into shop_private (shop, token, contact) values (sid, tok, _clean(p_contact, 120));
  return jsonb_build_object('ok', true, 'id', sid, 'token', tok);
end $$;

create function shop_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh shops; a areas;
begin
  select s.* into sh from shops s join shop_private sp on sp.shop = s.id where sp.token = _clean(p_token, 64);
  if not found then return _err('This invite link is not right. Ask the person who sent it.'); end if;
  select * into a from areas where id = sh.area;
  return jsonb_build_object('ok', true, 'id', sh.id, 'name', sh.name, 'status', sh.status,
                            'area', a.id, 'place', a.brand->>'place');
end $$;

create function shop_activate(p_token text, p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh shops;
begin
  select s.* into sh from shops s join shop_private sp on sp.shop = s.id where sp.token = _clean(p_token, 64);
  if not found then return _err('This invite link is not right. Ask the person who sent it.'); end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then return _err('Your PIN needs 4 numbers.'); end if;
  if exists (select 1 from shop_private where pin = p_pin and shop <> sh.id) then
    return _err('That PIN is taken. Please choose another.');
  end if;
  update shop_private set pin = p_pin where shop = sh.id;
  update shops set status = 'active', name = coalesce(nullif(_clean(p_name, 60), ''), name) where id = sh.id;
  return jsonb_build_object('ok', true, 'id', sh.id);
end $$;

-- ---------- campaigns ----------

create function post_campaign(p_area text, p_title text, p_month text, p_blurb text, p_from text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text := _clean(p_title, 80); m text := _clean(p_month, 40); b text := _clean(p_blurb, 300); lo int;
begin
  if p_from not in ('fruitbowl','council','street') then return _err('Who is posting?'); end if;
  if not exists (select 1 from areas where id = p_area) then return _err('We can''t find that street.'); end if;
  if t = '' then return _err('Please add a name.'); end if;
  if m = '' then return _err('Please add when.'); end if;
  if (select count(*) from campaigns) >= 60 then return _err('Too many campaigns. Press Reset demo.'); end if;
  select coalesce(min(sort_order), 1) - 1 into lo from campaigns;
  insert into campaigns (area, title, month, blurb, posted_by, council, street, sort_order)
  values (p_area, t, m, b, p_from,
          case when p_from = 'council' then 'approved' else 'pending' end,
          case when p_from = 'street'  then 'yes'      else 'pending' end,
          lo);
  return jsonb_build_object('ok', true);
end $$;

create function council_decide(p_id bigint, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update campaigns set council = case when p_approve then 'approved' else 'declined' end where id = p_id;
  if not found then return _err('Campaign not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create function street_decide(p_id bigint, p_yes boolean, p_extra text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update campaigns
     set street = case when p_yes then 'yes' else 'no' end,
         street_extra = case when p_yes then _clean(p_extra, 200) else street_extra end
   where id = p_id;
  if not found then return _err('Campaign not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- status: 'in', 'out' or 'none' (back to no answer)
create function set_trader(p_id bigint, p_shop text, p_status text, p_offer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh text := _clean(p_shop, 60);
begin
  if not exists (select 1 from shops where id = sh) or p_status not in ('in','out','none') then return _err('Bad answer.'); end if;
  if p_status = 'none' then
    update campaigns set traders = traders - sh where id = p_id;
  else
    update campaigns
       set traders = jsonb_set(traders, array[sh],
             jsonb_build_object('status', p_status, 'offer', case when p_status = 'in' then _clean(p_offer, 120) else '' end))
     where id = p_id;
  end if;
  if not found then return _err('Campaign not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- prizes ----------

create function add_prize(p_area text, p_name text, p_value int, p_collect_at text, p_stock int, p_added_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare hi int;
begin
  if p_added_by not in ('fruitbowl','council','street') then return _err('Who is adding this?'); end if;
  if not exists (select 1 from areas where id = p_area) then return _err('We can''t find that street.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add a name.'); end if;
  if p_value is null or p_value < 0 or p_value > 10000 then return _err('Value must be $0 or more.'); end if;
  if p_stock is null or p_stock < 1 or p_stock > 10000 then return _err('How many? Use 1 or more.'); end if;
  if (select count(*) from prizes) >= 80 then return _err('Too many prizes. Press Reset demo.'); end if;
  select coalesce(max(sort_order), 0) + 1 into hi from prizes;
  insert into prizes (area, name, value, stock, collect_at, added_by, sort_order)
  values (p_area, _clean(p_name, 60), p_value, p_stock, _clean(p_collect_at, 80), p_added_by, hi);
  return jsonb_build_object('ok', true);
end $$;

create function add_stock(p_id bigint, p_n int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_n is null or p_n < 1 or p_n > 1000 then return _err('Bad number.'); end if;
  update prizes set stock = stock + p_n where id = p_id;
  if not found then return _err('Prize not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create function remove_prize(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from signups where (prize->>'id')::bigint = p_id) then
    return _err('Someone already won this, so it cannot be removed.');
  end if;
  delete from prizes where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- workshops ----------

create function add_workshop(p_name text, p_date date, p_time text, p_format text, p_place text, p_councils text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare cs text[];
begin
  if _clean(p_name, 80) = '' then return _err('Please add a name.'); end if;
  if p_date is null then return _err('Please add a date.'); end if;
  if _clean(p_time, 20) = '' then return _err('Please add a time.'); end if;
  if p_format not in ('Online','In person') then return _err('Online or in person?'); end if;
  select coalesce(array_agg(c), '{}') into cs from (
    select distinct c from unnest(coalesce(p_councils, '{}')) c
     where c in (select council_area from areas union select unnest(array['Maroondah','Knox','Monash']))
  ) q;
  if array_length(cs, 1) is null then return _err('Pick at least one council.'); end if;
  if (select count(*) from workshops) >= 40 then return _err('Too many workshops. Press Reset demo.'); end if;
  insert into workshops (name, date, time, format, place, councils)
  values (_clean(p_name, 80), p_date, _clean(p_time, 20), p_format, _clean(p_place, 120), cs);
  return jsonb_build_object('ok', true);
end $$;

create function book_workshop(p_trader text, p_workshop bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from shops where id = _clean(p_trader, 60)) then return _err('Which shop?'); end if;
  if not exists (select 1 from workshops where id = p_workshop) then return _err('Workshop not found.'); end if;
  insert into bookings (trader, workshop) values (_clean(p_trader, 60), p_workshop) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- settings ----------

create function set_setting(p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'code_style' and p_value in ('qr','number','barcode') then
    insert into settings values (p_key, p_value)
    on conflict (key) do update set value = excluded.value;
    return jsonb_build_object('ok', true);
  end if;
  return _err('That setting is not allowed.');
end $$;

-- ---------- areas: onboarding, look, status ----------

create function _slug(t text) returns text
language sql immutable as $$ select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g')) $$;

-- p_by: 'fruitbowl' (an invite) or 'self' (they sign up themselves, then wait for Fruitbowl)
create function area_create(p_name text, p_type text, p_council_area text, p_slug text,
                            p_contact_name text, p_email text, p_mobile text, p_abn text, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text; base text; i int := 1; place text; starts date;
begin
  if _clean(p_name, 80) = '' then return _err('Please add your organisation name.'); end if;
  if p_type not in ('Street Association','Council') then return _err('Council or Street Association?'); end if;
  if _clean(p_council_area, 40) = '' then return _err('Please add your council area.'); end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return _err('Please add a real contact email.'); end if;
  if p_by not in ('fruitbowl','self') then return _err('Who is creating this?'); end if;
  if (select count(*) from areas) >= 30 then return _err('Too many areas. Press Reset demo.'); end if;
  base := _slug(coalesce(nullif(_clean(p_slug, 30), ''), split_part(_clean(p_name, 80), ' ', 1)));
  if base = '' then base := 'area'; end if;
  if base in ('demo','join','safety','c','desk','shop','client','hq','wallet','poster','stickers','tap','reports','api','img','css','js','vendor','sql','index','admin','login') then
    base := base || '-area';
  end if;
  sid := base;
  while exists (select 1 from areas where id = sid) loop i := i + 1; sid := base || '-' || i; end loop;
  place := _clean(p_name, 80);
  insert into areas (id, name, type, council_area, status, created_by, sort_order, brand, email_name, email_address)
  values (sid, place, p_type, _clean(p_council_area, 40),
          case when p_by = 'fruitbowl' then 'invited' else 'waiting' end, p_by,
          coalesce((select max(sort_order) from areas), 0) + 1,
          jsonb_build_object('place', place, 'color', '#560CC9', 'accent', '#F9DE4B', 'logo', '',
                             'welcome', 'Win something on Main Street', 'web', 'mymainstreet.com.au/' || sid),
          place, sid || '@mymainstreet.com.au');
  insert into area_private (area, contact) values (sid, jsonb_build_object(
     'name', _clean(p_contact_name, 80), 'email', _clean(p_email, 120), 'mobile', _clean(p_mobile, 20), 'abn', _clean(p_abn, 20)));
  starts := _today() + 30;
  insert into events (area, name, starts_on, use_by) values (sid, 'Launch day', starts, starts + 7);
  return jsonb_build_object('ok', true, 'id', sid);
end $$;

create function area_save_about(p_id text, p_name text, p_type text, p_council_area text,
                                p_contact_name text, p_email text, p_mobile text, p_abn text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if _clean(p_name, 80) = '' then return _err('Please add your organisation name.'); end if;
  if p_type not in ('Street Association','Council') then return _err('Council or Street Association?'); end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return _err('Please add a real contact email.'); end if;
  update areas set name = _clean(p_name, 80), type = p_type, council_area = _clean(p_council_area, 40) where id = p_id;
  if not found then return _err('We can''t find that street.'); end if;
  insert into area_private (area, contact) values (p_id, jsonb_build_object(
     'name', _clean(p_contact_name, 80), 'email', _clean(p_email, 120), 'mobile', _clean(p_mobile, 20), 'abn', _clean(p_abn, 20)))
  on conflict (area) do update set contact = excluded.contact;
  return jsonb_build_object('ok', true);
end $$;

create function area_contact(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select contact from area_private where area = p_id), '{}'::jsonb)
$$;

create function area_save_brand(p_id text, p_brand jsonb, p_email_name text, p_email_address text, p_reply_to text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b jsonb := '{}'; cur jsonb; k text; v text;
begin
  select brand into cur from areas where id = p_id;
  if not found then return _err('We can''t find that street.'); end if;
  b := cur;
  foreach k in array array['place','welcome','web'] loop
    v := _clean(p_brand->>k, 120);
    if p_brand ? k and v <> '' then b := b || jsonb_build_object(k, v); end if;
  end loop;
  foreach k in array array['color','accent'] loop
    v := p_brand->>k;
    if p_brand ? k then
      if v !~ '^#[0-9A-Fa-f]{6}$' then return _err('Colours need to look like #560CC9.'); end if;
      b := b || jsonb_build_object(k, upper(v));
    end if;
  end loop;
  if p_brand ? 'logo' then
    v := coalesce(p_brand->>'logo', '');
    if v <> '' and (v !~ '^data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$' or length(v) > 90000) then
      return _err('That logo file is too big or not a picture.');
    end if;
    b := b || jsonb_build_object('logo', v);
  end if;
  update areas set brand = b,
         email_name = coalesce(nullif(_clean(p_email_name, 80), ''), email_name),
         email_address = coalesce(nullif(_clean(p_email_address, 120), ''), email_address),
         reply_to = case when p_reply_to is null then reply_to else _clean(p_reply_to, 120) end
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create function area_set_status(p_id text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('invited','waiting','setting up','live') then return _err('Bad status.'); end if;
  update areas set status = p_status where id = p_id;
  if not found then return _err('We can''t find that street.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create function event_save(p_id bigint, p_name text, p_starts date, p_use_by date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if _clean(p_name, 80) = '' then return _err('Please add an event name.'); end if;
  if p_starts is null or p_use_by is null then return _err('Please add both dates.'); end if;
  if p_use_by < p_starts then return _err('The use-by date has to be after the event.'); end if;
  update events set name = _clean(p_name, 80), starts_on = p_starts, use_by = p_use_by where id = p_id;
  if not found then return _err('Event not found.'); end if;
  -- coupons already won at this event follow the new date
  update signups set use_by = p_use_by where event = p_id and prize is not null and not redeemed;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- reports ----------
-- Every sign-up with its coupon. p_area = null means every area (Fruitbowl).
create function report_rows(p_area text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'signed_up') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'area', s.area,
      'first_name', s.name,
      'last_name', coalesce(nullif(sp.last_name, ''), s.last_initial),
      'email', sp.email,
      'mobile', sp.mobile,
      'postcode', sp.postcode,
      'contact', case s.contact when 'text' then 'Text' else 'Email' end,
      'optin', sp.optin,
      'signed_up', to_char(s.created_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD HH24:MI'),
      'event_id', s.event,
      'event', ev.name,
      'code', s.code,
      'prize', s.prize->>'name',
      'value', (s.prize->>'value')::int,
      'won', to_char(s.spun_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD HH24:MI'),
      'status', case
          when s.prize is null then 'No coupon yet'
          when s.redeemed then 'Used'
          when s.use_by < _today() then 'Expired'
          else 'Not used' end,
      'used_at', case when s.redeemed then coalesce(sh.name, 'Prize desk') else null end,
      'used_shop_id', case when s.redeemed then s.redeemed_at else null end,
      'used', to_char(s.redeemed_time at time zone 'Australia/Melbourne', 'YYYY-MM-DD HH24:MI')
    ) as r
    from signups s
    join signup_private sp on sp.code = s.code
    join events ev on ev.id = s.event
    left join shops sh on sh.id = s.redeemed_at
    where p_area is null or s.area = p_area
  ) q
$$;

create function report_log(p_kind text, p_area text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into download_log (kind, area) values (_clean(p_kind, 40), _clean(p_area, 40));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- locks ----------

alter table settings        enable row level security;
alter table areas           enable row level security;
alter table area_private    enable row level security;
alter table events          enable row level security;
alter table shops           enable row level security;
alter table shop_private    enable row level security;
alter table signups         enable row level security;
alter table signup_private  enable row level security;
alter table campaigns       enable row level security;
alter table prizes          enable row level security;
alter table workshops       enable row level security;
alter table bookings        enable row level security;
alter table download_log    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','areas','events','shops','signups','campaigns','prizes','workshops','bookings'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
-- the private tables have no policy at all, so nobody but the database owner can read them.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon, authenticated;
    revoke all on all functions in schema public from anon, authenticated, public;
    grant usage on schema public to anon;
    grant select on settings, areas, events, shops, signups, campaigns, prizes, workshops, bookings to anon;
    grant execute on all functions in schema public to anon;
  end if;
end $$;

-- ---------- live updates ----------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['settings','areas','events','shops','signups','campaigns','prizes','workshops','bookings'] loop
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

select reset_demo();
