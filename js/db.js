// Talks to the data. Two modes:
//   demo (local)  runs in the visitor's own browser (js/localdb.js). Used for /demo and for CONFIG.mode = 'local'.
//   live          uses Supabase: shared data, staff logins, and customers who can only read their own coupon.
(function () {
  const TABLES = ['settings', 'areas', 'events', 'shops', 'campaigns', 'prizes', 'workshops', 'bookings'];   // nothing personal
  const ORDER = {
    settings: null, areas: 'sort_order', events: 'id', shops: 'sort_order',
    campaigns: 'sort_order', prizes: 'sort_order', workshops: 'date', bookings: 'id'
  };
  const listeners = [];
  const DB = {
    listeners,
    ready: false,
    error: null,
    mode: 'live',
    user: null,          // {email} when logged in
    staff: {},           // {role, area} when the login is on the staff list
    state: { settings: {}, areas: [], events: [], shops: [], signups: [], campaigns: [], prizes: [], workshops: [], bookings: [] },
    onChange(fn) { listeners.push(fn); }
  };
  let sb = null;
  let loading = null;
  let again = false;
  const passes = {};     // a customer's own coupons, fetched by code (customers cannot list everyone)

  function configured() {
    const c = window.CONFIG.supabase;
    return c && /^https:\/\//.test(c.url) && c.anonKey && !/PASTE_/.test(c.anonKey);
  }
  DB.configured = configured;
  const isStaff = () => !!(DB.staff && DB.staff.role);
  const notify = () => listeners.forEach((fn) => fn());

  // ---------- defaults (demo mode keeps all of this open) ----------
  DB.fetchPass = async (code) => DB.state.signups.find((s) => s.code === code) || null;
  DB.lookup = async (code) => DB.state.signups.find((s) => s.code === code) || null;
  DB.watchPass = () => () => {};
  DB.notifyCoupon = async () => ({ ok: true, demo: true });
  DB.signIn = async () => ({ ok: false, error: 'Logins are not used in the demo.' });
  DB.signOut = async () => {};
  DB.refresh = async () => {};

  async function load() {
    if (loading) { again = true; return loading; }
    loading = (async () => {
      try {
        const qs = TABLES.map((t) => { const q = sb.from(t).select('*'); return ORDER[t] ? q.order(ORDER[t]) : q; });
        if (isStaff()) qs.push(sb.from('signups').select('*').order('created_at'));
        const res = await Promise.all(qs);
        const bad = res.find((r) => r.error);
        if (bad) throw bad.error;
        TABLES.forEach((t, i) => {
          if (t === 'settings') DB.state.settings = Object.fromEntries(res[i].data.map((r) => [r.key, r.value]));
          else DB.state[t] = res[i].data;
        });
        DB.state.signups = isStaff() ? res[TABLES.length].data : Object.values(passes);
        DB.ready = true;
        DB.error = null;
      } catch (e) {
        DB.error = e.message || String(e);
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
    // A customer's own coupon, by code.
    DB.fetchPass = async (code) => {
      const { data, error } = await sb.rpc('get_pass', { p_code: code });
      if (error || !data) return null;
      const before = JSON.stringify(passes[code] || null);
      putPass(data);
      if (JSON.stringify(data) !== before) notify();
      return data;
    };
    // A shop looks up a code (the shop PIN is checked on the server).
    DB.lookup = async (code, pin) => {
      const { data, error } = await sb.rpc('shop_lookup', { p_code: code, p_pin: pin });
      if (error || !data) return null;
      putPass(data); notify();
      return data;
    };
    // Keep a customer's page fresh: staff tap the prize, the phone changes within a few seconds.
    DB.watchPass = (code) => {
      const id = setInterval(() => { if (!document.hidden) DB.fetchPass(code); }, 3500);
      return () => clearInterval(id);
    };
    DB.signIn = async (email, next) => {
      const dest = location.origin + '/login' + (next ? '?next=' + encodeURIComponent(next) : '');
      const { error } = await sb.auth.signInWithOtp({ email: String(email).trim().toLowerCase(), options: { emailRedirectTo: dest, shouldCreateUser: true } });
      return error ? { ok: false, error: 'We could not send the link. Check the email and try again.' } : { ok: true };
    };
    DB.refresh = async () => { await refreshStaff(); await load(); };
    DB.signOut = async () => { await sb.auth.signOut(); DB.user = null; DB.staff = {}; DB.state.signups = Object.values(passes); notify(); };
    // Send the coupon email (Netlify function). Only logged-in staff can do this.
    DB.notifyCoupon = async (code) => {
      try {
        const { data } = await sb.auth.getSession();
        const token = data && data.session && data.session.access_token;
        const r = await fetch('/.netlify/functions/send-coupon', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (token || '') }, body: JSON.stringify({ code }) });
        const j = await r.json().catch(() => ({}));
        return r.ok ? j : { ok: false, error: j.error || 'The email could not be sent.' };
      } catch (e) { return { ok: false, error: 'The email could not be sent.' }; }
    };
  }

  DB.start = async function () {
    // Demo: everything runs inside the visitor's own browser. No database needed.
    const demoPage = /^\/demo(\/|$)/.test(location.pathname) || new URLSearchParams(location.search).get('demo') === '1';
    if ((window.CONFIG.mode !== 'live' || demoPage) && window.LocalDB) { window.LocalDB.start(DB); return; }
    if (!configured()) { DB.error = 'not-configured'; notify(); return; }
    const c = window.CONFIG.supabase;
    sb = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    DB.mode = 'live';
    liveExtras();
    await refreshStaff();
    await load();
    sb.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT' || evt === 'TOKEN_REFRESHED') setTimeout(async () => { await refreshStaff(); await load(); }, 0);
    });
    const ch = sb.channel('live-' + Math.random().toString(36).slice(2, 8));
    TABLES.concat(['signups']).forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, soon));
    ch.subscribe();
    // Backup: refresh when the tab comes back, and every 30 seconds.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    setInterval(() => { if (!document.hidden) load(); }, 30000);
  };

  // Call one of the locked functions. Always returns {ok, error?, ...}.
  // Pass {reload:false} for read-only calls.
  DB.rpc = async function (name, args, opts) {
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) return { ok: false, error: 'Something went wrong. Please try again.' };
      if (!opts || opts.reload !== false) await load();
      return data === null || data === undefined ? { ok: true } : data;
    } catch (e) {
      return { ok: false, error: 'No connection. Please try again.' };
    }
  };

  // Read-only call that returns raw data (arrays and so on).
  DB.read = async function (name, args) {
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  };

  window.DB = DB;
})();
