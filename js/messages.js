// The email and text a customer gets when staff tap their prize.
// In the demo these are only shown on screen (the Email and Text tabs). Nothing is sent.
// On the live site the Netlify function in netlify/functions/send-coupon.js uses the same wording.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;      // Netlify function
  else root.Messages = factory({ domain: root.CONFIG.domain, esc: root.U.esc, money: root.U.money });   // browser
})(typeof window !== 'undefined' ? window : globalThis, function (deps) {
  const { domain, esc, money } = deps;

  // d: {name, value, code, useBy ("Sat 14 Nov"), useByShort ("14 Nov"), event, place, area, fromName, fromAddress, replyTo, unsubUrl, origin}
  // ---- The wording. Staff can change it in Admin > Messages. Words in {curly brackets} are filled in per customer. ----
  const DEFAULTS = {
    sms: 'Thanks for spinning! You won a {value} coupon for any {place} shop. Code: {code}. Use by {useByShort}. {link} Reply STOP to opt out',
    email_subject: "Thanks for spinning the wheel! Here's your coupon code",
    email_body: [
      'Hi {name},',
      'Thanks for spinning the wheel at {event} today!',
      '**You won a {value} coupon.**\n**Your coupon code: {code}**',
      'Spend it at any participating shop on {place} by {useBy}. Just show this email or your code at the counter.',
      '[buttons]',
      "We're so excited to bring life back to {place}. Stay tuned: we'll keep you posted as the next part launches.",
      'See you on Main Street!'
    ].join('\n\n')
  };
  const FIELDS = ['name', 'value', 'code', 'useBy', 'useByShort', 'place', 'event', 'link', 'shops'];
  // d -> the values that go into the {brackets}
  const valuesOf = (d, forEmail) => ({
    name: d.name, value: money(d.value), code: d.code, useBy: d.useBy, useByShort: d.useByShort, place: d.place, event: d.event,
    link: forEmail ? (d.couponUrl || d.link || '') : (d.link || ''), shops: d.shopsUrl || ''
  });
  const fill = (t, vars, enc) => String(t).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? enc(vars[k] == null ? '' : vars[k]) : m));
  // Which {brackets} in a piece of wording are not ones we know (so staff can be warned)
  const unknownIn = (t) => [...new Set((String(t).match(/\{(\w+)\}/g) || []).filter((m) => !FIELDS.includes(m.slice(1, -1))))];

  // Text colour for a coloured button: white or dark ink, whichever reads better.
  function inkOn(hex) {
    const h = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return '#1E0B45';
    const ch = (i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
    return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0625 ? '#FFFFFF' : '#1E0B45';
  }
  const hexOr = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : fallback);

  function email(d) {
    const url = d.origin || 'https://' + domain;
    const shops = d.shopsUrl || url + '/' + d.area + '/shops';
    const main = hexOr(d.color, '#23003F'), accent = hexOr(d.accent, '#FFFDB4');
    const c = d.custom || {};
    const subject = fill((c.email_subject && String(c.email_subject).trim()) || DEFAULTS.email_subject, valuesOf(d, true), (x) => String(x).replace(/[\r\n]+/g, ' '));
    const pal = (Array.isArray(d.palette) ? d.palette : []).filter((x) => /^#[0-9a-f]{6}$/i.test(x));
    const banner = d.headline && pal.length >= 3
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="background:${pal[0]};color:${inkOn(pal[0])};padding:20px 16px;font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:26px;line-height:1.05;text-transform:uppercase">${esc(d.headline)}</td></tr><tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${pal.slice(1).map((x) => `<td height="14" style="background:${x};font-size:0;line-height:0">&nbsp;</td>`).join('')}</tr></table></td></tr></table>`
      : '';
    const buttons = `<p>${d.couponUrl ? `<a href="${esc(d.couponUrl)}" style="display:inline-block;background:${accent};color:${inkOn(accent)};text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;margin-right:8px">Open your coupon</a>` : ''}<a href="${esc(shops)}" style="display:inline-block;background:${main};color:${inkOn(main)};text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px">See the shops</a></p>
        ${d.couponUrl ? `<p style="font-size:13px;color:#5E5180">If a button doesn't open, copy this link into your browser:<br>${esc(d.couponUrl)}</p>` : ''}`;
    // The body: blank lines make paragraphs, **double stars** make bold, and a line with just [buttons] is where the buttons go.
    const vars = valuesOf(d, true);
    const text = ((c.email_body && String(c.email_body).trim()) || DEFAULTS.email_body).replace(/\r/g, '');
    const paras = text.split(/\n{2,}/).map((para) => {
      if (para.trim() === '[buttons]') return buttons;
      const safe = fill(esc(para.trim()), Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)])), (x) => x);
      return `<p>${safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`;
    }).join('\n        ');
    const html =
      `${banner}<div style="font-family:Montserrat,Arial,sans-serif;color:#1E0B45;line-height:1.5;font-size:15px;padding:${banner ? '16px 0 0' : '0'}">
        ${paras}
        <p style="font-size:12px;color:#5E5180">You're getting this because you signed up at ${esc(d.event)}. <a href="${esc(d.unsubUrl || '#')}">Unsubscribe</a> · <a href="${esc(d.safetyUrl || url + '/safety')}">Safety and privacy</a></p>
      </div>`;
    return { from: `${d.fromName} <${d.fromAddress}>`, replyTo: d.replyTo, subject, html };
  }

  // Must stay under 160 characters (one text) unless staff chose their own wording. d.link is the customer's own coupon link, without https://
  function sms(d) {
    const c = d.custom || {};
    if (c.sms && String(c.sms).trim()) {
      const text = fill(String(c.sms).replace(/\r/g, '').trim(), valuesOf(d, false), (x) => String(x)).replace(/\s*\n\s*/g, ' ');
      return { text, length: text.length, custom: true };
    }
    const link = d.link || (domain + '/' + d.area + '/shops');
    const v = money(d.value);
    const tries = [
      fill(DEFAULTS.sms, Object.assign(valuesOf(d, false), { link }), (x) => String(x)),
      `You won a ${v} coupon for any ${d.place} shop. Code ${d.code}. Use by ${d.useByShort}. ${link} Reply STOP to opt out`,
      `You won a ${v} coupon! Code ${d.code}. Use by ${d.useByShort} at any ${d.place} shop: ${link} Reply STOP to opt out`,
      `You won a ${v} coupon! Code ${d.code}. Use by ${d.useByShort}. ${link} Reply STOP to opt out`
    ];
    const text = tries.find((t) => t.length <= 160) || tries[tries.length - 1];
    return { text, length: text.length };
  }

  return { email, sms, DEFAULTS, FIELDS, unknownIn };
});
