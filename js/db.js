// Talks to Supabase. Reads the shared tables, listens for live changes,
// and calls the locked database functions.
(function () {
  const TABLES = ['settings', 'areas', 'events', 'shops', 'signups', 'campaigns', 'prizes', 'workshops', 'bookings'];
  const ORDER = {
    settings: null, areas: 'sort_order', events: 'id', shops: 'sort_order', signups: 'created_at',
    campaigns: 'sort_order', prizes: 'sort_order', workshops: 'date', bookings: 'id'
  };
  const listeners = [];
  const DB = {
    listeners,
    ready: false,
    error: null,
    state: { settings: {}, areas: [], events: [], shops: [], signups: [], campaigns: [], prizes: [], workshops: [], bookings: [] },
    onChange(fn) { listeners.push(fn); }
  };
  let sb = null;
  let loading = null;
  let again = false;

  function configured() {
    const c = window.CONFIG.supabase;
    return c && /^https:\/\//.test(c.url) && c.anonKey && !/PASTE_/.test(c.anonKey);
  }
  DB.configured = configured;

  async function load() {
    if (loading) { again = true; return loading; }
    loading = (async () => {
      try {
        const res = await Promise.all(TABLES.map((t) => {
          const q = sb.from(t).select('*');
          return ORDER[t] ? q.order(ORDER[t]) : q;
        }));
        const bad = res.find((r) => r.error);
        if (bad) throw bad.error;
        TABLES.forEach((t, i) => {
          if (t === 'settings') DB.state.settings = Object.fromEntries(res[i].data.map((r) => [r.key, r.value]));
          else DB.state[t] = res[i].data;
        });
        DB.ready = true;
        DB.error = null;
      } catch (e) {
        DB.error = e.message || String(e);
      }
      loading = null;
      listeners.forEach((fn) => fn());
      if (again) { again = false; load(); }
    })();
    return loading;
  }
  DB.load = load;

  let timer = null;
  function soon() {
    clearTimeout(timer);
    timer = setTimeout(load, 150);
  }

  DB.start = async function () {
    // Demo mode: no database. Everything runs inside the visitor's own browser.
    if (window.CONFIG.mode !== 'supabase' && window.LocalDB) { window.LocalDB.start(DB); return; }
    if (!configured()) { DB.error = 'not-configured'; listeners.forEach((fn) => fn()); return; }
    const c = window.CONFIG.supabase;
    sb = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: false } });
    await load();
    const ch = sb.channel('demo-live-' + Math.random().toString(36).slice(2, 8));
    TABLES.forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, soon));
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
