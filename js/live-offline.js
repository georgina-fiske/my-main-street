// Offline-first for festival day. With no signal at all, these keep working and send themselves later:
//   LB.sq  sign-ups (a customer's phone, and the desk's "No smartphone?" form)
//   LB.dq  prize-desk taps (award and undo)
// Everything waiting is kept in the device's own storage (not memory), so a refresh or a restart loses nothing.
// Each send is safe to repeat: the database ignores the same entry the second time.
(function () {
  const D = window.DB, U = window.U, App = window.App;
  if (!D.live) return;
  const LB = App.live;
  const KS = 'msr-sq-v1', KD = 'msr-dq-v1', KC = 'msr-dq-conflicts-v1';

  // ---- storage that still works if the browser blocks it (then it lasts until a refresh) ----
  const mem = {};
  const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (Array.isArray(v)) return v; } catch (e) { /* fall through */ } return mem[k] ? mem[k].slice() : []; };
  const write = (k, v) => { mem[k] = v.slice(); try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kept in memory */ } };
  const hex = (n) => { const a = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(a); return Array.from(a, (b) => (b % 16).toString(16)).join(''); };
  const genCode = () => { const a = new Uint32Array(1); window.crypto.getRandomValues(a); return 'CMS-' + (1000 + (a[0] % 9000)); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const online = () => navigator.onLine !== false;
  const store = App.store;

  // ================= sign-ups =================
  const sq = LB.sq = {};
  const locks = {};                                    // code -> when the try started (a stuck try is ignored after 8 seconds)
  const locked = (c) => locks[c] && Date.now() - locks[c] < 8000;
  sq.list = () => read(KS);
  sq.find = (code) => read(KS).find((e) => e.code === code) || null;
  sq.pending = () => read(KS).filter((e) => e.status === 'pending');
  const put = (e) => { const all = read(KS).filter((x) => x.code !== e.code); all.push(e); write(KS, all); };
  const drop = (code) => write(KS, read(KS).filter((x) => x.code !== code));

  // One try at sending an entry. Returns {state: 'synced' | 'pending' | 'existing' | 'error', ...}
  async function syncOne(e, queued) {
    if (locked(e.code)) return { state: 'pending' };
    locks[e.code] = Date.now();
    try {
      const r = await D.rpc('signup', Object.assign({}, e.args, { p_code: e.code, p_token: e.token, p_queued: !!queued }), { reload: false });
      if (r.network || r.transport) return { state: 'pending' };          // no signal, or the login needs refreshing: keep it and try again
      if (!r.ok) return { state: 'error', error: r.error };
      if (r.existing) { drop(e.code); return { state: 'existing', code: r.code }; }          // already signed up: nothing was added
      const was = e.code;
      // sent: forget the personal details on this phone, keep only a small "done" note so a refresh never sends it again
      const done = { code: r.code, token: r.token, area: e.args.p_area, status: 'synced', at: Date.now() };
      if (r.code !== was) drop(was);
      put(done);
      if (r.code !== was && store.get('msr-code') === was) { store.set('msr-code', r.code); store.set('msr-token', r.token); }
      return { state: 'synced', code: r.code, token: r.token, changed: r.code !== was, was, duplicate: !!r.duplicate_of };
    } finally { delete locks[e.code]; }
  }

  // Customer or staff presses "send". Shows success straight away if there's no signal (or a slow one).
  sq.submit = async (area, d, opts) => {
    const o = opts || {};
    const args = LB.signupArgs(area, d);
    const e = { code: genCode(), token: hex(20), args, area, status: 'pending', at: Date.now(), staff: !!o.staff };
    put(e);
    if (!o.staff) { store.set('msr-code', e.code); store.set('msr-token', e.token); } else D.applyLocal();
    // Online: wait a few seconds for the answer, so a real problem (sign-ups closed, bad number) shows on the form.
    const first = online() ? syncOne(e, false) : Promise.resolve({ state: 'pending' });
    const r = await Promise.race([first, sleep(4000).then(() => ({ state: 'pending' }))]);
    if (r.state === 'error') { drop(e.code); if (!o.staff) { store.set('msr-code', ''); store.set('msr-token', ''); } return r; }
    if (r.state === 'existing') { if (!o.staff) { store.set('msr-code', r.code); store.set('msr-token', ''); } return r; }
    if (r.state === 'synced') return { state: 'synced', code: r.code, token: r.token };
    kick();
    return { state: 'pending', code: e.code, token: e.token };
  };

  sq.flush = async () => {
    let any = false;
    for (const e of sq.pending()) {
      if (!online() && D.offline) break;
      const r = await syncOne(e, true);
      if (r.state === 'pending') break;                  // still no signal: try again later
      any = true;
      if (r.state === 'error') put(Object.assign({}, e, { status: 'failed', error: r.error, args: {} }));
      if (r.state === 'synced') {
        const ctx = App.ctx;
        if (ctx && ctx.params && ctx.params.code === r.was && r.changed) { App.go('/c/' + r.code + '?k=' + r.token, true); }
        else if (D.fetchPass && !e.staff) D.fetchPass(r.code, r.token);
      }
    }
    // tidy: forget "done" notes after a week
    const week = Date.now() - 7 * 864e5; write(KS, read(KS).filter((x) => x.status !== 'synced' || (x.at || 0) > week));
    return any;
  };

  // ================= prize desk =================
  const dq = LB.dq = {};
  dq.list = () => read(KD);
  dq.conflicts = () => read(KC);
  dq.clearConflicts = () => write(KC, []);
  const blank = (s) => { s.prize = null; s.spun_at = null; s.use_by = null; s.valid_from = null; s.redeemed = false; s.redeemed_at = null; s.redeemed_time = null; s.awarded_by = null; s.notified_at = null; };
  const applyAward = (s, p) => {
    const ev = D.state.events.find((x) => x.id === s.event);
    s.prize = { id: p.id, name: p.name, value: Number(p.value) };
    s.spun_at = new Date().toISOString(); s.use_by = (ev && ev.use_by) || s.use_by; s.valid_from = (ev && ev.valid_from) || null;
    if (Number(p.value) === 0) { s.redeemed = true; s.redeemed_at = 'desk'; s.redeemed_time = s.spun_at; }
  };

  // Keep not-yet-sent taps (and staff sign-ups) visible, even after the data is reloaded from the server.
  D.transforms.push(() => {
    const sus = D.state.signups;
    if (!Array.isArray(sus)) return;
    sq.pending().filter((e) => e.staff).forEach((e) => {
      if (!sus.some((x) => x.code === e.code)) sus.push({ code: e.code, area: e.area, event: (D.state.events.filter((v) => v.area === e.area).slice(-1)[0] || {}).id, name: e.args.p_name, last_initial: String(e.args.p_last || '').slice(0, 1).toUpperCase(), contact: e.args.p_contact, prize: null, redeemed: false, local: true, created_at: new Date(e.at).toISOString() });
    });
    dq.list().forEach((it) => {
      const s = sus.find((x) => x.code === it.code);
      if (!s) return;
      if (it.name === 'award_prize') { const p = D.state.prizes.find((x) => Number(x.id) === Number(it.args.p_prize)); if (p && !(s.prize && Number(s.prize.id) === Number(p.id))) applyAward(s, p); }
      else if (it.name === 'undo_prize') blank(s);
    });
  });

  dq.award = (s, p) => {
    const it = { id: hex(8), name: 'award_prize', args: { p_code: s.code, p_prize: p.id }, code: s.code, value: Number(p.value), who: s.name, prizeName: p.name, at: Date.now() };
    write(KD, dq.list().concat([it]));
    applyAward(s, p);
    kick();
    return it;
  };
  // Undo: if the tap hasn't been sent yet, just cancel it. If it has, send an undo.
  dq.undo = (code) => {
    const list = dq.list(), i = list.findIndex((x) => x.name === 'award_prize' && x.code === code);
    const s = D.state.signups.find((x) => x.code === code);
    if (i >= 0) { list.splice(i, 1); write(KD, list); if (s) blank(s); return 'cancelled'; }
    write(KD, list.concat([{ id: hex(8), name: 'undo_prize', args: { p_code: code }, code, at: Date.now() }]));
    if (s) blank(s);
    kick();
    return 'queued';
  };

  let flushing = false, again = false;
  async function flushAll() {
    if (flushing) { again = true; return; }          // a send is running: go round once more as soon as it ends (don't wait for the timer)
    flushing = true;
    let changed = false;
    try {
      await sq.flush();                                   // staff sign-ups go first, so their awards can follow
      for (;;) {
        const it = dq.list()[0];
        if (!it) break;
        const r = await D.rpc(it.name, it.args, { reload: false });
        if (r.network || r.transport) break;              // no signal, or the login needs refreshing: keep everything, try again later
        write(KD, dq.list().filter((x) => x.id !== it.id));
        changed = true;
        if (r.ok) {
          if (it.name === 'award_prize' && it.value > 0) {
            const n = await D.notifyCoupon(it.code);       // the database sends each coupon only once
            const S = App.state;
            if (S.lastAward && S.lastAward.code === it.code) { S.notice = n.ok ? (n.message || 'Their coupon was sent.') : (n.error + ' Their phone still shows the coupon.'); S.noticeBad = !n.ok; }
          }
        } else {
          // The database said no (for example another iPad already gave them a prize). A person needs to know.
          write(KC, read(KC).concat([{ code: it.code, who: it.who || it.code, what: it.name === 'award_prize' ? it.prizeName : 'undo', msg: r.error, at: Date.now() }]));
        }
      }
    } finally { flushing = false; if (again) { again = false; setTimeout(flushAll, 150); } }
    if (changed || sq.list().length) { try { await D.load(); } catch (e) { /* offline */ } }
    if (App.ctx) App.render();
  }
  const waiting = () => dq.list().length + sq.pending().length;
  let timer = null;
  function kick() { if (!timer) timer = setInterval(() => { if (!waiting()) { clearInterval(timer); timer = null; if (App.ctx) App.render(); return; } flushAll(); }, 4000); flushAll(); }
  LB.offlineKick = kick;
  LB.waiting = waiting;

  // A small bar for whoever has things waiting to send (same look as the prize desk's "Saving…").
  LB.syncBar = () => {
    const n = waiting();
    if (!n) return '';
    const off = !online() || D.offline;
    return `<div class="savebar${off ? '' : ' ok'}" role="status"><b>${off ? 'Saved' : 'Sending'}</b> ${off ? '— will sync when we\'re back online.' : '… one moment.'}${n > 1 ? ' (' + n + ' waiting)' : ''}</div>`;
  };

  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && waiting()) kick(); });
  if (waiting()) setTimeout(kick, 800);                     // something was left from before a refresh or restart

  // ================= the app itself, kept on the device =================
  // So the page can open again with no signal at all. (Only after it has been opened once with signal.)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
})();
