// The email and text a customer gets when staff tap their prize.
// In the demo these are only shown on screen (the Email and Text tabs). Nothing is sent.
// On the live site the Netlify function in netlify/functions/send-coupon.js uses the same wording.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;      // Netlify function
  else root.Messages = factory({ domain: root.CONFIG.domain, esc: root.U.esc, money: root.U.money });   // browser
})(typeof window !== 'undefined' ? window : globalThis, function (deps) {
  const { domain, esc, money } = deps;

  // d: {name, value, code, useBy ("Sat 14 Nov"), useByShort ("14 Nov"), event, place, area, fromName, fromAddress, replyTo, unsubUrl, origin}
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
    const main = hexOr(d.color, '#23003F'), accent = hexOr(d.accent, '#FFFDB4');
    const shops = d.shopsUrl || url + '/' + d.area + '/shops';
    const subject = 'Thanks for spinning the wheel! Here\'s your coupon code';
    const html =
      `<div style="font-family:Montserrat,Arial,sans-serif;color:#1E0B45;line-height:1.5;font-size:15px">
        <p>Hi ${esc(d.name)},</p>
        <p>Thanks for spinning the wheel at ${esc(d.event)} today!</p>
        <p style="font-size:18px"><b>You won a ${money(d.value)} coupon.</b><br>
        <b>Your coupon code: ${esc(d.code)}</b></p>
        <p>Spend it at any participating shop on ${esc(d.place)} by ${esc(d.useBy)}. Just show this email or your code at the counter.</p>
        <p>${d.couponUrl ? `<a href="${esc(d.couponUrl)}" style="display:inline-block;background:${accent};color:${inkOn(accent)};text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;margin-right:8px">Open your coupon</a>` : ''}<a href="${esc(shops)}" style="display:inline-block;background:${main};color:${inkOn(main)};text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px">See the shops</a></p>
        ${d.couponUrl ? `<p style="font-size:13px;color:#5E5180">If a button doesn't open, copy this link into your browser:<br>${esc(d.couponUrl)}</p>` : ''}
        <p>We're so excited to bring life back to ${esc(d.place)}. Stay tuned: we'll keep you posted as the next part launches.</p>
        <p>See you on Main Street!</p>
        <p style="font-size:12px;color:#5E5180">You're getting this because you signed up at ${esc(d.event)}. <a href="${esc(d.unsubUrl || '#')}">Unsubscribe</a> · <a href="${esc(d.safetyUrl || url + '/safety')}">Safety and privacy</a></p>
      </div>`;
    return { from: `${d.fromName} <${d.fromAddress}>`, replyTo: d.replyTo, subject, html };
  }

  // Must stay under 160 characters (one text). d.link is the customer's own coupon link, without https://
  function sms(d) {
    const link = d.link || (domain + '/' + d.area + '/shops');
    const v = money(d.value);
    const tries = [
      `Thanks for spinning! You won a ${v} coupon for any ${d.place} shop. Code: ${d.code}. Use by ${d.useByShort}. ${link} Reply STOP to opt out`,
      `You won a ${v} coupon for any ${d.place} shop. Code ${d.code}. Use by ${d.useByShort}. ${link} Reply STOP to opt out`,
      `You won a ${v} coupon! Code ${d.code}. Use by ${d.useByShort} at any ${d.place} shop: ${link} Reply STOP to opt out`,
      `You won a ${v} coupon! Code ${d.code}. Use by ${d.useByShort}. ${link} Reply STOP to opt out`
    ];
    const text = tries.find((t) => t.length <= 160) || tries[tries.length - 1];
    return { text, length: text.length };
  }

  return { email, sms };
});
