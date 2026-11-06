-- Run this in a NEW query. It does not wipe anything.
-- Adds an editable message for the customer's "Which shop are you?" box, for the time before shops have signed up.
-- It sets Croydon's to: Check back on 13 November to see participating stores.

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
  if p_brand ? 'shopsNote' then b := b || jsonb_build_object('shopsNote', left(btrim(coalesce(p_brand->>'shopsNote', '')), 160)); end if;
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

update areas
set brand = brand || jsonb_build_object('shopsNote', 'Check back on 13 November to see participating stores.')
where id = 'croydon';
