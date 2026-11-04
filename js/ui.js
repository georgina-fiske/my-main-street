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
    shops: () => st().shops,
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
  const BRAND0 = { place: '', color: C.colors.indigo, accent: C.colors.yellow, logo: '', welcome: 'Win something on Main Street', web: '' };
  App.brandOf = (areaId) => {
    const a = D0.area(areaId);
    return Object.assign({}, BRAND0, { place: a ? a.name : '' }, (a && a.brand) || {}, { appName: C.siteName });
  };
  App.fruitbowlBrand = () => ({ place: '', color: C.colors.indigo, accent: C.colors.yellow, logo: '', welcome: '', web: '', appName: C.siteName });

  // The platform frame (header) is always the My Main Street brand. An area's own colours drive everything
  // else the UI colours: buttons, bars, tabs, badges, highlights. Every token is set together, every time.
  const lum = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 0; const n = parseInt(m[1], 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const TOKENS = ['--euc', '--on-euc', '--euc-soft', '--sun', '--on-sun', '--sun-soft', '--tab-line'];
  App.applyBrand = (b) => {
    const r = document.documentElement.style, same = (x, y) => String(x || '').toLowerCase() === String(y || '').toLowerCase();
    if (same(b.color, C.colors.indigo) && same(b.accent, C.colors.yellow)) { TOKENS.forEach((t) => r.removeProperty(t)); return; }   // platform look: the stylesheet (light and dark) decides
    r.setProperty('--euc', b.color);
    r.setProperty('--on-euc', U.textOn(b.color));
    r.setProperty('--euc-soft', `color-mix(in srgb, ${b.color} 14%, var(--surface))`);
    r.setProperty('--sun', b.accent);
    r.setProperty('--on-sun', U.textOn(b.accent));
    r.setProperty('--sun-soft', `color-mix(in srgb, ${b.accent} 22%, var(--surface))`);   // a soft tint that follows light and dark mode
    r.setProperty('--tab-line', lum(b.accent) > 0.6 && document.documentElement.getAttribute('data-theme') !== 'dark' ? b.color : b.accent);   // keep the tab underline visible on light backgrounds
  };

  // ---------- routes ----------
  const RESERVED_FIRST = ['demo', 'safety', 'join', 'shop', 'desk', 'client', 'hq', 'wallet', 'c', 'poster', 'stickers', 'tap', 'login', 'u'];
  // ---- the live site: each area has its own address, [area].my-mainstreet.com.au ----
  const dev = /(^|\.)localhost$/.test(location.hostname);
  const portPart = location.port ? ':' + location.port : '';
  App.hostArea = () => {
    const h = location.hostname, base = C.baseDomain;
    if (window.PREVIEW) return window.PREVIEW === 'main' ? null : window.PREVIEW;
    if (dev) return h.endsWith('.localhost') ? h.split('.')[0] : null;
    if (h.endsWith('.' + base)) { const l = h.slice(0, -(base.length + 1)); return l && l !== 'www' && !l.includes('.') ? l : null; }
    return null;
  };
  App.mainOrigin = () => (window.PREVIEW ? location.origin : dev ? location.protocol + '//localhost' + portPart : 'https://' + C.baseDomain);
  App.areaOrigin = (a) => (window.PREVIEW ? location.origin : dev ? location.protocol + '//' + a + '.localhost' + portPart : 'https://' + a + '.' + C.baseDomain);

  function parseLive() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const q = new URLSearchParams(location.search);
    const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
    const ha = App.hostArea();
    const ctx = { path, q, seg, params: {}, embed: q.get('embed') === '1', name: 'notfound', area: ha, live: true };
    const first = seg[0] || '';
    if (first === 'login') ctx.name = 'login';
    else if (first === 'set-password') ctx.name = 'setpw';
    else if (first === 'u') { ctx.name = 'unsub'; ctx.params.token = seg[1]; }
    else if (first === 'safety') ctx.name = 'safety';
    else if (ha) {
      if (!first) ctx.name = 'signup';
      else if (first === 'c') { ctx.name = 'coupon'; ctx.params.code = U.normCode(seg[1]); ctx.params.token = q.get('k') || ''; }
      else if (first === 'shops') ctx.name = 'shops';
      else if (first === 'desk') ctx.name = 'desk';
      else if (first === 'shop') ctx.name = seg[1] === 'claim' ? 'shopclaim' : 'shop';
      else if (first === 'admin') ctx.name = 'admin';      // an area's own admin: always that area, no chooser
    } else {
      if (!first) ctx.name = 'home';
      else if (first === 'admin') ctx.name = 'admin';
    }
    return ctx;
  }
  App.livePages = {};

  function parse() {
    if (D.live) return parseLive();
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
        case 'u': ctx.name = 'unsub'; ctx.params.token = seg[1]; break;
        default: ctx.name = seg[0];
      }
    } else {
      ctx.params.area = seg[0];
      ctx.name = seg.length === 1 ? 'signup' : seg[1] === 'shops' && seg.length === 2 ? 'shops' : 'notfound';
    }
    return ctx;
  }

  // Keep ?embed=1 on every link inside a preview frame.
  // In a live site, pages under /demo (and any link inside them) run as a private demo, with ?demo=1.
  const isDemoPath = (p) => /^\/demo(\/|\?|$)/.test(p) || /[?&]demo=1/.test(p);
  App.isDemo = () => !D.live;
  App.href = (path) => {
    let p = path;
    if (C.mode === 'live' && App.isDemo() && !isDemoPath(p)) p += (p.includes('?') ? '&' : '?') + 'demo=1';
    if (App.ctx && App.ctx.embed && !/[?&]embed=1/.test(p)) p += (p.includes('?') ? '&' : '?') + 'embed=1';
    return p;
  };
  App.go = (path, replace) => {
    const url = App.href(path);
    // Going between the live site and the demo needs a fresh page load (they use different data).
    if (C.mode === 'live' && isDemoPath(url) !== App.isDemo()) { location.assign(url); return; }
    try { history[replace ? 'replaceState' : 'pushState'](null, '', url); } catch (e) { location.href = url; return; }
    App.route();
  };

  // Who can do what? (The demo is open to everyone.)
  App.can = (need, area) => {
    if (App.isDemo()) return true;
    const s = D.staff || {};
    if (need === 'user') return !!(D.user && D.user.email);
    if (s.role === 'fruitbowl') return true;
    if (need === 'hq') return false;
    if (need === 'manage') return s.role === 'client' && s.area === area;
    if (need === 'desk') return (s.role === 'client' || s.role === 'desk') && s.area === area;
    return false;
  };
  // Which street a staff page is about. Clients and desk staff only ever see their own.
  App.areaFor = (ctx) => {
    const s = D.staff || {};
    if (!App.isDemo() && s.role && s.role !== 'fruitbowl' && s.area) return s.area;
    const q = ctx.q.get('area');
    if (D0.area(q)) return q;
    const first = D0.area(C.demoHomeArea) || D.state.areas[0];
    return first ? first.id : C.demoHomeArea;
  };
  // The staff log-in box shown instead of a staff page.
  App.gate = (title, need) => {
    const e = D.user && D.user.email;
    return `${App.band(title, App.fruitbowlBrand(), '')}<main class="wrap" id="main" style="max-width:560px">
      <div class="panel"><h2>${e ? 'This login can\'t open this page' : 'Staff log in'}</h2>
      ${e ? `<p>You are logged in as <b>${esc(e)}</b>, but that email doesn't have access here. Ask Fruitbowl to add you, or log in with a different email.</p><p><button class="btn" data-act="logout">Log out</button></p>`
        : `<p>Enter your email. We'll send you a link that logs you in. No password needed.</p>
           <form data-form="login" data-next="${esc(location.pathname + location.search)}"><label for="lg-email">Email</label><input id="lg-email" name="email" type="email" autocomplete="email" required>
           <p class="err" id="lg-err" role="alert" hidden></p><p style="margin-top:12px"><button class="btn big" type="submit">Email me a login link</button></p></form>`}
      </div></main>${App.footer()}`;
  };

  // ---------- chrome ----------
  App.logoImg = (b, cls) => (b.logo ? `<img class="${cls || 'blogo'}" src="${esc(b.logo)}" alt="">` : '');

  // The wide pages (desk, shop, client, HQ, reports...)
  App.band = (title, b, current) => {
    const demo = App.isDemo(), role = (D.staff || {}).role;
    let links = [['/desk', 'Prize desk', 'desk'], ['/shop', 'Shop screen', 'shop'], ['/client', 'Client', 'client'], ['/hq', 'Fruitbowl HQ', 'hq'], ['/demo', 'Demo', 'demo']];
    if (!demo) {
      links = role === 'fruitbowl' ? [['/desk', 'Prize desk', 'desk'], ['/client', 'Client', 'client'], ['/hq', 'Fruitbowl HQ', 'hq']]
        : role === 'client' ? [['/desk', 'Prize desk', 'desk'], ['/client', 'Client', 'client']]
          : role === 'desk' ? [['/desk', 'Prize desk', 'desk']] : [];
    }
    return `<header class="band"><div class="wrap">
      <div class="brandline">${App.logoImg(b)}<div><div class="small-street">${esc(b.place || C.siteName)}${demo ? ' <span class="demo">Demo, not live yet</span>' : ''}</div><div class="title">${esc(title)}</div></div></div>
      <nav aria-label="Pages">${links.map((l) => `<a href="${l[0]}"${l[2] === current ? ' aria-current="page"' : ''}>${l[1]}</a>`).join('')}${!demo && D.user ? '<a href="#" data-act="logout">Log out</a>' : ''}</nav>
    </div></header>`;
  };
  App.footer = () => (App.isDemo()
    ? `<footer class="foot"><p>This is a demo. The shops and coupons are made up. Nothing here is real. Your changes stay in this browser.
      <a href="/safety">Safety and privacy</a></p><button type="button" class="btn ghost small" data-act="reset">Reset demo</button></footer>`
    : `<footer class="foot"><p>${esc(C.siteName)}. <a href="/safety">Safety and privacy</a></p></footer>`);
  App.page = (inner, opts) => `<main class="wrap${opts && opts.cls ? ' ' + opts.cls : ''}" id="main">${inner}</main>${App.footer()}`;

  // The phone pages (sign-up, coupon, shops, Wallet)
  App.appbar = (b) => `<div class="appbar">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div><small>${esc(b.place)}</small><b>${esc(b.appName || C.siteName)}</b></div></div>`;
  // The Council's campaign look: a bold headline on a flat colour block, with flat blocks of the other colours under it.
  // The four colours are mixed differently on each page (the order turns by one each time). Only an area with a headline and palette gets it.
  const PAGE_TURN = { signup: 0, coupon: 1, shops: 2, desk: 3, shop: 3, shopclaim: 2 };
  App.palette = (b) => (Array.isArray(b.palette) ? b.palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c)) : []);
  App.councilBanner = (b, turn) => {
    const pal = App.palette(b);
    if (!b.headline || pal.length < 3) return '';
    const r = pal.map((_, i) => pal[(i + turn) % pal.length]);
    return `<section class="cbanner" aria-label="${esc(b.headline)}"><div class="cb-hero" style="background:${r[0]};color:${U.textOn(r[0])}"><h1>${esc(b.headline)}</h1></div>
      <div class="cb-blocks" aria-hidden="true">${r.slice(1).map((c) => `<i style="background:${c}"></i>`).join('')}</div></section>`;
  };
  App.colourStrip = (b) => { const pal = App.palette(b); return pal.length ? `<div class="cstrip" aria-hidden="true">${pal.map((c) => `<i style="background:${c}"></i>`).join('')}</div>` : ''; };
  App.custPage = (b, inner) => `<div class="cust">${App.isDemo() ? '<div class="demo-strip">Demo, not live yet</div>' : ''}${App.appbar(b)}${App.councilBanner(b, PAGE_TURN[(App.ctx || {}).name] || 0)}<div class="body" id="main">${inner}</div></div>`;

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

  const pageFor = (ctx) => (D.live ? App.livePages[ctx.name] || App.livePages.notfound : App.pages[ctx.name] || App.pages.notfound);
  App.pageFor = pageFor;
  App.render = () => {
    const ctx = App.ctx;
    const page = pageFor(ctx);
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
    const opened = [...root().querySelectorAll('details')].map((d) => d.open);   // a section someone opened stays open when the screen refreshes
    root().innerHTML = page.render(ctx, brand);
    if (App.skipRestore) App.skipRestore = false; else restoreFields(snap);
    root().querySelectorAll('details').forEach((d, i) => { if (opened[i]) d.open = true; });
    document.title = (page.title ? page.title(ctx, brand) + ' – ' : '') + C.siteName + (brand.place ? ' – ' + brand.place : '') + (App.isDemo() ? ' (demo)' : '');
    ctx.rendered = true;
    if (page.after) page.after(ctx, brand);
  };

  let pending = false;
  function onData() {
    const page = pageFor(App.ctx);
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
    if (App.ctx && App.ctx.stop) { App.ctx.stop(); App.ctx.stop = null; }   // stop refreshing the old page
    App.ctx = parse();
    const page = pageFor(App.ctx);
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
  App.acts.logout = async () => { await D.signOut(); App.go('/login'); };
  App.acts.reset = async () => {
    if (!App.isDemo()) return;
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
