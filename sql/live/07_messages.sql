-- Run this in a NEW query. It does not wipe anything.
-- It adds the place in Admin where you edit the wording of the text and email (Admin > Messages).

create or replace function message_save(p_area text, p_kind text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text; lim int; t text := replace(coalesce(p_text, ''), E'\r', '');
begin
  if not _can_manage(p_area) then return _err('Please log in with a staff account.'); end if;
  if p_kind not in ('sms', 'email_subject', 'email_body') then return _err('Which message?'); end if;
  if not exists (select 1 from areas where id = p_area) then return _err('We can''t find that street.'); end if;
  lim := case p_kind when 'sms' then 600 when 'email_subject' then 150 else 3000 end;
  if length(t) > lim then return _err('That is too long.'); end if;
  k := 'msg:' || p_area || ':' || p_kind;
  if btrim(t) = '' then delete from settings where key = k;
  else insert into settings values (k, t) on conflict (key) do update set value = excluded.value; end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function message_save(text,text,text) to authenticated;
