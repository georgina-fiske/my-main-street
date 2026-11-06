-- Run this in a NEW query. It does not wipe anything.
-- Adds an open "message for the customer" box to every prize (Admin > Prizes). It is added to that prize's text and email.

alter table prizes add column if not exists message text not null default '';

drop function if exists add_prize(text,text,int,int,text);
drop function if exists prize_update(bigint,text,int,int,text,int);

create or replace function add_prize(p_area text, p_name text, p_value int, p_stock int, p_color text, p_message text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_manage(p_area) then return _err('Please log in with a staff account.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add a name.'); end if;
  if p_value is null or p_value < 0 or p_value > 10000 then return _err('Value must be $0 or more.'); end if;
  if p_stock is null or p_stock < 1 or p_stock > 100000 then return _err('How many? Use 1 or more.'); end if;
  if coalesce(p_color, '') !~ '^#[0-9A-Fa-f]{6}$' then p_color := '#560CC9'; end if;
  insert into prizes (area, name, value, stock, color, sort_order, message)
  values (p_area, _clean(p_name, 60), p_value, p_stock, upper(p_color), coalesce((select max(sort_order) from prizes where area = p_area), 0) + 1, left(btrim(coalesce(p_message, '')), 300));
  return jsonb_build_object('ok', true);
end $$;

create or replace function prize_update(p_id bigint, p_name text, p_value int, p_stock int, p_color text, p_order int, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare given int;
begin
  if not _can_manage((select area from prizes where id = p_id)) then return _err('Please log in with a staff account.'); end if;
  select count(*) into given from signups where (prize->>'id')::bigint = p_id;
  if p_stock < given then return _err('That is fewer than have already been won (' || given || ').'); end if;
  if coalesce(p_color, '') !~ '^#[0-9A-Fa-f]{6}$' then return _err('Colours need to look like #560CC9.'); end if;
  if _clean(p_name, 60) = '' then return _err('Please add a name.'); end if;
  if given > 0 and p_value <> (select value from prizes where id = p_id) then return _err('Someone has already won this, so its value cannot change.'); end if;
  update prizes set name = _clean(p_name, 60), value = p_value, stock = p_stock, color = upper(p_color), sort_order = coalesce(p_order, sort_order),
         message = case when p_message is null then message else left(btrim(p_message), 300) end
   where id = p_id;
  -- coupons already given show the new note too
  if p_message is not null then
    update signups set prize = prize || jsonb_build_object('note', left(btrim(p_message), 300)) where (prize->>'id')::bigint = p_id;
  end if;
  return jsonb_build_object('ok', true);
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
     set prize = jsonb_build_object('id', p.id, 'name', p.name, 'value', p.value, 'note', p.message),
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

grant execute on function add_prize(text,text,int,int,text,text) to authenticated;
grant execute on function prize_update(bigint,text,int,int,text,int,text) to authenticated;
