// The live customer pages: sign-up form, coupon page, shops list, and the safety page.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  if (!D.live) return;
  const LP = App.livePages, LB = App.live;

  const areaOf = (ctx) => ctx.area || C.demoHomeArea;
  // "Coupons work from Tue 10 Nov until Mon 30 Nov." (read from the event's key details)
  LB.windowText = (ev) => (!ev || !ev.use_by ? '' : ev.valid_from ? `Use coupons between ${U.date(ev.valid_from)} and ${U.date(ev.use_by)}.` : `Use coupons by ${U.date(ev.use_by)}.`);
  LB.councilName = (a) => (a && a.council_area ? a.council_area + ' City Council' : 'Council');
  const brandFor = (ctx) => (d0.area(areaOf(ctx)) ? App.brandOf(areaOf(ctx)) : LB.fb());
  const THANKS = `<div class="ticket thanks"><b>Thanks for joining us!</b><br><span class="muted">We're so excited to bring you back to your Main Street.</span></div>`;
  const ls = { get: (k) => App.store.get(k), set: (k, v) => App.store.set(k, v) };
  const FRIENDLY = (what) => `<details class="friendly"><summary>If a shop isn't sure how this works</summary>
    <p>This is brand new, so some shops may not have set up yet. That's okay. Please be kind, and feel free to spend your ${what} at another shop on the street instead.</p></details>`;

  // ---------- 1. the sign-up page ----------
  LP.signup = {
    brand: brandFor,
    title: () => 'Sign up',
    async after(ctx) {
      // A saved code on this phone: check it still exists. If the sign-up was removed, forget it so nobody is told they have signed up.
      const code = ls.get('msr-code'), tk = ls.get('msr-token');
      if (!code || !tk || ctx.checkedSaved) return;
      ctx.checkedSaved = true;
      const local = LB.sq.find(code);
      if (local && local.status === 'pending') return;                 // still waiting to be sent: it is real
      const r = await D.fetchPass(code, tk);
      if (!r && !D.offline) { ls.set('msr-code', ''); ls.set('msr-token', ''); App.render(); }
    },
    render(ctx, b) {
      const a = d0.area(areaOf(ctx));
      if (!a) return App.custPage(b, '<h2>We can\'t find that street</h2><p>Check the web address and try again.</p>');
      const code = ls.get('msr-code'), tk = ls.get('msr-token');
      const again = code ? `<p class="who" style="margin:0">You've already signed up on this phone. <a href="/c/${esc(code)}${tk ? '?k=' + esc(tk) : ''}">See my code</a></p>` : '';
      const closed = a.status !== 'live';
      return App.custPage(b, `${again}
        <h2>${esc(b.welcome)}</h2>
        <p class="muted" style="margin:0">One sign-up per email and mobile number.${LB.windowText(d0.eventsOf(a.id).slice(-1)[0]) ? ' ' + esc(LB.windowText(d0.eventsOf(a.id).slice(-1)[0])) : ''}</p>
        ${closed ? '<div class="statecard bad"><h3>Sign-ups are not open yet</h3><p style="margin:0">Please come back soon.</p></div>' : ''}
        <form data-form="lsignup" data-area="${esc(a.id)}" novalidate>
          <label for="f-name">First name</label><input id="f-name" name="name" required autocomplete="given-name" maxlength="40">
          <label for="f-last">Last name</label><input id="f-last" name="last" required autocomplete="family-name" maxlength="40">
          <label for="f-post">Postcode</label><input id="f-post" name="postcode" inputmode="numeric" maxlength="4" required autocomplete="postal-code">
          <label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email" maxlength="120">
          <label for="f-mob">Mobile</label><input id="f-mob" name="mobile" inputmode="tel" required autocomplete="tel" placeholder="04xx xxx xxx" maxlength="14">
          <fieldset style="border:0;padding:0;margin:14px 0 0"><legend style="font-weight:700;font-size:15px">Send my coupon by:</legend>
            <div class="row" style="flex-wrap:nowrap"><label class="check" style="margin:4px 14px 0 0"><input type="radio" id="f-c-email" name="contact" value="email" checked> Email</label>
            <label class="check" style="margin:4px 0 0"><input type="radio" id="f-c-text" name="contact" value="text"> Text message</label></div></fieldset>
          <label class="check" style="margin-top:14px"><input type="checkbox" id="f-optin" name="optin"> <span>I agree to receive news and updates from ${esc(LB.councilName(a))}, the ${esc(b.place)} Traders Association, or related parties (optional). We never sell your details.</span></label>
          <label class="check"><input type="checkbox" id="f-terms" name="terms"> <span>I agree to the terms and the <a href="${App.mainOrigin()}/safety" target="_blank" rel="noopener">safety and privacy page</a>. If you're under 18, a parent or guardian must tick this for you.</span></label>
          <p class="err" id="su-err" role="alert" hidden></p>
          <p style="margin-top:14px"><button class="btn sun big" type="submit" ${closed ? 'disabled' : ''}>Sign up</button></p>
        </form>`);
    }
  };

  // Shared by the phone form and the desk's staff sign-up.
  LB.checkSignup = (d) => {
    if (!String(d.name || '').trim() || !String(d.last || '').trim()) return 'Please add the first and last name.';
    if (!/^\d{4}$/.test(d.postcode || '')) return 'Postcode needs 4 numbers.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email || '').trim())) return 'Please add a real email.';
    if (!/^04\d{8}$/.test(String(d.mobile || '').replace(/\s/g, ''))) return 'Mobile needs to look like 04xx xxx xxx.';
    if (!d.terms) return 'Please tick the box to agree to the terms.';
    return '';
  };
  LB.signupArgs = (area, d) => ({ p_area: area, p_name: d.name, p_last: d.last, p_email: d.email, p_mobile: d.mobile, p_postcode: d.postcode, p_contact: d.contact || 'email', p_optin: !!d.optin, p_terms: !!d.terms });

  App.forms.lsignup = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const fail = (m) => { const e = document.getElementById('su-err'); if (e) { e.textContent = m; e.hidden = false; } };
    const bad = LB.checkSignup(d);
    if (bad) return fail(bad);
    const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
    // Saved on this phone first, then sent. With no signal it still works and sends itself later.
    const r = await LB.sq.submit(f.dataset.area, d);
    if (btn) btn.disabled = false;
    if (r.state === 'error') return fail(r.error);
    if (r.state === 'existing') return App.go('/c/' + r.code);
    App.go('/c/' + r.code + '?k=' + r.token);
  };

  // ---------- 2. the coupon page ----------
  const codeBlock = (code) => `<div class="pass"><div class="qr" role="img" aria-label="QR code for ${esc(code)}">${U.qrSvg(code, 5)}</div>
      <div class="pass-num" style="font-size:64px">${esc(String(code).replace(/^CMS-/, ''))}</div><div class="pass-code">${esc(code)}</div></div>`;

  function phoneUse(s, ctx) {
    const ph = ctx.ph || {}, shops = d0.shops().filter((x) => x.area === s.area && x.claimed).slice().sort((a, b) => a.name.localeCompare(b.name));
    if (ph.done) return `<div class="statecard good" role="status"><h3><span class="dotg g"></span>Done! Take ${money(ph.done.value)} off their bill.</h3><p style="margin:0" class="muted">Used at ${esc(ph.done.shop)}.</p></div>`;
    if (!ph.step) return `<p style="margin:12px 0 0"><button class="btn ghost" style="width:100%" data-act="lphone-open">Shop: use this coupon</button></p>`;
    if (ph.step === 1) {
      // No shop has signed up yet: say when to check back, instead of an empty list.
      if (!shops.length) {
        const note = (App.brandOf(s.area).shopsNote || '').trim() || 'No shop has set up its account yet. Please ask the staff at the shop to set up.';
        return `<div class="panel" style="margin-top:12px"><h3>Which shop are you?</h3><p style="margin:0 0 10px">${esc(note)}</p>
          <div class="row"><button class="btn ghost" type="button" data-act="lphone-cancel">Close</button></div></div>`;
      }
      return `<div class="panel" style="margin-top:12px"><h3>Which shop are you?</h3>
        <form data-form="lphone1"><label for="ph-shop" class="sr">Shop</label><select id="ph-shop" name="shop" required><option value="">Choose your shop…</option>${shops.map((x) => `<option value="${esc(x.id)}" ${ph.shop === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <div class="row" style="margin-top:10px"><button class="btn" type="submit">Next</button><button class="btn ghost" type="button" data-act="lphone-cancel">Cancel</button></div></form></div>`;
    }
    const sh = d0.shop(ph.shop);
    return `<div class="panel" style="margin-top:12px"><h3>Enter your shop code</h3><p class="muted" style="margin:0 0 6px">${esc(sh ? sh.name : '')}'s 6-digit shop code.</p>
      <form data-form="lphone2"><label for="ph-code" class="sr">Shop code</label><input id="ph-code" name="code" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••••" style="letter-spacing:.35em;font-size:26px;text-align:center">
      <p class="err" id="ph-err" role="alert" ${ph.err ? '' : 'hidden'}>${esc(ph.err || '')}</p>
      <div class="row" style="margin-top:10px"><button class="btn" type="submit" ${ph.saving ? 'disabled' : ''}>${ph.saving ? 'Saving…' : 'Use coupon'}</button><button class="btn ghost" type="button" data-act="lphone-cancel">Cancel</button></div></form></div>`;
  }

  function couponState(s, ctx, b) {
    const p = s.prize, via = s.contact === 'text' ? 'texted' : 'emailed';
    if (!p) {
      return `<div class="ticket"><h2>You're in, ${esc(s.name)}! Now join the line for the wheel.</h2>
        <span class="muted">When it's your turn, show this screen to the staff. They'll scan your code.</span></div>${codeBlock(s.code)}`;
    }
    if (Number(p.value) === 0) {
      return `<div class="win" role="status"><b style="font-size:24px;line-height:1.15;display:block">You won a ${esc(p.name)}!</b><p>Collect it at the desk now.</p>${p.note ? `<p>${esc(p.note)}</p>` : ''}</div>${THANKS}`;
    }
    if (s.redeemed) {
      return `<div class="statecard"><h3>Used</h3><p style="margin:0">Used at <b>${esc(d0.shopName(s.redeemed_at))}</b>, ${esc(U.when(s.redeemed_time))}.</p></div>${THANKS}`;
    }
    if (s.use_by && s.use_by < U.today()) {
      return `<div class="statecard bad"><h3>This coupon has run out</h3><p style="margin:0">It ran out on ${esc(U.date(s.use_by))}.</p></div>`;
    }
    const notYet = !!(s.valid_from && s.valid_from > U.today());
    return `<div class="win" role="status"><b style="font-size:24px;line-height:1.15;display:block">You won a ${money(p.value)} coupon!</b>
        ${notYet ? `<p><b>You can't use it yet.</b> Use it between <b>${esc(U.date(s.valid_from))}</b> and <b>${esc(U.date(s.use_by))}</b>, at any shop on <b>${esc(b.place)}</b>.</p>` : `<p>Spend it at any shop on <b>${esc(b.place)}</b>.</p>`}
        ${p.note ? `<p>${esc(p.note)}</p>` : ''}
        <p style="font-size:18px;margin-top:10px">Your coupon code:</p><div class="bigcode">${esc(s.code)}</div>
        ${notYet ? '' : s.valid_from ? `<p>Use it between <b>${esc(U.date(s.valid_from))}</b> and <b>${esc(U.date(s.use_by))}</b></p>` : `<p>Use it by <b>${esc(U.date(s.use_by))}</b></p>`}
        <p style="margin-top:12px"><a class="btn" href="/shops">See the shops</a></p>
        <p style="font-size:14px">We've ${via} it to you.</p></div>
      <p class="muted" style="font-size:13px;margin:0">One coupon per bill. Used in full: no change or cash back.</p>
      ${FRIENDLY('coupon')}
      ${THANKS}
      ${codeBlock(s.code)}
      ${notYet ? '' : phoneUse(s, ctx)}`;
  }

  // A sign-up that is saved on this phone but not sent yet (no signal): show their number now.
  function pendingView(e, b) {
    return `<div class="ticket"><h2>You're in, ${esc(e.args.p_name)}! Now join the line for the wheel.</h2>
      <span class="muted">Saved on this phone. We'll finish saving it by itself when you have signal. Keep this page.</span></div>${codeBlock(e.code)}
      <p class="small muted">If the staff can't find your number yet, ask them to try again in a minute.</p>`;
  }

  LP.coupon = {
    brand(ctx) { const s = d0.signup(ctx.params.code); return s ? App.brandOf(s.area) : brandFor(ctx); },
    title: () => 'Your coupon',
    async after(ctx) {
      if (ctx.fetched) return;
      ctx.fetched = true;
      if (LB.waiting()) LB.offlineKick();
      if (ctx.params.token) await D.fetchPass(ctx.params.code, ctx.params.token);
      ctx.loaded = true;
      App.render();
      if (ctx.params.token) ctx.stop = D.watchPass(ctx.params.code, ctx.params.token);
    },
    render(ctx, b) {
      if (!ctx.loaded) return App.custPage(b, '<p>Loading your coupon…</p>');
      const s = d0.signup(ctx.params.code);
      const net = D.offline ? '<p class="small muted" role="status">Can\'t reach the system right now. This will update by itself.</p>' : '';
      const local = LB.sq.find(ctx.params.code);
      if (!s && local && local.status === 'pending') return App.custPage(b, pendingView(local, b) + LB.syncBar());
      if (!s && local && local.status === 'failed') return App.custPage(b, `<div class="statecard bad"><h3>We couldn't save your sign-up</h3><p style="margin:0">${esc(local.error || 'Please ask the staff for help.')}</p></div>`);
      if (!s) {
        // A link that has its secret but finds nothing: the sign-up was removed. Say so (and forget it on this phone).
        if (ctx.params.token) {
          if (ls.get('msr-code') === ctx.params.code) { ls.set('msr-code', ''); ls.set('msr-token', ''); }
          return App.custPage(b, `<div class="statecard bad"><h3>We can't find this coupon</h3><p style="margin:0">It may have been removed. You can sign up again, or ask the staff at the desk.</p></div>
            <p><a class="btn big" href="/">Sign up</a></p>`);
        }
        // Someone who signed up twice sees their code, but not the secret link.
        const code = ctx.params.code;
        return App.custPage(b, `<div class="ticket"><h2>You've already signed up.</h2><span class="muted">Show this code to the staff at the wheel. When you win, we'll send your coupon by email or text.</span></div>${codeBlock(code)}
          <p class="small muted">Can't find your link? Ask the staff at the desk.</p>`);
      }
      return App.custPage(b, `${couponState(s, ctx, b)}${net}${LB.syncBar()}`);
    }
  };

  App.acts['lphone-open'] = () => { App.ctx.ph = { step: 1 }; App.render(); };
  App.acts['lphone-cancel'] = () => { App.ctx.ph = {}; App.render(); };
  App.forms.lphone1 = (f) => {
    const shop = new FormData(f).get('shop');
    if (!shop) return;
    App.ctx.ph = { step: 2, shop }; App.render(); const el = document.getElementById('ph-code'); if (el) el.focus();
  };
  App.forms.lphone2 = async (f) => {
    const ctx = App.ctx, ph = ctx.ph;
    const code = String(new FormData(f).get('code') || '').trim();
    if (!/^\d{6}$/.test(code)) { ph.err = 'The shop code is 6 numbers.'; return App.render(); }
    ph.saving = true; ph.err = ''; App.render();
    const r = await LB.save('use_on_phone', { p_code: ctx.params.code, p_token: ctx.params.token, p_shop: ph.shop, p_shop_code: code });
    ph.saving = false;
    if (!r.ok) { ph.err = r.error; return App.render(); }
    ctx.ph = { done: { value: r.value, shop: r.shop } };
    await D.fetchPass(ctx.params.code, ctx.params.token);
    App.render();
  };

  // ---------- 3. the shops list ----------
  const shopRows = (area, q) => {
    const needle = String(q || '').trim().toLowerCase();
    const list = d0.shops().filter((s) => s.area === area && (!needle || (s.name + ' ' + s.type).toLowerCase().includes(needle)))
      .slice().sort((a, b) => a.name.localeCompare(b.name));
    return list.length
      ? list.map((s) => `<div class="camp" style="margin:0"><h3>${esc(s.name)}</h3><div class="muted">${esc(s.type)}</div></div>`).join('')
      : '<p class="muted">No shops match that.</p>';
  };
  LP.shops = {
    brand: brandFor,
    title: () => 'Shops',
    render(ctx, b) {
      const a = areaOf(ctx), mine = ls.get('msr-code');
      const win = LB.windowText(d0.eventsOf(a).slice(-1)[0]);
      return App.custPage(b, `<h2>Spend your coupon at any shop on ${esc(b.place)}</h2>
        ${win ? `<p class="muted" style="margin:0">${esc(win)}</p>` : ''}
        <label for="shop-q" class="sr">Search shops</label><input id="shop-q" type="search" placeholder="Search shops" data-input="shop-search" autocomplete="off">
        <div id="shoplist" class="grid" style="gap:10px">${shopRows(a, App.state.shopQ)}</div>
        <p class="muted" style="margin:0"><b>Shop not listed?</b> Every shop on ${esc(b.place)} takes coupons.</p>
        ${FRIENDLY('coupon')}
        ${mine ? `<p><a class="btn ghost" href="/c/${esc(mine)}${ls.get('msr-token') ? '?k=' + esc(ls.get('msr-token')) : ''}">Back to my coupon</a></p>` : ''}`);
    }
  };
  App.changes['shop-search'] = (el) => {
    App.state.shopQ = el.value;
    const box = document.getElementById('shoplist');
    if (box) box.innerHTML = shopRows(App.ctx.area, el.value);
  };

  // ---------- 4. safety and privacy ----------
  const ph = (t) => `<mark>[${esc(t)}]</mark>`;
  LP.safety = {
    brand: LB.fb,
    title: () => 'Safety and privacy',
    render() {
      const sec = (n, h, body) => `<h2 style="margin-top:22px">${n}. ${h}</h2>${body}`;
      return `${LB.band('Safety and privacy', LB.fb(), [])}<main class="wrap" id="main" style="max-width:820px">
        <p class="who" style="margin-top:0"><b>${ph('to be checked by a lawyer')}</b></p>
        <h1 style="font-size:32px;margin:14px 0 6px">Safety and privacy</h1>
        <p class="muted">The short version: we only collect what we need, we keep it in Australia, we never sell it, and you can ask us to delete it.</p>
        ${sec(1, 'Who runs it', `<p>My Main Street is built and run by Georgina Fiske, trading as ${esc(C.runBy)}, sole trader, ABN 97 221 925 993, Melbourne. It's delivered with ${esc(C.homeCompany)} for Croydon Main Street.</p>`)}
        ${sec(2, 'What we collect', `<p>Your first and last name, email and mobile, postcode, your coupon, where and when it was used, and whether you want news. We send you messages through whichever one you choose at sign-up.</p>`)}
        ${sec(3, 'Why', `<p>To send your coupon, check it at shops, pay shops back, and (only if you say yes) send you news and updates from ${esc('Maroondah City Council')}, the Traders Association, or related parties. ${ph('lawyer to confirm this wording')}</p>`)}
        ${sec(4, 'Where it\'s stored', `<ul><li>Database: Sydney, Australia (Supabase)</li><li>Website: Netlify</li><li>Emails: Resend</li><li>Texts: ClickSend</li></ul>`)}
        ${sec(5, 'Who can see it', `<p>${esc(C.runBy)}, ${esc(C.homeCompany)} and the Croydon Main Street Traders Association, for Croydon only. Shops only see a coupon when it's shown to them.</p>`)}
        ${sec(6, 'We never sell your data', `<p>Never. Not to anyone.</p>`)}
        ${sec(7, 'How long we keep it', `<p>Until you unsubscribe or ask us to delete it. ${ph('lawyer to confirm this wording')}</p>`)}
        ${sec(8, 'Your choices', `<p>Unsubscribe from any email, reply STOP to any text, or email hey@chaosmaster.com.au to see or delete your data.</p>`)}
        ${sec(9, 'How we keep it safe', `<p>A secure connection (HTTPS), staff logins, and each area only sees its own data.</p>`)}
        ${sec(10, 'Under 18s', `<p>Anyone under 18 needs a parent or guardian's OK to sign up and spin.</p>`)}
        ${sec(11, 'Coupon terms', `<p>One coupon per bill. Coupons are used in full: no change or cash back. Use it before the use-by date. It can be spent at any participating Croydon Main Street shop.</p>`)}
        ${sec(12, 'Contact', `<p><a href="mailto:hey@chaosmaster.com.au">hey@chaosmaster.com.au</a></p>`)}
      </main>${LB.footer()}`;
    }
  };
})();
