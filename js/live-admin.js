// The live Admin page (my-mainstreet.com.au/admin): numbers, sign-ups, shops, prizes, look and people.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  if (!D.live) return;
  const LP = App.livePages, LB = App.live;
  const TABS = [['overview', 'Overview'], ['signups', 'Sign-ups'], ['shops', 'Shops'], ['prizes', 'Prizes'], ['look', 'Look'], ['people', 'People'], ['pages', 'Site pages']];
  const LEVELS = { chaos: 'Chaos Master', fruitbowl: 'Fruitbowl', council: 'Council', street: 'Street Association', desk: 'Prize desk', shop: 'Shop' };

  const adminArea = (ctx) => {
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

  // ---------- the spreadsheet ----------
  const COLS = [
    { label: 'First name', key: 'first_name' }, { label: 'Last name', key: 'last_name' }, { label: 'Email', key: 'email' }, { label: 'Mobile', key: 'mobile' },
    { label: 'Postcode', key: 'postcode' }, { label: 'Contact by', key: 'contact' }, { label: 'News opt-in', get: (r) => (r.optin ? 'Yes' : 'No') },
    { label: 'Signed up (date and time)', key: 'signed_up' }, { label: 'Event', key: 'event' }, { label: 'Coupon code', key: 'code' }, { label: 'Prize', key: 'prize' },
    { label: 'Value ($)', get: (r) => (r.value == null ? '' : r.value) }, { label: 'Won (date and time)', key: 'won' }, { label: 'Status', key: 'status' },
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
      ['Admin (this page)', 'Numbers, sign-ups, shops, prizes, look and people.', pageUrl(null, '/admin?area=' + encodeURIComponent(area))],
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
      const tab = ctx.q.get('tab') || 'overview', area = adminArea(ctx);
      if (!D.user || !LB.canManage(area)) return;
      if (['signups', 'overview'].includes(tab) && !ctx.reportAsked) {
        ctx.reportAsked = true;
        await loadReport(area); App.render();
        const t = setInterval(async () => { if (!document.hidden && App.ctx === ctx) { await loadReport(area); if (['signups', 'overview'].includes(ctx.q.get('tab') || 'overview')) App.render(); } }, 10000);
        ctx.stop = () => clearInterval(t);
      }
      if (tab === 'people' && !ctx.peopleAsked && LB.isHq()) { ctx.peopleAsked = true; App.state.people = (await D.read('staff_list')) || []; App.render(); }
    },
    render(ctx, b) {
      const area = adminArea(ctx);
      if (!D.user || !LB.canManage(area)) return LB.gate('Admin');
      const a = d0.area(area);
      if (!a) return `${LB.band('Admin', b, [])}<main class="wrap" id="main"><div class="panel"><h2>No street set up yet</h2><p>Run the Croydon set-up file in Supabase, or add a street.</p></div></main>${LB.footer()}`;
      const tab = TABS.some((t) => t[0] === ctx.q.get('tab')) ? ctx.q.get('tab') : 'overview';
      const hq = LB.isHq(), S = App.state;
      const link = (t) => `/admin?area=${encodeURIComponent(area)}&tab=${t}`;
      let body = '';
      if (tab === 'overview') {
        const st = stats(area), limit = limitOf(), pct = limit ? Math.min(100, Math.round((st.value / limit) * 100)) : 0;
        const ev = d0.eventsOf(area).slice(-1)[0];
        body = `<div class="stats">
            <div class="stat"><b>${st.signups}</b><span>sign-ups</span></div><div class="stat"><b>${st.coupons}</b><span>coupons won</span></div>
            <div class="stat"><b>${money(st.value)}</b><span>$ won</span></div><div class="stat"><b>${st.used}</b><span>coupons used</span></div>
            <div class="stat"><b>${money(st.usedValue)}</b><span>$ used</span></div><div class="stat"><b>${st.small}</b><span>small prizes given</span></div></div>
          <section class="panel meter ${st.value > limit * 0.9 ? 'warn' : ''}"><div class="row" style="justify-content:space-between"><b>${money(st.value)} of ${money(limit)} spent</b><span class="muted">${pct}%</span></div><div class="bar big"><i style="width:${pct}%"></i></div></section>
          <div class="grid two gap">
            <section class="panel"><h3>Sign-ups</h3><p>${a.status === 'live' ? '<span class="tag">Open</span> Customers can sign up now.' : '<span class="tag wait">Closed</span> Customers see "Sign-ups are not open yet".'}</p>
              ${hq ? `<p><button class="btn ${a.status === 'live' ? 'ghost' : 'sun'}" data-act="ladmin-open" data-v="${a.status === 'live' ? 'setting up' : 'live'}">${a.status === 'live' ? 'Close sign-ups' : 'Open sign-ups'}</button></p>` : ''}
              <h3 style="margin-top:14px">The festival</h3>${ev ? `<form data-form="levent" data-id="${ev.id}" class="row" style="align-items:flex-end">
                <div style="flex:2;min-width:150px"><label for="ev-name">Event</label><input id="ev-name" name="name" value="${esc(ev.name)}" maxlength="80"></div>
                <div style="flex:1;min-width:130px"><label for="ev-date">Date</label><input id="ev-date" name="starts" type="date" value="${esc(ev.starts_on)}"></div>
                <div style="flex:1;min-width:130px"><label for="ev-use">Use coupons by</label><input id="ev-use" name="use_by" type="date" value="${esc(ev.use_by)}"></div>
                <button class="btn" type="submit">Save</button></form>` : '<p class="muted">No event yet.</p>'}</section>
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
      } else if (tab === 'pages') body = pagesTab(area);
      else if (tab === 'people') {
        if (!hq) body = '<div class="panel"><p>Only Fruitbowl can invite people.</p></div>';
        else {
          const mine = LB.role();
          const levels = [['fruitbowl', 'Fruitbowl'], ['council', 'Council'], ['street', 'Street Association'], ['desk', 'Prize desk']].concat(mine === 'chaos' ? [['chaos', 'Chaos Master']] : []);
          body = `<div class="panel"><h3>Invite someone</h3><p class="muted">They get an email with a link to choose a password. Each level sees only what it should.</p>
            <form data-form="linvite" class="row" style="align-items:flex-end">
              <div style="flex:1;min-width:150px"><label for="iv-name">Name</label><input id="iv-name" name="name" maxlength="80"></div>
              <div style="flex:2;min-width:200px"><label for="iv-email">Email</label><input id="iv-email" name="email" type="email" required></div>
              <div style="flex:1;min-width:150px"><label for="iv-role">Level</label><select id="iv-role" name="role">${levels.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
              <div style="flex:1;min-width:170px"><label for="iv-area">Street</label><select id="iv-area" name="area">${d0.areas().map((x) => `<option value="${esc(x.id)}" ${x.id === area ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
              <button class="btn" type="submit">Send invite</button></form>
            <p class="small muted">Fruitbowl, Chaos Master: every street. Council and Street Association: their own street only. Prize desk: the prize desk for one street. Shops set up their own accounts from the shop one-pager.</p>
            <p class="err" id="iv-err" role="alert" hidden></p><p class="ok" id="iv-ok" role="status" hidden></p></div>
            <div class="panel gap"><h3>Everyone with a login</h3>${S.people ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Level</th><th>Street or shop</th><th></th></tr></thead><tbody>
              ${S.people.map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(LEVELS[x.role] || x.role)}</td><td>${esc(x.shop || x.area || 'All')}</td><td>${x.email === (D.user || {}).email ? '<span class="muted">You</span>' : `<button class="btn ghost small" data-act="ladmin-remove" data-email="${esc(x.email)}">Remove access</button>`}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No one yet.</td></tr>'}</tbody></table></div>` : '<p class="muted">Loading…</p>'}</div>`;
        }
      }
      return `${LB.band('Admin', b, [['/admin', 'Admin', true]])}<main class="wrap" id="main">
        <div class="row" style="justify-content:space-between;margin-bottom:6px">
          ${hq ? `<div><label for="ad-area" style="margin:0">Street</label><select id="ad-area" data-change="ladmin-area" style="max-width:340px">${d0.areas().map((x) => `<option value="${esc(x.id)}" ${x.id === area ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : `<b>${esc(a.name)}</b>`}
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
  App.changes['ladmin-area'] = (el) => { App.state.report = null; App.state.brandDraft = null; App.go('/admin?area=' + encodeURIComponent(el.value) + '&tab=' + (App.ctx.q.get('tab') || 'overview')); };

  App.acts['ladmin-csv'] = async () => {
    const area = adminArea(App.ctx);
    await loadReport(area);
    const rows = reportFor(area) || [];
    U.download(`my-main-street-${area}-signups-${U.today()}.csv`, U.csv(COLS, rows));
    D.rpc('report_log', { p_kind: 'signups', p_area: area }, { reload: false });
    U.toast('Spreadsheet downloaded.');
  };
  App.acts['ladmin-open'] = (b) => LB.save('area_set_status', { p_id: adminArea(App.ctx), p_status: b.dataset.v }).then((r) => { if (r.ok) U.toast(b.dataset.v === 'live' ? 'Sign-ups are open.' : 'Sign-ups are closed.'); else U.toast(r.error, true); });
  App.forms.levent = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await LB.save('event_save', { p_id: Number(f.dataset.id), p_name: d.name, p_starts: d.starts, p_use_by: d.use_by });
    U.toast(r.ok ? 'Saved.' : r.error, !r.ok);
  };

  // ---------- prizes ----------
  function wheelTable(area, edit) {
    const ps = d0.prizesOf(area), staffSees = D.staff && D.staff.role;
    if (!staffSees) return '';
    return `<div class="table-wrap"><table><thead><tr><th>Prize</th><th>Value</th><th>Won</th><th>Cap</th><th>Left</th></tr></thead><tbody>
      ${ps.map((p) => `<tr><td><span class="dot-pill" style="background:${esc(p.color)}"></span>${esc(p.name)}</td><td>${p.value ? money(p.value) : 'Small prize'}</td><td>${d0.given(p)}</td><td>${p.stock}</td><td>${d0.left(p)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No prizes yet.</td></tr>'}</tbody></table></div>`;
  }
  function prizesTab(area, hq) {
    const ps = d0.prizesOf(area), limit = limitOf();
    const capTotal = ps.filter((p) => p.value > 0).reduce((a, p) => a + p.value * p.stock, 0);
    return `<div class="panel"><h3>The wheel</h3><p class="muted">The most you can give away: <b>${money(capTotal)}</b> in coupons (every cap used). The budget limit is <b>${money(limit)}</b>. The prize desk stops coupons when the limit is reached.</p>
      ${hq ? `<form data-form="lbudget" class="row" style="align-items:flex-end"><div><label for="bg">Budget limit ($)</label><input id="bg" name="limit" inputmode="numeric" value="${limit}" style="max-width:160px"></div><button class="btn" type="submit">Save limit</button></form>` : ''}
      <div class="table-wrap gap"><table><thead><tr><th>Order</th><th>Prize</th><th>Value $ (0 = small prize)</th><th>Cap</th><th>Colour</th><th>Won</th><th></th></tr></thead><tbody>
      ${ps.map((p) => `<tr><form id="pf-${p.id}" data-form="lprize" data-id="${p.id}"></form>
        <td><input form="pf-${p.id}" name="order" inputmode="numeric" value="${p.sort_order}" style="width:64px" aria-label="Order"></td>
        <td><input form="pf-${p.id}" name="name" value="${esc(p.name)}" maxlength="60" style="min-width:150px" aria-label="Prize name"></td>
        <td><input form="pf-${p.id}" name="value" inputmode="numeric" value="${p.value}" style="width:90px" aria-label="Value" ${d0.given(p) ? 'readonly' : ''}></td>
        <td><input form="pf-${p.id}" name="stock" inputmode="numeric" value="${p.stock}" style="width:90px" aria-label="Cap"></td>
        <td><input form="pf-${p.id}" name="color" type="color" value="${esc(p.color)}" style="width:60px;padding:2px" aria-label="Colour"></td>
        <td>${d0.given(p)}</td>
        <td><button class="btn small" form="pf-${p.id}" type="submit">Save</button> ${d0.given(p) ? '' : `<button class="btn ghost small" data-act="ladmin-rmprize" data-id="${p.id}">Remove</button>`}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No prizes yet.</td></tr>'}</tbody></table></div>
      <form data-form="laddprize" class="row" style="margin-top:12px;align-items:flex-end">
        <div style="flex:2;min-width:150px"><label for="np-name">New prize</label><input id="np-name" name="name" required placeholder="$20 coupon"></div>
        <div style="flex:1;min-width:100px"><label for="np-value">Value $ (0 = small prize)</label><input id="np-value" name="value" inputmode="numeric" required></div>
        <div style="flex:1;min-width:100px"><label for="np-stock">Cap (how many)</label><input id="np-stock" name="stock" inputmode="numeric" required></div>
        <div><label for="np-color">Colour</label><input id="np-color" name="color" type="color" value="#560CC9" style="width:60px;padding:2px"></div>
        <button class="btn" type="submit">Add prize</button></form></div>`;
  }
  App.forms.lprize = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await LB.save('prize_update', { p_id: Number(f.dataset.id), p_name: d.name, p_value: parseInt(d.value, 10) || 0, p_stock: parseInt(d.stock, 10) || 0, p_color: d.color, p_order: parseInt(d.order, 10) || 0 });
    U.toast(r.ok ? 'Saved.' : r.error, !r.ok);
  };
  App.forms.laddprize = async (f) => {
    const d = Object.fromEntries(new FormData(f)), v = Number(d.value), q = Number(d.stock);
    if (!(v >= 0) || !(q >= 1)) return U.toast('Value and cap need to be numbers.', true);
    const r = await LB.save('add_prize', { p_area: adminArea(App.ctx), p_name: d.name, p_value: Math.round(v), p_stock: Math.round(q), p_color: d.color });
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
        <td><label class="check" style="margin:0"><input form="sf-${esc(s.id)}" type="checkbox" name="show" ${s.hidden ? '' : 'checked'}> Show</label></td>
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

  // ---------- people ----------
  App.forms.linvite = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const err = document.getElementById('iv-err'), okm = document.getElementById('iv-ok');
    err.hidden = true; okm.hidden = true;
    const r = await LB.fn('invite-staff', { name: d.name, email: d.email, role: d.role, area: ['chaos', 'fruitbowl'].includes(d.role) ? null : d.area }, true);
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
