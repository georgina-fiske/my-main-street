// The email and text a customer gets when staff tap their prize.
// In the demo these are only shown on screen (the Email and Text tabs). Nothing is sent.
(function () {
  const C = window.CONFIG, esc = (s) => window.U.esc(s);

  // d: {name, value, code, useBy ("Sat 14 Nov"), useByShort ("14 Nov"), event, place, area, fromName, fromAddress, replyTo}
  function email(d) {
    const url = 'https://' + C.domain;
    const shops = url + '/' + d.area + '/shops';
    const subject = 'Thanks for spinning the wheel! Here\'s your coupon code';
    const html =
      `<div style="font-family:Montserrat,Arial,sans-serif;color:#1E0B45;line-height:1.5;font-size:15px">
        <p>Hi ${esc(d.name)},</p>
        <p>Thanks for spinning the wheel at ${esc(d.event)} today!</p>
        <p style="font-size:18px"><b>You won a ${window.U.money(d.value)} coupon.</b><br>
        <b>Your coupon code: ${esc(d.code)}</b></p>
        <p>Spend it at any participating shop on ${esc(d.place)} by ${esc(d.useBy)}. Just show this email or your code at the counter.</p>
        <p><a href="${esc(shops)}" style="display:inline-block;background:#560CC9;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px">See the shops</a></p>
        <p>We're so excited to bring life back to ${esc(d.place)}. Stay tuned: we'll keep you posted as the next part launches.</p>
        <p>See you on Main Street!</p>
        <p style="font-size:12px;color:#5E5180">You're getting this because you signed up at ${esc(d.event)}. <a href="#">Unsubscribe</a> · <a href="${esc(url)}/safety">Safety and privacy</a></p>
      </div>`;
    return { from: `${d.fromName} <${d.fromAddress}>`, replyTo: d.replyTo, subject, html };
  }

  // Must stay under 160 characters.
  function sms(d) {
    const shops = C.domain + '/' + d.area + '/shops';
    const tries = [
      `Thanks for spinning! You won a ${window.U.money(d.value)} coupon for any ${d.place} shop. Code: ${d.code}. Use by ${d.useByShort}. Shops: ${shops} Reply STOP to opt out`,
      `You won a ${window.U.money(d.value)} coupon for any ${d.place} shop. Code: ${d.code}. Use by ${d.useByShort}. Shops: ${shops} Reply STOP to opt out`,
      `You won a ${window.U.money(d.value)} coupon! Code: ${d.code}. Use by ${d.useByShort}. Shops: ${shops} Reply STOP to opt out`
    ];
    const text = tries.find((t) => t.length <= 160) || tries[tries.length - 1];
    return { text, length: text.length };
  }

  window.Messages = { email, sms };
})();
