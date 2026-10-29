// Customer pages: the sign-up form, the coupon page, the shop list, the Wallet pass, the poster and stickers.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  const P = App.pages;

  const THANKS = `<div class="ticket thanks"><b>Thanks for joining us!</b><br><span class="muted">We're so excited to bring you back to your Main Street.</span></div>`;

  const areaOr404 = (ctx) => d0.area(ctx.params.area);
  const brandFor = (ctx) => (areaOr404(ctx) ? App.brandOf(ctx.params.area) : App.fruitbowlBrand());

  function notFound(msg) {
    return `<div class="panel"><h2>We can't find that page</h2><p>${esc(msg || 'Check the web address and try again.')}</p><p><a class="btn" href="/demo">Go to the demo</a></p></div>`;
  }

  // ---------- sign-up form (/croydon) ----------
  P.signup = {
    brand: brandFor,
    title: () => 'Sign up',
    render(ctx, b) {
      const a = areaOr404(ctx);
      if (!a) return App.custPage(b, notFound('We can\'t find that street.'));
      const me = d0.me();
      const mine = me && me.area === a.id ? `<p class="who" style="margin:0">You're signed up as <b>${esc(me.name)}</b>. <a href="/c/${esc(me.code)}">See your coupon page</a></p>` : '';
      return App.custPage(b, `${mine}
        <h2>${esc(b.welcome)}</h2>
        <p class="muted" style="margin:0">Fill out the form, join the line for the wheel, and spend your coupon on ${esc(b.place)} today.</p>
        <form data-form="signup" data-area="${esc(a.id)}" novalidate>
          <label for="f-name">First name</label><input id="f-name" name="name" required autocomplete="given-name" maxlength="40">
          <label for="f-last">Last name</label><input id="f-last" name="last" required autocomplete="family-name" maxlength="40">
          <label for="f-post">Postcode</label><input id="f-post" name="postcode" inputmode="numeric" maxlength="4" required autocomplete="postal-code">
          <fieldset style="border:0;padding:0;margin:12px 0 0"><legend style="font-weight:700;font-size:15px">Send my coupon by:</legend>
            <div class="row" style="flex-wrap:nowrap"><label class="check" style="margin:4px 14px 0 0"><input type="radio" name="contact" value="email" checked> Email</label>
            <label class="check" style="margin:4px 0 0"><input type="radio" name="contact" value="text"> Text message</label></div></fieldset>
          <label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="120">
          <label for="f-mob">Mobile</label><input id="f-mob" name="mobile" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx" maxlength="14">
          <p class="muted" style="font-size:13px;margin:6px 0 0">Demo only: please use made-up details.</p>
          <label class="check" style="margin-top:12px"><input type="checkbox" name="optin"> Send me news and offers from ${esc(b.place)} (optional)</label>
          <label class="check"><input type="checkbox" name="terms"> <span>I agree to the terms and the <a href="/safety" target="_blank" rel="noopener">safety and privacy page</a></span></label>
          <p class="err" id="su-err" role="alert" hidden></p>
          <p style="margin-top:14px"><button class="btn sun big" type="submit">Sign up</button></p>
        </form>`);
    }
  };

  App.forms.signup = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const fail = (m) => { const e = document.getElementById('su-err'); if (e) { e.textContent = m; e.hidden = false; } };
    const e0 = document.getElementById('su-err'); if (e0) e0.hidden = true;
    if (!d.name.trim() || !d.last.trim()) return fail('Please add your first and last name.');
    if (!/^\d{4}$/.test(d.postcode || '')) return fail('Postcode needs 4 numbers.');
    const text = d.contact === 'text';
    if (text && !/^04\d{8}$/.test((d.mobile || '').replace(/\s/g, ''))) return fail('Mobile needs to look like 04xx xxx xxx.');
    if (!text && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((d.email || '').trim())) return fail('Please add a real email, or choose text message.');
    if (!d.terms) return fail('Please tick the box to agree to the terms.');
    const r = await App.run('signup', {
      p_area: f.dataset.area, p_name: d.name, p_last: d.last, p_contact: d.contact, p_email: d.email || '',
      p_mobile: d.mobile || '', p_postcode: d.postcode, p_optin: !!d.optin
    });
    if (!r.ok) return fail(r.error);
    App.store.set('msr-code', r.code);
    if (r.existing) U.toast("You've already signed up. Here's your code.");
    App.go('/c/' + r.code);
  };

  // ---------- coupon page (/c/CMS-1234) ----------
  function codeCard(s, b) {
    return `<div class="pass"><div class="pass-top"><span>${esc(b.appName)}</span><span>${esc(b.place)}</span></div>
      <div class="pass-name">${esc(s.name)}</div>${U.codeBlock(s.code, d0.codeStyle())}</div>`;
  }
  const expired = (s) => s.use_by && s.use_by < U.today();

  function couponState(s, b) {
    const p = s.prize;
    const via = s.contact === 'text' ? 'texted' : 'emailed';
    if (!p) {
      return `<div class="ticket"><h2>You're in, ${esc(s.name)}! Now join the line for the wheel.</h2>
        <span class="muted">When it's your turn, show this screen to the staff. They'll scan your code.</span></div>${codeCard(s, b)}`;
    }
    if (p.value === 0) {
      // gifts are handed over at the desk and marked as used straight away
      return `<div class="win" role="status"><b style="font-size:24px;line-height:1.15;display:block">You won a ${esc(p.name)}!</b><p>Collect it at the desk now.</p></div>${THANKS}${codeCard(s, b)}`;
    }
    if (s.redeemed) {
      return `<div class="statecard"><h3>Used</h3><p style="margin:0">Used at <b>${esc(d0.shopName(s.redeemed_at))}</b> on ${esc(U.when(s.redeemed_time))}.</p></div>
        ${THANKS}${codeCard(s, b)}`;
    }
    if (expired(s)) {
      return `<div class="statecard bad"><h3>This coupon ran out</h3><p style="margin:0">It ran out on ${esc(U.date(s.use_by))}.</p></div>${codeCard(s, b)}`;
    }
    const pin = App.state.pinOpen === s.code;
    return `<div class="win" role="status"><b style="font-size:24px;line-height:1.15;display:block">You won a ${money(p.value)} coupon!</b>
        <p>Spend it at any participating shop on <b>${esc(b.place)}</b>.</p>
        <p style="font-size:18px"><b>Your coupon code: ${esc(s.code)}</b></p>
        <p>Use it by <b>${esc(U.date(s.use_by))}</b></p>
        <p style="margin-top:12px"><a class="btn" href="/${esc(s.area)}/shops">See the shops</a></p>
        <p style="font-size:14px">We've ${via} it to you too.</p></div>
      ${THANKS}
      ${codeCard(s, b)}
      <div class="couponbox"><b>${money(p.value)} · ${esc(p.name)}</b>
        <p class="muted" style="font-size:13px;margin:4px 0 0">Coupons are used in full. No change is given.</p>
        ${pin
          ? `<form data-form="couponpin" data-code="${esc(s.code)}" class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="pin-in" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" aria-label="Shop PIN" style="flex:1 1 140px;min-width:120px;letter-spacing:.3em"><button class="btn" type="submit" style="flex:0 0 auto">Confirm</button></form>
             <p class="muted" style="font-size:13px;margin:6px 0 0">Staff type their shop's 4-digit PIN. Demo: Main St Espresso is 1111.</p>`
          : `<button class="btn sun" style="width:100%;margin-top:10px" data-act="pin-open" data-code="${esc(s.code)}">Shop: use this coupon</button>`}</div>`;
  }

  P.coupon = {
    brand(ctx) { const s = d0.signup(ctx.params.code); return s ? App.brandOf(s.area) : App.fruitbowlBrand(); },
    title: () => 'Your coupon',
    render(ctx, b) {
      const s = d0.signup(ctx.params.code);
      if (!s) return App.custPage(b, notFound("We can't find that code. Check it and try again."));
      const mine = d0.me();
      return App.custPage(b, `${couponState(s, b)}
        ${mine && mine.code === s.code ? `<p class="small muted" style="text-align:center"><a href="/${esc(s.area)}">Fill out the form for someone else</a> · <a href="/wallet">Phase 2: see the Wallet pass</a></p>` : ''}`);
    }
  };
  App.acts['pin-open'] = (b) => { App.state.pinOpen = b.dataset.code; App.render(); const el = document.getElementById('pin-in'); if (el) el.focus(); };
  App.forms.couponpin = async (f) => {
    const pin = new FormData(f).get('pin');
    const r = await App.run('use_coupon', { p_code: f.dataset.code, p_pin: pin });
    if (r.ok) { App.state.pinOpen = null; U.toast(`Used at ${r.shop}. Take ${money(r.value)} off the bill.`); App.render(); }
  };

  // ---------- the shops (/croydon/shops) ----------
  P.shops = {
    brand: brandFor,
    title: () => 'Participating shops',
    render(ctx, b) {
      const a = areaOr404(ctx);
      if (!a) return App.custPage(b, notFound('We can\'t find that street.'));
      const shops = d0.activeShopsOf(a.id);
      const camps = d0.campaignsOf(a.id).filter(d0.live);
      const offer = (sid) => camps.map((c) => ((c.traders || {})[sid] || {})).filter((t) => t.status === 'in' && t.offer).map((t) => t.offer);
      return App.custPage(b, `<h2>Shops on ${esc(b.place)}</h2>
        <p class="muted" style="margin:0">Spend your coupon at any of these shops. Show your code at the counter.</p>
        ${shops.length ? shops.map((s) => `<div class="camp" style="margin:0"><h3>${esc(s.name)}</h3><div class="muted">${esc(s.type)}</div>
            ${offer(s.id).map((o) => `<p class="offer" style="margin:6px 0 0">${esc(o)}</p>`).join('')}</div>`).join('')
          : '<p class="muted">No shops have joined yet.</p>'}
        ${d0.me() ? `<p><a class="btn ghost" href="/c/${esc(d0.me().code)}">Back to my coupon</a></p>` : ''}`);
    }
  };

  // ---------- phase 2: the Wallet pass (/wallet) ----------
  const homeOf = (s) => s.area;
  function cardsOf(s) {
    const list = [homeOf(s)].concat((s.cards || []).filter((g) => g !== homeOf(s)));
    return list.filter((g) => d0.area(g));
  }
  const cardStamps = (s, g) => (g === homeOf(s) ? U.stampTotal(s) : Number((s.card_stamps || {})[g] || 0));

  function walletView(s) {
    const cards = cardsOf(s);
    const front = cards.includes(App.state.walletFront) ? App.state.walletFront : homeOf(s);
    const fb = App.brandOf(front), on = U.textOn(fb.color), total = cardStamps(s, front), n = Math.min(total, C.stampsForDraw);
    const strips = cards.filter((g) => g !== front).map((g) => {
      const bb = App.brandOf(g);
      return `<button class="wstrip" data-act="wallet-front" data-g="${esc(g)}" style="background:${esc(bb.color)};color:${U.textOn(bb.color)}">${bb.logo ? `<img src="${esc(bb.logo)}" alt="">` : ''}<b>${esc(C.siteName)}</b><span>${esc(bb.place)} · ${Math.min(cardStamps(s, g), 10)}/10</span></button>`;
    }).join('');
    return `<div class="wallet"><h3>Wallet</h3><div class="stub">Bank card</div>${strips}
      <div class="pass" style="background:${esc(fb.color)};color:${on}"><div class="pass-top" style="opacity:1;font-size:17px;font-weight:800;align-items:center"><span style="display:flex;gap:8px;align-items:center">${fb.logo ? `<img src="${esc(fb.logo)}" alt="" style="width:30px;height:30px;object-fit:contain;border-radius:6px">` : ''}${esc(C.siteName)}</span><span style="font-size:11px;font-weight:500">${esc(fb.place)}</span></div>
        <div class="lbl"><span>NAME</span><span>STAMPS</span></div><div class="val"><span>${esc(s.name)}</span><span>${n}/${C.stampsForDraw}</span></div>
        <div class="dots" aria-hidden="true">${Array.from({ length: C.stampsForDraw }, (_, i) => `<span class="dot" style="border-color:${esc(fb.accent)};${i < n ? 'background:' + esc(fb.accent) : ''}"></span>`).join('')}</div>
        <div style="font-size:12px;opacity:.85">${total >= C.stampsForDraw ? "You're in the big draw!" : (C.stampsForDraw - total) + ' more for the big draw'}</div>
        ${U.codeBlock(s.code, d0.codeStyle())}</div>
      ${cards.length > 1 ? `<p class="hint">Tap a card to bring it to the front</p>` : ''}</div>`;
  }

  function redeemBox(key, title, value, s) {
    const open = App.state.pinFor === key;
    return `<div class="voucher"><b>${value ? money(value) + ' · ' : ''}${esc(title)}</b>
      ${open
        ? `<form data-form="walletpin" data-key="${esc(key)}" class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="pin-in" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" aria-label="Shop PIN" style="flex:1 1 140px;min-width:120px;letter-spacing:.3em"><button class="btn" type="submit" style="flex:0 0 auto">Confirm</button></form>
           <p class="muted" style="font-size:13px;margin:6px 0 0">Staff type their shop's 4-digit PIN. Demo: Main St Espresso is 1111.</p>`
        : `<button class="btn sun" data-act="wallet-pin-open" data-key="${esc(key)}">Staff: tap to use this</button>`}</div>`;
  }

  P.wallet = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Wallet pass',
    render() {
      const s = d0.me();
      if (!s) {
        return `<div class="cust"><div class="demo-strip">Demo, not live yet</div><div class="body" id="main"><div class="panel"><h2>Fill out the form first</h2>
          <p>Fill out the form on a phone to get your pass. Then come back here.</p><p><a class="btn sun" href="/${C.demoHomeArea}">Fill out the form</a></p></div></div></div>`;
      }
      const cards = cardsOf(s), others = d0.areas().filter((g) => !cards.includes(g.id));
      const front = cards.includes(App.state.walletFront) ? App.state.walletFront : homeOf(s);
      const ready = [];
      if (s.prize && s.prize.value > 0 && !s.redeemed && !expired(s)) ready.push(redeemBox('prize', 'Coupon: ' + s.prize.name, s.prize.value, s));
      d0.shopsOf(s.area).forEach((sh) => { if (U.rewardsLeft(s, sh.id) > 0) ready.push(redeemBox('reward-' + sh.id, `${C.stampsForReward}-stamp reward from ${sh.name}`, null, s)); });
      const live = d0.campaignsOf(s.area).filter(d0.live);
      return `<div class="cust" style="background:#000">${walletView(s)}
        <div class="body" id="main" style="background:var(--bg);border-radius:22px 22px 0 0;margin-top:-6px">
          <div class="panel"><h3>My Main Street passes</h3><p class="muted">Shop on more than one street? You get a pass for each. They're all ${esc(C.siteName)}, each in that street's colours.</p>
            ${others.length ? `<div class="row"><select id="add-card" style="flex:1">${others.map((g) => `<option value="${esc(g.id)}">${esc(App.brandOf(g.id).place)}</option>`).join('')}</select><button class="btn small" data-act="add-card">Add pass</button></div>`
              : '<p class="muted">You have a pass for every street in the demo.</p>'}
            ${front !== homeOf(s) ? `<p style="margin-top:10px"><button class="btn sun small" data-act="card-stamp" data-g="${esc(front)}">Demo: collect a stamp in ${esc(App.brandOf(front).place)}</button></p>` : ''}</div>
          ${ready.length ? `<div class="panel"><h3>Ready to use</h3><div class="grid" style="gap:10px;margin-top:8px">${ready.join('')}</div></div>` : ''}
          <div class="panel"><h3>Get a stamp after you pay</h3>
            <p>In real life: open your camera and scan the QR code on the counter, or tap your phone on the sticker. About 5 seconds. The shop does nothing.</p>
            <p class="who" style="margin-top:0"><b>${C.stampsForReward} stamps at one shop</b> = that shop's reward.<br><b>${C.stampsForDraw} stamps anywhere</b> = the big draw.</p>
            <p class="muted">Demo: each button does the same as scanning that shop's QR code.</p>
            <div class="row">${d0.activeShopsOf(s.area).map((t) => `<button class="btn ghost small" data-act="tap" data-t="${esc(t.id)}">${esc(t.name)} · ${U.stampsAt(s, t.id)}</button>`).join('')}</div>
            <p class="muted" style="margin-top:10px;font-size:14px">Coming later: link your bank card and stamps land automatically when you pay.</p></div>
          <h3 style="margin:6px 0 0">Happening now</h3>
          ${live.length ? live.map((c) => {
            const ins = d0.activeShopsOf(s.area).filter((t) => ((c.traders || {})[t.id] || {}).status === 'in');
            return `<div class="camp" style="margin:0"><h3>${esc(c.title)}</h3><div class="muted">${esc(c.month)}</div><p>${esc(c.blurb)}</p>${c.street_extra ? `<p><b>${esc(c.street_extra)}</b></p>` : ''}
              ${ins.length ? `<ul class="list">${ins.map((t) => `<li><b>${esc(t.name)}</b> · ${esc(c.traders[t.id].offer || 'Stamp with any purchase')}</li>`).join('')}</ul>` : ''}</div>`;
          }).join('') : '<p class="muted">Nothing on yet.</p>'}
          <p class="small muted" style="text-align:center">In the real version this is a pass in your phone's Wallet, like a concert ticket or boarding pass. Nothing to download.</p>
        </div></div>`;
    }
  };
  App.acts['wallet-front'] = (b) => { App.state.walletFront = b.dataset.g; App.render(); };
  App.acts['wallet-pin-open'] = (b) => { App.state.pinFor = b.dataset.key; App.render(); const el = document.getElementById('pin-in'); if (el) el.focus(); };
  App.acts['add-card'] = async () => {
    const s = d0.me(); if (!s) return;
    const g = document.getElementById('add-card').value;
    const r = await App.run('add_card', { p_code: s.code, p_area: g }, 'Added your ' + App.brandOf(g).place + ' pass');
    if (r.ok) { App.state.walletFront = g; App.render(); }
  };
  App.acts['card-stamp'] = async (b) => {
    const s = d0.me(); if (!s) return;
    const g = b.dataset.g;
    const r = await App.run('card_stamp', { p_code: s.code, p_area: g });
    if (r.ok) U.toast('Stamp in ' + App.brandOf(g).place + '. ' + Math.min(cardStamps(d0.me(), g), 10) + '/10');
  };
  App.acts.tap = async (b) => {
    const s = d0.me();
    if (!s) return U.toast('Fill out the form first to collect stamps.', true);
    await addStamp(s, b.dataset.t);
  };
  async function addStamp(s, shopId) {
    const here = U.stampsAt(s, shopId) + 1, total = U.stampTotal(s) + 1;
    const r = await App.run('give_stamp', { p_code: s.code, p_shop: shopId });
    if (r.ok) {
      U.toast(here % C.stampsForReward === 0 ? 'Reward unlocked at ' + d0.shopName(shopId) + '!'
        : total === C.stampsForDraw ? "You're in the big draw!"
          : 'Stamp from ' + d0.shopName(shopId) + '. ' + Math.min(total, C.stampsForDraw) + '/' + C.stampsForDraw);
    }
    return r;
  }
  App.addStamp = addStamp;
  App.forms.walletpin = async (f) => {
    const s = d0.me(); if (!s) return;
    const sh = await D.rpc('shop_login', { p_pin: new FormData(f).get('pin') }, { reload: false });
    if (!sh.ok) return U.toast(sh.error, true);
    const key = f.dataset.key;
    let r;
    if (key === 'prize') r = await App.run('use_coupon', { p_code: s.code, p_pin: new FormData(f).get('pin') });
    else {
      const target = key.slice(7);
      if (sh.shop !== target) return U.toast('This reward can only be used at ' + d0.shopName(target), true);
      r = await App.run('use_reward', { p_code: s.code, p_shop: target });
    }
    if (r.ok) { App.state.pinFor = null; U.toast('Used at ' + sh.name); App.render(); }
  };

  // ---------- QR stamp link (/tap/espresso) ----------
  P.tap = {
    brand(ctx) { const sh = d0.shop(ctx.params.shop); return sh ? App.brandOf(sh.area) : App.fruitbowlBrand(); },
    render(ctx, b) { return App.custPage(b, '<p>Adding your stamp…</p>'); },
    async after(ctx) {
      if (ctx.done) return;
      ctx.done = true;
      const sh = d0.shop(ctx.params.shop), s = d0.me();
      if (!sh) { U.toast('That sticker is not part of this demo.', true); return App.go('/demo', true); }
      if (!s) { U.toast('Fill out the form first to collect stamps.', true); return App.go('/' + sh.area, true); }
      await addStamp(s, sh.id);
      App.go('/wallet', true);
    }
  };

  // ---------- posters and stickers ----------
  // The marquee poster. Used on the print page and in the guided demo.
  App.posterHtml = (areaId, opts) => {
    const b = App.brandOf(areaId);
    const url = location.origin + '/' + areaId;
    return `<div class="poster" ${opts && opts.id ? `id="${opts.id}"` : ''}>
      <h2>${esc(b.place.toUpperCase())} IS MY MAIN STREET!</h2>
      <div class="sub">Scan, spin and win.</div>
      <div class="qrbig" ${opts && opts.tap ? 'data-act="poster-scan" role="button" tabindex="0" aria-label="Demo: tap the QR code to open the form"' : ''}>${U.qrSvg(url, 6)}</div>
      <div class="cap">Open your phone camera and point it here.</div>
      ${opts && opts.tap ? '<div class="cap"><b>Demo:</b> tap the QR code</div>' : ''}
    </div>`;
  };

  P.poster = {
    brand: (ctx) => (d0.area(ctx.params.area) ? App.brandOf(ctx.params.area) : App.fruitbowlBrand()),
    title: () => 'QR poster',
    render(ctx, b) {
      if (!d0.area(ctx.params.area)) return App.page(notFound());
      return App.page(`<div class="printable" style="max-width:520px;margin:0 auto">${App.posterHtml(ctx.params.area)}</div>
        <p class="noprint" style="text-align:center;margin-top:16px"><button class="btn" data-act="print-page">Print or save as PDF (A3)</button></p>
        <style>@media print{@page{size:A3 portrait;margin:15mm} .poster{height:auto!important} .poster h2{font-size:64px} .poster .qrbig svg{width:420px;height:420px} .poster .sub{font-size:40px} .poster .cap{font-size:22px}}</style>`);
    }
  };
  App.acts['print-page'] = () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); };

  P.stickers = {
    brand(ctx) { const sh = d0.shop(ctx.params.id); const a = sh ? sh.area : ctx.params.id; return d0.area(a) ? App.brandOf(a) : App.fruitbowlBrand(); },
    title: () => 'Counter stickers',
    render(ctx) {
      const sh = d0.shop(ctx.params.id);
      const list = sh ? [sh] : d0.activeShopsOf(ctx.params.id);
      if (!list.length) return App.page(notFound('There are no shops to print stickers for yet.'));
      return App.page(`<div class="printable"><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px">
        ${list.map((s) => `<div class="sticker"><div style="font-weight:800;font-size:20px">${esc(s.name)}</div>
          <div style="margin:8px 0">${U.qrSvg(location.origin + '/tap/' + s.id, 5)}</div>
          <div style="font-weight:700">Paid? Scan to get your stamp.</div><div class="muted" style="font-size:12px">Open your phone camera, or tap the sticker.</div></div>`).join('')}</div></div>
        <p class="noprint" style="margin-top:16px"><button class="btn" data-act="print-page">Print or save as PDF</button></p>`);
    }
  };
})();
