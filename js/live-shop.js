// The live shop pages: claim a shop account (once), log in, see the shop code, check and use coupons.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  if (!D.live) return;
  const LP = App.livePages, LB = App.live;
  const focusId = (id) => { const el = document.getElementById(id); if (el) el.focus(); };
  const areaOf = (ctx) => ctx.area || C.demoHomeArea;
  const brandFor = (ctx) => (d0.area(areaOf(ctx)) ? App.brandOf(areaOf(ctx)) : LB.fb());

  // call a Netlify function
  LB.fn = async (name, body, withLogin) => {
    try {
      const headers = { 'content-type': 'application/json' };
      if (withLogin) headers.authorization = 'Bearer ' + ((await D.token()) || '');
      const r = await fetch('/.netlify/functions/' + name, { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      return r.ok ? j : { ok: false, error: j.error || 'Something went wrong. Please try again.' };
    } catch (e) { return { ok: false, network: true, error: 'No connection. Please try again.' }; }
  };

  const codeCard = (code) => `<div class="panel shopcode"><div class="muted">Your shop code</div>
      <div class="bigcode" id="shopcode-text">${esc(code)}</div>
      <p class="row" style="justify-content:center"><button class="btn small" data-act="lshop-copy" data-code="${esc(code)}">Copy</button></p>
      <div class="qr" role="img" aria-label="QR code of your shop code" style="background:#fff;border-radius:8px;padding:8px;width:fit-content;margin:8px auto">${U.qrSvg(code, 4)}</div>
      <p class="muted small" style="margin:0">Print this or stick it by the till. Staff type this code on a customer's phone to use their coupon.</p></div>`;
  App.acts['lshop-copy'] = async (b) => {
    try { await navigator.clipboard.writeText(b.dataset.code); U.toast('Copied.'); } catch (e) { U.toast('Select the code and copy it.', true); }
  };

  // ---------- claim your shop (one time) ----------
  LP.shopclaim = {
    brand: brandFor,
    title: () => 'Set up your shop',
    render(ctx, b) {
      const S = App.state, cl = S.claim || (S.claim = { step: 1 });
      const area = areaOf(ctx), a = d0.area(area);
      if (!a) return LB.page('<div class="panel"><h2>We can\'t find that street</h2></div>');
      let body;
      if (cl.done) {
        body = `<h2>You're in, ${esc(cl.done.name)}!</h2><p>Your shop account is ready, and you're logged in.</p>${codeCard(cl.done.code)}
          <p style="margin-top:14px"><a class="btn big" href="/shop">Go to my shop</a></p>`;
      } else if (cl.step === 1) {
        const q = (S.claimQ || '').toLowerCase();
        const list = d0.shops().filter((s) => s.area === area && !s.claimed && (!q || (s.name + ' ' + s.type).toLowerCase().includes(q))).slice().sort((x, y) => x.name.localeCompare(y.name));
        body = `<h2>Set up your shop</h2><p class="muted">Takes about a minute. Find your shop, then set a password. You'll get a shop code that lets staff use coupons.</p>
          <label for="claim-q" class="sr">Search for your shop</label><input id="claim-q" type="search" placeholder="Search for your shop" data-input="claim-search" value="${esc(S.claimQ || '')}" autocomplete="off">
          <div id="claimlist" class="grid" style="gap:8px;margin-top:10px">${claimRows(list)}</div>
          <p style="margin-top:14px"><button class="btn ghost" data-act="lclaim-new">My shop isn't listed: add it</button></p>
          <p class="small muted">Already set up? <a href="/login">Log in</a>.</p>`;
      } else {
        const sh = cl.shop ? d0.shop(cl.shop) : null;
        body = `<h2>${sh ? esc(sh.name) : 'Add your shop'}</h2><p class="muted">Your details, and a password for next time.</p>
          <form data-form="lclaim" novalidate>
            ${sh ? '' : `<label for="cl-sname">Shop name</label><input id="cl-sname" name="shopname" maxlength="60"><label for="cl-stype">Type of shop (cafe, florist…)</label><input id="cl-stype" name="shoptype" maxlength="30">`}
            <label for="cl-name">Your name</label><input id="cl-name" name="name" maxlength="80" autocomplete="name">
            <label for="cl-email">Email</label><input id="cl-email" name="email" type="email" maxlength="120" autocomplete="username">
            <label for="cl-mob">Mobile</label><input id="cl-mob" name="mobile" inputmode="tel" placeholder="04xx xxx xxx" maxlength="14" autocomplete="tel">
            <label for="cl-pw">Create a password (8 or more characters)</label><input id="cl-pw" name="password" type="password" minlength="8" autocomplete="new-password">
            <p class="err" id="cl-err" role="alert" hidden></p>
            <div class="row" style="margin-top:14px"><button class="btn big" type="submit" ${cl.saving ? 'disabled' : ''}>${cl.saving ? 'Setting up…' : 'Set up my shop'}</button><button class="btn ghost" type="button" data-act="lclaim-back">Back</button></div></form>`;
      }
      return App.custPage(b, body);
    }
  };
  const claimRows = (list) => (list.length ? list.map((s) => `<button class="btn ghost" style="justify-content:space-between;text-align:left" data-act="lclaim-pick" data-id="${esc(s.id)}"><span>${esc(s.name)}</span><span class="muted">${esc(s.type)}</span></button>`).join('')
    : '<p class="muted">No unclaimed shops match. If yours is set up already, log in. Otherwise add it below.</p>');
  App.changes['claim-search'] = (el) => {
    App.state.claimQ = el.value;
    const q = el.value.toLowerCase(), area = areaOf(App.ctx);
    const box = document.getElementById('claimlist');
    if (box) box.innerHTML = claimRows(d0.shops().filter((s) => s.area === area && !s.claimed && (!q || (s.name + ' ' + s.type).toLowerCase().includes(q))).slice().sort((x, y) => x.name.localeCompare(y.name)));
  };
  App.acts['lclaim-pick'] = (b) => { App.state.claim = { step: 2, shop: b.dataset.id }; App.render(); focusId('cl-name'); };
  App.acts['lclaim-new'] = () => { App.state.claim = { step: 2, shop: null }; App.render(); focusId('cl-sname'); };
  App.acts['lclaim-back'] = () => { App.state.claim = { step: 1 }; App.render(); };
  App.forms.lclaim = async (f) => {
    const S = App.state, cl = S.claim, d = Object.fromEntries(new FormData(f));
    const err = (m) => { const e = document.getElementById('cl-err'); if (e) { e.textContent = m; e.hidden = false; } };
    if (!cl.shop && !String(d.shopname || '').trim()) return err('Please add your shop name.');
    if (!String(d.name || '').trim()) return err('Please add your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email || '').trim())) return err('Please add a real email.');
    if (!/^04\d{8}$/.test(String(d.mobile || '').replace(/\s/g, ''))) return err('Mobile needs to look like 04xx xxx xxx.');
    if (String(d.password || '').length < 8) return err('Your password needs 8 or more characters.');
    cl.saving = true; App.render();
    const r = await LB.fn('claim-shop', { area: areaOf(App.ctx), shop: cl.shop, newShop: cl.shop ? null : { name: d.shopname, type: d.shoptype }, name: d.name, email: d.email, mobile: d.mobile, password: d.password });
    cl.saving = false;
    if (!r.ok) { App.render(); return err(r.error); }
    await D.signInPassword(d.email, d.password);
    S.claim = { done: { name: r.name, code: r.code } };
    App.render();
  };

  // ---------- the shop portal ----------
  function resultCard(res, shopName) {
    if (!res) return '';
    const bad = (t, m) => `<div class="statecard bad" role="status"><h3><span class="dotg r"></span>${t}</h3>${m ? `<p style="margin:0">${m}</p>` : ''}</div>`;
    switch (res.state) {
      case 'missing': return bad("We can't find this code. Check it and try again.");
      case 'noprize': return bad('This code has no coupon yet.', `${esc(res.name)} hasn't spun the wheel yet.`);
      case 'small': return bad('This is a small prize', 'It is collected at the desk. There is no coupon to use.');
      case 'used': return bad(`Already used at ${esc(res.at)}, ${esc(res.when)}`);
      case 'expired': return bad(`This coupon ran out on ${esc(res.use_by)}`);
      case 'notyet': return bad(`Not valid yet. It works from ${esc(res.valid_from)}`, `Do not accept it today. It can be used from ${esc(res.valid_from)} until ${esc(res.use_by)}.`);
      case 'otherarea': return bad('This coupon is for a different street');
      case 'valid': return `<div class="statecard good" role="status"><h3><span class="dotg g"></span>Valid. ${money(res.value)} coupon · ${esc(res.name)} ${esc(res.last)}. · Use by ${esc(res.use_by)}.</h3>
          <p class="muted" style="margin:0 0 10px">One coupon per bill. Used in full: no change or cash back.</p>
          <button class="btn big" data-act="lshop-use" data-code="${esc(res.code)}" ${App.state.shopSaving ? 'disabled' : ''}>${App.state.shopSaving ? 'Saving…' : 'Use it now'}</button></div>`;
      default: return '';
    }
  }

  LP.shop = {
    brand(ctx) { const s = LB.myShop(); return s && s.area && d0.area(s.area) ? App.brandOf(s.area) : brandFor(ctx); },
    title: () => 'Shop',
    async after(ctx) {
      if (LB.role() !== 'shop' || ctx.loaded) return;
      ctx.loaded = true;
      const [me, sm] = await Promise.all([D.read('shop_me'), D.read('shop_summary')]);
      App.state.shopMe = me; App.state.shopSum = sm;
      App.render();
    },
    render(ctx, b) {
      const S = App.state, role = LB.role();
      if (!D.user || role !== 'shop') {
        const other = D.user && role;
        return `${LB.band('Shop', b, [])}<main class="wrap" id="main" style="max-width:560px"><div class="panel">
          ${other ? `<h2>This is a shop page</h2><p>You're logged in as <b>${esc(D.user.email)}</b>, which isn't a shop account.</p><p><button class="btn" data-act="logout">Log out</button></p>`
            : `<h2>Shop log in</h2>
              <form data-form="loginpw" data-next="/shop"><label for="lg-email">Email</label><input id="lg-email" name="email" type="email" autocomplete="username" required>
              <label for="lg-pw">Password</label><input id="lg-pw" name="password" type="password" autocomplete="current-password" required>
              <p class="err" id="lg-err" role="alert" hidden></p><p style="margin-top:12px"><button class="btn big" type="submit">Log in</button></p></form>
              <p class="small muted" style="margin-top:14px">Forgot your password? <a href="#" data-act="login-link">Email me a link</a>.</p>
              <p style="margin-top:6px"><a class="btn ghost" href="/shop/claim">First time? Set up your shop</a></p>`}
        </div></main>${LB.footer()}`;
      }
      const me = S.shopMe;
      if (!me) return `${LB.band('Shop', b, [])}<main class="wrap" id="main"><p>Loading your shop…</p></main>${LB.footer()}`;
      const sm = S.shopSum || { used: [] }, used = sm.used || [], total = used.reduce((a, x) => a + Number(x.value || 0), 0);
      const chk = S.shopCheck;
      const justDone = S.shopDone && chk && chk.code === S.shopDone.code ? S.shopDone : null;
      return `${LB.band(me.name, b, [['/shop', 'My shop', true]])}<main class="wrap" id="main">
        ${LB.netBanner('the coupon code and shop')}
        <div class="grid two">
          <section class="panel"><h2>Type or scan the coupon code</h2>
            <form data-form="lshopcheck"><label for="shop-code" class="sr">Coupon code</label>
              <input id="shop-code" name="code" placeholder="CMS-4821 or just 4821" autocomplete="off" style="font-size:26px;padding:16px" value="${esc(S.shopCodeIn || '')}">
              <div class="row" style="margin-top:10px"><button class="btn" type="submit">Check it</button><button class="btn sun" type="button" data-act="lshop-scan">Scan with the camera</button></div></form>
            <p class="muted small">A barcode scanner can type into the box. It sends when it presses Enter.</p>
            ${justDone ? `<div class="statecard good" role="status"><h3><span class="dotg g"></span>Done! Take ${money(justDone.value)} off their bill.</h3><p class="muted" style="margin:0">Saved against ${esc(me.name)}.</p>
                <p style="margin:10px 0 0"><button class="btn" data-act="lshop-next">Next customer</button></p></div>` : resultCard(chk && chk.res, me.name)}
          </section>
          <section>${codeCard(me.code)}
            <p class="small muted" style="margin:8px 0 0"><button class="btn ghost small" data-act="lshop-reset">Reset my shop code</button></p></section>
        </div>
        <section class="panel gap"><h3>Your coupons</h3>
          <div class="stats" style="margin:6px 0 12px"><div class="stat"><b>${used.length}</b><span>coupons used here</span></div><div class="stat"><b>${money(total)}</b><span>total value</span></div></div>
          ${used.length ? `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Customer</th><th>Value</th><th>When</th></tr></thead><tbody>${used.map((x) => `<tr><td>${esc(x.code)}</td><td>${esc(x.name)} ${esc(x.last)}.</td><td>${money(x.value)}</td><td>${esc(U.when(x.at))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No coupons used here yet.</p>'}
          <p class="muted small" style="margin-top:10px">You only see your own shop's coupons. Fruitbowl uses these to pay you back.</p></section>
        <p class="muted small">Another way: on a customer's own phone, tap "Shop: use this coupon", choose your shop, and type your shop code.</p>
      </main>${LB.footer()}`;
    }
  };

  const doCheck = async (raw) => {
    const S = App.state, code = U.normCode(raw);
    S.shopCodeIn = code; S.shopDone = null;
    if (!code) { S.shopCheck = null; return App.render(); }
    const res = await D.read('shop_check', { p_code: code });
    S.shopCheck = { code, res: res || (D.offline ? null : { state: 'missing' }) };
    if (!res && D.offline) U.toast("Can't reach the system. Try again in a moment.", true);
    App.render(); return '';
  };
  App.forms.lshopcheck = async (f) => { await doCheck(new FormData(f).get('code')); focusId('shop-code'); };
  App.acts['lshop-scan'] = () => U.openScanner({ title: "Scan the customer's code", onCode: doCheck, after: () => focusId('shop-code') });
  App.acts['lshop-next'] = () => { App.state.shopCheck = null; App.state.shopDone = null; App.state.shopCodeIn = ''; App.render(); focusId('shop-code'); };
  App.acts['lshop-use'] = async (b) => {
    const S = App.state; if (S.shopSaving) return;
    const code = b.dataset.code, value = S.shopCheck && S.shopCheck.res ? S.shopCheck.res.value : 0;
    S.shopSaving = true; App.render();
    const r = await LB.save('shop_use', { p_code: code });
    S.shopSaving = false;
    if (r.ok) {
      S.shopDone = { code, value: r.value || value };
      S.shopSum = await D.read('shop_summary');
    } else {
      U.toast(r.error, true);
      await doCheck(code);       // show why (already used, ran out...)
      return;
    }
    App.render();
  };
  App.acts['lshop-reset'] = async () => {
    if (!confirm('Reset your shop code? The old code will stop working straight away.')) return;
    const r = await LB.save('shop_reset_code', {});
    if (!r.ok) return U.toast(r.error, true);
    App.state.shopMe = await D.read('shop_me');
    U.toast('Your new shop code is ' + r.code); App.render();
  };
})();
