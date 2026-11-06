-- Run this in a NEW query. It does not wipe anything.
-- Shops now see the prize name and its message (what to give the customer), not just a dollar amount.

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
      return jsonb_build_object('ok', true, 'shop', sh.name, 'value', (s.prize->>'value')::int, 'name', s.name, 'prize', s.prize->>'name');
    end if;
    select name into at_name from shops where id = s.redeemed_at;
    return _err('Already used at ' || coalesce(at_name, 'the prize desk') || ' on ' || _when(s.redeemed_time));
  end if;
  if s.use_by < _today() then return _err('This coupon has run out.'); end if;
  if s.valid_from is not null and s.valid_from > _today() then return _err('This coupon can''t be used yet. It works from ' || _day(s.valid_from) || '.'); end if;
  if sh.area <> s.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'shop', sh.name, 'value', (s.prize->>'value')::int, 'name', s.name, 'prize', s.prize->>'name');
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
                            'value', (s.prize->>'value')::int, 'use_by', _day(s.use_by),
                            'prize', s.prize->>'name', 'note', s.prize->>'note');
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
      return jsonb_build_object('ok', true, 'value', (s.prize->>'value')::int, 'name', s.name, 'prize', s.prize->>'name', 'note', s.prize->>'note');
    end if;
    select name into at_name from shops where id = s.redeemed_at;
    return _err('Already used at ' || coalesce(at_name, 'the prize desk') || ' on ' || _when(s.redeemed_time));
  end if;
  if s.use_by < _today() then return _err('This coupon ran out on ' || _day(s.use_by)); end if;
  if s.valid_from is not null and s.valid_from > _today() then return _err('This coupon can''t be used yet. It works from ' || _day(s.valid_from) || '.'); end if;
  if s.area <> sh.area then return _err('This coupon is for a different street.'); end if;
  update signups set redeemed = true, redeemed_at = sh.id, redeemed_time = now() where code = s.code;
  return jsonb_build_object('ok', true, 'value', (s.prize->>'value')::int, 'name', s.name, 'prize', s.prize->>'name', 'note', s.prize->>'note');
end $$;

create or replace function shop_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'used', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'last', s.last_initial,
              'value', (s.prize->>'value')::int, 'prize', s.prize->>'name', 'at', s.redeemed_time) order by s.redeemed_time desc)
              from signups s where s.redeemed and s.redeemed_at = _my_shop() and (s.prize->>'value')::int > 0), '[]'::jsonb))
$$;
