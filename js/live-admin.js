// The live Admin page (my-mainstreet.com.au/admin): numbers, sign-ups, shops, prizes, look and people.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  if (!D.live) return;
  const LP = App.livePages, LB = App.live;
  const TABS = [['details', 'Key details'], ['overview', 'Overview'], ['signups', 'Sign-ups'], ['shops', 'Shops'], ['prizes', 'Prizes'], ['look', 'Look'], ['messages', 'Messages'], ['people', 'People'], ['pages', 'Site pages']];
  const LEVELS = { chaos: 'Chaos Master', fruitbowl: 'Fruitbowl', council: 'Council', street: 'Street Association', desk: 'Prize desk', shop: 'Shop' };

  const adminArea = (ctx) => {
    if (ctx.area) return ctx.area;        // on croydon.my-mainstreet.com.au it is always Croydon
    const s = D.staff || {};
    if (['council', 'street'].includes(s.role) && s.area) return s.area;
    const q = ctx.q.get('area');
    if (d0.area(q)) return q;
    return (d0.area(C.demoHomeArea) ? C.demoHomeArea : (D.state.areas[0] || {}).id) || C.demoHomeArea;
  };
  const limitOf = () => { const v = parseInt(D.state.settings.budget_limit, 10); return Number.isFinite(v) ? v : 5000; };

  // ---------- numbers ----------
  function stats(area) {
    const all = d0.signupsOf(area), won = all.filter((s) => s.prize), coupons = won.filter((s) => Number(s.prize.value) > 0);
    return {
      signups: all.length, won: won.length, coupons: coupons.length, small: won.length - coupons.length,
      value: coupons.reduce((a, s) => a + Number(s.prize.value), 0),
      used: coupons.filter((s) => s.redeemed).length,
      usedValue: coupons.filter((s) => s.redeemed).reduce((a, s) => a + Number(s.prize.value), 0)
    };
  }


  // ---------- dashboard pieces ----------
  const ICON = {
    people: '<path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="8" r="3.5"/><path d="M21 20v-1a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6"/>',
    ticket: '<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
    dollar: '<path d="M12 3v18M16 7.5c-.6-1.2-2-2-4-2-2.4 0-4 1.2-4 3s1.6 2.6 4 3 4 1.2 4 3-1.6 3-4 3c-2 0-3.5-.8-4-2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'
  };
  const card = (icon, num, label) => `<div class="mcard"><div class="mbadge" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[icon]}</svg></div><b>${esc(num)}</b><span class="l">${esc(label)}</span></div>`;

  // A simple line chart of running totals: sign-ups and coupons won, by hour (or by day if it spans more than 2 days).
  function chart(rows) {
    if (!rows) return '<p class="muted">Loading…</p>';
    const t = (x) => (x ? Date.parse(String(x).replace(' ', 'T') + ':00') : NaN);
    const su = rows.map((r) => t(r.signed_up)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    const won = rows.filter((r) => r.prize).map((r) => t(r.won)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (!su.length) return '<p class="muted">No sign-ups yet. The chart appears with the first one.</p>';
    const span = su[su.length - 1] - su[0], step = span > 2 * 864e5 ? 864e5 : 36e5, start = Math.floor(su[0] / step) * step;
    const end = Math.max(su[su.length - 1], won.length ? won[won.length - 1] : 0), n = Math.max(2, Math.floor((end - start) / step) + 2);
    const series = (a) => { const out = Array(n).fill(0); a.forEach((x) => { for (let i = Math.floor((x - start) / step); i < n; i++) out[i]++; }); return out; };
    const A = series(su), B = series(won), max = Math.max(1, A[n - 1]);
    const W = 640, H = 200, L = 38, R = 10, T = 10, Bt = 28, x = (i) => L + (i * (W - L - R)) / (n - 1), y = (v) => T + (H - T - Bt) * (1 - v / max);
    const pts = (a) => a.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const lab = (ms) => new Date(ms).toLocaleString('en-AU', step === 864e5 ? { day: 'numeric', month: 'short' } : { weekday: 'short', hour: 'numeric', hour12: true });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Running totals: ${A[n - 1]} sign-ups and ${B[n - 1]} coupons won">
      ${[0, 0.5, 1].map((f) => `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}"/><text x="${L - 6}" y="${(y(max * f) + 4).toFixed(1)}" text-anchor="end">${Math.round(max * f)}</text>`).join('')}
      <polygon points="${x(0)},${y(0)} ${pts(A)} ${x(n - 1)},${y(0)}" fill="var(--chart)" opacity=".14"/>
      <polyline points="${pts(A)}" fill="none" stroke="var(--chart)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${pts(B)}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round"/>
      <text x="${L}" y="${H - 6}">${esc(lab(start))}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(lab(start + (n - 1) * step))}</text></svg>
      <p class="legend"><span><i style="background:var(--chart)"></i>Sign-ups (${A[n - 1]})</span><span><i style="background:var(--ink)"></i>Coupons won (${B[n - 1]})</span></p>`;
  }

  // ---------- the spreadsheet ----------
  const COLS = [
    { label: 'First name', key: 'first_name' }, { label: 'Last name', key: 'last_name' }, { label: 'Email', key: 'email' }, { label: 'Mobile', key: 'mobile' },
    { label: 'Postcode', key: 'postcode' }, { label: 'Contact by', key: 'contact' }, { label: 'News opt-in', get: (r) => (r.optin ? 'Yes' : 'No') },
    { label: 'Signed up (date and time)', key: 'signed_up' }, { label: 'Event', key: 'event' }, { label: 'Coupon code', key: 'code' }, { label: 'Possible duplicate of', key: 'duplicate_of' }, { label: 'Prize', key: 'prize' },
    { label: 'Value ($)', get: (r) => (r.value == null ? '' : r.value) }, { label: 'Won (date and time)', key: 'won' }, { label: 'Status', key: 'status' }, { label: 'Coupons work from', key: 'valid_from' },
    { label: 'Used at (shop)', key: 'used_at' }, { label: 'Used (date and time)', key: 'used' }
  ];
  async function loadReport(area) {
    const rows = await D.read('report_rows', { p_area: area });
    App.state.report = { area, rows: rows || [], at: Date.now() };
  }
  const reportFor = (area) => (App.state.report && App.state.report.area === area ? App.state.report.rows : null);

  // ---------- QR codes ----------
  LB.qrDownload = async (url, name, kind) => {
    const svg = U.qrSvg(url, 12);
    if (kind === 'svg') { U.downloadFile(name + '.svg', svg, 'image/svg+xml'); return; }
    const img = new Image();
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const size = 1200, pad = 80, c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.imageSmoothingEnabled = false;
    g.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
    c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); });
  };
  U.downloadFile = (filename, text, type) => {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const qrCard = (title, url, file) => `<div class="panel qrcard printable"><h3>${esc(title)}</h3>
      <div class="qr" role="img" aria-label="QR code for ${esc(url)}" style="background:#fff;border-radius:8px;padding:10px;width:fit-content;margin:8px auto"><span class="qrbigsvg">${U.qrSvg(url, 6)}</span></div>
      <p class="small" style="word-break:break-all;text-align:center"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p>
      <p class="row noprint" style="justify-content:center"><button class="btn small" data-act="ladmin-qr" data-url="${esc(url)}" data-file="${esc(file)}" data-kind="png">Download PNG</button>
      <button class="btn ghost small" data-act="ladmin-qr" data-url="${esc(url)}" data-file="${esc(file)}" data-kind="svg">Download SVG</button>
      <button class="btn ghost small" data-act="print-page">Print</button></p></div>`;
  App.acts['ladmin-qr'] = (b) => LB.qrDownload(b.dataset.url, b.dataset.file, b.dataset.kind);
  App.acts['print-page'] = () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); };


  // Links that work on the real domain, and also on the Netlify preview address.
  const pageUrl = (area, path) => (window.PREVIEW ? path + (path.includes('?') ? '&' : '?') + 'preview=' + (area || 'main') : (area ? App.areaOrigin(area) : App.mainOrigin()) + path);
  function pagesTab(area) {
    const a = d0.area(area), rows = [
      ['Sign-up page', 'Customers scan the QR and sign up here.', pageUrl(area, '/')],
      ['Coupon page', 'Each customer gets their own secret link when they sign up, so there is no fixed address. Sign up on the page above to see one.', pageUrl(area, '/')],
      ['Shops list', 'The shops that take coupons.', pageUrl(area, '/shops')],
      ['Prize desk', 'For the two iPads at the wheel. Staff log in.', pageUrl(area, '/desk')],
      ['Shop set-up (claim)', 'A shop sets up its account here. This is the shop QR code.', pageUrl(area, '/shop/claim')],
      ['Shop portal (log in)', 'A shop checks and uses coupons here.', pageUrl(area, '/shop')],
      ['Safety and privacy', 'The safety page, shared by every street.', pageUrl(null, '/safety')],
      ['Log in', 'Staff log in. One login works on the main site and every street.', pageUrl(null, '/login')],
      ['Admin (this page)', 'Numbers, sign-ups, shops, prizes, look and people.', pageUrl(area, '/admin')],
      ['Demo', 'The guided demo with made-up shops. It never touches real data.', '/demo']
    ];
    return `<div class="panel"><h3>Every page on the site${a ? ' for ' + esc(a.name) : ''}</h3><p class="muted">Tap a link to open it. Pick a different street at the top to see its pages.</p>
      <div class="table-wrap"><table style="min-width:0"><thead><tr><th>Page (tap to open)</th><th>What it is</th></tr></thead><tbody>
      ${rows.map(([n, w, u]) => `<tr><td style="white-space:nowrap"><a href="${esc(u)}" target="_blank" rel="noopener"><b>${esc(n)}</b> ↗</a></td><td>${esc(w)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  // ---------- the page ----------
  LP.admin = {
    brand: (ctx) => (d0.area(adminArea(ctx)) ? App.brandOf(adminArea(ctx)) : LB.fb()),
    title: () => 'Admin',
    async after(ctx) {
      const tab = ctx.q.get('tab') || 'details', area = adminArea(ctx);
      if (!D.user || !LB.canManage(area)) return;
      if (['signups', 'overview'].includes(tab) && !ctx.reportAsked) {
        ctx.reportAsked = true;
        await loadReport(area); App.render();
        const t = setInterval(async () => { if (!document.hidden && App.ctx === ctx) { await loadReport(area); if (['signups', 'overview'].includes(ctx.q.get('tab') || 'details')) App.render(); } }, 10000);
        ctx.stop = () => clearInterval(t);
      }
      if (tab === 'people' && !ctx.peopleAsked && LB.isHq()) { ctx.peopleAsked = true; App.state.people = (await D.read('staff_list')) || []; App.render(); }
    },
    render(ctx, b) {
      const area = adminArea(ctx);
      if (!D.user || !LB.canManage(area)) return LB.gate('Admin');
      const a = d0.area(area);
      if (!a) return `${LB.band('Admin', b, [])}<main class="wrap" id="main"><div class="panel"><h2>No street set up yet</h2><p>Run the Croydon set-up file in Supabase, or add a street.</p></div></main>${LB.footer()}`;
      const tab = TABS.some((t) => t[0] === ctx.q.get('tab')) ? ctx.q.get('tab') : 'details';
      const hq = LB.isHq(), S = App.state;
      const link = (t) => (ctx.area ? `/admin?tab=${t}` : `/admin?area=${encodeURIComponent(area)}&tab=${t}`);
      let body = '';
      if (tab === 'details') body = detailsTab(area);
      else if (tab === 'overview') {
        const st = stats(area), limit = limitOf(), pct = limit ? Math.min(100, Math.round((st.value / limit) * 100)) : 0;
        const ev = d0.eventsOf(area).slice(-1)[0];
        const pctUsed = st.coupons ? Math.round((st.used / st.coupons) * 100) : 0;
        body = `<div class="mcards">
            ${card('people', st.signups, 'Sign-ups')}${card('ticket', st.coupons, 'Coupons won')}${card('dollar', money(st.value), '$ won')}
            ${card('check', st.used, 'Coupons used')}${card('cash', money(st.usedValue), '$ used')}${card('percent', pctUsed + '%', 'Of coupons used')}</div>
          <div class="grid two">
            <section class="panel"><h3>Sign-ups and coupons won</h3>${chart(reportFor(area))}</section>
            <section class="panel meter ${st.value > limit * 0.9 ? 'warn' : ''}"><h3>Budget spent</h3><p class="muted" style="margin:4px 0 14px">Coupon value given out, against your limit.</p>
              <div class="row" style="justify-content:space-between"><b style="font-size:26px">${money(st.value)}</b><span class="muted">of ${money(limit)} (${pct}%)</span></div>
              <div class="bar big" role="img" aria-label="${pct}% of the budget spent"><i style="width:${pct}%"></i></div>
              ${st.value > limit * 0.9 ? '<p style="margin:12px 0 0"><span class="tag no">Budget nearly spent</span></p>' : ''}</section></div>
          <div class="grid two gap">
            <section class="panel"><h3>Sign-ups</h3><p>${a.status === 'live' ? '<span class="tag">Open</span> Customers can sign up now.' : '<span class="tag wait">Closed</span> Customers see "Sign-ups are not open yet".'}</p>
              ${hq ? `<p><button class="btn ${a.status === 'live' ? 'ghost' : 'sun'}" data-act="ladmin-open" data-v="${a.status === 'live' ? 'setting up' : 'live'}">${a.status === 'live' ? 'Close sign-ups' : 'Open sign-ups'}</button></p>` : ''}
              <h3 style="margin-top:14px">The festival</h3>${ev ? `<p><b>${esc(ev.name)}</b>, ${esc(U.date(ev.starts_on))}.<br>${esc(LB.windowText(ev) || '')}</p><p><a href="${link('details')}">Change the dates and wording in Key details</a></p>` : '<p class="muted">No event yet.</p>'}</section>
            <section class="panel"><h3>The wheel</h3>${wheelTable(area, false)}</section></div>
          <div class="grid two gap">${qrCard('Sign-up page (marquee poster)', App.areaOrigin(area), area + '-signup-qr')}${qrCard('Shop set-up (shop one-pager)', App.areaOrigin(area) + '/shop/claim', area + '-shop-qr')}</div>
          <p style="margin-top:14px"><button class="btn" data-act="ladmin-csv">Download spreadsheet</button></p>`;
      } else if (tab === 'signups') {
        const rows = reportFor(area), q = (S.suQ || '').toLowerCase();
        const list = rows ? rows.filter((r) => !q || [r.first_name, r.last_name, r.email, r.mobile, r.code, r.prize, r.status, r.used_at].join(' ').toLowerCase().includes(q)) : null;
        body = `<div class="row" style="justify-content:space-between;margin-bottom:10px"><div style="flex:1;min-width:220px"><label for="su-q" class="sr">Search sign-ups</label>
            <input id="su-q" type="search" placeholder="Search by name, email, mobile or code" data-input="ladmin-search" value="${esc(S.suQ || '')}"></div>
            <button class="btn" data-act="ladmin-csv">Download spreadsheet</button></div>
          ${list ? `<p class="muted small">${list.length} of ${rows.length} sign-ups</p><div class="table-wrap"><table><thead><tr>${COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody id="su-body">${suRows(list)}</tbody></table></div>` : '<p class="muted">Loading…</p>'}`;
      } else if (tab === 'shops') body = shopsTab(area);
      else if (tab === 'prizes') body = prizesTab(area, hq);
      else if (tab === 'look') {
        const d = App.draftFor(area);
        body = `<div class="grid duo"><section class="panel">${App.admin.lookForm(area, true)}</section><section><h3 style="margin-bottom:10px">Live preview</h3><div id="brand-preview">${App.admin.brandPreview(d)}</div></section></div>`;
      } else if (tab === 'messages') body = messagesTab(area);
      else if (tab === 'pages') body = pagesTab(area);
      else if (tab === 'people') {
        if (!hq) body = '<div class="panel"><p>Only Fruitbowl can invite people.</p></div>';
        else {
          const mine = LB.role();
          const levels = [['fruitbowl', 'Fruitbowl'], ['council', 'Council'], ['street', 'Street Association'], ['desk', 'Prize desk']].concat(mine === 'chaos' ? [['chaos', 'Chaos Master']] : []);
          body = `<div class="panel"><h3>Invite someone</h3><p class="muted">Leave the password empty and they get an email with a link to choose their own. Or type a password (8 or more characters) and they can log in straight away. Send it to them privately.</p>
            <form data-form="linvite" class="row" style="align-items:flex-end">
              <div style="flex:1;min-width:150px"><label for="iv-name">Name</label><input id="iv-name" name="name" maxlength="80"></div>
              <div style="flex:2;min-width:200px"><label for="iv-email">Email</label><input id="iv-email" name="email" type="email" required></div>
              <div style="flex:1;min-width:150px"><label for="iv-role">Level</label><select id="iv-role" name="role">${levels.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
              ${ctx.area ? `<input type="hidden" name="area" value="${esc(area)}">` : `<div style="flex:1;min-width:170px"><label for="iv-area">Street</label><select id="iv-area" name="area">${d0.areas().map((x) => `<option value="${esc(x.id)}" ${x.id === area ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`}
              <div style="flex:1;min-width:200px"><label for="iv-pw">Password (optional)</label><input id="iv-pw" name="password" type="text" autocomplete="off" minlength="8" placeholder="Leave empty to send an email"></div>
              <button class="btn" type="submit">Add person</button></form>
            <p class="small muted">Fruitbowl, Chaos Master: every street. Council and Street Association: their own street only. Prize desk: the prize desk for one street. Shops set up their own accounts from the shop one-pager.</p>
            <p class="err" id="iv-err" role="alert" hidden></p><p class="ok" id="iv-ok" role="status" hidden></p></div>
            <div class="panel gap"><h3>Everyone with a login</h3>${S.people ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Level</th><th>Street or shop</th><th></th></tr></thead><tbody>
              ${S.people.map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(LEVELS[x.role] || x.role)}</td><td>${esc(x.shop || x.area || 'All')}</td><td>${x.email === (D.user || {}).email ? '<span class="muted">You</span>' : `<button class="btn ghost small" data-act="ladmin-remove" data-email="${esc(x.email)}">Remove access</button>`}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No one yet.</td></tr>'}</tbody></table></div>` : '<p class="muted">Loading…</p>'}</div>`;
        }
      }
      return `${LB.band('Admin', b, [['/admin', 'Admin', true]])}<main class="wrap dash" id="main">
        <div class="row" style="justify-content:space-between;margin-bottom:6px">
          ${hq && !ctx.area ? `<div><label for="ad-area" style="margin:0">Street</label><select id="ad-area" data-change="ladmin-area" style="max-width:340px">${d0.areas().map((x) => `<option value="${esc(x.id)}" ${x.id === area ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : `<b>${esc(a.name)}</b>`}
          <span class="tag ${a.status === 'live' ? '' : 'wait'}">${a.status === 'live' ? 'Sign-ups open' : 'Sign-ups closed'}</span></div>
        ${LB.netBanner('what you were doing')}
        <nav class="tabsbar" aria-label="Admin">${TABS.map((t) => `<a href="${link(t[0])}"${t[0] === tab ? ' aria-current="page"' : ''}>${t[1]}</a>`).join('')}</nav>
        ${body}</main>${LB.footer()}`;
    }
  };

  const suRows = (list) => list.map((r) => `<tr>${COLS.map((c) => `<td>${esc(typeof c.get === 'function' ? c.get(r) : r[c.key] == null ? '' : r[c.key])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${COLS.length}" class="muted">No sign-ups match.</td></tr>`;
  App.changes['ladmin-search'] = (el) => {
    App.state.suQ = el.value;
    const rows = reportFor(adminArea(App.ctx)), q = el.value.toLowerCase();
    const body = document.getElementById('su-body');
    if (rows && body) body.innerHTML = suRows(rows.filter((r) => !q || [r.first_name, r.last_name, r.email, r.mobile, r.code, r.prize, r.status, r.used_at].join(' ').toLowerCase().includes(q)));
  };
  App.changes['ladmin-area'] = (el) => { App.state.report = null; App.state.brandDraft = null; App.go('/admin?area=' + encodeURIComponent(el.value) + '&tab=' + (App.ctx.q.get('tab') || 'details')); };

  App.acts['ladmin-csv'] = async () => {
    const area = adminArea(App.ctx);
    await loadReport(area);
    const rows = reportFor(area) || [];
    U.download(`my-main-street-${area}-signups-${U.today()}.csv`, U.csv(COLS, rows));
    D.rpc('report_log', { p_kind: 'signups', p_area: area }, { reload: false });
    U.toast('Spreadsheet downloaded.');
  };
  App.acts['ladmin-open'] = (b) => LB.save('area_set_status', { p_id: adminArea(App.ctx), p_status: b.dataset.v }).then((r) => { if (r.ok) U.toast(b.dataset.v === 'live' ? 'Sign-ups are open.' : 'Sign-ups are closed.'); else U.toast(r.error, true); });

  // ---------- prizes ----------
  function wheelTable(area, edit) {
    const ps = d0.prizesOf(area), staffSees = D.staff && D.staff.role;
    if (!staffSees) return '';
    return `<div class="table-wrap"><table><thead><tr><th>Prize</th><th>Value</th><th>Won</th><th>Cap</th><th>Left</th></tr></thead><tbody>
      ${ps.map((p) => `<tr><td><span class="dot-pill" style="background:${esc(p.color)}"></span>${esc(p.name)}</td><td>${p.value ? money(p.value) : 'Small prize'}</td><td>${d0.given(p)}</td><td>${p.stock}</td><td>${d0.left(p)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No prizes yet.</td></tr>'}</tbody></table></div>`;
  }
  // What a customer's text will do with this prize's message (a text holds about 160 characters).
  function noteHint(area, p, note) {
    const n = String(note || '').trim();
    if (!n) return 'Nothing extra is added for this prize.';
    if (Number(p.value) === 0) return `${n.length}/300. A small prize is handed over at the desk, so the message shows on the customer's phone and on the desk screen.`;
    const r = window.Messages.sms(Object.assign(sampleFor(area), { prizeName: p.name, prizeNote: n, value: p.value }));
    return `${n.length}/300. It shows on the customer's coupon page and in the email. ` + (r.noteDropped ? 'It is too long for the text message, even as two texts, so the text leaves it out.' : r.parts > 1 ? 'In the text it makes the message 2 texts joined together, which costs a little more to send.' : 'It also fits in the text message (one text).');
  }
  App.changes['lprize-hint'] = (el) => {
    const area = adminArea(App.ctx), p = d0.prizesOf(area).find((x) => String(x.id) === el.dataset.pid), h = document.getElementById('pz-' + el.dataset.pid + '-hint');
    if (p && h) h.textContent = noteHint(area, p, el.value);
  };
  function prizesTab(area, hq) {
    const ps = d0.prizesOf(area), limit = limitOf();
    const capTotal = ps.filter((p) => p.value > 0).reduce((a, p) => a + p.value * p.stock, 0);
    return `<div class="panel"><h3>The wheel</h3><p class="muted">The most you can give away: <b>${money(capTotal)}</b> in coupons (every cap used). The budget limit is <b>${money(limit)}</b>. The prize desk stops coupons when the limit is reached.</p>
      ${hq ? `<form data-form="lbudget" class="row" style="align-items:flex-end"><div><label for="bg">Budget limit ($)</label><input id="bg" name="limit" inputmode="numeric" value="${limit}" style="max-width:160px"></div><button class="btn" type="submit">Save limit</button></form>` : ''}</div>
      ${ps.map((p) => `<form class="panel prizecard" data-form="lprize" data-id="${p.id}">
        <div class="row" style="justify-content:space-between"><h3><span class="dot-pill" style="background:${esc(p.color)}"></span>${esc(p.name)}</h3><span class="muted">${d0.given(p)} won of ${p.stock}</span></div>
        <div class="prizegrid">
          <div><label for="pz-${p.id}-name">Prize name</label><input id="pz-${p.id}-name" name="name" value="${esc(p.name)}" maxlength="60"></div>
          <div><label for="pz-${p.id}-value">Value $ <span class="muted">(budget only. Customers never see it. 0 = small prize)</span></label><input id="pz-${p.id}-value" name="value" inputmode="numeric" value="${p.value}" ${d0.given(p) ? 'readonly' : ''}></div>
          <div><label for="pz-${p.id}-stock">Cap (how many)</label><input id="pz-${p.id}-stock" name="stock" inputmode="numeric" value="${p.stock}"></div>
          <div><label for="pz-${p.id}-order">Order</label><input id="pz-${p.id}-order" name="order" inputmode="numeric" value="${p.sort_order}"></div>
          <div><label for="pz-${p.id}-color">Colour</label><input id="pz-${p.id}-color" name="color" type="color" value="${esc(p.color)}" style="width:64px;padding:2px"></div>
        </div>
        <label for="pz-${p.id}-msg">Message for the customer <span class="muted">(optional)</span></label>
        <textarea id="pz-${p.id}-msg" name="message" rows="3" maxlength="300" data-input="lprize-hint" data-pid="${p.id}" placeholder="For example: Collect your chocolate bar from the Croydon Bakehouse stall.">${esc(p.message || '')}</textarea>
        <p class="muted small" id="pz-${p.id}-hint" style="margin:4px 0 12px">${esc(noteHint(area, p, p.message))}</p>
        <div class="row"><button class="btn small" type="submit">Save</button>${d0.given(p) ? '' : `<button class="btn ghost small" type="button" data-act="ladmin-rmprize" data-id="${p.id}">Remove</button>`}</div></form>`).join('') || '<div class="panel"><p class="muted">No prizes yet.</p></div>'}
      <form class="panel" data-form="laddprize"><h3>Add a prize</h3>
        <div class="prizegrid">
          <div><label for="np-name">Prize name</label><input id="np-name" name="name" required placeholder="$20 coupon"></div>
          <div><label for="np-value">Value $ <span class="muted">(budget only. Customers never see it. 0 = small prize)</span></label><input id="np-value" name="value" inputmode="numeric" required></div>
          <div><label for="np-stock">Cap (how many)</label><input id="np-stock" name="stock" inputmode="numeric" required></div>
          <div><label for="np-color">Colour</label><input id="np-color" name="color" type="color" value="#006BB6" style="width:64px;padding:2px"></div>
        </div>
        <label for="np-msg">Message for the customer <span class="muted">(optional)</span></label>
        <textarea id="np-msg" name="message" rows="3" maxlength="300" placeholder="Added to this prize's text, email and coupon page."></textarea>
        <p style="margin-top:12px"><button class="btn" type="submit">Add prize</button></p></form>`;
  }
  App.forms.lprize = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await LB.save('prize_update', { p_id: Number(f.dataset.id), p_name: d.name, p_value: parseInt(d.value, 10) || 0, p_stock: parseInt(d.stock, 10) || 0, p_color: d.color, p_order: parseInt(d.order, 10) || 0, p_message: String(d.message || '') });
    U.toast(r.ok ? 'Saved.' : r.error, !r.ok);
  };
  App.forms.laddprize = async (f) => {
    const d = Object.fromEntries(new FormData(f)), v = Number(d.value), q = Number(d.stock);
    if (!(v >= 0) || !(q >= 1)) return U.toast('Value and cap need to be numbers.', true);
    const r = await LB.save('add_prize', { p_area: adminArea(App.ctx), p_name: d.name, p_value: Math.round(v), p_stock: Math.round(q), p_color: d.color, p_message: String(d.message || '') });
    if (r.ok) { f.reset(); U.toast('Prize added.'); } else U.toast(r.error, true);
  };
  App.acts['ladmin-rmprize'] = async (b) => { const r = await LB.save('remove_prize', { p_id: Number(b.dataset.id) }); U.toast(r.ok ? 'Removed.' : r.error, !r.ok); };
  App.forms.lbudget = async (f) => {
    const r = await LB.save('set_setting', { p_key: 'budget_limit', p_value: String(parseInt(new FormData(f).get('limit'), 10) || 0) });
    U.toast(r.ok ? 'Saved.' : r.error, !r.ok);
  };

  // ---------- shops ----------
  function shopsTab(area) {
    const shops = d0.shopsOf(area).slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="panel"><h3>Shops</h3><p class="muted">Every shop takes coupons. Each shop sets up its own account the first time, from the shop QR code. <b>${shops.filter((s) => s.claimed).length}</b> of <b>${shops.length}</b> have set up.</p>
      <div class="table-wrap"><table><thead><tr><th>Shop</th><th>Type</th><th>Account</th><th>Show on list</th><th></th></tr></thead><tbody>
      ${shops.map((s) => `<tr><form id="sf-${esc(s.id)}" data-form="lshop" data-id="${esc(s.id)}"></form>
        <td><input form="sf-${esc(s.id)}" name="name" value="${esc(s.name)}" maxlength="60" style="min-width:170px" aria-label="Shop name"></td>
        <td><input form="sf-${esc(s.id)}" name="type" value="${esc(s.type)}" maxlength="30" style="min-width:110px" aria-label="Type"></td>
        <td><span class="tag ${s.claimed ? '' : 'wait'}">${s.claimed ? 'Set up' : 'Not yet'}</span></td>
        <td><label class="check" style="margin:0"><input id="sh-show-${esc(s.id)}" form="sf-${esc(s.id)}" type="checkbox" name="show" ${s.hidden ? '' : 'checked'}> Show</label></td>
        <td><button class="btn small" form="sf-${esc(s.id)}" type="submit">Save</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No shops yet.</td></tr>'}</tbody></table></div>
      <form data-form="laddshop" class="row" style="margin-top:12px;align-items:flex-end">
        <div style="flex:2;min-width:170px"><label for="ns-name">Add a shop</label><input id="ns-name" name="name" required placeholder="Croydon Florist"></div>
        <div style="flex:1;min-width:120px"><label for="ns-type">Type</label><input id="ns-type" name="type" placeholder="Florist"></div>
        <button class="btn" type="submit">Add shop</button></form></div>`;
  }
  App.forms.lshop = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await LB.save('shop_update', { p_id: f.dataset.id, p_name: d.name, p_type: d.type || '', p_hidden: !d.show });
    U.toast(r.ok ? 'Saved.' : r.error, !r.ok);
  };
  App.forms.laddshop = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await LB.save('shop_add', { p_area: adminArea(App.ctx), p_name: d.name, p_type: d.type || '' });
    if (r.ok) { f.reset(); U.toast('Shop added.'); } else U.toast(r.error, true);
  };



  // ---------- Key details: the front page. Change it here and it changes everywhere. ----------
  function detailsTab(area) {
    const a = d0.area(area), b = App.brandOf(area), ev = d0.eventsOf(area).slice(-1)[0];
    if (!ev) return '<div class="panel"><h3>Key details</h3><p>This street has no festival yet.</p></div>';
    const win = LB.windowText(ev);
    return `<form data-form="ldetails" data-id="${ev.id}">
      <div class="grid two">
        <section class="panel"><h3>The festival</h3>
          <label for="kd-name">Festival name</label><input id="kd-name" name="name" value="${esc(ev.name)}" maxlength="80">
          <label for="kd-date">Festival date</label><input id="kd-date" name="starts" type="date" value="${esc(ev.starts_on)}">
          <h3 style="margin-top:18px">When coupons work</h3>
          <label for="kd-from">Coupons work from <span class="muted">(optional)</span></label><input id="kd-from" name="valid_from" type="date" value="${esc(ev.valid_from || '')}">
          <p class="muted small" style="margin:4px 0 0">Leave it empty and coupons work straight away. With a date, shops are told not to accept them before it, and customers are told they can't use it today.</p>
          <label for="kd-until">Coupons work until</label><input id="kd-until" name="use_by" type="date" value="${esc(ev.use_by)}">
          <p class="muted small" style="margin:4px 0 0">The last day a coupon can be used.</p>
        </section>
        <section class="panel"><h3>Words on the customer pages</h3>
          <label for="kd-head">Headline</label><input id="kd-head" name="headline" value="${esc(b.headline || '')}" maxlength="60" placeholder="CROYDON IS OPEN FOR BUSINESS">
          <p class="muted small" style="margin:4px 0 0">The big words at the top of the sign-up, coupon and shops pages and the email. Empty hides them.</p>
          <label for="kd-welcome">Sign-up page welcome line</label><input id="kd-welcome" name="welcome" value="${esc(b.welcome || '')}" maxlength="120">
          <label for="kd-shops">Message when no shops have signed up yet</label><input id="kd-shops" name="shopsNote" value="${esc(b.shopsNote || '')}" maxlength="160" placeholder="Check back on 13 November to see participating stores.">
          <p class="muted small" style="margin:4px 0 0">Shown in the "Which shop are you?" box on a customer's coupon, until a shop has set up its account.</p>
          <h3 style="margin-top:18px">Right now customers read</h3>
          <p class="friendly" style="margin:6px 0"><b>${esc(win || 'No dates set yet.')}</b></p>
          <p class="muted small" style="margin:0">Colours, street name and the logo are in the <a href="${aLink('look')}">Look</a> tab. The wording of the text and email is in <a href="${aLink('messages')}">Messages</a>.</p>
        </section>
      </div>
      <div class="panel"><div class="row" style="justify-content:space-between"><div><b>Where this shows</b>
        <ul class="list small" style="margin:6px 0 0"><li>The sign-up page, the coupon page and the shops page</li><li>The coupon email and the text message</li><li>The shop's coupon checker, and the phone redemption</li><li>The spreadsheet, and the Overview</li></ul></div>
        <button class="btn" type="submit">Save key details</button></div></div></form>`;
  }
  const aLink = (t) => (App.ctx && App.ctx.area ? `/admin?tab=${t}` : `/admin?area=${encodeURIComponent(adminArea(App.ctx))}&tab=${t}`);
  App.forms.ldetails = async (f) => {
    const d = Object.fromEntries(new FormData(f)), area = adminArea(App.ctx);
    const r = await LB.save('event_save', { p_id: Number(f.dataset.id), p_name: d.name, p_starts: d.starts, p_use_by: d.use_by, p_valid_from: d.valid_from || null });
    if (!r.ok) return U.toast(r.error, true);
    const r2 = await LB.save('area_save_brand', { p_id: area, p_brand: { headline: d.headline || '', welcome: d.welcome || '', shopsNote: d.shopsNote || '' }, p_email_name: null, p_email_address: null, p_reply_to: null });
    U.toast(r2.ok ? 'Saved. Every page, email and text now uses these.' : r2.error, !r2.ok);
  };

  // ---------- Messages: the wording of the text and the email ----------
  const PH = [['{name}', 'First name'], ['{prize}', 'Prize name'], ['{prizeNote}', 'Message for this prize'], ['{value}', 'Dollar value (back office)'], ['{code}', 'Coupon code'], ['{validFrom}', 'First day it works'], ['{validFromShort}', 'First day, short'], ['{useBy}', 'Last day it works'], ['{useByShort}', 'Last day, short'], ['{place}', 'Street name'], ['{event}', 'Event name'], ['{link}', 'Coupon link'], ['{shops}', 'Shops link']];
  const msgKey = (area, k) => 'msg:' + area + ':' + k;
  const msgNow = (area, k) => D.state.settings[msgKey(area, k)] || '';
  const anyNote = (area) => d0.prizesOf(area).some((x) => Number(x.value) > 0 && String(x.message || '').trim());
  const startsLater = (area) => { const ev = d0.eventsOf(area).slice(-1)[0]; return !!(ev && ev.valid_from && ev.valid_from > U.today()); };
  function sampleFor(area) {
    const a = d0.area(area) || {}, b = App.brandOf(area), ev = d0.eventsOf(area).slice(-1)[0] || {}, host = area + '.' + C.baseDomain;
    const useBy = ev.use_by ? U.date(ev.use_by) : 'Mon 30 Nov';
    const vf = ev.valid_from ? U.date(ev.valid_from) : U.date(U.today());
    const withNote = d0.prizesOf(area).find((x) => Number(x.value) > 0 && String(x.message || '').trim());
    return { prizeName: withNote ? withNote.name : '$5 coupon', prizeNote: withNote ? withNote.message : '', hasStart: startsLater(area), validFrom: vf, validFromShort: String(vf).replace(/^\w+\s/, ''), name: 'Sam', value: 5, code: 'CMS-1234', useBy, useByShort: String(useBy).replace(/^\w+\s/, ''), event: ev.name || 'the festival', place: b.place || a.name, area,
      origin: 'https://' + host, couponUrl: 'https://' + host + '/c/CMS-1234?k=0123456789abcdef0123', link: host + '/c/CMS-1234?k=0123456789abcdef0123', shopsUrl: 'https://' + host + '/shops',
      safetyUrl: 'https://' + C.baseDomain + '/safety', unsubUrl: '#', fromName: a.email_name || b.place, fromAddress: a.email_address || 'hello@' + C.baseDomain,
      color: b.color, accent: b.accent, headline: b.headline, palette: b.palette };
  }
  function previewSms(area, text) {
    const standard = String(text).replace(/\r/g, '').trim() === window.Messages.defaults(startsLater(area), anyNote(area)).sms;      // the standard wording shortens itself to fit one text
    const r = window.Messages.sms(Object.assign(sampleFor(area), standard ? {} : { custom: { sms: text } }));
    const n = r.length, parts = n <= 160 ? 1 : Math.ceil(n / 153);
    return { html: `<div class="smsbubble">${esc(r.text)}</div>`, n, parts, r };
  }
  function previewEmail(area, subject, body) {
    const r = window.Messages.email(Object.assign(sampleFor(area), { custom: { email_subject: subject, email_body: body } }));
    return `<p class="muted small" style="margin:0 0 6px"><b>Subject:</b> ${esc(r.subject)}</p><iframe class="emailprev" title="Email preview" sandbox srcdoc="${esc('<body style="margin:0;padding:14px;background:#fff">' + r.html + '</body>')}"></iframe>`;
  }
  const chips = (target) => `<div class="chips" aria-label="Words you can add">${PH.map(([ph, label]) => `<button type="button" class="chip" data-act="lmsg-insert" data-target="${target}" data-ph="${esc(ph)}" title="${esc(label)}">${esc(ph)}</button>`).join('')}</div>`;
  const warnFor = (text, needLink, needStart) => {
    const bad = window.Messages.unknownIn(text), out = [];
    if (needStart && !/\{validFrom(Short)?\}/.test(text)) out.push('Coupons start on a later day, but this wording does not say so. Add {validFrom} so customers know they cannot use it today.');
    if (bad.length) out.push('Not a word we know: ' + bad.join(', ') + '. It will show as typed.');
    if (needLink && !/\{link\}/.test(text)) out.push('There is no {link}, so customers will not get their coupon link.');
    return out.map((w) => `<p class="warnline">${esc(w)}</p>`).join('');
  };
  function messagesTab(area) {
    const M = window.Messages, D0 = M.defaults(startsLater(area), anyNote(area));
    const sms = msgNow(area, 'sms') || D0.sms, sub = msgNow(area, 'email_subject') || D0.email_subject, body = msgNow(area, 'email_body') || D0.email_body;
    const ps = previewSms(area, sms);
    return `<div class="panel"><h3>What customers receive</h3>
        <p class="muted">Change the wording of the text message and the email here. Tap a word like <code>{name}</code> to add it. The system swaps it for each customer's own details. The buttons, the coupon link and the unsubscribe line in the email are added for you.</p></div>
      <div class="grid two">
        <section class="panel"><h3>Text message</h3>
          <form data-form="lmsg" data-kind="sms">
            <label for="msg-sms">Text</label><textarea id="msg-sms" name="text" rows="6" maxlength="600" data-input="lmsg-preview">${esc(sms)}</textarea>
            ${chips('msg-sms')}
            <div id="sms-meta" class="muted small" style="margin:8px 0">${ps.n} characters. ${ps.parts === 1 ? 'Sends as 1 text.' : 'Sends as ' + ps.parts + ' texts, and costs more.'} One text is up to 160 characters.</div>
            <div id="sms-warn">${warnFor(sms, true, startsLater(area) && sms !== D0.sms)}</div>
            <div class="row"><button class="btn" type="submit">Save text</button><button type="button" class="btn ghost" data-act="lmsg-reset" data-kind="sms">Back to standard wording</button></div>
          </form>
          <h4 style="margin:16px 0 6px">What it looks like</h4><div id="sms-prev">${ps.html}</div>
        </section>
        <section class="panel"><h3>Email</h3>
          <form data-form="lmsg" data-kind="email">
            <label for="msg-sub">Subject</label><input id="msg-sub" name="subject" maxlength="150" value="${esc(sub)}" data-input="lmsg-preview">
            <label for="msg-body">Message</label><textarea id="msg-body" name="body" rows="14" maxlength="3000" data-input="lmsg-preview">${esc(body)}</textarea>
            ${chips('msg-body')}
            <p class="muted small" style="margin:8px 0">Leave a blank line between paragraphs. Put <code>**two stars**</code> around words to make them bold. A line with just <code>[buttons]</code> shows the two buttons there.</p>
            <div id="email-warn">${warnFor(sub + '\n' + body, false, startsLater(area) && body !== D0.email_body)}</div>
            <div class="row"><button class="btn" type="submit">Save email</button><button type="button" class="btn ghost" data-act="lmsg-reset" data-kind="email">Back to standard wording</button></div>
          </form>
          <h4 style="margin:16px 0 6px">What it looks like</h4><div id="email-prev">${previewEmail(area, sub, body)}</div>
        </section>
      </div>
      ${d0.prizesOf(area).some((x) => String(x.message || '').trim()) ? '' : '<p class="muted small">No prize has a message yet, so <code>{prizeNote}</code> shows as empty in these examples. Add one in the <b>Prizes</b> tab.</p>'}
      <p class="muted small">The example uses a made-up customer, "Sam". Texts go out through ClickSend and emails through Resend, the same as before.</p>`;
  }
  App.changes['lmsg-preview'] = (el) => {
    const area = adminArea(App.ctx), q = (id) => document.getElementById(id);
    if (el.id === 'msg-sms') {
      const p = previewSms(area, el.value);
      q('sms-prev').innerHTML = p.html;
      q('sms-meta').textContent = p.n + ' characters. ' + (p.parts === 1 ? 'Sends as 1 text.' : 'Sends as ' + p.parts + ' texts, and costs more.') + ' One text is up to 160 characters.';
      q('sms-warn').innerHTML = warnFor(el.value, true, startsLater(area) && el.value.trim() !== window.Messages.defaults(true, anyNote(area)).sms);
    } else {
      const sub = q('msg-sub').value, body = q('msg-body').value;
      q('email-prev').innerHTML = previewEmail(area, sub, body);
      q('email-warn').innerHTML = warnFor(sub + '\n' + body, false, startsLater(area) && body.trim() !== window.Messages.defaults(true, anyNote(area)).email_body);
    }
  };
  App.acts['lmsg-insert'] = (b) => {
    const t = document.getElementById(b.dataset.target); if (!t) return;
    const a = t.selectionStart == null ? t.value.length : t.selectionStart, z = t.selectionEnd == null ? a : t.selectionEnd;
    t.value = t.value.slice(0, a) + b.dataset.ph + t.value.slice(z);
    t.focus(); t.selectionStart = t.selectionEnd = a + b.dataset.ph.length;
    App.changes['lmsg-preview'](t);
  };
  App.acts['lmsg-reset'] = (b) => {
    const D0 = window.Messages.defaults(startsLater(adminArea(App.ctx)), anyNote(adminArea(App.ctx))), q = (id) => document.getElementById(id);
    if (b.dataset.kind === 'sms') { q('msg-sms').value = D0.sms; App.changes['lmsg-preview'](q('msg-sms')); }
    else { q('msg-sub').value = D0.email_subject; q('msg-body').value = D0.email_body; App.changes['lmsg-preview'](q('msg-body')); }
    U.toast('Standard wording is back. Press Save to keep it.');
  };
  const area0 = () => adminArea(App.ctx);
  App.forms.lmsg = async (f) => {
    const area = adminArea(App.ctx), D0 = window.Messages.defaults(startsLater(area0()), anyNote(area0())), d = Object.fromEntries(new FormData(f));
    const pairs = f.dataset.kind === 'sms' ? [['sms', d.text, D0.sms]] : [['email_subject', d.subject, D0.email_subject], ['email_body', d.body, D0.email_body]];
    for (const [kind, text, dflt] of pairs) {
      const same = String(text).replace(/\r/g, '').trim() === dflt;
      const r = await LB.save('message_save', { p_area: area, p_kind: kind, p_text: same ? '' : String(text) });
      if (!r.ok) return U.toast(r.error, true);
    }
    U.toast('Saved. The next message sent will use it.');
  };

  // ---------- people ----------
  App.forms.linvite = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const err = document.getElementById('iv-err'), okm = document.getElementById('iv-ok');
    err.hidden = true; okm.hidden = true;
    const r = await LB.fn('invite-staff', { name: d.name, email: d.email, password: d.password || '', role: d.role, area: ['chaos', 'fruitbowl'].includes(d.role) ? null : d.area }, true);
    if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
    okm.textContent = r.message; okm.hidden = false; f.reset();
    App.state.people = (await D.read('staff_list')) || []; App.render();
    const o = document.getElementById('iv-ok'); if (o) { o.textContent = r.message; o.hidden = false; }
  };
  App.acts['ladmin-remove'] = async (b) => {
    if (!confirm('Remove access for ' + b.dataset.email + '?')) return;
    const r = await LB.save('staff_remove', { p_email: b.dataset.email });
    if (!r.ok) return U.toast(r.error, true);
    App.state.people = (await D.read('staff_list')) || []; U.toast('Removed.'); App.render();
  };
})();
