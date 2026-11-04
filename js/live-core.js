// The live site (real customers): shared pieces. Staff logins, page chrome, and "keep trying" saves.
// These pages are only used when CONFIG.mode is 'live' (and not under /demo).
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, d0 = App.d;
  if (!D.live) return;
  const LP = App.livePages;
  const LB = (App.live = {});

  // ---------- who am I, and what may I do (the database checks this too) ----------
  LB.role = () => (D.staff || {}).role || '';
  LB.isHq = () => ['chaos', 'fruitbowl'].includes(LB.role());
  LB.canManage = (area) => LB.isHq() || (['council', 'street'].includes(LB.role()) && D.staff.area === area);
  LB.canDesk = (area) => LB.canManage(area) || (LB.role() === 'desk' && D.staff.area === area);
  LB.myShop = () => (LB.role() === 'shop' ? d0.shop(D.staff.shop) || { id: D.staff.shop, area: null } : null);

  // Where each kind of login goes.
  LB.homeFor = () => {
    const r = LB.role();
    // On an area's own address, staff stay there and land straight in that area's admin.
    if (['chaos', 'fruitbowl', 'council', 'street'].includes(r)) return App.hostArea() ? '/admin' : (['council', 'street'].includes(r) && D.staff.area ? App.areaOrigin(D.staff.area) : App.mainOrigin()) + '/admin';
    if (r === 'desk') return App.areaOrigin(D.staff.area) + '/desk';
    if (r === 'shop') { const s = d0.shop(D.staff.shop); return App.areaOrigin(s ? s.area : C.demoHomeArea) + '/shop'; }
    return null;
  };

  // ---------- page chrome ----------
  LB.band = (title, brand, links) => `<header class="band"><div class="wrap">
      <div class="brandline">${App.logoImg(brand)}<div><div class="small-street">${esc(brand.place || C.siteName)}</div><div class="title">${esc(title)}</div></div></div>
      <nav aria-label="Pages">${(links || []).map((l) => `<a href="${esc(l[0])}"${l[2] ? ' aria-current="page"' : ''}>${esc(l[1])}</a>`).join('')}${D.user ? '<a href="#" data-act="logout">Log out</a>' : ''}</nav>
    </div>${App.colourStrip(brand)}</header>`;
  LB.footer = () => `<footer class="foot"><p>${esc(C.siteName)}. <a href="${App.mainOrigin()}/safety">Safety and privacy</a></p></footer>`;
  LB.page = (inner) => `<main class="wrap" id="main">${inner}</main>${LB.footer()}`;
  LB.fb = () => App.fruitbowlBrand();

  // A banner for when the system can't be reached.
  LB.netBanner = (what) => (D.offline
    ? `<div class="netbanner" role="alert"><b>Can't reach the system.</b> Write ${what} on the paper log, then enter them later. This page keeps trying by itself.</div>` : '');

  // ---------- keep trying until it is saved ----------
  // hooks.state('saving' | 'slow' | 'done'). The server accepts the same tap twice, so retrying is safe.
  LB.save = async (name, args, hooks) => {
    const h = hooks || {};
    const t0 = Date.now();
    let slow = false;
    if (h.state) h.state('saving');
    for (;;) {
      const r = await D.rpc(name, args);
      if (!r.network) { if (h.state) h.state('done'); return r; }
      if (!slow && Date.now() - t0 > 15000) { slow = true; if (h.state) h.state('slow'); }
      await new Promise((res) => setTimeout(res, 2000));
    }
  };

  // ---------- log in ----------
  LB.gate = (title, link) => {
    const e = D.user && D.user.email;
    return `${LB.band(title, LB.fb(), [])}<main class="wrap" id="main" style="max-width:560px"><div class="panel">
      <h2>${e ? 'This login can\'t open this page' : 'Please log in'}</h2>
      ${e ? `<p>You are logged in as <b>${esc(e)}</b>, but that login doesn't have access here.</p><p class="row"><button class="btn" data-act="logout">Log out</button>${LB.homeFor() ? `<a class="btn ghost" href="${esc(LB.homeFor())}">Go to my page</a>` : ''}</p>`
        : `<p>This page is for staff.</p><p><a class="btn" href="/login?next=${encodeURIComponent(location.pathname)}">Log in</a></p>`}
      </div></main>${LB.footer()}`;
  };

  LP.login = {
    brand: LB.fb,
    title: () => 'Log in',
    after(ctx) {
      if (D.user && LB.role() && !ctx.redirected) {
        ctx.redirected = true;
        const next = ctx.q.get('next');
        const home = LB.homeFor();
        // go back where they came from on this address, otherwise to their own page
        if (next && next.startsWith('/') && !next.startsWith('//')) App.go(next, true);
        else if (home) location.replace(home);
      }
    },
    render(ctx) {
      const e = D.user && D.user.email, next = ctx.q.get('next') || '';
      let body;
      if (e) {
        body = `<div class="panel"><h2>You're logged in</h2><p>Logged in as <b>${esc(e)}</b>.</p>
          <p class="row">${LB.role() ? '<span class="muted">Taking you to your page…</span>' : '<span class="muted">This email isn\'t set up for anything yet. Ask Fruitbowl to add it.</span>'}
          <button class="btn ghost" data-act="logout">Log out</button></p></div>`;
      } else {
        body = `<div class="panel"><h2>Log in</h2>
          ${ctx.sent ? `<p class="statecard good"><b>Check your email.</b> We sent a link to ${esc(ctx.sent)}. Open it on this device.</p>` : ''}
          <form data-form="loginpw" data-next="${esc(next)}"><label for="lg-email">Email</label><input id="lg-email" name="email" type="email" autocomplete="username" required value="${esc(ctx.sent || '')}">
            <label for="lg-pw">Password</label><input id="lg-pw" name="password" type="password" autocomplete="current-password" required>
            <p class="err" id="lg-err" role="alert" hidden></p>
            <p style="margin-top:12px"><button class="btn big" type="submit">Log in</button></p></form>
          <p class="small muted" style="margin-top:14px">Forgot your password, or first time? <a href="#" data-act="login-link">Email me a link</a>.</p>
          ${App.hostArea() ? `<p class="small muted">Shop? <a href="/shop/claim">Set up your shop</a>.</p>` : ''}</div>`;
      }
      return `${LB.band('Log in', LB.fb(), [])}<main class="wrap" id="main" style="max-width:560px">${body}</main>${LB.footer()}`;
    }
  };
  const lgErr = (m) => { const e = document.getElementById('lg-err'); if (e) { e.textContent = m; e.hidden = false; } };
  App.forms.loginpw = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await D.signInPassword(d.email, d.password);
    if (!r.ok) return lgErr(r.error);
    App.ctx.redirected = false; App.render();
  };
  // "Email me a link": a password reset link (works for first-time setup too)
  App.acts['login-link'] = async () => {
    const email = (document.getElementById('lg-email') || {}).value || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return lgErr('Type your email in the box first.');
    const r = await D.resetPassword(email);
    if (!r.ok) return lgErr(r.error);
    App.ctx.sent = email; App.render();
  };

  // Back from an invite or reset link: choose a password.
  LP.setpw = {
    brand: LB.fb,
    title: () => 'Choose a password',
    render(ctx) {
      const e = D.user && D.user.email;
      const body = !e
        ? `<div class="panel"><h2>This link has run out</h2><p>Go to <a href="/login">Log in</a> and ask for a new link.</p></div>`
        : ctx.done
          ? `<div class="panel"><h2>Your password is saved</h2><p>You can log in with it any time.</p><p><a class="btn" href="${esc(LB.homeFor() || '/login')}">Continue</a></p></div>`
          : `<div class="panel"><h2>Choose a password</h2><p>For <b>${esc(e)}</b>. Use at least 8 characters.</p>
              <form data-form="setpw"><label for="np">New password</label><input id="np" name="password" type="password" autocomplete="new-password" minlength="8" required>
              <p class="err" id="np-err" role="alert" hidden></p><p style="margin-top:12px"><button class="btn big" type="submit">Save password</button></p></form></div>`;
      return `${LB.band('Choose a password', LB.fb(), [])}<main class="wrap" id="main" style="max-width:560px">${body}</main>${LB.footer()}`;
    }
  };
  App.forms.setpw = async (f) => {
    const pw = String(new FormData(f).get('password') || '');
    const err = (m) => { const e = document.getElementById('np-err'); if (e) { e.textContent = m; e.hidden = false; } };
    if (pw.length < 8) return err('Use at least 8 characters.');
    const r = await D.setPassword(pw);
    if (!r.ok) return err(r.error);
    App.ctx.done = true; App.render();
  };

  // "Unsubscribe" link in an email or text.
  LP.unsub = {
    brand: LB.fb,
    title: () => 'Unsubscribe',
    async after(ctx) {
      if (ctx.asked) return;
      ctx.asked = true;
      ctx.result = await D.rpc('unsubscribe', { p_token: ctx.params.token });
      App.render();
    },
    render(ctx) {
      const r = ctx.result;
      return `<main class="wrap" id="main" style="max-width:560px;padding-top:40px"><div class="panel">
        ${!r ? '<p>One moment…</p>' : r.ok ? `<h2>You're unsubscribed</h2><p>We won't send you news and offers. You can still use any coupon you've already won.</p>`
          : `<h2>That link isn't right</h2><p>${esc(r.error || '')}</p>`}
        <p><a href="${App.mainOrigin()}/safety">Safety and privacy</a></p></div></main>${LB.footer()}`;
    }
  };

  // The main address with nothing after it: send people to the demo.
  LP.home = {
    brand: LB.fb,
    render() {
      if (!window.PREVIEW) return '<p style="padding:24px">One moment…</p>';
      return `${LB.band('Preview', LB.fb(), [])}<main class="wrap" id="main" style="max-width:600px"><div class="panel"><h2>Preview of the real site</h2>
        <p>This is the main site. Pick a page:</p>
        <p><a class="btn" href="/admin">Admin</a> <a class="btn ghost" href="/login">Log in</a> <a class="btn ghost" href="/safety">Safety</a> <a class="btn ghost" href="/demo">Demo</a></p>
        <p class="muted small">To see the Croydon pages, add <b>?preview=croydon</b> to the address.</p></div></main>${LB.footer()}`;
    },
    after() { if (!window.PREVIEW) location.replace('/demo'); }
  };
  LP.notfound = {
    brand: LB.fb,
    title: () => 'Not found',
    render() { return `${LB.band('Page not found', LB.fb(), [])}<main class="wrap" id="main" style="max-width:600px"><div class="panel"><h2>We can't find that page</h2><p>Check the web address and try again.</p></div></main>${LB.footer()}`; }
  };

  App.acts.logout = async () => { await D.signOut(); location.assign('/login'); };
})();
