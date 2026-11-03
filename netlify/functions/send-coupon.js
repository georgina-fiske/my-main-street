// Emails a customer their coupon the moment staff tap the prize at the wheel.
//
// Who can call it: only a logged-in staff member for that customer's street.
// What it sends: the email in js/messages.js, through Resend.
// It sends once per coupon (it remembers in signups.notified_at), so a double tap never sends two.
//
// Settings (Netlify > Site configuration > Environment variables). Never put these in the code:
//   SUPABASE_URL                 your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    the secret service_role key (Supabase > Project Settings > API)
//   RESEND_API_KEY               from resend.com
//   SITE_ORIGIN                  e.g. https://mymainstreet.com.au  (optional)

const makeMessages = require('../../js/messages.js');

const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const money = (n) => '$' + Number(n || 0).toLocaleString('en-AU');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayName = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
};

exports.handler = async (event, _ctx, inject) => {
  const fetchFn = (inject && inject.fetch) || fetch;
  const env = (inject && inject.env) || process.env;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST.' });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) return json(500, { ok: false, error: 'Email is not set up yet.' });

  let code;
  try { code = String(JSON.parse(event.body || '{}').code || '').toUpperCase().trim(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  if (!/^CMS-\d{4}$/.test(code)) return json(400, { ok: false, error: 'Bad code.' });

  const token = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, error: 'Please log in.' });

  const sb = (path, opts) => fetchFn(SUPABASE_URL + path, Object.assign({}, opts, {
    headers: Object.assign({ apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' }, (opts && opts.headers) || {})
  }));
  const rows = async (path) => { const r = await sb(path); return r.ok ? r.json() : []; };

  // 1. Who is calling?
  const who = await fetchFn(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + token } });
  if (!who.ok) return json(401, { ok: false, error: 'Please log in again.' });
  const email = String((await who.json()).email || '').toLowerCase();
  const staff = (await rows('/rest/v1/staff?select=role,area&email=eq.' + encodeURIComponent(email)))[0];
  if (!staff) return json(403, { ok: false, error: 'This login is not on the staff list.' });

  // 2. The coupon
  const s = (await rows('/rest/v1/signups?select=*&code=eq.' + code))[0];
  if (!s) return json(404, { ok: false, error: 'No one has that code.' });
  if (staff.role !== 'fruitbowl' && staff.area !== s.area) return json(403, { ok: false, error: 'That customer belongs to a different street.' });
  if (!s.prize || !(Number(s.prize.value) > 0)) return json(200, { ok: true, skipped: true, message: 'Gifts are handed over at the desk, so no email.' });
  if (s.notified_at) return json(200, { ok: true, message: 'Their coupon was already emailed.' });
  if (s.contact === 'text') {
    return json(200, { ok: true, skipped: true, message: `${s.name} asked for a text. Texts aren't switched on yet, so their phone screen shows the coupon.` });
  }

  const priv = (await rows('/rest/v1/signup_private?select=email,unsub&code=eq.' + code))[0];
  const area = (await rows('/rest/v1/areas?select=*&id=eq.' + encodeURIComponent(s.area)))[0];
  const ev = (await rows('/rest/v1/events?select=name&id=eq.' + s.event))[0];
  if (!priv || !priv.email || !area) return json(200, { ok: false, error: 'There is no email address for this customer.' });

  // 3. Send it
  const origin = env.SITE_ORIGIN || (event.headers && event.headers.origin) || '';
  const Messages = makeMessages({ domain: String(origin).replace(/^https?:\/\//, '') || 'mymainstreet.com.au', esc, money });
  const place = (area.brand && area.brand.place) || area.name;
  const useBy = s.use_by;
  const m = Messages.email({
    name: s.name, value: s.prize.value, code: s.code, useBy: dayName(useBy), useByShort: dayName(useBy).replace(/^\w+\s/, ''),
    event: (ev && ev.name) || 'the festival', place, area: area.id, origin: origin || undefined,
    fromName: area.email_name || place, fromAddress: area.email_address, replyTo: area.reply_to || undefined,
    unsubUrl: (origin || '') + '/u/' + priv.unsub
  });
  const send = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + RESEND_API_KEY, 'content-type': 'application/json', 'idempotency-key': 'coupon-' + s.code },
    body: JSON.stringify({
      from: m.from, to: [priv.email], subject: m.subject, html: m.html, reply_to: m.replyTo || undefined,
      headers: { 'List-Unsubscribe': `<${(origin || '') + '/u/' + priv.unsub}>` }
    })
  });
  if (!send.ok) {
    console.error('Resend error', send.status, await send.text().catch(() => ''));
    return json(200, { ok: false, error: 'The email could not be sent.' });
  }
  await sb('/rest/v1/signups?code=eq.' + code, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
  return json(200, { ok: true, message: `Emailed to ${priv.email}.` });
};
