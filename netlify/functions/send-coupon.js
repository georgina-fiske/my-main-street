// Sends a customer their coupon the moment staff tap the prize at the wheel:
// by EMAIL (Resend) or by TEXT (an Australian SMS service), whichever the customer chose.
//
// Who can call it: only a logged-in staff member for that customer's street.
// It sends once per coupon (it remembers in signups.notified_at), so a double tap never sends two.
//
// Settings (Netlify > Site configuration > Environment variables). Never put these in the code:
//   SUPABASE_URL                 your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    the secret service_role key
//   RESEND_API_KEY               from resend.com (emails)
//   SMS_PROVIDER                 'clicksend' or 'mobilemessage' (texts)
//   SMS_USERNAME, SMS_API_KEY    your SMS account
//   SMS_FROM                     the number to send from, then "CroydonMS" once approved
//   BASE_DOMAIN                  my-mainstreet.com.au  (optional; that is the default)

const makeMessages = require('../../js/messages.js');
const { json, client, bearer } = require('./_supabase.js');

const money = (n) => '$' + Number(n || 0).toLocaleString('en-AU');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayName = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
};
const e164 = (m) => '+61' + String(m).replace(/\s/g, '').replace(/^0/, '');

// One text through the chosen provider. Returns true when it was accepted.
async function sendSms(fetchFn, env, to, text) {
  const auth = 'Basic ' + Buffer.from((env.SMS_USERNAME || '') + ':' + (env.SMS_API_KEY || '')).toString('base64');
  if (env.SMS_PROVIDER === 'clicksend') {
    const r = await fetchFn('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ source: 'my-main-street', from: env.SMS_FROM || undefined, to: e164(to), body: text }] })
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    const m = j && j.data && j.data.messages && j.data.messages[0];
    return !m || m.status === 'SUCCESS';
  }
  if (env.SMS_PROVIDER === 'mobilemessage') {
    const r = await fetchFn('https://api.mobilemessage.com.au/v1/messages', {
      method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ enable_unicode: false, messages: [{ to: String(to).replace(/\s/g, ''), message: text, sender: env.SMS_FROM, custom_ref: 'mms' }] })
    });
    return r.ok;
  }
  return false;
}

exports.handler = async (event, _ctx, inject) => {
  const fetchFn = (inject && inject.fetch) || fetch;
  const env = (inject && inject.env) || process.env;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST.' });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json(500, { ok: false, error: 'Messages are not set up yet.' });

  let code;
  try { code = String(JSON.parse(event.body || '{}').code || '').toUpperCase().trim(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  if (!/^CMS-\d{4}$/.test(code)) return json(400, { ok: false, error: 'Bad code.' });
  const token = bearer(event);
  if (!token) return json(401, { ok: false, error: 'Please log in.' });

  const sb = client(env, fetchFn);
  // 1. Who is calling, and are they allowed?
  const me = await sb.whoIs(token);
  if (!me) return json(401, { ok: false, error: 'Please log in again.' });
  const staff = await sb.staffRow(me.email);
  if (!staff || staff.role === 'shop') return json(403, { ok: false, error: 'This login is not on the staff list.' });

  // 2. The coupon
  const s = (await sb.rows('/rest/v1/signups?select=*&code=eq.' + code))[0];
  if (!s) return json(404, { ok: false, error: 'No one has that code.' });
  if (!['chaos', 'fruitbowl'].includes(staff.role) && staff.area !== s.area) return json(403, { ok: false, error: 'That customer belongs to a different street.' });
  if (!s.prize || !(Number(s.prize.value) > 0)) return json(200, { ok: true, skipped: true, message: 'Small prizes are handed over at the desk, so nothing is sent.' });
  if (s.notified_at) return json(200, { ok: true, message: 'Their coupon was already sent.' });

  const priv = (await sb.rows('/rest/v1/signup_private?select=email,mobile,unsub&code=eq.' + code))[0];
  const area = (await sb.rows('/rest/v1/areas?select=*&id=eq.' + encodeURIComponent(s.area)))[0];
  const ev = (await sb.rows('/rest/v1/events?select=name&id=eq.' + s.event))[0];
  if (!priv || !area) return json(200, { ok: false, error: 'There are no contact details for this customer.' });

  const baseDomain = env.BASE_DOMAIN || 'my-mainstreet.com.au';
  const host = area.id + '.' + baseDomain;
  const origin = 'https://' + host;
  const place = (area.brand && area.brand.place) || area.name;
  const couponPath = '/c/' + s.code + '?k=' + s.token;
  const Messages = makeMessages({ domain: host, esc, money });
  const d = {
    name: s.name, value: s.prize.value, code: s.code, useBy: dayName(s.use_by), useByShort: dayName(s.use_by).replace(/^\w+\s/, ''),
    event: (ev && ev.name) || 'the festival', place, area: area.id, origin,
    couponUrl: origin + couponPath, link: host + couponPath, shopsUrl: origin + '/shops', safetyUrl: 'https://' + baseDomain + '/safety',
    fromName: area.email_name || place, fromAddress: area.email_address, replyTo: area.reply_to || undefined,
    unsubUrl: origin + '/u/' + priv.unsub
  };

  let message;
  if (s.contact === 'text') {
    // 3a. a text
    if (!env.SMS_PROVIDER || !env.SMS_API_KEY) return json(200, { ok: false, error: 'Texts are not switched on yet.' });
    if (!priv.mobile) return json(200, { ok: false, error: 'There is no mobile number for this customer.' });
    const m = Messages.sms(d);
    if (!(await sendSms(fetchFn, env, priv.mobile, m.text))) { console.error('SMS error'); return json(200, { ok: false, error: 'The text could not be sent.' }); }
    message = `Texted to ${priv.mobile}.`;
  } else {
    // 3b. an email
    if (!env.RESEND_API_KEY) return json(200, { ok: false, error: 'Email is not set up yet.' });
    if (!priv.email) return json(200, { ok: false, error: 'There is no email address for this customer.' });
    const m = Messages.email(d);
    const send = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json', 'idempotency-key': 'coupon-' + s.code },
      body: JSON.stringify({ from: m.from, to: [priv.email], subject: m.subject, html: m.html, reply_to: m.replyTo || undefined, headers: { 'List-Unsubscribe': `<${d.unsubUrl}>` } })
    });
    if (!send.ok) { console.error('Resend error', send.status, await send.text().catch(() => '')); return json(200, { ok: false, error: 'The email could not be sent.' }); }
    message = `Emailed to ${priv.email}.`;
  }

  await sb.call('/rest/v1/signups?code=eq.' + code, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
  return json(200, { ok: true, message });
};
