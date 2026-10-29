// Core: routes, page chrome, area looks (branding), shared data helpers, event wiring.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, esc = U.esc;
  const App = { pages: {}, acts: {}, forms: {}, changes: {}, ctx: null, demoHints: true };

  // ---------- storage ----------
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    sget: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  App.store = store;

  // ---------- shared data helpers ----------
  const st = () => D.state;
  const D0 = {
    areas: () => st().areas,
    area: (id) => st().areas.find((a) => a.id === id) || null,
    shopsOf: (areaId) => st().shops.filter((s) => s.area === areaId),
    activeShopsOf: (areaId) => st().shops.filter((s) => s.area === areaId && s.status === 'active'),
    shop: (id) => st().shops.find((s) => s.id === id) || null,
    shopName: (id) => (id === 'desk' ? 'the prize desk' : (D0.shop(id) || { name: 'a shop' }).name),
    prizesOf: (areaId) => st().prizes.filter((p) => p.area === areaId).sort((a, b) => a.value - b.value || a.id - b.id),
    campaignsOf: (areaId) => st().campaigns.filter((c) => c.area === areaId),
    eventsOf: (areaId) => st().events.filter((e) => e.area === areaId),
    event: (id) => st().events.find((e) => Number(e.id) === Number(id)) || null,
    signup: (code) => st().signups.find((s) => s.code === code) || null,
    signupsOf: (areaId) => st().signups.filter((s) => s.area === areaId),
    given: (p) => st().signups.filter((s) => s.prize && Number(s.prize.id) === Number(p.id)).length,
    left: (p) => p.stock - D0.given(p),
    codeStyle: () => st().settings.code_style || 'qr',
    live: (c) => c.council === 'approved' || c.street === 'yes',
    workshops: () => st().workshops.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))),
    me: () => { const c = store.get('msr-code'); return c ? D0.signup(c) : null; }
  };
  App.d = D0;

  // An area's look, with safe defaults. The name is always My Main Street.
  const BRAND0 = { place: '', color: C.colors.purple, accent: C.colors.yellow, logo: '', welcome: 'Win something on Main Street', web: '' };
  App.brandOf = (areaId) => {
    const a = D0.area(areaId);
    return Object.assign({}, BRAND0, { place: a ? a.name : '' }, (a && a.brand) || {}, { appName: C.siteName });
  };
  App.fruitbowlBrand = () => ({ place: '', color: C.colors.purple, accent: C.colors.yellow, logo: '', welcome: '', web: '', appName: C.siteName });

  App.applyBrand = (b) => {
    const r = document.documentElement.style;
    r.setProperty('--brand', b.color);
    r.setProperty('--on-brand', U.textOn(b.color));
    r.setProperty('--sun', b.accent);
    r.setProperty('--on-sun', U.textOn(b.accent));
    r.setProperty('--sun-soft', `color-mix(in srgb, ${b.accent} 22%, white)`);
  };

  // ---------- routes ----------
  const RESERVED_FIRST = ['demo', 'safety', 'join', 'shop', 'desk', 'client', 'hq', 'wallet', 'c', 'poster', 'stickers', 'tap'];
  function parse() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const q = new URLSearchParams(location.search);
    const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
    const ctx = { path, q, seg, params: {}, embed: q.get('embed') === '1', name: 'notfound' };
    if (!seg.length) ctx.name = 'demo';
    else if (RESERVED_FIRST.includes(seg[0])) {
      switch (seg[0]) {
        case 'demo': ctx.name = 'demo'; ctx.params.step = seg[1]; break;
        case 'shop':
          if (seg[1] === 'join') { ctx.name = 'shopjoin'; ctx.params.token = seg[2]; } else ctx.name = 'shop';
          break;
        case 'c': ctx.name = 'coupon'; ctx.params.code = U.normCode(seg[1]); break;
        case 'poster': ctx.name = 'poster'; ctx.params.area = seg[1]; break;
        case 'stickers': ctx.name = 'stickers'; ctx.params.id = seg[1]; break;
        case 'tap': ctx.name = 'tap'; ctx.params.shop = seg[1]; break;
        default: ctx.name = seg[0];
      }
    } else {
      ctx.params.area = seg[0];
      ctx.name = seg.length === 1 ? 'signup' : seg[1] === 'shops' && seg.length === 2 ? 'shops' : 'notfound';
    }
    return ctx;
  }

  // Keep ?embed=1 on every link inside a preview frame.
  App.href = (path) => {
    if (!App.ctx || !App.ctx.embed) return path;
    return path + (path.includes('?') ? '&' : '?') + 'embed=1';
  };
  App.go = (path, replace) => {
    const url = App.href(path);
    try { history[replace ? 'replaceState' : 'pushState'](null, '', url); } catch (e) { location.href = url; return; }
    App.route();
  };

  // ---------- chrome ----------
  App.logoImg = (b, cls) => (b.logo ? `<img class="${cls || 'blogo'}" src="${esc(b.logo)}" alt="">` : '');

  // The wide pages (desk, shop, client, HQ, reports...)
  App.band = (title, b, current) => {
    const links = [['/desk', 'Prize desk', 'desk'], ['/shop', 'Shop screen', 'shop'], ['/client', 'Client', 'client'], ['/hq', 'Fruitbowl HQ', 'hq'], ['/demo', 'Demo', 'demo']];
    return `<header class="band"><div class="wrap">
      <div class="brandline">${App.logoImg(b)}<div><div class="small-street">${esc(b.place || C.siteName)} <span class="demo">Demo, not live yet</span></div><div class="title">${esc(title)}</div></div></div>
      <nav aria-label="Pages">${links.map((l) => `<a href="${l[0]}"${l[2] === current ? ' aria-current="page"' : ''}>${l[1]}</a>`).join('')}</nav>
    </div></header>`;
  };
  App.footer = () => `<footer class="foot"><p>This is a demo. The shops and coupons are made up. Nothing here is real.
      <a href="/safety">Safety and privacy</a></p><button type="button" class="btn ghost small" data-act="reset">Reset demo</button></footer>`;
  App.page = (inner, opts) => `<main class="wrap${opts && opts.cls ? ' ' + opts.cls : ''}" id="main">${inner}</main>${App.footer()}`;

  // The phone pages (sign-up, coupon, shops, Wallet)
  App.appbar = (b) => `<div class="appbar">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div><small>${esc(b.place)}</small><b>${esc(b.appName || C.siteName)}</b></div></div>`;
  App.custPage = (b, inner) => `<div class="cust"><div class="demo-strip">Demo, not live yet</div>${App.appbar(b)}<div class="body" id="main">${inner}</div></div>`;

  App.intro = (title, what, who, tryit) =>
    `<div class="intro"><h2>${title}</h2><p>${what}</p><div class="intro-grid"><div><b>Who uses it</b><p>${who}</p></div>${tryit ? `<div><b>Try it</b><p>${tryit}</p></div>` : ''}</div></div>`;

  // ---------- running things ----------
  App.run = async (name, args, okMsg) => {
    const r = await D.rpc(name, args);
    if (!r.ok) U.toast(r.error || 'Something went wrong.', true);
    else if (okMsg) U.toast(okMsg);
    return r;
  };

  // ---------- render ----------
  const root = () => document.getElementById('app');

  function snapshotFields() {
    const snap = {};
    root().querySelectorAll('input[id],select[id],textarea[id]').forEach((el) => {
      if (el.type === 'file') return;
      snap[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
    });
    return snap;
  }
  function restoreFields(snap) {
    Object.keys(snap).forEach((id) => {
      const el = root().querySelector('#' + CSS.escape(id));
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = snap[id];
      else if (el.tagName === 'SELECT') { if ([...el.options].some((o) => o.value === snap[id])) el.value = snap[id]; } else el.value = snap[id];
    });
  }

  App.render = () => {
    const ctx = App.ctx;
    const page = App.pages[ctx.name] || App.pages.notfound;
    document.body.classList.toggle('embed', ctx.embed);
    document.body.classList.toggle('demo-body', ctx.name === 'demo');
    if (!D.ready) {
      App.applyBrand(App.fruitbowlBrand());
      root().innerHTML = D.error === 'not-configured'
        ? `<div class="panel" style="margin:24px"><h2>Almost there</h2><p>This site needs its database. Add the Supabase URL and key in <code>js/config.js</code>. See the README.</p></div>`
        : D.error
          ? `<div class="panel" style="margin:24px"><h2>Can't reach the demo data</h2><p>${esc(D.error)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`
          : '<p style="padding:24px">Loading…</p>';
      return;
    }
    const brand = page.brand ? page.brand(ctx) : App.fruitbowlBrand();
    App.applyBrand(brand);
    const snap = snapshotFields();
    root().innerHTML = page.render(ctx, brand);
    if (App.skipRestore) App.skipRestore = false; else restoreFields(snap);
    document.title = (page.title ? page.title(ctx, brand) + ' – ' : '') + C.siteName + (brand.place ? ' – ' + brand.place : '') + ' (demo)';
    ctx.rendered = true;
    if (page.after) page.after(ctx, brand);
  };

  let pending = false;
  function onData() {
    const page = App.pages[App.ctx.name];
    if (page && page.onData && App.ctx.rendered) return page.onData(App.ctx);
    const a = document.activeElement;
    if (a && root().contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
      if (!pending) {
        pending = true;
        a.addEventListener('blur', () => { setTimeout(() => { pending = false; onData(); }, 400); }, { once: true });
      }
      return;
    }
    App.render();
  }

  App.route = () => {
    App.ctx = parse();
    const page = App.pages[App.ctx.name];
    if (page && page.enter) page.enter(App.ctx);
    App.render();
    if (!App.ctx.q.get('keepscroll')) window.scrollTo(0, 0);
  };

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      const fn = App.acts[b.dataset.act];
      if (fn) { if (b.tagName === 'A') e.preventDefault(); fn(b, e); return; }
    }
    const a = e.target.closest('a[href]');
    if (a && !a.target && !a.hasAttribute('download') && !a.dataset.external && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) {
        e.preventDefault();
        App.go(u.pathname + u.search + u.hash);
      }
    }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = App.forms[f.dataset.form];
    if (fn) fn(f, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const fn = App.changes[el.dataset.change];
    if (fn) fn(el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (!el) return;
    const fn = App.changes[el.dataset.input];
    if (fn) fn(el, e);
  });
  window.addEventListener('popstate', App.route);

  // ---------- shared actions ----------
  App.acts.reset = async () => {
    if (!confirm('Reset the demo? This wipes all changes and reloads the demo data.')) return;
    const r = await App.run('reset_demo', {}, 'Demo reset.');
    if (r.ok) { store.set('msr-code', ''); store.sset('msr-shop', ''); App.state = {}; App.render(); document.dispatchEvent(new CustomEvent('msr-reset')); }
  };
  App.state = {};   // small per-page memory (cleared on reset)

  // ---------- start ----------
  App.start = () => {
    D.onChange(onData);
    App.route();
    D.start().then(() => { if (App.afterLoad) App.afterLoad(); });
  };

  window.App = App;
  window.App.RESERVED_FIRST = RESERVED_FIRST;
})();
