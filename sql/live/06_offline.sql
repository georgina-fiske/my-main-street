-- Run this in a NEW query. It does not wipe anything.
-- Offline sign-up: a phone with no signal can keep its own code and send the sign-up later.
-- If the same person signed up twice while offline, the second one is flagged (never merged) for a person to look at.

alter table signups        add column if not exists dup_of text;
alter table signup_private add column if not exists dup boolean not null default false;
drop index if exists signup_private_email_once;
drop index if exists signup_private_mobile_once;
create unique index signup_private_email_once  on signup_private (event, lower(email)) where email <> '' and not dup;
create unique index signup_private_mobile_once on signup_private (event, mobile)       where mobile <> '' and not dup;

drop function if exists signup(text,text,text,text,text,text,text,boolean,boolean);
drop function if exists signup(text,text,text,text,text,text,text,boolean,boolean,text,text,boolean);

create function signup(p_area text, p_name text, p_last text, p_email text, p_mobile text,
                       p_postcode text, p_contact text, p_optin boolean, p_terms boolean,
                       p_code text default null, p_token text default null, p_queued boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n text := _clean(p_name, 40); l text := _clean(p_last, 40);
  e text := lower(_clean(p_email, 120)); m text := regexp_replace(coalesce(p_mobile, ''), '\s', '', 'g');
  a areas; ev events; c text; tk text; tries int := 0; existing text; dup text := null;
  want_c text := upper(_clean(p_code, 12)); want_t text := lower(_clean(p_token, 20));
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

  -- A phone (or iPad) can make its own code and secret, so a sign-up works with no signal.
  -- If it is not a well-formed pair, ignore it and make one here.
  if want_c !~ '^CMS-\d{4}$' or want_t !~ '^[0-9a-f]{20}$' then want_c := null; want_t := null; end if;
  -- The very same entry sent again (a retry after a lost reply) is fine: nothing is added twice.
  if want_c is not null and exists (select 1 from signups where code = want_c and token = want_t and event = ev.id) then
    return jsonb_build_object('ok', true, 'code', want_c, 'token', want_t, 'existing', false, 'again', true);
  end if;

  -- one sign-up per email or mobile
  select s.code into existing
    from signup_private sp join signups s on s.code = sp.code
   where sp.event = ev.id and not sp.dup and (lower(sp.email) = e or sp.mobile = m)
   order by s.created_at limit 1;
  if existing is not null then
    if not p_queued then
      return jsonb_build_object('ok', true, 'code', existing, 'existing', true);   -- no secret: it is not shown to anyone who asks
    end if;
    -- It was made on a device with no signal, so the person already holds their own code.
    -- Keep it, but flag it: a person decides which one is real. Never merged automatically.
    dup := existing;
  end if;

  if want_c is not null and not exists (select 1 from signups where code = want_c) then
    c := want_c; tk := want_t;
  else
    loop
      c := 'CMS-' || (1000 + floor(random() * 9000))::int;
      exit when not exists (select 1 from signups where code = c);
      tries := tries + 1;
      if tries > 80 then return _err('Please try again.'); end if;
    end loop;
    tk := substr(md5(random()::text || clock_timestamp()::text || c), 1, 20);
  end if;
  begin
    insert into signups (code, token, area, event, name, last_initial, contact, dup_of)
    values (c, tk, p_area, ev.id, n, upper(left(l, 1)), p_contact, dup);
    insert into signup_private (code, event, last_name, email, mobile, postcode, optin, dup)
    values (c, ev.id, l, e, m, p_postcode, coalesce(p_optin, false), dup is not null);
  exception when unique_violation then
    -- the same entry arrived twice at the same moment: the first one won, so this is just a repeat
    if exists (select 1 from signups where code = c and token = tk) then
      return jsonb_build_object('ok', true, 'code', c, 'token', tk, 'existing', false, 'again', true);
    end if;
    return _err('Please try again.');
  end;
  return jsonb_build_object('ok', true, 'code', c, 'token', tk, 'existing', false, 'duplicate_of', dup);
end $$;

create or replace function get_pass(p_code text, p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'id' - 'token' - 'awarded_by' - 'dup_of'
    from signups s where s.code = upper(_clean(p_code, 12)) and s.token = lower(_clean(p_token, 20))
$$;


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
grant execute on function signup(text,text,text,text,text,text,text,boolean,boolean,text,text,boolean) to anon, authenticated;
grant execute on function get_pass(text,text) to anon, authenticated;
grant execute on function report_rows(text) to authenticated;
