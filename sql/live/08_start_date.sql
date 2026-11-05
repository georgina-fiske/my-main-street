-- Run this in a NEW query. It does not wipe anything.
-- Adds "coupons work from" (a start date): the system refuses a coupon before it, and Admin > Key details sets the dates.

alter table events  add column if not exists valid_from date;
alter table signups add column if not exists valid_from date;
update signups set valid_from = (select valid_from from events e where e.id = signups.event) where prize is not null and not redeemed;

drop function if exists event_save(bigint,text,date,date);

create or replace function use_on_phone(p_code text, p_token text, p_shop text, p_shop_code text)
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
  if s.valid_from is not null and s.valid_from > _today() then return _err('This coupon can''t be used yet. It works from ' || _day(s.valid_from) || '.'); end if;
  if sh.area <> s.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'shop', sh.name, 'value', (s.prize->>'value')::int, 'name', s.name);
end $$;

create or replace function award_prize(p_code text, p_prize bigint)
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
         valid_from = ev.valid_from,
         awarded_by = _me(),
         -- small prizes are handed over at the desk, so they are used straight away
         redeemed = (p.value = 0),
         redeemed_at = case when p.value = 0 then 'desk' else null end,
         redeemed_time = case when p.value = 0 then now() else null end
   where code = s.code;
  return jsonb_build_object('ok', true);
end $$;

create or replace function undo_prize(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s signups;
begin
  select * into s from signups where code = upper(_clean(p_code, 12)) for update;
  if not found then return _err('No one has that code.'); end if;
  if not _can_desk(s.area) then return _err('Please log in with a staff account.'); end if;
  if s.prize is null then return jsonb_build_object('ok', true); end if;           -- already undone
  if s.redeemed and s.redeemed_at is distinct from 'desk' then return _err('Already used. Cannot undo.'); end if;
  update signups
     set prize = null, spun_at = null, use_by = null, valid_from = null, redeemed = false, redeemed_at = null,
         redeemed_time = null, awarded_by = null, notified_at = null
   where code = s.code;
  return jsonb_build_object('ok', true);
end $$;

create or replace function shop_check(p_code text)
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
  if s.valid_from is not null and s.valid_from > _today() then return jsonb_build_object('state', 'notyet', 'valid_from', _day(s.valid_from), 'use_by', _day(s.use_by)); end if;
  if s.area <> sh.area then return jsonb_build_object('state', 'otherarea'); end if;
  return jsonb_build_object('state', 'valid', 'code', s.code, 'name', s.name, 'last', s.last_initial,
                            'value', (s.prize->>'value')::int, 'use_by', _day(s.use_by));
end $$;

create or replace function shop_use(p_code text)
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
  if s.valid_from is not null and s.valid_from > _today() then return _err('This coupon can''t be used yet. It works from ' || _day(s.valid_from) || '.'); end if;
  if s.area <> sh.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'value', (s.prize->>'value')::int, 'name', s.name);
end $$;

create or replace function report_rows(p_area text)
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
      'duplicate_of', s.dup_of,
      'valid_from', s.valid_from,
      'prize', s.prize->>'name',
      'value', (s.prize->>'value')::int,
      'won', to_char(s.spun_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD HH24:MI'),
      'status', case
          when s.prize is null then 'No coupon yet'
          when (s.prize->>'value')::int = 0 then 'Collected at desk'
          when s.redeemed then 'Used'
          when s.use_by < _today() then 'Expired'
          when s.valid_from > _today() then 'Not valid yet'
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

create or replace function area_save_brand(p_id text, p_brand jsonb, p_email_name text, p_email_address text, p_reply_to text)
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
  if p_brand ? 'headline' then b := b || jsonb_build_object('headline', _clean(p_brand->>'headline', 60)); end if;
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

create or replace function event_save(p_id bigint, p_name text, p_starts date, p_use_by date, p_valid_from date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_manage((select area from events where id = p_id)) then return _err('Please log in with a staff account.'); end if;
  if _clean(p_name, 80) = '' then return _err('Please add an event name.'); end if;
  if p_starts is null or p_use_by is null then return _err('Please add the event date and the last day coupons work.'); end if;
  if p_use_by < p_starts then return _err('The last day has to be after the event.'); end if;
  if p_valid_from is not null and (p_valid_from < p_starts or p_valid_from > p_use_by) then
    return _err('The first day coupons work has to be between the event date and the last day.');
  end if;
  update events set name = _clean(p_name, 80), starts_on = p_starts, use_by = p_use_by, valid_from = p_valid_from where id = p_id;
  -- coupons already given keep up with the change (unless already used)
  update signups set use_by = p_use_by, valid_from = p_valid_from where event = p_id and prize is not null and not redeemed;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function event_save(bigint,text,date,date,date) to authenticated;
