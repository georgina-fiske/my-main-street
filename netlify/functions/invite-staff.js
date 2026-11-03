// "Invite someone": adds a login at a chosen level and emails them a link to set a password.
// Only Chaos Master and Fruitbowl logins can call this.
//   Chaos Master can invite any level. Fruitbowl can invite Fruitbowl, Council, Street Association and Desk.
//
// Settings: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_ORIGIN (e.g. https://my-mainstreet.com.au).

const { json, client, bearer } = require('./_supabase.js');

exports.handler = async (event, ...rest) => {   // rest, not named inputs: Netlify rejects 3-input handlers as the old callback style
  const inject = rest[1];
  const fetchFn = (inject && inject.fetch) || fetch;
  const env = (inject && inject.env) || process.env;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST.' });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json(500, { ok: false, error: 'Invites are not set up yet.' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  const token = bearer(event);
  if (!token) return json(401, { ok: false, error: 'Please log in.' });

  const sb = client(env, fetchFn);
  const me = await sb.whoIs(token);
  if (!me) return json(401, { ok: false, error: 'Please log in again.' });
  const caller = await sb.staffRow(me.email);
  if (!caller || !['chaos', 'fruitbowl'].includes(caller.role)) return json(403, { ok: false, error: 'Only Fruitbowl or Chaos Master can invite people.' });

  const email = String(b.email || '').trim().toLowerCase(), role = String(b.role || ''), name = String(b.name || '').trim().slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { ok: false, error: 'Please add a real email.' });
  if (!['chaos', 'fruitbowl', 'council', 'street', 'desk'].includes(role)) return json(400, { ok: false, error: 'Which level?' });
  if (role === 'chaos' && caller.role !== 'chaos') return json(403, { ok: false, error: 'Only Chaos Master can invite another Chaos Master.' });
  const typedPassword = String(b.password || '');
  if (typedPassword && typedPassword.length < 8) return json(400, { ok: false, error: 'The password needs at least 8 characters.' });
  let area = null;
  if (!['chaos', 'fruitbowl'].includes(role)) {
    area = String(b.area || '');
    if (!(await sb.rows('/rest/v1/areas?select=id&id=eq.' + encodeURIComponent(area)))[0]) return json(400, { ok: false, error: 'Which street?' });
  }
  const existing = await sb.staffRow(email);
  if (existing && existing.role === 'chaos' && caller.role !== 'chaos') return json(403, { ok: false, error: 'That login can only be changed by Chaos Master.' });
  if (existing && existing.role === 'shop') return json(409, { ok: false, error: 'That email is a shop account.' });

  // the level
  const up = await sb.call('/rest/v1/staff?on_conflict=email', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ email, role, area, shop: null }) });
  if (!up.ok) return json(500, { ok: false, error: 'We could not add them. Please try again.' });

  // A password typed in by Fruitbowl: make the login now, so they can log in straight away (no email needed).
  const password = String(b.password || '');
  if (password) {
    const made = await sb.call('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }) });
    if (made.ok) return json(200, { ok: true, message: email + ' can log in now with the password you set. Please send it to them privately.' });
    const mj = await made.json().catch(() => ({}));
    if (made.status === 422 || /already|registered|exists/i.test(JSON.stringify(mj))) {
      const list = await sb.call('/auth/v1/admin/users?per_page=1000');
      const found = list.ok ? ((await list.json()).users || []).find((u) => String(u.email || '').toLowerCase() === email) : null;
      if (!found) return json(200, { ok: false, error: 'They were added, but their password could not be set. Ask them to use "Forgot password".' });
      const put = await sb.call('/auth/v1/admin/users/' + found.id, { method: 'PUT', body: JSON.stringify({ password, email_confirm: true }) });
      if (put.ok) return json(200, { ok: true, message: email + ' already had an account. Their password is now the one you set. Please send it to them privately.' });
    }
    return json(200, { ok: false, error: 'They were added, but their password could not be set. Ask them to use "Forgot password".' });
  }

  // the email with a link to set a password
  const origin = String(env.SITE_ORIGIN || '').replace(/\/$/, '');
  const inv = await sb.call('/auth/v1/invite' + (origin ? '?redirect_to=' + encodeURIComponent(origin + '/set-password') : ''), { method: 'POST', body: JSON.stringify({ email, data: { name } }) });
  if (inv.ok) return json(200, { ok: true, message: 'Invite sent to ' + email + '. They will get an email with a link to choose a password.' });
  const j = await inv.json().catch(() => ({}));
  if (/already|registered|exists/i.test(JSON.stringify(j))) return json(200, { ok: true, message: email + ' already has an account, so no email was sent. They can log in now, or use "Forgot password".' });
  return json(200, { ok: false, error: 'They were added, but the invite email could not be sent. Ask them to use "Forgot password" on the log in page.' });
};
