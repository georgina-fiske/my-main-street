-- My Main Street: LIVE database (real customers).  Version 3.
-- Run this whole file once in Supabase > SQL Editor, on a new or empty project.
-- It has NO demo data and NO reset function.
-- Running it again wipes everything, so only run it before real sign-ups start.
--
-- How it is locked:
--  * The public (anon key) can read only the non-personal tables: areas, events, settings, and shops
--    (not the hidden ones). It cannot read customers, prizes or staff.
--  * A customer can only open their OWN coupon, and only with their code AND the secret
--    in their link (get_pass). Nobody can browse other people's coupons.
--  * Staff (logged in) read customers for their own area only. Every staff function checks the role.
--  * A shop has a real account. It checks coupons with its login. Using a coupon on a customer's
--    phone needs the shop AND its 6-digit shop code, with a lock-out after a few wrong tries.
--  * Private details live in tables nobody but the functions can read:
--    signup_private (email, mobile, postcode, last name), shop_private (shop code, contact),
--    area_private, staff, download_log.

-- The demo had a nightly reset. Real data must never be reset, so switch that off if it exists.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'nightly-demo-reset';
  end if;
end $$;

-- ---------- clean slate ----------

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  loop execute 'drop function if exists ' || r.sig || ' cascade'; end loop;
end $$;

drop table if exists staff, download_log, bookings, workshops, campaigns, prizes,
  shop_private, shops, signup_private, signups, events, area_private, areas, settings cascade;

-- ---------- tables ----------

create table settings (
  key   text primary key,
  value text not null
);

-- A council or street association using My Main Street.
create table areas (
  id           text primary key,            -- the subdomain, e.g. 'croydon'
  name         text not null,
  type         text not null check (type in ('Street Association','Council')),
  council_area text not null default '',
  status       text not null default 'invited' check (status in ('invited','waiting','setting up','live')),
  created_by   text not null default 'fruitbowl' check (created_by in ('fruitbowl','self')),
  sort_order   int not null default 0,
  brand        jsonb not null default '{}', -- place, color, accent, logo, welcome, web
  email_name   text not null default '',    -- the "From" name on emails
  email_address text not null default '',
  reply_to     text not null default ''
);

create table area_private (
  area    text primary key references areas(id) on delete cascade,
  contact jsonb not null default '{}'
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
  claimed    boolean not null default false, -- has the shop set up its own account yet?
  hidden     boolean not null default false,
  sort_order int not null default 0
);

create table shop_private (
  shop         text primary key references shops(id) on delete cascade,
  code         text unique check (code ~ '^\d{6}$'),   -- the permanent 6-digit shop code
  contact      jsonb not null default '{}',            -- name, email, mobile
  fail_count   int not null default 0,                 -- wrong shop-code tries in a row
  locked_until timestamptz,
  claimed_at   timestamptz
);

-- Who can log in, and what they can do.
--   chaos       = everything, every area, and platform settings
--   fruitbowl   = everything else, every area
--   council / street = manage their own area (shops, prizes, look, reports, prize desk)
--   desk        = the prize desk for their own area
--   shop        = a shop's own account (checks and uses coupons)
create table staff (
  email text primary key check (email = lower(email)),
  role  text not null check (role in ('chaos','fruitbowl','council','street','desk','shop')),
  area  text references areas(id) on delete cascade,
  shop  text references shops(id) on delete cascade,
  check ((role in ('chaos','fruitbowl') and area is null and shop is null)
      or (role in ('council','street','desk') and area is not null and shop is null)
      or (role = 'shop' and shop is not null))
);

create table prizes (
  id         bigint generated always as identity primary key,
  area       text not null references areas(id) on delete cascade,
  name       text not null,
  value      int not null default 0,        -- 0 = a small prize handed over at the desk
  stock      int not null default 0,        -- how many in total (the cap). Left = stock - won
  color      text not null default '#560CC9',  -- the colour of its slice on the wheel
  sort_order int not null default 0
);

create table signups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  token        text not null,               -- the secret in the customer's own link
  area         text not null references areas(id) on delete cascade,
  event        bigint not null references events(id) on delete cascade,
  name         text not null,
  last_initial text not null default '',
  contact      text not null default 'email' check (contact in ('email','text')),
  created_at   timestamptz not null default now(),
  consent_at   timestamptz not null default now(),
  prize        jsonb,                       -- {id, name, value}
  spun_at      timestamptz,
  use_by       date,
  redeemed     boolean not null default false,
  redeemed_at  text,                        -- shop id, or 'desk'
  redeemed_time timestamptz,
  awarded_by   text,
  notified_at  timestamptz
);

create table signup_private (
  code      text primary key references signups(code) on delete cascade,
  event     bigint not null,
  last_name text not null default '',
  email     text not null default '',
  mobile    text not null default '',
  postcode  text not null default '',
  optin     boolean not null default false,
  unsub     text not null default md5(random()::text || clock_timestamp()::text)
);
-- the same email or mobile can only sign up once per event
create unique index signup_private_email_once  on signup_private (event, lower(email)) where email <> '';
create unique index signup_private_mobile_once on signup_private (event, mobile)       where mobile <> '';

create table download_log (
  id    bigint generated always as identity primary key,
  at    timestamptz not null default now(),
  who   text not null default '',
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

-- Who is calling? (the email on their login, or '' for the public)
create function _me() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create function _is_chaos() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where email = _me() and role = 'chaos')
$$;
create function _is_hq() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where email = _me() and role in ('chaos','fruitbowl'))
$$;
-- manage an area: Chaos Master, Fruitbowl, or the council / street association for that area
create function _can_manage(a text) returns boolean
language sql stable security definer set search_path = public as $$
  select _is_hq() or exists (select 1 from staff where email = _me() and role in ('council','street') and area = a)
$$;
-- run the prize desk for an area
create function _can_desk(a text) returns boolean
language sql stable security definer set search_path = public as $$
  select _can_manage(a) or exists (select 1 from staff where email = _me() and role = 'desk' and area = a)
$$;
-- the shop this login belongs to (null if not a shop login)
create function _my_shop() returns text
language sql stable security definer set search_path = public as $$
  select shop from staff where email = _me() and role = 'shop'
$$;

create function _new_shop_code() returns text
language plpgsql volatile as $$
declare c text; n int := 0;
begin
  loop
    c := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from shop_private where code = c);
    n := n + 1; if n > 200 then raise exception 'no free shop code'; end if;
  end loop;
  return c;
end $$;

-- ---------- customers ----------

create function signup(p_area text, p_name text, p_last text, p_email text, p_mobile text,
                       p_postcode text, p_contact text, p_optin boolean, p_terms boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n text := _clean(p_name, 40); l text := _clean(p_last, 40);
  e text := lower(_clean(p_email, 120)); m text := regexp_replace(coalesce(p_mobile, ''), '\s', '', 'g');
  a areas; ev events; c text; tk text; tries int := 0; existing text;
begin
  if n = '' then return _err('Please add your first name.'); end if;
  if l = '' then return _err('Please add your last name.'); end if;
  if coalesce(p_postcode, '') !~ '^\d{4}$' then return _err('Postcode needs 4 numbers.'); end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return _err('Please add a real email.'); end if;
  if m !~ '^04\d{8}$' then return _err('Mobile needs to look like 04xx xxx xxx.'); end if;
  if p_contact not in ('email','text') then return _err('Choose email or text message.'); end if;
  if p_terms is not true then return _err('Please tick the box to agree to the terms.'); end if;
  select * into a from areas where id = p_area;
  if not found then return _err('We can''t find that street.'); end if;
  if a.status <> 'live' then return _err('Sign-ups are not open yet.'); end if;
  select * into ev from events where area = p_area order by starts_on desc, id desc limit 1;
  if not found then return _err('No festival is open for this street yet.'); end if;

  -- one sign-up per email or mobile: show the code they already have
  select s.code into existing
    from signup_private sp join signups s on s.code = sp.code
   where sp.event = ev.id and (lower(sp.email) = e or sp.mobile = m)
   limit 1;
  if existing is not null then
    return jsonb_build_object('ok', true, 'code', existing, 'existing', true);   -- no secret: it is not shown to anyone who asks
  end if;

  loop
    c := 'CMS-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from signups where code = c);
    tries := tries + 1;
    if tries > 80 then return _err('Please try again.'); end if;
  end loop;
  tk := substr(md5(random()::text || clock_timestamp()::text || c), 1, 8);
  insert into signups (code, token, area, event, name, last_initial, contact)
  values (c, tk, p_area, ev.id, n, upper(left(l, 1)), p_contact);
  insert into signup_private (code, event, last_name, email, mobile, postcode, optin)
  values (c, ev.id, l, e, m, p_postcode, coalesce(p_optin, false));
  return jsonb_build_object('ok', true, 'code', c, 'token', tk, 'existing', false);
end $$;

-- A customer's own coupon: needs the code AND the secret from their link.
create function get_pass(p_code text, p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'id' - 'token' - 'awarded_by'
    from signups s where s.code = upper(_clean(p_code, 12)) and s.token = lower(_clean(p_token, 20))
$$;

-- "Shop: use this coupon" on the customer's own phone. Needs the coupon's secret AND the shop's code.
create function use_on_phone(p_code text, p_token text, p_shop text, p_shop_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sp shop_private; sh shops; s signups; at_name text;
begin
  select * into sh from shops where id = _clean(p_shop, 60) and not hidden;
  if not found then return _err('Please choose your shop.'); end if;
  select * into sp from shop_private where shop = sh.id for update;
  if sp.locked_until is not null and sp.locked_until > now() then
    return _err('Too many wrong codes. Please wait a few minutes and try again.');
  end if;
  if sp.code is null or sp.code is distinct from _clean(p_shop_code, 6) then
    update shop_private
       set locked_until = case when fail_count + 1 >= 5 then now() + interval '10 minutes' else null end,
           fail_count = case when fail_count + 1 >= 5 then 0 else fail_count + 1 end
     where shop = sh.id;
    return _err('That shop code doesn''t match ' || sh.name || '.');
  end if;
  update shop_private set fail_count = 0, locked_until = null where shop = sh.id;
  select * into s from signups where code = upper(_clean(p_code, 12)) and token = lower(_clean(p_token, 20)) for update;
  if not found then return _err('We can''t find this coupon.'); end if;
  if s.prize is null then return _err('This code has no coupon yet.'); end if;
  if (s.prize->>'value')::int = 0 then return _err('This is a small prize. It is collected at the desk.'); end if;
  if s.redeemed then
    if s.redeemed_at = sh.id and s.redeemed_time > now() - interval '2 minutes' then   -- the same tap sent twice
      return jsonb_build_object('ok', true, 'shop', sh.name, 'value', (s.prize->>'value')::int, 'name', s.name);
    end if;
    select name into at_name from shops where id = s.redeemed_at;
    return _err('Already used at ' || coalesce(at_name, 'the prize desk') || ' on ' || _when(s.redeemed_time));
  end if;
  if s.use_by < _today() then return _err('This coupon has run out.'); end if;
  if sh.area <> s.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'shop', sh.name, 'value', (s.prize->>'value')::int, 'name', s.name);
end $$;

-- "Unsubscribe" in an email or text: stop news and offers.
create function unsubscribe(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update signup_private set optin = false where unsub = _clean(p_token, 40);
  if not found then return _err('That link is not right.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- the prize desk ----------

create function award_prize(p_code text, p_prize bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; p prizes; ev events; spent int; lim int;
begin
  select * into s from signups where code = upper(_clean(p_code, 12)) for update;
  if not found then return _err('No one has that code.'); end if;
  if not _can_desk(s.area) then return _err('Please log in with a staff account.'); end if;
  if s.prize is not null then
    -- the same tap sent twice (a slow connection retrying) is fine
    if (s.prize->>'id')::bigint = p_prize and s.spun_at > now() - interval '2 minutes' then
      return jsonb_build_object('ok', true, 'again', true);
    end if;
    return _err(s.name || ' has already spun.');
  end if;
  select * into p from prizes where id = p_prize for update;
  if not found then return _err('That prize is gone.'); end if;
  if p.area <> s.area then return _err('That prize belongs to a different street.'); end if;
  if p.stock - (select count(*) from signups where (prize->>'id')::bigint = p.id) < 1 then
    return _err('That prize has run out.');
  end if;
  if p.value > 0 then
    -- one budget for the whole street, shared by every desk
    perform 1 from settings where key = 'budget_limit' for update;
    select coalesce(sum((prize->>'value')::int), 0) into spent from signups where area = s.area and prize is not null;
    select coalesce((select value::int from settings where key = 'budget_limit'), 5000) into lim;
    if spent + p.value > lim then return _err('The prize budget is used up. Give a small prize instead.'); end if;
  end if;
  select * into ev from events where id = s.event;
  update signups
     set prize = jsonb_build_object('id', p.id, 'name', p.name, 'value', p.value),
         spun_at = now(),
         use_by = coalesce(ev.use_by, _today() + 7),
         awarded_by = _me(),
         -- small prizes are handed over at the desk, so they are used straight away
         redeemed = (p.value = 0),
         redeemed_at = case when p.value = 0 then 'desk' else null end,
         redeemed_time = case when p.value = 0 then now() else null end
   where code = s.code;
  return jsonb_build_object('ok', true);
end $$;

create function undo_prize(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  select * into s from signups where code = upper(_clean(p_code, 12)) for update;
  if not found then return _err('No one has that code.'); end if;
  if not _can_desk(s.area) then return _err('Please log in with a staff account.'); end if;
  if s.prize is null then return jsonb_build_object('ok', true); end if;           -- already undone
  if s.redeemed and s.redeemed_at is distinct from 'desk' then return _err('Already used. Cannot undo.'); end if;
  update signups
     set prize = null, spun_at = null, use_by = null, redeemed = false, redeemed_at = null,
         redeemed_time = null, awarded_by = null, notified_at = null
   where code = s.code;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- a shop's own account ----------

-- This shop (name, shop code, street).
create function shop_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', sh.id, 'name', sh.name, 'type', sh.type, 'area', sh.area,
                            'code', sp.code, 'place', a.brand->>'place')
    from shops sh join shop_private sp on sp.shop = sh.id join areas a on a.id = sh.area
   where sh.id = _my_shop()
$$;

-- Look up a coupon. Returns what the shop needs to decide.
create function shop_check(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sh shops; s signups; at_name text;
begin
  select * into sh from shops where id = _my_shop();
  if not found then return jsonb_build_object('state', 'login'); end if;
  select * into s from signups where code = upper(_clean(p_code, 12));
  if not found then return jsonb_build_object('state', 'missing'); end if;
  if s.prize is null then return jsonb_build_object('state', 'noprize', 'name', s.name); end if;
  if (s.prize->>'value')::int = 0 then return jsonb_build_object('state', 'small', 'name', s.name); end if;
  if s.redeemed then
    select name into at_name from shops where id = s.redeemed_at;
    return jsonb_build_object('state', 'used', 'at', coalesce(at_name, 'the prize desk'), 'when', _when(s.redeemed_time));
  end if;
  if s.use_by < _today() then return jsonb_build_object('state', 'expired', 'use_by', _day(s.use_by)); end if;
  if s.area <> sh.area then return jsonb_build_object('state', 'otherarea'); end if;
  return jsonb_build_object('state', 'valid', 'code', s.code, 'name', s.name, 'last', s.last_initial,
                            'value', (s.prize->>'value')::int, 'use_by', _day(s.use_by));
end $$;

create function shop_use(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh shops; s signups; at_name text;
begin
  select * into sh from shops where id = _my_shop();
  if not found then return _err('Please log in to your shop account.'); end if;
  select * into s from signups where code = upper(_clean(p_code, 12)) for update;
  if not found then return _err('We can''t find this code. Check it and try again.'); end if;
  if s.prize is null then return _err('This code has no coupon yet.'); end if;
  if (s.prize->>'value')::int = 0 then return _err('This is a small prize. It is collected at the desk.'); end if;
  if s.redeemed then
    if s.redeemed_at = sh.id and s.redeemed_time > now() - interval '2 minutes' then   -- the same tap sent twice
      return jsonb_build_object('ok', true, 'value', (s.prize->>'value')::int, 'name', s.name);
    end if;
    select name into at_name from shops where id = s.redeemed_at;
    return _err('Already used at ' || coalesce(at_name, 'the prize desk') || ' on ' || _when(s.redeemed_time));
  end if;
  if s.use_by < _today() then return _err('This coupon ran out on ' || _day(s.use_by)); end if;
  if s.area <> sh.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'value', (s.prize->>'value')::int, 'name', s.name);
end $$;

-- The shop's own history. (Only this shop's coupons.)
create function shop_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'used', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'last', s.last_initial,
              'value', (s.prize->>'value')::int, 'at', s.redeemed_time) order by s.redeemed_time desc)
              from signups s where s.redeemed and s.redeemed_at = _my_shop() and (s.prize->>'value')::int > 0), '[]'::jsonb))
$$;

create function shop_reset_code()
returns jsonb language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if _my_shop() is null then return _err('Please log in to your shop account.'); end if;
  c := _new_shop_code();
  update shop_private set code = c, fail_count = 0, locked_until = null where shop = _my_shop();
  return jsonb_build_object('ok', true, 'code', c);
end $$;

-- ---------- shops and prizes (admin) ----------

create function shop_add(p_area text, p_name text, p_type text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text; base text; i int := 1;
begin
  if not _can_manage(p_area) then return _err('Please log in with a staff account.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add the shop name.'); end if;
  base := trim(both '-' from regexp_replace(lower(_clean(p_name, 60)), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'shop'; end if;
  sid := base;
  while exists (select 1 from shops where id = sid) loop i := i + 1; sid := base || '-' || i; end loop;
  insert into shops (id, area, name, type, sort_order)
  values (sid, p_area, _clean(p_name, 60), _clean(p_type, 30), coalesce((select max(sort_order) from shops where area = p_area), 0) + 1);
  insert into shop_private (shop) values (sid);
  return jsonb_build_object('ok', true, 'id', sid);
end $$;

create function shop_update(p_id text, p_name text, p_type text, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_manage((select area from shops where id = p_id)) then return _err('Please log in with a staff account.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add the shop name.'); end if;
  update shops set name = _clean(p_name, 60), type = _clean(p_type, 30), hidden = coalesce(p_hidden, false) where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create function add_prize(p_area text, p_name text, p_value int, p_stock int, p_color text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_manage(p_area) then return _err('Please log in with a staff account.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add a name.'); end if;
  if p_value is null or p_value < 0 or p_value > 10000 then return _err('Value must be $0 or more.'); end if;
  if p_stock is null or p_stock < 1 or p_stock > 100000 then return _err('How many? Use 1 or more.'); end if;
  if coalesce(p_color, '') !~ '^#[0-9A-Fa-f]{6}$' then p_color := '#560CC9'; end if;
  insert into prizes (area, name, value, stock, color, sort_order)
  values (p_area, _clean(p_name, 60), p_value, p_stock, upper(p_color), coalesce((select max(sort_order) from prizes where area = p_area), 0) + 1);
  return jsonb_build_object('ok', true);
end $$;

create function prize_update(p_id bigint, p_name text, p_value int, p_stock int, p_color text, p_order int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare given int;
begin
  if not _can_manage((select area from prizes where id = p_id)) then return _err('Please log in with a staff account.'); end if;
  select count(*) into given from signups where (prize->>'id')::bigint = p_id;
  if p_stock < given then return _err('That is fewer than have already been won (' || given || ').'); end if;
  if coalesce(p_color, '') !~ '^#[0-9A-Fa-f]{6}$' then return _err('Colours need to look like #560CC9.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add a name.'); end if;
  if given > 0 and p_value <> (select value from prizes where id = p_id) then return _err('Someone has already won this, so its value cannot change.'); end if;
  update prizes set name = _clean(p_name, 60), value = p_value, stock = p_stock, color = upper(p_color), sort_order = coalesce(p_order, sort_order) where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create function remove_prize(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_manage((select area from prizes where id = p_id)) then return _err('Please log in with a staff account.'); end if;
  if exists (select 1 from signups where (prize->>'id')::bigint = p_id) then
    return _err('Someone already won this, so it cannot be removed.');
  end if;
  delete from prizes where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create function set_setting(p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_hq() then return _err('Please log in with a staff account.'); end if;
  if p_key = 'code_style' and p_value in ('qr','number','barcode') then null;
  elsif p_key = 'budget_limit' and p_value ~ '^\d{1,6}$' then null;
  else return _err('That setting is not allowed.'); end if;
  insert into settings values (p_key, p_value) on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- areas: look, event, status ----------

create function _slug(t text) returns text
language sql immutable as $$ select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g')) $$;

create function area_create(p_name text, p_type text, p_council_area text, p_slug text,
                            p_contact_name text, p_email text, p_mobile text, p_abn text, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text; base text; i int := 1; place text; starts date;
begin
  if not _is_hq() then return _err('Only Fruitbowl can add an area.'); end if;
  if _clean(p_name, 80) = '' then return _err('Please add the organisation name.'); end if;
  if p_type not in ('Street Association','Council') then return _err('Council or Street Association?'); end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return _err('Please add a real contact email.'); end if;
  base := _slug(coalesce(nullif(_clean(p_slug, 30), ''), split_part(_clean(p_name, 80), ' ', 1)));
  if base = '' then base := 'area'; end if;
  if base in ('www','admin','app','api','demo','safety','login','mail','shop','desk') then base := base || '-area'; end if;
  sid := base;
  while exists (select 1 from areas where id = sid) loop i := i + 1; sid := base || '-' || i; end loop;
  place := _clean(p_name, 80);
  insert into areas (id, name, type, council_area, status, created_by, sort_order, brand, email_name, email_address)
  values (sid, place, p_type, _clean(p_council_area, 40), 'invited', 'fruitbowl',
          coalesce((select max(sort_order) from areas), 0) + 1,
          jsonb_build_object('place', place, 'color', '#560CC9', 'accent', '#F9DE4B', 'logo', '',
                             'welcome', place || ' is My Main Street! Scan, spin and win.', 'web', sid || '.my-mainstreet.com.au'),
          place, 'hello@my-mainstreet.com.au');
  insert into area_private (area, contact) values (sid, jsonb_build_object(
     'name', _clean(p_contact_name, 80), 'email', _clean(p_email, 120), 'mobile', _clean(p_mobile, 20), 'abn', _clean(p_abn, 20)));
  starts := _today() + 30;
  insert into events (area, name, starts_on, use_by) values (sid, 'Launch day', starts, starts + 22);
  return jsonb_build_object('ok', true, 'id', sid);
end $$;

create function area_save_brand(p_id text, p_brand jsonb, p_email_name text, p_email_address text, p_reply_to text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b jsonb := '{}'; cur jsonb; k text; v text;
begin
  if not _can_manage(p_id) then return _err('Please log in with a staff account.'); end if;
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
  if not _is_hq() then return _err('Please log in with a staff account.'); end if;
  if p_status not in ('invited','waiting','setting up','live') then return _err('Bad status.'); end if;
  update areas set status = p_status where id = p_id;
  if not found then return _err('We can''t find that street.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create function event_save(p_id bigint, p_name text, p_starts date, p_use_by date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_manage((select area from events where id = p_id)) then return _err('Please log in with a staff account.'); end if;
  if _clean(p_name, 80) = '' then return _err('Please add an event name.'); end if;
  if p_starts is null or p_use_by is null then return _err('Please add both dates.'); end if;
  if p_use_by < p_starts then return _err('The use-by date has to be after the event.'); end if;
  update events set name = _clean(p_name, 80), starts_on = p_starts, use_by = p_use_by where id = p_id;
  update signups set use_by = p_use_by where event = p_id and prize is not null and not redeemed;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- people (staff logins) ----------

create function staff_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('email', email, 'role', role, 'area', area, 'shop', shop) from staff where email = _me()), '{}'::jsonb)
$$;

-- Everyone with a login. Fruitbowl does not see Chaos Master logins.
create function staff_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when _is_hq() then coalesce((
      select jsonb_agg(jsonb_build_object('email', st.email, 'role', st.role, 'area', st.area, 'shop', sh.name) order by st.role, st.email)
        from staff st left join shops sh on sh.id = st.shop
       where _is_chaos() or st.role <> 'chaos'), '[]'::jsonb) else '[]'::jsonb end
$$;

create function staff_remove(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if not _is_hq() then return _err('Please log in with a staff account.'); end if;
  if lower(_clean(p_email, 120)) = _me() then return _err('You cannot remove yourself.'); end if;
  select role into r from staff where email = lower(_clean(p_email, 120));
  if r = 'chaos' and not _is_chaos() then return _err('Only Chaos Master can remove that login.'); end if;
  delete from staff where email = lower(_clean(p_email, 120));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- reports ----------

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
          when (s.prize->>'value')::int = 0 then 'Collected at desk'
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
    where (case when p_area is null then _is_hq() else _can_manage(p_area) end)
      and (p_area is null or s.area = p_area)
  ) q
$$;

create function report_log(p_kind text, p_area text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (case when nullif(p_area, '') is null then _is_hq() else _can_manage(p_area) end) then
    return _err('Please log in with a staff account.');
  end if;
  insert into download_log (who, kind, area) values (_me(), _clean(p_kind, 40), _clean(p_area, 40));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- locks ----------

alter table settings        enable row level security;
alter table areas           enable row level security;
alter table area_private    enable row level security;
alter table staff           enable row level security;
alter table events          enable row level security;
alter table shops           enable row level security;
alter table shop_private    enable row level security;
alter table prizes          enable row level security;
alter table signups         enable row level security;
alter table signup_private  enable row level security;
alter table download_log    enable row level security;

-- The public can read these: nothing personal in them.
do $$
declare t text;
begin
  foreach t in array array['settings','areas','events'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
drop policy if exists "public read" on shops;
create policy "public read" on shops for select using (not hidden);
drop policy if exists "staff read" on shops;
create policy "staff read" on shops for select to authenticated using (_can_manage(area));
-- Prizes and customers: only staff for that area.
drop policy if exists "staff read" on prizes;
create policy "staff read" on prizes for select to authenticated using (_can_desk(area));
drop policy if exists "staff read" on signups;
create policy "staff read" on signups for select to authenticated using (_can_desk(area));
-- signup_private, shop_private, area_private, staff and download_log have no policy at all,
-- so only the database functions above can read them.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon, authenticated;
    revoke all on all functions in schema public from anon, authenticated, public;
    grant usage on schema public to anon, authenticated;
    grant select on settings, areas, events, shops to anon, authenticated;
    grant select on prizes, signups to authenticated;
    -- the table rules call these, so the caller needs to be able to run them
    grant execute on function _me(), _is_chaos(), _is_hq(), _can_manage(text), _can_desk(text), _my_shop() to anon, authenticated;
    -- anyone: the customer form, their own coupon, "Shop: use this coupon" on their phone, unsubscribe
    grant execute on function
      signup(text,text,text,text,text,text,text,boolean,boolean), get_pass(text,text),
      use_on_phone(text,text,text,text), unsubscribe(text)
    to anon, authenticated;
    -- logged-in staff and shops (each function also checks the role)
    grant execute on function
      award_prize(text,bigint), undo_prize(text),
      shop_me(), shop_check(text), shop_use(text), shop_summary(), shop_reset_code(),
      shop_add(text,text,text), shop_update(text,text,text,boolean),
      add_prize(text,text,int,int,text), prize_update(bigint,text,int,int,text,int), remove_prize(bigint),
      set_setting(text,text), area_create(text,text,text,text,text,text,text,text,text),
      area_save_brand(text,jsonb,text,text,text), area_set_status(text,text), event_save(bigint,text,date,date),
      staff_me(), staff_list(), staff_remove(text), report_rows(text), report_log(text,text)
    to authenticated;
  end if;
end $$;

-- ---------- live updates ----------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['settings','areas','events','shops','prizes','signups'] loop
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

insert into settings values ('code_style', 'qr'), ('budget_limit', '5000') on conflict (key) do nothing;
