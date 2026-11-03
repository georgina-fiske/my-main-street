// The email and text a customer gets when staff tap their prize.
// In the demo these are only shown on screen (the Email and Text tabs). Nothing is sent.
// On the live site the Netlify function in netlify/functions/send-coupon.js uses the same wording.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;      // Netlify function
  else root.Messages = factory({ domain: root.CONFIG.domain, esc: root.U.esc, money: root.U.money });   // browser
})(typeof window !== 'undefined' ? window : globalThis, function (deps) {
  const { domain, esc, money } = deps;

  // d: {name, value, code, useBy ("Sat 14 Nov"), useByShort ("14 Nov"), event, place, area, fromName, fromAddress, replyTo, unsubUrl, origin}
  function email(d) {
    const url = d.origin || 'https://' + domain;
    const shops = d.shopsUrl || url + '/' + d.area + '/shops';
    const subject = 'Thanks for spinning the wheel! Here\'s your coupon code';
    const html =
      `<div style="font-family:Montserrat,Arial,sans-serif;color:#1E0B45;line-height:1.5;font-size:15px">
        <p>Hi ${esc(d.name)},</p>
        <p>Thanks for spinning the wheel at ${esc(d.event)} today!</p>
        <p style="font-size:18px"><b>You won a ${money(d.value)} coupon.</b><br>
        <b>Your coupon code: ${esc(d.code)}</b></p>
        <p>Spend it at any participating shop on ${esc(d.place)} by ${esc(d.useBy)}. Just show this email or your code at the counter.</p>
        <p>${d.couponUrl ? `<a href="${esc(d.couponUrl)}" style="display:inline-block;background:#F9DE4B;color:#2A1E00;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;margin-right:8px">Open your coupon</a>` : ''}<a href="${esc(shops)}" style="display:inline-block;background:#560CC9;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px">See the shops</a></p>
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
