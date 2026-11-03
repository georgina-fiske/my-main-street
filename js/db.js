// Talks to the data. Two modes:
//   demo (local)  runs in the visitor's own browser (js/localdb.js). Used for /demo and for CONFIG.mode = 'local'.
//   live          uses Supabase: shared data, logins, and customers who can only read their own coupon.
(function () {
  const BASE_TABLES = ['settings', 'areas', 'events', 'shops'];    // nothing personal: anyone can read
  const STAFF_TABLES = ['prizes', 'signups'];                       // only logged-in staff can read
  const ORDER = { settings: null, areas: 'sort_order', events: 'id', shops: 'sort_order', prizes: 'sort_order', signups: 'created_at' };
  const listeners = [];
  const demoPage = /^\/demo(\/|$)/.test(location.pathname) || new URLSearchParams(location.search).get('demo') === '1';
  const isLive = window.CONFIG.mode === 'live' && !demoPage;
  const DB = {
    listeners,
    live: isLive,
    ready: false,
    error: null,
    offline: false,      // true while the system can't be reached
    mode: isLive ? 'live' : 'local',
    user: null,          // {email} when logged in
    staff: {},           // {role, area, shop} when the login is on the list
    state: { settings: {}, areas: [], events: [], shops: [], prizes: [], signups: [], campaigns: [], workshops: [], bookings: [] },
    onChange(fn) { listeners.push(fn); }
  };
  let sb = null;
  let loading = null;
  let again = false;
  const passes = {};     // a customer's own coupons, fetched by code + secret (customers cannot list everyone)


  // One login for the main site and every area (croydon.my-mainstreet.com.au): keep the login in a cookie
  // shared by the whole domain. Anywhere else (localhost, previews) it stays in the browser as normal.
  function sharedStorage() {
    const base = String(window.CONFIG.baseDomain || '').toLowerCase(), host = location.hostname.toLowerCase();
    const local = { getItem: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, removeItem: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
    if (!base || !(host === base || host.endsWith('.' + base))) return local;
    const CH = 3000, attrs = '; domain=.' + base + '; path=/; SameSite=Lax; Secure';
    const all = () => Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));
    const drop = (k) => { const a = all(); Object.keys(a).forEach((n) => { if (n === 'msr.' + k + '.n' || n.indexOf('msr.' + k + '.') === 0) document.cookie = n + '=; max-age=0' + attrs; }); };
    return {
      getItem(k) {
        const a = all(), n = parseInt(a['msr.' + k + '.n'], 10);
        if (!n) return local.getItem(k);
        let v = ''; for (let i = 0; i < n; i++) { if (a['msr.' + k + '.' + i] == null) return null; v += a['msr.' + k + '.' + i]; }
        try { return decodeURIComponent(v); } catch (e) { return null; }
      },
      setItem(k, v) {
        drop(k);
        const e = encodeURIComponent(v), n = Math.ceil(e.length / CH), exp = '; max-age=' + 60 * 60 * 24 * 30;
        for (let i = 0; i < n; i++) document.cookie = 'msr.' + k + '.' + i + '=' + e.slice(i * CH, (i + 1) * CH) + attrs + exp;
        document.cookie = 'msr.' + k + '.n=' + n + attrs + exp;
      },
      removeItem(k) { drop(k); local.removeItem(k); }
    };
  }

  function configured() {
    const c = window.CONFIG.supabase;
    return c && /^https:\/\//.test(c.url) && c.anonKey && !/PASTE_/.test(c.anonKey);
  }
  DB.configured = configured;
  const isStaff = () => !!(DB.staff && DB.staff.role && DB.staff.role !== 'shop');
  const notify = () => listeners.forEach((fn) => fn());
  const isNet = (e) => !!e && ((!e.code && /fetch|network|load failed|timeout/i.test(e.message || '')) || e.name === 'TypeError');
  const setOffline = (v) => { if (DB.offline !== v) { DB.offline = v; notify(); } };

  // ---------- defaults (demo mode keeps all of this open) ----------
  DB.fetchPass = async (code) => DB.state.signups.find((s) => s.code === code) || null;
  DB.lookup = async (code) => DB.state.signups.find((s) => s.code === code) || null;
  DB.watchPass = () => () => {};
  DB.notifyCoupon = async () => ({ ok: true, demo: true });
  DB.signIn = async () => ({ ok: false, error: 'Logins are not used in the demo.' });
  DB.signInPassword = async () => ({ ok: false, error: 'Logins are not used in the demo.' });
  DB.resetPassword = async () => ({ ok: false });
  DB.setPassword = async () => ({ ok: false });
  DB.signOut = async () => {};
  DB.refresh = async () => {};
  DB.token = async () => null;

  async function load() {
    if (loading) { again = true; return loading; }
    loading = (async () => {
      try {
        const names = BASE_TABLES.concat(isStaff() ? STAFF_TABLES : []);
        const res = await Promise.all(names.map((t) => { const q = sb.from(t).select('*'); return ORDER[t] ? q.order(ORDER[t]) : q; }));
        const bad = res.find((r) => r.error);
        if (bad) throw bad.error;
        names.forEach((t, i) => {
          if (t === 'settings') DB.state.settings = Object.fromEntries(res[i].data.map((r) => [r.key, r.value]));
          else DB.state[t] = res[i].data;
        });
        if (!isStaff()) { DB.state.prizes = []; DB.state.signups = Object.values(passes); }
        DB.ready = true;
        DB.error = null;
        setOffline(false);
      } catch (e) {
        if (isNet(e)) setOffline(true);
        if (!DB.ready) DB.error = e.message || String(e);
      }
      loading = null;
      notify();
      if (again) { again = false; load(); }
    })();
    return loading;
  }
  DB.load = load;

  let timer = null;
  function soon() { clearTimeout(timer); timer = setTimeout(load, 150); }

  async function refreshStaff() {
    const { data } = await sb.auth.getSession();
    const user = data && data.session && data.session.user;
    DB.user = user ? { email: (user.email || '').toLowerCase() } : null;
    DB.staff = {};
    if (user) {
      const r = await sb.rpc('staff_me');
      if (r && r.data && r.data.role) DB.staff = r.data;
    }
  }

  function putPass(rec) {
    if (!rec) return null;
    passes[rec.code] = rec;
    if (!isStaff()) DB.state.signups = Object.values(passes);
    else {
      const i = DB.state.signups.findIndex((s) => s.code === rec.code);
      if (i >= 0) DB.state.signups[i] = Object.assign({}, DB.state.signups[i], rec); else DB.state.signups.push(rec);
    }
    return rec;
  }

  function liveExtras() {
    // A customer's own coupon: needs the code AND the secret in their link.
    DB.fetchPass = async (code, token) => {
      const { data, error } = await sb.rpc('get_pass', { p_code: code, p_token: token || '' });
      if (error) { if (isNet(error)) setOffline(true); return null; }
      setOffline(false);
      if (!data) return null;
      const before = JSON.stringify(passes[code] || null);
      putPass(data);
      if (JSON.stringify(data) !== before) notify();
      return data;
    };
    // Keep a customer's page fresh: staff tap the prize, the phone changes within a few seconds.
    DB.watchPass = (code, token) => {
      const id = setInterval(() => {
        const cur = passes[code];
        if (cur && cur.redeemed) return;           // nothing more will change, so stop asking
        if (!document.hidden) DB.fetchPass(code, token);
      }, 5000);
      return () => clearInterval(id);
    };
    DB.signIn = async (email, next) => {
      const dest = location.origin + '/login' + (next ? '?next=' + encodeURIComponent(next) : '');
      const { error } = await sb.auth.signInWithOtp({ email: String(email).trim().toLowerCase(), options: { emailRedirectTo: dest, shouldCreateUser: false } });
      return error ? { ok: false, error: 'We could not send the link. Check the email is the one you were invited with.' } : { ok: true };
    };
    DB.signInPassword = async (email, password) => {
      const { error } = await sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
      if (error) return { ok: false, error: isNet(error) ? 'No connection. Please try again.' : 'That email and password don\'t match.' };
      await refreshStaff(); await load();
      return { ok: true };
    };
    DB.resetPassword = async (email) => {
      const { error } = await sb.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo: location.origin + '/set-password' });
      return error ? { ok: false, error: 'We could not send the link.' } : { ok: true };
    };
    DB.setPassword = async (password) => {
      const { error } = await sb.auth.updateUser({ password });
      return error ? { ok: false, error: error.message || 'That password did not work.' } : { ok: true };
    };
    DB.refresh = async () => { await refreshStaff(); await load(); };
    DB.signOut = async () => { await sb.auth.signOut(); DB.user = null; DB.staff = {}; DB.state.signups = Object.values(passes); DB.state.prizes = []; notify(); };
    DB.token = async () => { const { data } = await sb.auth.getSession(); return data && data.session && data.session.access_token; };
    // Send the coupon by email or text (Netlify function). Only logged-in staff can do this.
    DB.notifyCoupon = async (code) => {
      try {
        const token = await DB.token();
        const r = await fetch('/.netlify/functions/send-coupon', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (token || '') }, body: JSON.stringify({ code }) });
        const j = await r.json().catch(() => ({}));
        return r.ok ? j : { ok: false, error: j.error || 'The message could not be sent.' };
      } catch (e) { return { ok: false, error: 'The message could not be sent.' }; }
    };
  }

  DB.start = async function () {
    // Demo: everything runs inside the visitor's own browser. No database needed.
    if (!isLive && window.LocalDB) { window.LocalDB.start(DB); return; }
    if (!configured()) { DB.error = 'not-configured'; notify(); return; }
    const c = window.CONFIG.supabase;
    sb = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sharedStorage() } });
    liveExtras();
    await refreshStaff();
    await load();
    sb.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT' || evt === 'TOKEN_REFRESHED' || evt === 'PASSWORD_RECOVERY') setTimeout(async () => { await refreshStaff(); await load(); }, 0);
    });
    const ch = sb.channel('live-' + Math.random().toString(36).slice(2, 8));
    BASE_TABLES.concat(STAFF_TABLES).forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, soon));
    ch.subscribe();
    // Backup: refresh when the tab comes back, and every 30 seconds.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    setInterval(() => { if (!document.hidden) load(); }, 30000);
    window.addEventListener('online', () => load());
    window.addEventListener('offline', () => setOffline(true));
  };

  // Call one of the locked functions. Always returns {ok, error?, ...}.
  // Pass {reload:false} for read-only calls. A failure to connect comes back with network:true.
  DB.rpc = async function (name, args, opts) {
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) {
        if (isNet(error)) { setOffline(true); return { ok: false, network: true, error: 'No connection. Please try again.' }; }
        return { ok: false, error: 'Something went wrong. Please try again.' };
      }
      setOffline(false);
      if (!opts || opts.reload !== false) await load();
      return data === null || data === undefined ? { ok: true } : data;
    } catch (e) {
      setOffline(true);
      return { ok: false, network: true, error: 'No connection. Please try again.' };
    }
  };

  // Read-only call that returns raw data (arrays and so on).
  DB.read = async function (name, args) {
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) { if (isNet(error)) setOffline(true); return null; }
      return data;
    } catch (e) {
      return null;
    }
  };

  window.DB = DB;
})();
