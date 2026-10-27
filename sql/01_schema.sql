-- My Main Street: demo database.
-- Run this whole file once in Supabase > SQL Editor.
-- Safe to run again: it rebuilds everything and reloads the demo data.
--
-- How it is locked:
--  * The public (anon key) can READ the demo tables.
--  * The public can NOT write to any table directly.
--  * Every change goes through the functions below. Each one does
--    only what a demo screen does, and checks its input.
--  * Emails and postcodes live in signup_private. The public cannot read it.

create extension if not exists pgcrypto;

-- ---------- tables ----------

drop table if exists bookings, workshops, campaigns, prizes, signup_private, signups, settings cascade;

create table settings (
  key   text primary key,
  value text not null
);

create table signups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  created_at   timestamptz not null default now(),
  prize        jsonb,                      -- {id, name, value, collect_at}
  spun_at      timestamptz,
  redeemed     boolean not null default false,
  redeemed_at  text,                       -- shop name where the prize was used
  stamps       jsonb not null default '{}', -- shop id -> count
  rewards_used jsonb not null default '{}'  -- shop id -> count
);

-- email, postcode and opt-in. Not readable by the public.
create table signup_private (
  code     text primary key references signups(code) on delete cascade,
  email    text,
  postcode text,
  optin    boolean not null default false
);

create table campaigns (
  id           bigint generated always as identity primary key,
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
  name       text not null,
  value      int not null default 0,
  stock      int not null default 0,        -- how many are left
  collect_at text not null default '',
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

-- ---------- helpers ----------

create or replace function _err(msg text) returns jsonb
language sql immutable as $$ select jsonb_build_object('ok', false, 'error', msg) $$;

create or replace function _clean(t text, n int) returns text
language sql immutable as $$ select left(btrim(coalesce(t, '')), n) $$;

-- ---------- demo data (also used by the reset button) ----------

create or replace function reset_demo() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  truncate bookings, workshops, campaigns, prizes, signup_private, signups, settings restart identity cascade;

  insert into settings values ('code_style', 'qr');

  insert into prizes (name, value, stock, collect_at, added_by, sort_order) values
    ('Free coffee',            5,  149, 'Main St Espresso',                       'fruitbowl', 1),
    ('Sweet treat',            5,   80, 'Gelato Lane',                            'fruitbowl', 2),
    ('Drink at a bar tonight', 10,  60, 'The Drover Bar, tonight only',           'street',    3),
    ('Shop voucher',           20,  30, 'The Corner Bookshop or Croydon Op Shop', 'street',    4),
    ('Dinner voucher',         25,  30, 'Lantern Thai',                           'council',   5),
    ('Big dining prize',      100,   3, 'Lantern Thai',                           'council',   6),
    ('Croydon tote bag',        0, 200, 'The marquee desk, right now',            'fruitbowl', 7);

  insert into campaigns (title, month, blurb, posted_by, council, street, street_extra, traders, sort_order) values
    ('Tinsel & Thongs: a Croydon Summer Christmas', 'December 2026',
     'A hot, silly, local Christmas. Shop on the street. Collect stamps. Win prizes.',
     'fruitbowl', 'approved', 'yes', 'Santa on a banana lounge, Saturday afternoons.',
     jsonb_build_object(
       'espresso', jsonb_build_object('status','in','offer','Free iced coffee upsize + a stamp'),
       'gelato',   jsonb_build_object('status','in','offer','Christmas pudding gelato, stamp with any scoop'),
       'books',    jsonb_build_object('status','in','offer','Free gift wrapping + a stamp'),
       'optom',    jsonb_build_object('status','in','offer','Free sunnies fitting + a stamp')),
     1),
    ('Hot Days, Cool Street', 'January 2027',
     'Beat the heat. Cool drinks, cold treats and shady spots on Main St.',
     'fruitbowl', 'approved', 'pending', '', '{}', 2),
    ('Back to School', 'February 2027',
     'Help families get ready. Uniforms, books, glasses and a smile.',
     'fruitbowl', 'pending', 'pending', '', '{}', 3),
    ('Croydon Twilight Market', 'Friday 4 December 2026',
     'Shops stay open late. Stamps count double on the night.',
     'council', 'approved', 'pending', '', '{}', 4);

  insert into workshops (name, date, time, format, place, councils) values
    ('Christmas in a box',           '2026-11-10', '6:30pm', 'Online',    'Link sent when you book', array['Maroondah','Knox']),
    ('How to use My Main Street','2026-11-12', '2pm',    'Online',    'Link sent when you book', array['Maroondah']),
    ('Phone photos that sell',       '2026-11-17', '10am',   'In person', 'Croydon, venue to be confirmed', array['Maroondah']);

  -- three demo customers
  insert into signups (code, name, created_at, stamps) values
    ('CMS-1001', 'Jo', now() - interval '20 minutes', '{}');
  insert into signups (code, name, created_at, prize, spun_at, stamps) values
    ('CMS-1002', 'Priya', now() - interval '40 minutes',
     (select jsonb_build_object('id', id, 'name', name, 'value', value, 'collect_at', collect_at) from prizes where name = 'Free coffee'),
     now() - interval '30 minutes', '{}');
  insert into signups (code, name, created_at, stamps) values
    ('CMS-1003', 'Alex', now() - interval '2 days', '{"espresso":4,"gelato":3,"books":2}');

  insert into signup_private (code, email, postcode, optin) values
    ('CMS-1001', 'jo@example.com',    '3136', true),
    ('CMS-1002', 'priya@example.com', '3136', false),
    ('CMS-1003', 'alex@example.com',  '3136', true);

  return jsonb_build_object('ok', true);
end $$;

-- ---------- customers ----------

create or replace function signup(p_name text, p_email text, p_postcode text, p_optin boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n text := _clean(p_name, 40); e text := _clean(p_email, 120); c text; tries int := 0;
begin
  if n = '' then return _err('Please add your first name.'); end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return _err('Please add a real email.'); end if;
  if coalesce(p_postcode, '') !~ '^\d{4}$' then return _err('Postcode needs 4 numbers.'); end if;
  if (select count(*) from signups) >= 400 then return _err('The demo is full. Press Reset demo in the footer.'); end if;
  loop
    c := 'CMS-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from signups where code = c);
    tries := tries + 1;
    if tries > 50 then return _err('Please try again.'); end if;
  end loop;
  insert into signups (code, name) values (c, n);
  insert into signup_private (code, email, postcode, optin) values (c, e, p_postcode, coalesce(p_optin, false));
  return jsonb_build_object('ok', true, 'code', c);
end $$;

create or replace function give_stamp(p_code text, p_shop text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; sh text := _clean(p_shop, 30);
begin
  if sh = '' then return _err('Which shop?'); end if;
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  update signups
     set stamps = jsonb_set(stamps, array[sh], to_jsonb(coalesce((stamps->>sh)::int, 0) + 1))
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

create or replace function use_reward(p_code text, p_shop text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; sh text := _clean(p_shop, 30); have int; used int;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  have := coalesce((s.stamps->>sh)::int, 0) / 6;
  used := coalesce((s.rewards_used->>sh)::int, 0);
  if have - used < 1 then return _err('No 6-stamp reward to use here.'); end if;
  update signups
     set rewards_used = jsonb_set(rewards_used, array[sh], to_jsonb(used + 1))
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- festival desk ----------

create or replace function award_prize(p_code text, p_prize bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups; p prizes;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if s.prize is not null then return _err(s.name || ' has already spun.'); end if;
  select * into p from prizes where id = p_prize for update;
  if not found then return _err('That prize is gone.'); end if;
  if p.stock < 1 then return _err('That prize has run out.'); end if;
  update prizes set stock = stock - 1 where id = p.id;
  update signups
     set prize = jsonb_build_object('id', p.id, 'name', p.name, 'value', p.value, 'collect_at', p.collect_at),
         spun_at = now()
   where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

create or replace function undo_prize(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if s.prize is null then return _err('No prize to undo.'); end if;
  if s.redeemed then return _err('Already used. Cannot undo.'); end if;
  update prizes set stock = stock + 1 where id = (s.prize->>'id')::bigint;
  update signups set prize = null, spun_at = null where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

create or replace function redeem_prize(p_code text, p_shop_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  select * into s from signups where code = p_code for update;
  if not found then return _err('No one has that code.'); end if;
  if s.prize is null then return _err('No festival prize to use.'); end if;
  if s.redeemed then return _err('Already used at ' || coalesce(s.redeemed_at, 'a shop') || '.'); end if;
  update signups set redeemed = true, redeemed_at = _clean(p_shop_name, 60) where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- campaigns ----------

create or replace function post_campaign(p_title text, p_month text, p_blurb text, p_from text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text := _clean(p_title, 80); m text := _clean(p_month, 40); b text := _clean(p_blurb, 300); lo int;
begin
  if p_from not in ('fruitbowl','council','street') then return _err('Who is posting?'); end if;
  if t = '' then return _err('Please add a name.'); end if;
  if m = '' then return _err('Please add when.'); end if;
  if (select count(*) from campaigns) >= 60 then return _err('Too many campaigns. Press Reset demo in the footer.'); end if;
  select coalesce(min(sort_order), 1) - 1 into lo from campaigns;
  insert into campaigns (title, month, blurb, posted_by, council, street, sort_order)
  values (t, m, b, p_from,
          case when p_from = 'council' then 'approved' else 'pending' end,
          case when p_from = 'street'  then 'yes'      else 'pending' end,
          lo);
  return jsonb_build_object('ok', true);
end $$;

create or replace function council_decide(p_id bigint, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update campaigns set council = case when p_approve then 'approved' else 'declined' end where id = p_id;
  if not found then return _err('Campaign not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function street_decide(p_id bigint, p_yes boolean, p_extra text)
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
create or replace function set_trader(p_id bigint, p_shop text, p_status text, p_offer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh text := _clean(p_shop, 30);
begin
  if sh = '' or p_status not in ('in','out','none') then return _err('Bad answer.'); end if;
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

create or replace function add_prize(p_name text, p_value int, p_collect_at text, p_stock int, p_added_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare hi int;
begin
  if p_added_by not in ('fruitbowl','council','street') then return _err('Who is adding this?'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add a prize name.'); end if;
  if p_value is null or p_value < 0 or p_value > 10000 then return _err('Value must be $0 or more.'); end if;
  if _clean(p_collect_at, 80) = '' then return _err('Please say where to collect it.'); end if;
  if p_stock is null or p_stock < 1 or p_stock > 10000 then return _err('How many? Use 1 or more.'); end if;
  if (select count(*) from prizes) >= 60 then return _err('Too many prizes. Press Reset demo in the footer.'); end if;
  select coalesce(max(sort_order), 0) + 1 into hi from prizes;
  insert into prizes (name, value, stock, collect_at, added_by, sort_order)
  values (_clean(p_name, 60), p_value, p_stock, _clean(p_collect_at, 80), p_added_by, hi);
  return jsonb_build_object('ok', true);
end $$;

create or replace function add_stock(p_id bigint, p_n int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_n is null or p_n < 1 or p_n > 1000 then return _err('Bad number.'); end if;
  update prizes set stock = stock + p_n where id = p_id;
  if not found then return _err('Prize not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function remove_prize(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from signups where (prize->>'id')::bigint = p_id) then
    return _err('Someone already won this, so it cannot be removed.');
  end if;
  delete from prizes where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- workshops ----------

create or replace function add_workshop(p_name text, p_date date, p_time text, p_format text, p_place text, p_councils text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare cs text[];
begin
  if _clean(p_name, 80) = '' then return _err('Please add a name.'); end if;
  if p_date is null then return _err('Please add a date.'); end if;
  if _clean(p_time, 20) = '' then return _err('Please add a time.'); end if;
  if p_format not in ('Online','In person') then return _err('Online or in person?'); end if;
  select coalesce(array_agg(c), '{}') into cs
    from unnest(coalesce(p_councils, '{}')) c where c in ('Maroondah','Knox','Monash');
  if array_length(cs, 1) is null then return _err('Pick at least one council.'); end if;
  if (select count(*) from workshops) >= 40 then return _err('Too many workshops. Press Reset demo in the footer.'); end if;
  insert into workshops (name, date, time, format, place, councils)
  values (_clean(p_name, 80), p_date, _clean(p_time, 20), p_format, _clean(p_place, 120), cs);
  return jsonb_build_object('ok', true);
end $$;

create or replace function book_workshop(p_trader text, p_workshop bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if _clean(p_trader, 30) = '' then return _err('Which shop?'); end if;
  if not exists (select 1 from workshops where id = p_workshop) then return _err('Workshop not found.'); end if;
  insert into bookings (trader, workshop) values (_clean(p_trader, 30), p_workshop) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function cancel_booking(p_trader text, p_workshop bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from bookings where trader = _clean(p_trader, 30) and workshop = p_workshop;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- settings ----------

create or replace function set_setting(p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'code_style' and p_value in ('qr','number','barcode') then
    insert into settings values (p_key, p_value)
    on conflict (key) do update set value = excluded.value;
    return jsonb_build_object('ok', true);
  end if;
  return _err('That setting is not allowed.');
end $$;

-- ---------- locks ----------

alter table settings        enable row level security;
alter table signups         enable row level security;
alter table signup_private  enable row level security;
alter table campaigns       enable row level security;
alter table prizes          enable row level security;
alter table workshops       enable row level security;
alter table bookings        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','signups','campaigns','prizes','workshops','bookings'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
-- signup_private has no policy at all, so nobody but the database owner can read it.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon, authenticated;
    revoke all on all functions in schema public from anon, authenticated, public;
    grant usage on schema public to anon;
    grant select on settings, signups, campaigns, prizes, workshops, bookings to anon;
    grant execute on function
      signup(text,text,text,boolean), give_stamp(text,text), use_reward(text,text),
      award_prize(text,bigint), undo_prize(text), redeem_prize(text,text),
      post_campaign(text,text,text,text), council_decide(bigint,boolean),
      street_decide(bigint,boolean,text), set_trader(bigint,text,text,text),
      add_prize(text,int,text,int,text), add_stock(bigint,int), remove_prize(bigint),
      add_workshop(text,date,text,text,text,text[]), book_workshop(text,bigint),
      cancel_booking(text,bigint), set_setting(text,text), reset_demo()
    to anon;
  end if;
end $$;

-- ---------- live updates ----------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['settings','signups','campaigns','prizes','workshops','bookings'] loop
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

select reset_demo();
