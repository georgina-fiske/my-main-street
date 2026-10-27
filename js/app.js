// Screens and actions. Layout and wording follow the mockup (main-street-rewards.html).
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, esc = U.esc, money = U.money;

  const VIEWS = [
    { id: 'start', label: 'Start here' }, { id: 'activation', label: 'Festival day' }, { id: 'trader', label: 'Vendor' },
    { id: 'customer', label: 'Customer' }, { id: 'fruitbowl', label: 'Fruitbowl' }, { id: 'council', label: 'Council' },
    { id: 'street', label: 'Street Association' }
  ];
  const TRADERS = C.shops;
  const HOME = C.council;
  const WHO = { fruitbowl: 'Fruitbowl', council: 'Council', street: 'Street Association' };
  const FROM = { fruitbowl: 'From Fruitbowl', council: 'From council', street: 'From the Street Association' };
  const STYLE_NAME = { qr: 'QR code', number: 'Number', barcode: 'Barcode' };

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const S = {
    view: 'start',
    phoneCode: store.get('msr-code') || null,
    trader: store.get('msr-trader') || TRADERS[0].id,
    deskCode: '', lastAward: null, pinFor: null, scan: null
  };
  const root = document.getElementById('app');

  // ---- data helpers (read from the shared database) ----
  const st = () => D.state;
  const signups = () => st().signups;
  const byCode = (code) => signups().find((s) => s.code === code);
  const prizeList = () => st().prizes.slice().sort((a, b) => a.value - b.value || a.id - b.id);
  const given = (p) => signups().filter((s) => s.prize && Number(s.prize.id) === Number(p.id)).length;
  const left = (p) => p.stock - given(p);
  const tName = (id) => (TRADERS.find((t) => t.id === id) || {}).name || 'a shop';
  const stampTotal = U.stampTotal;
  const rewardsAvail = U.rewardsLeft;
  const style = () => st().settings.code_style || 'qr';
  const campList = () => st().campaigns;
  const live = (c) => c.council === 'approved' || c.street === 'yes';
  const wsList = () => st().workshops.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const bookedBy = (w, trader) => st().bookings.some((b) => Number(b.workshop) === Number(w.id) && b.trader === trader);

  async function run(name, args, okMsg) {
    const r = await D.rpc(name, args);
    if (!r.ok) U.toast(r.error || 'Something went wrong.', true);
    else if (okMsg) U.toast(okMsg);
    return r;
  }
  const normCode = (v) => {
    let c = String(v || '').trim().toUpperCase();
    if (c && !c.startsWith('CMS-')) c = 'CMS-' + c;
    return c;
  };

  function totals() {
    const all = signups(), spun = all.filter((s) => s.prize);
    return {
      signups: all.length, spun: spun.length,
      spent: spun.reduce((a, s) => a + Number(s.prize.value || 0), 0),
      used: spun.filter((s) => s.redeemed).length,
      stamps: all.reduce((a, s) => a + stampTotal(s), 0),
      draw: all.filter((s) => stampTotal(s) >= C.stampsForDraw).length
    };
  }
  function statsBlock() {
    const t = totals();
    return `<div class="stats">
      <div class="stat"><b>${t.signups}</b><span>sign-ups</span></div>
      <div class="stat"><b>${t.stamps}</b><span>stamps given</span></div>
      <div class="stat"><b>${t.spun}</b><span>prizes won</span></div>
      <div class="stat"><b>${money(t.spent)}</b><span>prize value</span></div>
      <div class="stat"><b>${t.used}</b><span>prizes used on Main Street</span></div>
      <div class="stat"><b>${t.draw}</b><span>in the big draw</span></div></div>`;
  }

  // ---- shared pieces ----
  function intro(title, what, who, tryit) {
    return `<div class="intro"><h2>${title}</h2><p>${what}</p><div class="intro-grid"><div><b>Who uses it</b><p>${who}</p></div><div><b>Try it</b><p>${tryit}</p></div></div></div>`;
  }

  function ladder(c) {
    const tin = Object.values(c.traders || {}).filter((t) => t.status === 'in').length;
    const k = (v) => (v === 'approved' || v === 'yes' ? '' : v === 'declined' || v === 'no' ? 'no' : 'wait');
    const w = (v) => (v === 'approved' || v === 'yes' ? 'backing it' : v === 'declined' || v === 'no' ? 'passed' : 'deciding');
    return `<div class="ladder"><span class="tag ${k(c.council)}">Council: ${w(c.council)}</span><span class="tag ${k(c.street)}">Street: ${w(c.street)}</span>
      <span class="tag ${live(c) ? '' : 'wait'}">${live(c) ? 'Live for vendors' : 'Not live yet'} · ${tin}/${TRADERS.length} vendors in</span></div>`;
  }
  function campCard(c, actions) {
    return `<div class="camp"><div class="row" style="justify-content:space-between"><h3>${esc(c.title)}</h3><span class="tag">${FROM[c.posted_by || 'fruitbowl']}</span></div>
      <div class="muted">${esc(c.month)}</div>${ladder(c)}<p>${esc(c.blurb)}</p>${c.street_extra ? `<p><b>Street extra:</b> ${esc(c.street_extra)}</p>` : ''}${actions || ''}</div>`;
  }

  function winBanner(s) {
    const p = s.prize;
    if (!p || s.redeemed) return '';
    return `<div class="win" role="status"><b style="font-size:20px">You won!</b><div class="amt">${p.value ? money(p.value) : 'Gift'}</div><b>${esc(p.name)}</b>
      <p>Go to <b>${esc(p.collect_at || 'any participating Main Street shop')}</b> to collect it. Show this screen.</p>
      <p style="font-size:14px">Use it by ${U.useBy(s.spun_at)}. We've emailed you a copy too.</p></div>`;
  }

  function redeemBox(key, title, value, used, usedAt) {
    if (used) return `<div class="voucher used"><b>${esc(title)}</b><br><span class="muted">Used at ${esc(tName(usedAt))}</span></div>`;
    const open = S.pinFor === key;
    return `<div class="voucher"><b>${value ? money(value) + ' · ' : ''}${esc(title)}</b>
      ${open
        ? `<form data-form="pin" data-key="${key}" class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="pin-in" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" aria-label="Shop PIN" style="flex:1 1 140px;min-width:120px;letter-spacing:.3em"><button class="btn" type="submit" style="flex:0 0 auto">Confirm</button></form>
           <p class="muted" style="font-size:13px;margin:6px 0 0">Staff type their shop's 4-digit PIN. Demo: Main St Espresso is 1111.</p>`
        : `<button class="btn sun" data-act="pin-open" data-key="${key}">Staff: tap to use this</button>`}</div>`;
  }

  const THANKS = `<div class="ticket thanks"><b>Thanks for joining us!</b><br><span class="muted">We're so excited to bring you back to your Main Street.</span></div>`;
  function passCard(s, withCode) {
    return `<div class="pass"><div class="pass-top"><span>${esc(C.siteName)}</span><span>Croydon</span></div><div class="pass-name">${esc(s.name)}</div>${withCode ? U.codeBlock(s.code, style()) : ''}</div>`;
  }
  function phoneWrap(inner) {
    return `<div class="phone"><div class="appbar"><small>${esc(C.streetName)}</small><b>${esc(C.siteName)}</b></div><div class="phone-body">${inner}</div></div>`;
  }

  // Festival day phone: sign-up, then the code, then the win, then "used".
  function festivalPhone(s) {
    const p = s.prize;
    if (!p) return `<div class="ticket"><h2>You're in! Now get in line for the wheel.</h2><span class="muted">When you reach the wheel, show this screen. Staff will scan it.</span></div>${passCard(s, true)}`;
    if (s.redeemed) return `${passCard(s, false)}${redeemBox('prize', 'Festival prize: ' + p.name, p.value, true, s.redeemed_at)}${THANKS}`;
    if (S.pinFor === 'prize') return `${passCard(s, false)}${redeemBox('prize', 'Festival prize: ' + p.name, p.value, false)}`;
    return `${winBanner(s)}${THANKS}${redeemBox('prize', 'Festival prize: ' + p.name, p.value, false)}`;
  }

  // Customer screen: the pass as it looks in their phone's Wallet.
  function walletView(s) {
    const total = stampTotal(s), n = Math.min(total, C.stampsForDraw);
    return `<div class="phone"><div class="wallet"><h3>Wallet</h3><div class="stub">Bank card</div>
      <div class="pass"><div class="pass-top" style="opacity:1;font-size:17px;font-weight:800"><span>${esc(C.siteName)}</span><span style="font-size:11px;font-weight:500">Croydon</span></div>
      <div class="lbl"><span>NAME</span><span>STAMPS</span></div><div class="val"><span>${esc(s.name)}</span><span>${n}/${C.stampsForDraw}</span></div>
      <div class="dots" aria-hidden="true">${Array.from({ length: C.stampsForDraw }, (_, i) => `<span class="dot ${i < n ? 'f' : ''}"></span>`).join('')}</div>
      <div style="font-size:12px;opacity:.85">${total >= C.stampsForDraw ? "You're in the big draw!" : (C.stampsForDraw - total) + ' more for the big draw'}</div>
      ${U.codeBlock(s.code, style())}</div></div></div>`;
  }
  function readyToUse(me) {
    const p = me.prize;
    const rw = TRADERS.filter((t) => rewardsAvail(me, t.id) > 0);
    const items = (p && !me.redeemed ? redeemBox('prize', 'Festival prize: ' + p.name, p.value, false) : '')
      + rw.map((t) => redeemBox('reward-' + t.id, `${C.stampsForReward}-stamp reward from ${t.name}`, null, false)).join('');
    return items ? `<div class="panel gap"><h3>Ready to use</h3><div class="grid" style="gap:10px;margin-top:8px">${items}</div></div>` : '';
  }

  function campaignForm(level) {
    const btn = level === 'fruitbowl' ? 'Send to council and the street' : 'Send to our vendors';
    return `<form data-form="newcamp" data-level="${level}">
      <label for="ct-${level}">Name</label><input id="ct-${level}" name="title" required placeholder="Late Night Thursdays">
      <label for="cm-${level}">When</label><input id="cm-${level}" name="month" required placeholder="December 2026">
      <label for="cb-${level}">The idea</label><textarea id="cb-${level}" name="blurb" required placeholder="What vendors do and what customers get"></textarea>
      <p style="margin-top:14px"><button class="btn" type="submit">${btn}</button></p></form>
      <details><summary>Need an idea? Pick one to fill the form</summary><ul class="list">${C.ideas.map((x, i) => `<li class="row" style="justify-content:space-between;flex-wrap:nowrap"><span><b>${esc(x.title)}</b> <span class="muted">· ${esc(x.month)}</span><br><span class="muted">${esc(x.blurb)}</span></span><button type="button" class="btn ghost small" data-act="use-idea" data-level="${level}" data-i="${i}">Use this</button></li>`).join('')}</ul></details>`;
  }

  function prizesPanel(level) {
    return `<div class="panel gap"><h3>Prizes</h3><p class="muted">Fruitbowl, council and the Street Association can all add prizes. They show on the festival desk straight away.</p>
      <div class="table-wrap"><table><thead><tr><th>Prize</th><th>Value</th><th>Where to collect</th><th>Won</th><th>Stock</th><th>Added by</th><th></th></tr></thead><tbody>
      ${prizeList().map((p) => {
        const g = given(p);
        return `<tr><td>${esc(p.name)}</td><td>${p.value ? money(p.value) : 'Gift'}</td><td>${esc(p.collect_at || 'Any shop')}</td><td>${g}</td><td>${p.stock}</td><td>${esc(WHO[p.added_by] || '')}</td>
          <td><button class="btn ghost small" data-act="stock" data-id="${p.id}">+10</button> ${g ? '' : `<button class="btn ghost small" data-act="del-prize" data-id="${p.id}">Remove</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>
      <form data-form="prize" data-level="${level}" class="row" style="margin-top:12px;align-items:flex-end">
        <div style="flex:2;min-width:160px"><label for="pn-${level}">New prize</label><input id="pn-${level}" name="name" required placeholder="Free pizza slice"></div>
        <div style="flex:1;min-width:90px"><label for="pv-${level}">Value $</label><input id="pv-${level}" name="value" inputmode="numeric" required placeholder="10"></div>
        <div style="flex:2;min-width:160px"><label for="pw-${level}">Where to collect</label><input id="pw-${level}" name="where" required placeholder="Main St Espresso"></div>
        <div style="flex:1;min-width:90px"><label for="pq-${level}">How many</label><input id="pq-${level}" name="stock" inputmode="numeric" required placeholder="20"></div>
        <button class="btn" type="submit">Add prize</button></form></div>`;
  }

  function wsTable(list, withBook) {
    if (!list.length) return '<p class="muted">No workshops yet.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>Workshop</th><th>When</th><th>Format</th><th>Where</th>${withBook ? '<th></th>' : '<th>Sent to</th><th>Booked</th>'}</tr></thead><tbody>
      ${list.map((w) => {
        const n = st().bookings.filter((b) => Number(b.workshop) === Number(w.id)).length;
        return `<tr><td>${esc(w.name)}</td><td>${U.date(w.date)} ${U.time(w.time)}</td><td><span class="tag ${w.format === 'Online' ? '' : 'wait'}">${esc(w.format)}</span></td><td>${esc(w.place)}</td>
          ${withBook
            ? `<td>${bookedBy(w, S.trader) ? '<span class="tag">Booked</span>' : `<button class="btn small" data-act="book" data-w="${w.id}">Book</button>`}</td>`
            : `<td>${esc((w.councils || []).join(', '))}</td><td>${n}</td>`}</tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // ---- views ----
  function card(go, title, what, ex) {
    return `<div class="card"><h3>${title}</h3><p>${what}</p><div class="ex"><b>Example:</b> ${ex}</div><a class="btn small" href="#${go}">Open ${title}</a></div>`;
  }
  function vStart() {
    return `<div class="intro"><h2>What this is</h2>
      <p>One website for ${esc(C.streetName)}. Shoppers collect stamps and win prizes. Shops join campaigns with one tap. Council and the Street Association see what's working.</p>
      <p><b>How customers get a stamp:</b> after paying, they scan the QR code on the counter or tap their phone on the sticker. It takes 5 seconds and the vendor does nothing. This is the same way StampMe works.</p>
      <p><b>How customers win:</b> ${C.stampsForReward} stamps at one shop gets that shop's reward. ${C.stampsForDraw} anywhere gets you into the big draw.</p>
      <p><b>Later:</b> customers link their bank card once, and stamps land automatically when they pay.</p>
      <p><b>What vendors do:</b> almost nothing. Customers tap the counter sticker for stamps. To use a prize, staff type their shop PIN on the customer's phone.</p>
      <p class="muted">This is a demo to click through. It's not live yet. The shops and prizes are made up.</p></div>
      <h2 style="margin:8px 0 12px">Each screen, explained</h2>
      <div class="cards">
      ${card('activation', 'Festival day', `${esc(C.festivalName)} launch: the customer's phone, our desk and the vendor, side by side.`, 'Sam signs up, spins, wins a free coffee, and uses it at Main St Espresso that night.')}
      ${card('trader', 'Vendor', "Each shop's screen. Built to need as little as possible from busy staff.", 'Gelato Lane prints its counter sticker, joins Christmas, and books a workshop.')}
      ${card('customer', 'Customer', "The shopper's pass: stamps, prizes, rewards and what's on.", 'Sam has 4 of 10 stamps toward the big draw.')}
      ${card('fruitbowl', 'Fruitbowl', 'Plans the year, adds prizes, and runs workshops for each council.', 'Fruitbowl sends an online workshop to Maroondah and Knox.')}
      ${card('council', 'Council', 'Backs campaigns, makes its own, adds prizes, and sees results.', 'Council posts its own campaign for a local event.')}
      ${card('street', 'Street Association', 'Backs campaigns, makes its own, adds prizes, and sees which shops are in.', 'The association adds Santa on a banana lounge on Saturdays.')}
      </div>`;
  }

  function vActivation() {
    const me = S.phoneCode && byCode(S.phoneCode);
    const phone = me
      ? festivalPhone(me)
      : `<h2>Win something on Main Street</h2><p class="muted">Sign up, spin the wheel, and use your prize in Croydon today.</p>
        <form data-form="signup">
          <label for="f-name">First name</label><input id="f-name" name="name" required autocomplete="given-name" maxlength="40">
          <label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email" maxlength="120">
          <p class="muted" style="font-size:13px;margin:4px 0 0">Demo: use a made-up email.</p>
          <label for="f-post">Postcode</label><input id="f-post" name="postcode" inputmode="numeric" maxlength="4" required autocomplete="postal-code">
          <label class="check"><input type="checkbox" name="optin" checked> Send me news and offers from ${esc(C.streetName)}</label>
          <label class="check"><input type="checkbox" name="terms" required> I agree to the terms and privacy note</label>
          <p style="margin-top:14px"><button class="btn sun" type="submit" style="width:100%">Sign up and get my spin</button></p></form>`;
    const cur = S.deskCode ? byCode(S.deskCode) : null;
    const desk = `<p><b>When someone reaches the wheel, scan their phone.</b></p>
      <button class="btn sun big" data-act="desk-scan">Scan their code</button>
      <form data-form="desk" style="margin-top:10px"><label for="desk-in">Scanner box</label><input id="desk-in" name="code" placeholder="Scan, or type the number" autocomplete="off"></form>
      <p class="muted" style="font-size:14px;margin-top:6px">Phones show the code as a <b>${STYLE_NAME[style()]}</b>. Change this on the Fruitbowl screen.</p>
      ${cur
        ? `<div class="next gap"><div class="muted">At the wheel</div><div class="nextname">${esc(cur.name)}</div><div>${esc(cur.code)}</div>
            ${cur.prize ? `<span class="tag no">Already won: ${esc(cur.prize.name)}</span>` : ''}</div>
            ${cur.prize ? '' : `<p style="margin:12px 0 0"><b>Tap the prize the wheel landed on.</b> That's it.</p>`}`
        : S.deskCode
          ? `<div class="next gap">No sign-up with code ${esc(S.deskCode)}. Check their screen and scan again.</div>`
          : `<div class="next gap"><span class="muted">Scan someone to start. The prize buttons light up once you do.</span></div>`}
      <div class="prizes">${prizeList().map((p) => {
        const l = left(p), off = !cur || cur.prize || l <= 0;
        return `<button class="prize ${p.value >= 100 ? 'hero' : p.value === 0 ? 'filler' : ''}" data-act="award" data-code="${cur ? esc(cur.code) : ''}" data-prize="${p.id}" ${off ? 'disabled' : ''}><span class="v">${p.value ? money(p.value) : 'Gift'}</span><span class="n">${esc(p.name)}</span><span class="left">${l} left</span></button>`;
      }).join('')}</div>
      ${S.lastAward ? `<div class="who">${esc(S.lastAward.name)} won <b>${esc(S.lastAward.prize)}</b>.${S.lastAward.where ? ' Collect at <b>' + esc(S.lastAward.where) + '</b>.' : ''} Their phone shows it now. <button class="btn ghost small" data-act="undo">Undo</button></div>` : ''}`;
    return `${intro('Festival day', `How ${esc(C.festivalName)} works on the day. Three people, three screens. Follow 1, 2, 3.`, 'The customer on their phone, our team at the marquee desk, and the vendor on Main Street.', 'Sign up on the phone. At the desk, tap Scan their code and pick yourself. Tap a prize. Then on the phone, tap Staff: tap to use this and enter 1111.')}
      ${statsBlock()}
      <div class="grid three">
        <section aria-label="Customer phone"><div class="stephead"><span class="num">1</span><div><h3>What the customer sees</h3><p class="muted">On their own phone, after scanning the marquee QR code.</p></div></div>${phoneWrap(phone)}${me ? `<p style="text-align:center;margin-top:12px"><button class="btn ghost small" data-act="reset-phone">Sign up someone else</button></p>` : ''}</section>
        <section class="panel" aria-label="Prize desk"><div class="stephead"><span class="num">2</span><div><h3>What our team sees</h3><p class="muted">At the wheel. People line up in person. Staff scan each phone, then tap the prize the wheel landed on.</p></div></div>${desk}</section>
        <section class="panel" aria-label="Vendor"><div class="stephead"><span class="num">3</span><div><h3>What the vendor does</h3><p class="muted">At their counter on Main Street, later that day.</p></div></div>
          <div class="howcard"><h3>The easy way</h3><p>The customer shows their prize. Staff tap <b>Staff: tap to use this</b> on the customer's phone and type the shop's 4-digit PIN. Done. No device, no app.</p></div>
          <div class="howcard gap"><h3>Busy counter?</h3><p>Use the <b>Scan</b> button on the Vendor screen, or plug a barcode scanner into the POS tablet. It reads the customer's pass and shows one big button.</p>
          <a class="btn small" href="#trader">Open the Vendor screen</a></div></section>
      </div>
      <div class="panel gap printable"><h3>Marquee QR code</h3><p class="muted">Print this big for the backdrop and the desk. It opens the sign-up page.</p>
        <div class="qr marquee-qr" role="img" aria-label="QR code for the sign-up page" style="background:#fff;border-radius:12px;padding:12px;width:fit-content;margin:12px auto">${U.qrSvg(location.origin + '/#activation', 6)}</div>
        <p class="noprint" style="text-align:center"><button class="btn small" data-act="print-marquee">Print this</button></p></div>`;
  }

  function vTrader() {
    const t = TRADERS.find((x) => x.id === S.trader) || TRADERS[0];
    const camps = campList().filter(live);
    const used = signups().filter((s) => s.redeemed && s.redeemed_at === t.id);
    const stamped = signups().reduce((a, s) => a + U.stampsAt(s, t.id), 0);
    const sc = S.scan && byCode(S.scan);
    let result = '';
    if (S.scan && !sc) result = `<div class="result">No customer with code ${esc(S.scan)}. Check the code on their pass.</div>`;
    if (sc) {
      const p = sc.prize, rw = rewardsAvail(sc, t.id);
      result = `<div class="result"><h3>${esc(sc.name)} · ${esc(sc.code)}</h3><p class="muted">${U.stampsAt(sc, t.id)} stamps here · ${stampTotal(sc)}/${C.stampsForDraw} overall</p>
        <div class="grid" style="gap:8px">
          ${p && !sc.redeemed ? `<button class="btn sun big" data-act="v-use-prize">Use festival prize: ${esc(p.name)}</button>` : ''}
          ${rw > 0 ? `<button class="btn sun big" data-act="v-use-reward">Use ${C.stampsForReward}-stamp reward</button>` : ''}
          <button class="btn big" data-act="v-stamp">Give a stamp</button>
          <button class="btn ghost small" data-act="v-clear">Next customer</button></div></div>`;
    }
    const campHtml = camps.length ? camps.map((c) => {
      const s = (c.traders || {})[t.id];
      return campCard(c, s
        ? `<p><span class="tag ${s.status === 'in' ? '' : 'no'}">${s.status === 'in' ? "You're in" : 'Not this time'}</span> ${esc(s.offer || '')}</p><button class="btn ghost small" data-act="trader-undo" data-id="${c.id}">Change my answer</button>`
        : `<form data-form="optin" data-id="${c.id}"><label for="o-${c.id}">Your offer (optional)</label><input id="o-${c.id}" name="offer" placeholder="A stamp with any purchase" maxlength="120">
            <div class="row" style="margin-top:10px"><button class="btn" type="submit">I'm in</button><button class="btn ghost" type="button" data-act="trader-out" data-id="${c.id}">Not this time</button></div></form>`);
    }).join('') : `<p class="muted">No campaigns yet. They show here when council or your street backs one.</p>`;
    return `${intro('Vendor', "Each shop's own screen. Made so busy staff barely have to touch it.", 'Every shop, cafe and service on Main Street, on any phone or tablet.', 'Pick a shop. Scan a customer (pick anyone from the demo list). Use their prize with one tap. Then join a campaign and book a workshop.')}
      <div class="row" style="margin-bottom:16px"><label for="t-pick" style="margin:0">Pretend you are</label><select id="t-pick" data-change="trader-pick" style="max-width:320px">${TRADERS.map((x) => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)} (${esc(x.type)})</option>`).join('')}</select></div>
      <div class="stats"><div class="stat"><b>${stamped}</b><span>stamps given here</span></div><div class="stat"><b>${used.length}</b><span>prizes used here</span></div><div class="stat"><b>${money(used.reduce((a, s) => a + Number((s.prize || {}).value || 0), 0))}</b><span>prize money spent here</span></div></div>
      <h2>How you'll use it</h2>
      <div class="kit gap" style="margin-top:8px">
        <div class="howcard"><h3>Stamps: nothing to do</h3><p>After paying, customers scan the QR on your counter or tap the sticker. It takes about 5 seconds. The stamp lands on their pass by itself. One stamp per shop per day. Same as StampMe.</p><p class="muted" style="font-size:14px">Later: customers can link their bank card, so stamps happen when they pay.</p></div>
        <div class="howcard"><h3>Prizes and rewards: type your PIN</h3><p>The customer shows their pass. Tap <b>Staff: tap to use this</b> on their phone and type your PIN.</p><div class="bigpin" aria-label="Shop PIN ${t.pin.split('').join(' ')}">${t.pin}</div><p class="muted" style="font-size:14px">Your shop PIN. Keep it behind the counter.</p></div>
        <div class="howcard"><h3>Your counter sticker</h3><p>Print this QR. The NFC tap sticker we post you has the same link.</p><div class="qr" role="img" aria-label="Counter sticker QR code" style="background:#fff;border-radius:8px;padding:8px;width:fit-content">${U.qrSvg(location.origin + '/tap/' + t.id, 4)}</div><p class="muted" style="font-size:13px">${esc(location.origin)}/tap/${esc(t.id)}</p></div>
      </div>
      <div class="grid two gap">
        <section class="panel"><h3>Busy counter? Scan instead</h3>
          <p class="muted">Tap Scan to use the camera, or plug a barcode scanner into your POS tablet and scan into the box. No typing.</p>
          <button class="btn sun big" data-act="v-scan">Scan a customer's pass</button>
          <form data-form="scan" style="margin-top:12px"><label for="scan-in">Scanner box</label><input id="scan-in" name="code" placeholder="Scan or type CMS-1234" autocomplete="off"></form>
          ${result}</section>
        <section><h3 style="margin-bottom:10px">Campaigns you can join</h3>${campHtml}</section></div>
      <div class="panel gap"><h3>Workshops for your area</h3><p class="muted">Run by Fruitbowl. Book a spot with one tap.</p>${wsTable(wsList().filter((w) => (w.councils || []).includes(HOME)), true)}</div>`;
  }

  function vCustomer() {
    const me = S.phoneCode && byCode(S.phoneCode);
    const camps = campList().filter(live);
    return `${intro('Customer', "The shopper's pass: stamps, prizes, rewards and what's on.", 'Anyone who signs up. In the real version the pass lives in Apple or Google Wallet, so no app is needed.', `Tap a shop's sticker below to collect stamps. Get ${C.stampsForReward} at one shop to unlock its reward. Get ${C.stampsForDraw} anywhere for the big draw.`)}
      <div class="grid two">
        <section>${me ? walletView(me) + readyToUse(me) : `<div class="panel"><p>You're not signed up yet.</p><a class="btn sun" href="#activation">Sign up on the Festival day screen</a></div>`}</section>
        <section>
          ${me ? `<div class="panel"><h3>Get a stamp after you pay</h3><p>In real life: open your camera and scan the QR on the counter, or tap your phone on the sticker. About 5 seconds. The shop does nothing. It works the same way as StampMe.</p>
            <p class="who" style="margin-top:0"><b>${C.stampsForReward} stamps at one shop</b> = that shop's reward.<br><b>${C.stampsForDraw} stamps anywhere</b> = the big draw.</p>
            <p class="muted" style="margin-top:12px">Demo: each button does the same thing for that shop.</p><div class="row">${TRADERS.map((t) => `<button class="btn ghost small" data-act="tap" data-t="${t.id}">${esc(t.name)} · ${U.stampsAt(me, t.id)}</button>`).join('')}</div>
            <p class="muted" style="margin-top:10px;font-size:14px">Coming later: link your bank card and stamps land automatically when you pay.</p></div>` : ''}
          <h3 style="margin:18px 0 10px">Happening now</h3>
          ${camps.length ? camps.map((c) => {
            const ins = TRADERS.filter((t) => ((c.traders || {})[t.id] || {}).status === 'in');
            return `<div class="camp"><h3>${esc(c.title)}</h3><div class="muted">${esc(c.month)}</div><p>${esc(c.blurb)}</p>${c.street_extra ? `<p><b>${esc(c.street_extra)}</b></p>` : ''}
              ${ins.length ? `<ul class="list">${ins.map((t) => `<li><b>${esc(t.name)}</b> · ${esc(c.traders[t.id].offer || 'Stamp with any purchase')}</li>`).join('')}</ul>` : ''}</div>`;
          }).join('') : '<p class="muted">Nothing on yet.</p>'}
        </section></div>`;
  }

  function vFruitbowl() {
    const camps = campList();
    return `${intro('Fruitbowl', 'Fruitbowl plans the year, adds prizes, and runs the workshops. Campaigns you post go to council and the Street Association to back.', 'The Fruitbowl team.', 'Post Easter Egg Hunt using an idea. Add a workshop for Maroondah only. Then open the Vendor screen to see it.')}
      <div class="panel"><h3>Festival day settings</h3><p class="muted">How the customer's code shows on their phone after they sign up. It is saved for everyone. Pick whatever your scanner reads best.</p>
        <div class="row" role="group" aria-label="Code style">${[['qr', 'QR code'], ['number', 'Number'], ['barcode', 'Barcode']].map(([v, l]) => `<button class="btn ${style() === v ? '' : 'ghost'}" data-act="code-style" data-v="${v}" aria-pressed="${style() === v}">${l}</button>`).join('')}</div></div>
      <div class="gap">${statsBlock()}</div>
      <div class="grid two">
        <section class="panel"><h3>Post a campaign</h3>${campaignForm('fruitbowl')}</section>
        <section><h3 style="margin-bottom:10px">Every campaign, every level</h3>${camps.length ? camps.map((c) => campCard(c)).join('') : '<p class="muted">No campaigns yet.</p>'}</section></div>
      ${prizesPanel('fruitbowl')}
      <div class="panel gap"><h3>Workshops</h3><p class="muted">Only Fruitbowl creates workshops. Pick which councils get each one. Their vendors see it and book.</p>
        ${wsTable(wsList(), false)}
        <form data-form="workshop" class="gap">
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div><label for="w-name">Workshop</label><input id="w-name" name="name" required placeholder="Know your brand"></div>
            <div><label for="w-date">Date</label><input id="w-date" name="date" type="date" required></div>
            <div><label for="w-time">Time</label><input id="w-time" name="time" type="time" required></div>
            <div><label for="w-format">Format</label><select id="w-format" name="format"><option>Online</option><option>In person</option></select></div>
            <div style="grid-column:1/-1"><label for="w-where">Where or link</label><input id="w-where" name="where" required placeholder="Croydon Library, or a Google Meet link"></div>
          </div>
          <fieldset style="border:0;padding:0;margin:10px 0 0"><legend style="font-weight:700;font-size:15px">Send to</legend><div class="row">${C.allCouncils.map((c) => `<label class="check" style="margin:4px 12px 0 0"><input type="checkbox" name="councils" value="${esc(c)}" ${c === HOME ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div></fieldset>
          <p style="margin-top:14px"><button class="btn" type="submit">Send workshop</button></p></form></div>`;
  }

  function vCouncil() {
    const camps = campList();
    return `${intro('Council', "Council can back Fruitbowl's campaigns, make its own, and add prizes. Backing or posting a campaign sends it straight to vendors.", esc(C.councilLabel) + '.', 'Post a campaign about something happening locally. Then open the Vendor screen and join it.')}
      ${statsBlock()}
      <div class="grid two">
        <section class="panel"><h3>Post your own campaign</h3><p class="muted">It goes straight to your vendors.</p>${campaignForm('council')}</section>
        <section><h3 style="margin-bottom:10px">Campaigns</h3>${camps.length ? camps.map((c) => campCard(c, c.council === 'pending' ? `<div class="row"><button class="btn small" data-act="council" data-id="${c.id}" data-v="approved">Back it and send to vendors</button><button class="btn ghost small" data-act="council" data-id="${c.id}" data-v="declined">Not for us</button></div>` : '')).join('') : '<p class="muted">No campaigns yet.</p>'}</section></div>
      ${prizesPanel('council')}
      <div class="panel gap"><h3>Workshops for ${esc(HOME)} vendors</h3>${wsTable(wsList().filter((w) => (w.councils || []).includes(HOME)), false)}</div>`;
  }

  function vStreet() {
    const camps = campList();
    return `${intro('Street Association', 'The Street Association can back campaigns, make its own, add prizes, and see which shops are in.', `The ${esc(C.streetOrg)} president and coordinator.`, 'Back Hot Days, Cool Street with an extra like free water on hot days. Or post your own campaign.')}
      ${statsBlock()}
      <div class="grid two">
        <section class="panel"><h3>Post your own campaign</h3><p class="muted">It goes straight to your vendors.</p>${campaignForm('street')}</section>
        <section><h3 style="margin-bottom:10px">Campaigns</h3>${camps.length ? camps.map((c) => {
          const tr = c.traders || {};
          const act = c.street === 'yes'
            ? `<details><summary>Which vendors are in</summary><div class="table-wrap"><table><tbody>${TRADERS.map((t) => { const s = tr[t.id]; return `<tr><td>${esc(t.name)}</td><td>${s ? `<span class="tag ${s.status === 'in' ? '' : 'no'}">${s.status === 'in' ? 'In' : 'Not this time'}</span>` : '<span class="tag wait">No answer</span>'}</td><td>${esc((s && s.offer) || '')}</td></tr>`; }).join('')}</tbody></table></div></details>`
            : c.street === 'no' ? ''
              : `<form data-form="street" data-id="${c.id}"><label for="x-${c.id}">Street extra (optional)</label><input id="x-${c.id}" name="extra" placeholder="Santa visits Saturday 12 December" maxlength="200">
                  <div class="row" style="margin-top:10px"><button class="btn" type="submit">Back it and send to vendors</button><button class="btn ghost" type="button" data-act="street-no" data-id="${c.id}">Not for us</button></div></form>`;
          return campCard(c, act);
        }).join('') : '<p class="muted">No campaigns yet.</p>'}</section></div>
      ${prizesPanel('street')}`;
  }

  const VIEW_FN = { start: vStart, activation: vActivation, trader: vTrader, customer: vCustomer, fruitbowl: vFruitbowl, council: vCouncil, street: vStreet };

  // ---- render ----
  function snapshotFields() {
    const snap = {};
    root.querySelectorAll('input[id],select[id],textarea[id]').forEach((el) => {
      snap[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return snap;
  }
  function restoreFields(snap) {
    Object.keys(snap).forEach((id) => {
      const el = root.querySelector('#' + CSS.escape(id));
      if (!el) return;
      if (el.type === 'checkbox') el.checked = snap[id];
      else if (el.tagName === 'SELECT') { if ([...el.options].some((o) => o.value === snap[id])) el.value = snap[id]; } else el.value = snap[id];
    });
  }

  function render() {
    document.getElementById('nav').innerHTML = VIEWS.map((v) => `<a href="#${v.id}"${S.view === v.id ? ' aria-current="page"' : ''}>${v.label}</a>`).join('');
    if (!D.ready) {
      root.innerHTML = D.error === 'not-configured'
        ? `<div class="panel"><h2>Almost there</h2><p>This site needs its database. Add the Supabase URL and key in <code>js/config.js</code>. See the README.</p></div>`
        : D.error
          ? `<div class="panel"><h2>Can't reach the demo data</h2><p>${esc(D.error)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`
          : '<p>Loading…</p>';
      return;
    }
    const snap = snapshotFields();
    root.innerHTML = VIEW_FN[S.view]();
    restoreFields(snap);
  }

  let pending = false;
  function scheduleRender() {
    const a = document.activeElement;
    if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
      if (!pending) {
        pending = true;
        a.addEventListener('blur', () => { setTimeout(() => { pending = false; scheduleRender(); }, 400); }, { once: true });
      }
      return;
    }
    render();
  }

  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    if (h.startsWith('tap-')) { render(); return; } // the stamp is added after the data loads
    S.view = VIEW_FN[h] ? h : 'start';
    render();
    window.scrollTo(0, 0);
  }

  // ---- actions ----
  const focusId = (id) => { const el = document.getElementById(id); if (el) el.focus(); };

  async function addStamp(code, tid) {
    const s = byCode(code);
    if (!s) return;
    const here = U.stampsAt(s, tid) + 1, total = stampTotal(s) + 1;
    const r = await run('give_stamp', { p_code: code, p_shop: tid });
    if (r.ok) {
      U.toast(here % C.stampsForReward === 0 ? 'Reward unlocked at ' + tName(tid) + '!'
        : total === C.stampsForDraw ? "You're in the big draw!"
          : 'Stamp from ' + tName(tid) + '. ' + Math.min(total, C.stampsForDraw) + '/' + C.stampsForDraw);
    }
  }
  async function usePrize(code, tid) {
    const s = byCode(code);
    if (!s || !s.prize) { U.toast('No festival prize on this pass', true); return false; }
    if (s.redeemed) { U.toast('Already used', true); return false; }
    const r = await run('redeem_prize', { p_code: code, p_shop: tid });
    if (r.ok) U.toast('Used: ' + s.prize.name + ' at ' + tName(tid));
    return r.ok;
  }
  async function useReward(code, tid) {
    const s = byCode(code);
    if (!s || rewardsAvail(s, tid) <= 0) { U.toast('No reward to use here yet', true); return false; }
    const r = await run('use_reward', { p_code: code, p_shop: tid });
    if (r.ok) U.toast('Reward used at ' + tName(tid));
    return r.ok;
  }

  function deskPick(raw) { S.deskCode = normCode(raw); render(); focusId('desk-in'); return ''; }
  function vendorPick(raw) { S.scan = normCode(raw) || null; render(); return ''; }

  const ACTS = {
    async reset() {
      if (!confirm('Reset the demo? This wipes all changes and reloads the demo data.')) return;
      const r = await run('reset_demo', {}, 'Demo reset.');
      if (r.ok) { S.phoneCode = null; store.set('msr-code', ''); S.deskCode = ''; S.lastAward = null; S.scan = null; S.pinFor = null; render(); }
    },
    'reset-phone'() { S.phoneCode = null; store.set('msr-code', ''); render(); },
    'desk-scan'() {
      const list = signups().filter((s) => !s.prize).slice().reverse().slice(0, 12).map((s) => ({ label: `${s.name} · ${s.code}`, code: s.code }));
      U.openScanner({ title: 'Scan their code', list, onCode: deskPick, after: () => focusId('desk-in') });
    },
    'code-style': (b) => run('set_setting', { p_key: 'code_style', p_value: b.dataset.v }, 'Phones now show a ' + STYLE_NAME[b.dataset.v]),
    async award(b) {
      const cur = byCode(b.dataset.code);
      if (!cur || cur.prize) return;
      const p = st().prizes.find((x) => Number(x.id) === Number(b.dataset.prize));
      if (!p) return;
      if (left(p) <= 0) return U.toast(p.name + ' has run out', true);
      const r = await run('award_prize', { p_code: cur.code, p_prize: p.id });
      if (r.ok) { S.lastAward = { code: cur.code, name: cur.name, prize: p.name, where: p.collect_at || '' }; S.deskCode = ''; render(); focusId('desk-in'); }
    },
    async undo() {
      if (!S.lastAward) return;
      const s = byCode(S.lastAward.code);
      if (s && s.redeemed) return U.toast("Can't undo. It's already been used.", true);
      const r = await run('undo_prize', { p_code: S.lastAward.code }, 'Undone');
      if (r.ok) { S.lastAward = null; render(); }
    },
    'pin-open'(b) { S.pinFor = b.dataset.key; render(); focusId('pin-in'); },
    tap(b) { if (S.phoneCode) return addStamp(S.phoneCode, b.dataset.t); },
    'v-scan'() {
      const list = signups().slice(-12).reverse().map((s) => ({ label: `${s.name} · ${s.code}`, code: s.code }));
      U.openScanner({ title: "Scan a customer's pass", list, onCode: vendorPick });
    },
    'v-clear'() { S.scan = null; render(); focusId('scan-in'); },
    'v-stamp'() { if (S.scan) return addStamp(S.scan, S.trader); },
    'v-use-prize'() { if (S.scan) return usePrize(S.scan, S.trader); },
    'v-use-reward'() { if (S.scan) return useReward(S.scan, S.trader); },
    council: (b) => run('council_decide', { p_id: Number(b.dataset.id), p_approve: b.dataset.v === 'approved' }, b.dataset.v === 'approved' ? 'Backed. Sent to vendors.' : 'Passed on this one'),
    'street-no': (b) => run('street_decide', { p_id: Number(b.dataset.id), p_yes: false, p_extra: '' }, 'Passed on this one'),
    'trader-out': (b) => run('set_trader', { p_id: Number(b.dataset.id), p_shop: S.trader, p_status: 'out', p_offer: '' }),
    'trader-undo': (b) => run('set_trader', { p_id: Number(b.dataset.id), p_shop: S.trader, p_status: 'none', p_offer: '' }),
    book: (b) => run('book_workshop', { p_trader: S.trader, p_workshop: Number(b.dataset.w) }, 'Booked. Details coming by email.'),
    'use-idea'(b) {
      const x = C.ideas[Number(b.dataset.i)], lv = b.dataset.level;
      document.getElementById('ct-' + lv).value = x.title;
      document.getElementById('cm-' + lv).value = x.month;
      document.getElementById('cb-' + lv).value = x.blurb;
      focusId('ct-' + lv);
    },
    stock: (b) => run('add_stock', { p_id: Number(b.dataset.id), p_n: 10 }, 'Added 10.'),
    'del-prize': (b) => run('remove_prize', { p_id: Number(b.dataset.id) }, 'Prize removed'),
    'print-marquee'() {
      document.body.classList.add('printing');
      window.print();
      setTimeout(() => document.body.classList.remove('printing'), 500);
    }
  };

  const FORMS = {
    async signup(f) {
      const d = Object.fromEntries(new FormData(f));
      const r = await run('signup', { p_name: d.name, p_email: d.email, p_postcode: d.postcode, p_optin: !!d.optin });
      if (r.ok) { S.phoneCode = r.code; store.set('msr-code', r.code); f.reset(); render(); }
    },
    async pin(f) {
      const d = Object.fromEntries(new FormData(f));
      const t = TRADERS.find((x) => x.pin === String(d.pin || '').trim());
      if (!t) return U.toast("That PIN doesn't match a shop", true);
      const key = f.dataset.key;
      let ok = false;
      if (key === 'prize') ok = await usePrize(S.phoneCode, t.id);
      else {
        const tid = key.slice(7);
        if (tid !== t.id) return U.toast('This reward can only be used at ' + tName(tid), true);
        ok = await useReward(S.phoneCode, tid);
      }
      if (ok) { S.pinFor = null; render(); }
    },
    desk(f) { deskPick(new FormData(f).get('code')); },
    scan(f) { vendorPick(new FormData(f).get('code')); },
    async newcamp(f) {
      const lv = f.dataset.level, d = Object.fromEntries(new FormData(f));
      const r = await run('post_campaign', { p_title: d.title, p_month: d.month, p_blurb: d.blurb, p_from: lv },
        lv === 'fruitbowl' ? 'Sent to council and the street' : 'Sent to your vendors');
      if (r.ok) { f.reset(); render(); }
    },
    street(f) { return run('street_decide', { p_id: Number(f.dataset.id), p_yes: true, p_extra: new FormData(f).get('extra') || '' }, 'Sent to every vendor'); },
    optin(f) {
      return run('set_trader', { p_id: Number(f.dataset.id), p_shop: S.trader, p_status: 'in', p_offer: new FormData(f).get('offer') || 'Stamp with any purchase' }, "You're in");
    },
    async prize(f) {
      const d = Object.fromEntries(new FormData(f));
      const v = Number(d.value), q = Number(d.stock);
      if (!(v >= 0) || !(q > 0)) return U.toast('Value and how many need to be numbers', true);
      const r = await run('add_prize', { p_name: d.name, p_value: Math.round(v), p_collect_at: d.where, p_stock: Math.round(q), p_added_by: f.dataset.level }, "Prize added. It's on the festival desk now.");
      if (r.ok) { f.reset(); render(); }
    },
    async workshop(f) {
      const fd = new FormData(f), cs = fd.getAll('councils');
      if (!cs.length) return U.toast('Pick at least one council', true);
      const r = await run('add_workshop', { p_name: fd.get('name'), p_date: fd.get('date') || null, p_time: fd.get('time'), p_format: fd.get('format'), p_place: fd.get('where'), p_councils: cs },
        'Workshop sent to ' + cs.length + ' council' + (cs.length > 1 ? 's' : ''));
      if (r.ok) { f.reset(); render(); }
    }
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTS[b.dataset.act];
    if (fn) { if (b.tagName === 'A') e.preventDefault(); fn(b); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    FORMS[f.dataset.form](f);
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-change="trader-pick"]')) {
      S.trader = e.target.value; S.scan = null; store.set('msr-trader', S.trader);
      root.querySelectorAll('input[id^="o-"]').forEach((i) => (i.value = ''));
      render();
    }
  });
  window.addEventListener('hashchange', route);

  // ---- start ----
  const logo = document.getElementById('logo');
  logo.innerHTML = `<img class="fb" src="${esc(C.logoUrl)}" alt="${esc(C.logoAlt)}">`;
  logo.firstChild.onerror = () => { logo.innerHTML = `<span class="fb-text">${esc(C.logoAlt)}</span>`; };
  document.getElementById('siteName').textContent = C.siteName;
  document.getElementById('streetName').textContent = C.streetName;
  document.title = C.siteName + ' – ' + C.streetName.replace(/ Main Street$/, '') + ' (demo)';

  // Colours come from js/config.js. Dark mode keeps its own palette in the CSS.
  const c = C.colors;
  const theme = document.createElement('style');
  theme.textContent = `:root{--brand:${c.purple};--bg:${c.light};--ink:${c.ink};--euc:${c.purple};--sun:${c.yellow};--red:${c.pink}}`;
  document.head.appendChild(theme);

  // /tap/<shop-id> (the QR or NFC sticker), or #tap-<shop-id>: add a stamp, then show Customer.
  let tapShop = null;
  const pm = location.pathname.match(/^\/tap\/([\w-]+)\/?$/);
  const hm = location.hash.match(/^#tap-([\w-]+)$/);
  if (pm) tapShop = pm[1]; else if (hm) tapShop = hm[1];
  if (tapShop) { try { history.replaceState(null, '', '/#customer'); } catch (e) { /* ignore */ } S.view = 'customer'; }

  async function afterFirstLoad() {
    if (!tapShop || !D.ready) return;
    const id = tapShop;
    tapShop = null;
    S.view = 'customer';
    const t = TRADERS.find((x) => x.id === id);
    if (!t) U.toast('That sticker is not part of this demo.', true);
    else if (!(S.phoneCode && byCode(S.phoneCode))) U.toast('Sign up first to collect stamps.', true);
    else await addStamp(S.phoneCode, t.id);
    render();
  }

  D.onChange(scheduleRender);
  route();
  D.start().then(afterFirstLoad);
})();
