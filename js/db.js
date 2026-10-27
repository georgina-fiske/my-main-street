// Talks to Supabase. Reads tables, listens for live changes, calls the locked functions.
(function () {
  const TABLES = ['settings', 'signups', 'campaigns', 'prizes', 'workshops', 'bookings'];
  const listeners = [];
  const DB = {
    ready: false,
    error: null,
    state: { settings: {}, signups: [], campaigns: [], prizes: [], workshops: [], bookings: [] },
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
        const res = await Promise.all([
          sb.from('settings').select('*'),
          sb.from('signups').select('*').order('created_at'),
          sb.from('campaigns').select('*').order('sort_order'),
          sb.from('prizes').select('*').order('sort_order'),
          sb.from('workshops').select('*').order('date'),
          sb.from('bookings').select('*')
        ]);
        const bad = res.find((r) => r.error);
        if (bad) throw bad.error;
        const s = DB.state;
        s.settings = Object.fromEntries(res[0].data.map((r) => [r.key, r.value]));
        s.signups = res[1].data;
        s.campaigns = res[2].data;
        s.prizes = res[3].data;
        s.workshops = res[4].data;
        s.bookings = res[5].data;
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
    if (!configured()) { DB.error = 'not-configured'; listeners.forEach((fn) => fn()); return; }
    const c = window.CONFIG.supabase;
    sb = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: false } });
    await load();
    const ch = sb.channel('demo-live');
    TABLES.forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, soon));
    ch.subscribe();
    // Backup: refresh when the tab comes back, and every 30 seconds.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    setInterval(() => { if (!document.hidden) load(); }, 30000);
  };

  // Call one of the locked functions. Always returns {ok, error?, ...}.
  DB.rpc = async function (name, args) {
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) return { ok: false, error: 'Something went wrong. Please try again.' };
      await load();
      return data || { ok: true };
    } catch (e) {
      return { ok: false, error: 'No connection. Please try again.' };
    }
  };

  window.DB = DB;
})();
