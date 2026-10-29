// Client dashboard (a council or street association), Fruitbowl HQ, and the reports.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  const P = App.pages;
  const FROM = { fruitbowl: 'From Fruitbowl', council: 'From council', street: 'From the Street Association' };
  const WHO = { fruitbowl: 'Fruitbowl', council: 'Council', street: 'Street Association' };
  const STATUS_LABEL = { invited: 'Invited', waiting: 'Waiting for Fruitbowl', 'setting up': 'Setting up', live: 'Live' };
  const focusId = (id) => { const el = document.getElementById(id); if (el) el.focus(); };

  // ---------- numbers ----------
  function totals(areaId) {
    const all = areaId ? d0.signupsOf(areaId) : D.state.signups;
    const won = all.filter((s) => s.prize);
    return {
      signups: all.length,
      stamps: all.reduce((a, s) => a + U.stampTotal(s), 0),
      won: won.length,
      value: won.reduce((a, s) => a + Number(s.prize.value || 0), 0),
      used: won.filter((s) => s.redeemed).length,
      draw: all.filter((s) => U.stampTotal(s) >= C.stampsForDraw).length
    };
  }
  function statsBlock(areaId) {
    const t = totals(areaId);
    return `<div class="stats">
      <div class="stat"><b>${t.signups}</b><span>sign-ups</span></div>
      <div class="stat"><b>${t.stamps}</b><span>stamps given</span></div>
      <div class="stat"><b>${t.won}</b><span>coupons won</span></div>
      <div class="stat"><b>${money(t.value)}</b><span>coupon value</span></div>
      <div class="stat"><b>${t.used}</b><span>coupons used on Main Street</span></div>
      <div class="stat"><b>${t.draw}</b><span>in the big draw</span></div></div>`;
  }

  // ---------- campaigns ----------
  function ladder(c) {
    const shops = d0.activeShopsOf(c.area);
    const tin = Object.values(c.traders || {}).filter((t) => t.status === 'in').length;
    const k = (v) => (v === 'approved' || v === 'yes' ? '' : v === 'declined' || v === 'no' ? 'no' : 'wait');
    const w = (v) => (v === 'approved' || v === 'yes' ? 'backing it' : v === 'declined' || v === 'no' ? 'passed' : 'deciding');
    return `<div class="ladder"><span class="tag ${k(c.council)}">Council: ${w(c.council)}</span><span class="tag ${k(c.street)}">Street: ${w(c.street)}</span>
      <span class="tag ${d0.live(c) ? '' : 'wait'}">${d0.live(c) ? 'Live for vendors' : 'Not live yet'} · ${tin}/${shops.length} vendors in</span></div>`;
  }
  function campCard(c, actions) {
    return `<div class="camp"><div class="row" style="justify-content:space-between"><h3>${esc(c.title)}</h3><span class="tag">${FROM[c.posted_by || 'fruitbowl']}</span></div>
      <div class="muted">${esc(c.month)}</div>${ladder(c)}<p>${esc(c.blurb)}</p>${c.street_extra ? `<p><b>Street extra:</b> ${esc(c.street_extra)}</p>` : ''}${actions || ''}</div>`;
  }
  function campaignForm(level, areaId, areaChoices) {
    const btn = level === 'fruitbowl' ? 'Send to council and the street' : 'Send to our vendors';
    return `<form data-form="newcamp" data-level="${level}" data-area="${esc(areaId || '')}">
      ${areaChoices ? `<label for="ca-${level}">Street</label><select id="ca-${level}" name="area">${areaChoices.map((a) => `<option value="${esc(a.id)}">${esc(App.brandOf(a.id).place)}</option>`).join('')}</select>` : ''}
      <label for="ct-${level}">Name</label><input id="ct-${level}" name="title" required placeholder="Late Night Thursdays">
      <label for="cm-${level}">When</label><input id="cm-${level}" name="month" required placeholder="December 2026">
      <label for="cb-${level}">The idea</label><textarea id="cb-${level}" name="blurb" required placeholder="What vendors do and what customers get"></textarea>
      <p style="margin-top:14px"><button class="btn" type="submit">${btn}</button></p></form>
      <details><summary>Need an idea? Pick one to fill the form</summary><ul class="list">${C.ideas.map((x, i) => `<li class="row" style="justify-content:space-between;flex-wrap:nowrap"><span><b>${esc(x.title)}</b> <span class="muted">· ${esc(x.month)}</span><br><span class="muted">${esc(x.blurb)}</span></span><button type="button" class="btn ghost small" data-act="use-idea" data-level="${level}" data-i="${i}">Use this</button></li>`).join('')}</ul></details>`;
  }
  App.acts['use-idea'] = (b) => {
    const x = C.ideas[Number(b.dataset.i)], lv = b.dataset.level;
    document.getElementById('ct-' + lv).value = x.title;
    document.getElementById('cm-' + lv).value = x.month;
    document.getElementById('cb-' + lv).value = x.blurb;
    focusId('ct-' + lv);
  };
  App.forms.newcamp = async (f) => {
    const lv = f.dataset.level, d = Object.fromEntries(new FormData(f));
    const area = d.area || f.dataset.area;
    const r = await App.run('post_campaign', { p_area: area, p_title: d.title, p_month: d.month, p_blurb: d.blurb, p_from: lv },
      lv === 'fruitbowl' ? 'Sent to council and the street' : 'Sent to your vendors');
    if (r.ok) { f.reset(); App.render(); }
  };
  App.acts.council = (b) => App.run('council_decide', { p_id: Number(b.dataset.id), p_approve: b.dataset.v === 'approved' }, b.dataset.v === 'approved' ? 'Backed. Sent to vendors.' : 'Passed on this one');
  App.acts['street-no'] = (b) => App.run('street_decide', { p_id: Number(b.dataset.id), p_yes: false, p_extra: '' }, 'Passed on this one');
  App.forms.street = (f) => App.run('street_decide', { p_id: Number(f.dataset.id), p_yes: true, p_extra: new FormData(f).get('extra') || '' }, 'Sent to every vendor');

  function campaignsSection(areaId, role) {
    const camps = d0.campaignsOf(areaId);
    const shops = d0.activeShopsOf(areaId);
    return `<div class="grid two">
      <section class="panel"><h3>Post your own campaign</h3><p class="muted">It goes straight to your vendors.</p>${campaignForm(role, areaId)}</section>
      <section><h3 style="margin-bottom:10px">Campaigns</h3>${camps.length ? camps.map((c) => {
        let act = '';
        if (role === 'council' && c.council === 'pending') {
          act = `<div class="row"><button class="btn small" data-act="council" data-id="${c.id}" data-v="approved">Back it and send to vendors</button><button class="btn ghost small" data-act="council" data-id="${c.id}" data-v="declined">Not for us</button></div>`;
        }
        if (role === 'street') {
          const tr = c.traders || {};
          act = c.street === 'yes'
            ? `<details><summary>Which vendors are in</summary><div class="table-wrap"><table><tbody>${shops.map((t) => { const s = tr[t.id]; return `<tr><td>${esc(t.name)}</td><td>${s ? `<span class="tag ${s.status === 'in' ? '' : 'no'}">${s.status === 'in' ? 'In' : 'Not this time'}</span>` : '<span class="tag wait">No answer</span>'}</td><td>${esc((s && s.offer) || '')}</td></tr>`; }).join('')}</tbody></table></div></details>`
            : c.street === 'no' ? ''
              : `<form data-form="street" data-id="${c.id}"><label for="x-${c.id}">Street extra (optional)</label><input id="x-${c.id}" name="extra" placeholder="Santa visits Saturday 12 December" maxlength="200">
                  <div class="row" style="margin-top:10px"><button class="btn" type="submit">Back it and send to vendors</button><button class="btn ghost" type="button" data-act="street-no" data-id="${c.id}">Not for us</button></div></form>`;
        }
        return campCard(c, act);
      }).join('') : '<p class="muted">No campaigns yet.</p>'}</section></div>`;
  }

  // ---------- prizes ----------
  function prizesPanel(areaId, level) {
    const ps = d0.prizesOf(areaId);
    const budget = ps.reduce((a, p) => a + p.value * p.stock, 0);
    return `<div class="panel"><h3>Coupons and gifts</h3>
      <p class="muted">A coupon (value over $0) can be spent at any participating shop on the street. A gift ($0) is handed over at the desk. New ones show on the prize desk straight away. Total budget if every coupon is used: <b>${money(budget)}</b>.</p>
      <div class="table-wrap"><table><thead><tr><th>Prize</th><th>Value</th><th>Note</th><th>Won</th><th>Stock</th><th>Added by</th><th></th></tr></thead><tbody>
      ${ps.map((p) => { const g = d0.given(p); return `<tr><td>${esc(p.name)}</td><td>${p.value ? money(p.value) : 'Gift'}</td><td>${esc(p.collect_at || '')}</td><td>${g}</td><td>${p.stock}</td><td>${esc(WHO[p.added_by] || '')}</td>
        <td><button class="btn ghost small" data-act="stock" data-id="${p.id}">+10</button> ${g ? '' : `<button class="btn ghost small" data-act="del-prize" data-id="${p.id}">Remove</button>`}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">No prizes yet.</td></tr>'}
      </tbody></table></div>
      <form data-form="prize" data-area="${esc(areaId)}" data-level="${level}" class="row" style="margin-top:12px;align-items:flex-end">
        <div style="flex:2;min-width:150px"><label for="pn-${level}">New prize</label><input id="pn-${level}" name="name" required placeholder="Free pizza slice"></div>
        <div style="flex:1;min-width:90px"><label for="pv-${level}">Value $ (0 = gift)</label><input id="pv-${level}" name="value" inputmode="numeric" required placeholder="10"></div>
        <div style="flex:2;min-width:150px"><label for="pw-${level}">Note (optional)</label><input id="pw-${level}" name="where" placeholder="Any participating shop"></div>
        <div style="flex:1;min-width:90px"><label for="pq-${level}">How many</label><input id="pq-${level}" name="stock" inputmode="numeric" required placeholder="20"></div>
        <button class="btn" type="submit">Add prize</button></form></div>`;
  }
  App.acts.stock = (b) => App.run('add_stock', { p_id: Number(b.dataset.id), p_n: 10 }, 'Added 10.');
  App.acts['del-prize'] = (b) => App.run('remove_prize', { p_id: Number(b.dataset.id) }, 'Prize removed');
  App.forms.prize = async (f) => {
    const d = Object.fromEntries(new FormData(f)), v = Number(d.value), q = Number(d.stock);
    if (!(v >= 0) || !(q > 0)) return U.toast('Value and how many need to be numbers', true);
    const r = await App.run('add_prize', { p_area: f.dataset.area, p_name: d.name, p_value: Math.round(v), p_collect_at: d.where || '', p_stock: Math.round(q), p_added_by: f.dataset.level },
      "Prize added. It's on the prize desk now.");
    if (r.ok) { f.reset(); App.render(); }
  };

  // ---------- shops ----------
  function shopsPanel(areaId) {
    const shops = d0.shopsOf(areaId);
    return `<div class="panel"><h3>Shops</h3><p class="muted">Each shop gets an invite link. They open it, choose a 4-digit PIN, and they're in. Only active shops can accept coupons.</p>
      <div class="table-wrap"><table><thead><tr><th>Shop</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>
      ${shops.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.type)}</td><td><span class="tag ${s.status === 'active' ? '' : 'wait'}">${s.status === 'active' ? 'Active' : 'Invited'}</span></td>
        <td>${s.status === 'active' ? `<a class="btn ghost small" href="/stickers/${esc(s.id)}" target="_blank" rel="noopener">Sticker</a>` : `<button class="btn ghost small" data-act="copy-invite" data-id="${esc(s.id)}">Show invite link</button>`}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No shops yet.</td></tr>'}
      </tbody></table></div>
      ${App.state.inviteLinks ? Object.entries(App.state.inviteLinks).map(([id, link]) => `<p class="who">Invite link for <b>${esc((d0.shop(id) || {}).name || id)}</b>:<br><a href="${esc(link)}">${esc(link)}</a></p>`).join('') : ''}
      <form data-form="addshop" data-area="${esc(areaId)}" class="row" style="margin-top:12px;align-items:flex-end">
        <div style="flex:2;min-width:150px"><label for="as-name">Shop name</label><input id="as-name" name="name" required placeholder="Croydon Florist"></div>
        <div style="flex:1;min-width:110px"><label for="as-type">Type</label><input id="as-type" name="type" placeholder="Florist"></div>
        <div style="flex:2;min-width:150px"><label for="as-contact">Contact email or mobile</label><input id="as-contact" name="contact" placeholder="owner@shop.com.au"></div>
        <button class="btn" type="submit">Add shop</button></form>
      <p style="margin-top:12px"><a class="btn ghost small" href="/stickers/${esc(areaId)}" target="_blank" rel="noopener">Print counter stickers for every active shop</a></p></div>`;
  }
  App.forms.addshop = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await App.run('add_shop', { p_area: f.dataset.area, p_name: d.name, p_type: d.type || '', p_contact: d.contact || '' }, 'Shop added. Send them the invite link.');
    if (r.ok) {
      App.state.inviteLinks = Object.assign({}, App.state.inviteLinks, { [r.id]: location.origin + '/shop/join/' + r.token });
      f.reset(); App.render();
    }
  };
  // Invite links are private, so we only know the ones made in this visit.
  App.acts['copy-invite'] = (b) => U.toast('Invite links show when you add a shop. In the real version you can resend them here.');

  // ---------- look (branding) ----------
  function brandPreview(b) {
    const on = U.textOn(b.color), aon = U.textOn(b.accent);
    return `<div class="phone" style="min-height:0;max-width:320px"><div class="appbar" style="background:${esc(b.color)};color:${on}">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div><small>${esc(b.place)}</small><b>${esc(C.siteName)}</b></div></div>
      <div class="phone-body"><h2>${esc(b.welcome)}</h2>
        <div style="background:${esc(b.accent)};color:${aon};border-radius:16px;padding:14px;text-align:center"><b>You won a $5 coupon!</b><div style="font-size:40px;font-weight:800;line-height:1.1">$5</div><span>Spend it at any participating shop</span></div>
        <div style="background:${esc(b.color)};color:${on};border-radius:18px;padding:16px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;opacity:.85"><span>${esc(C.siteName)}</span><span>${esc(b.place)}</span></div><div style="font-size:22px;font-weight:800;margin-top:6px">Sam</div></div>
        <div style="background:${esc(b.accent)};color:${aon};border-radius:12px;padding:12px;text-align:center;font-weight:800">Sign up</div>
        <p class="muted" style="font-size:12px;text-align:center;margin:0">${esc(b.web)}</p></div></div>`;
  }
  App.brandPreview = brandPreview;

  // The draft look being edited (Look tab and onboarding step 2).
  function draftFor(areaId) {
    const S = App.state, a = d0.area(areaId);
    if (!S.brandDraft || S.brandDraft.area !== areaId) {
      S.brandDraft = Object.assign({ area: areaId }, App.brandOf(areaId), { email_name: a ? a.email_name : '', email_address: a ? a.email_address : '', reply_to: a ? a.reply_to : '' });
    }
    return S.brandDraft;
  }
  App.draftFor = draftFor;

  function lookForm(areaId, withEmail, noSave) {
    const d = draftFor(areaId);
    return `<form data-form="brand" data-area="${esc(areaId)}">
      <p class="muted" style="margin-top:0">The name is always <b>${esc(C.siteName)}</b>. Add your logo, street name, heading and colours.</p>
      <label for="b-place">Street name <span class="muted" style="font-weight:400">(shows under ${esc(C.siteName)})</span></label><input id="b-place" name="place" data-input="brand-live" value="${esc(d.place)}" required maxlength="80">
      <label for="b-welcome">Heading on the sign-up form</label><input id="b-welcome" name="welcome" data-input="brand-live" value="${esc(d.welcome)}" maxlength="120">
      <div class="row" style="gap:18px"><div><label for="b-color">Main colour</label><div class="swatch"><input id="b-color" name="color" data-input="brand-live" type="color" value="${esc(d.color)}"><span class="muted">${esc(d.color)}</span></div></div>
        <div><label for="b-accent">Highlight colour</label><div class="swatch"><input id="b-accent" name="accent" data-input="brand-live" type="color" value="${esc(d.accent)}"><span class="muted">${esc(d.accent)}</span></div></div></div>
      <label for="b-logo">Logo <span class="muted" style="font-weight:400">(we make it 128 pixels wide)</span></label><input id="b-logo" type="file" accept="image/png,image/jpeg,image/gif,image/webp" data-change="brand-logo">
      ${d.logo ? `<p style="margin-top:6px"><button type="button" class="btn ghost small" data-act="logo-clear">Remove logo</button></p>` : ''}
      <label for="b-web">Web address</label><input id="b-web" name="web" data-input="brand-live" value="${esc(d.web)}" placeholder="${esc(C.domain)}/yourstreet, or your own domain" maxlength="120">
      ${withEmail ? `<h3 style="margin-top:18px">Emails to customers</h3>
        <label for="b-ename">"From" name</label><input id="b-ename" name="email_name" value="${esc(d.email_name)}" maxlength="80">
        <label for="b-eaddr">Sent from</label><input id="b-eaddr" name="email_address" value="${esc(d.email_address)}" maxlength="120">
        <label for="b-reply">Replies go to (your own email)</label><input id="b-reply" name="reply_to" type="email" value="${esc(d.reply_to)}" maxlength="120">` : ''}
      ${noSave ? '' : '<div class="row" style="margin-top:16px"><button class="btn" type="submit">Save</button></div>'}</form>`;
  }

  App.changes['brand-live'] = (el) => {
    const S = App.state, f = el.closest('form'), area = f.dataset.area;
    const d = draftFor(area);
    S.brandDraft = Object.assign({}, d, { [el.name]: el.value });
    const pv = document.getElementById('brand-preview');
    if (pv) pv.innerHTML = brandPreview(S.brandDraft);
    const sw = el.closest('.swatch');
    if (sw) sw.querySelector('span').textContent = el.value;
  };
  App.changes['brand-logo'] = (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const area = el.closest('form').dataset.area;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'), k = Math.min(1, 128 / Math.max(im.width, im.height));
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        App.state.brandDraft = Object.assign({}, draftFor(area), { logo: c.toDataURL('image/png') });
        App.render();
      };
      im.onerror = () => U.toast('That file is not a picture.', true);
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  App.acts['logo-clear'] = () => { const d = App.state.brandDraft; if (d) { App.state.brandDraft = Object.assign({}, d, { logo: '' }); App.render(); } };
  async function saveBrand(areaId, f) {
    const d = draftFor(areaId);
    const fd = f ? Object.fromEntries(new FormData(f)) : {};
    const next = Object.assign({}, d, fd);
    App.state.brandDraft = next;
    const r = await App.run('area_save_brand', {
      p_id: areaId, p_brand: { place: next.place, welcome: next.welcome, web: next.web, color: next.color, accent: next.accent, logo: next.logo || '' },
      p_email_name: next.email_name || null, p_email_address: next.email_address || null, p_reply_to: next.reply_to == null ? null : next.reply_to
    }, 'Saved.');
    if (r.ok) App.state.brandDraft = null;
    return r;
  }
  App.saveBrand = saveBrand;
  App.forms.brand = async (f) => { const r = await saveBrand(f.dataset.area, f); if (r.ok) App.render(); };

  // ---------- events ----------
  function eventForm(areaId) {
    const ev = d0.eventsOf(areaId).slice(-1)[0];
    if (!ev) return '<p class="muted">No event yet.</p>';
    return `<form data-form="event" data-id="${ev.id}" class="row" style="align-items:flex-end">
      <div style="flex:2;min-width:160px"><label for="ev-name">Event</label><input id="ev-name" name="name" value="${esc(ev.name)}" maxlength="80"></div>
      <div style="flex:1;min-width:140px"><label for="ev-date">Date</label><input id="ev-date" name="starts" type="date" value="${esc(ev.starts_on)}"></div>
      <div style="flex:1;min-width:140px"><label for="ev-use">Coupons must be used by</label><input id="ev-use" name="use_by" type="date" value="${esc(ev.use_by)}"></div>
      <button class="btn" type="submit">Save event</button></form>
      <p class="muted" style="font-size:13px">Coupons last 7 days after the event unless you change the date. A new date also changes coupons people have already won and not yet used.</p>`;
  }
  App.forms.event = (f) => {
    const d = Object.fromEntries(new FormData(f));
    return App.run('event_save', { p_id: Number(f.dataset.id), p_name: d.name, p_starts: d.starts, p_use_by: d.use_by }, 'Event saved.');
  };

  // ---------- workshops ----------
  function wsTable(list, mode) {   // mode: 'hq' (sent to + booked) or 'read' (booked count + shops)
    if (!list.length) return '<p class="muted">No workshops yet.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>Workshop</th><th>When</th><th>Format</th><th>Where</th>${mode === 'hq' ? '<th>Sent to</th>' : ''}<th>Booked</th></tr></thead><tbody>
      ${list.map((w) => {
        const bk = D.state.bookings.filter((b) => Number(b.workshop) === Number(w.id));
        return `<tr><td>${esc(w.name)}</td><td>${U.date(w.date)} ${U.time(w.time)}</td><td><span class="tag ${w.format === 'Online' ? '' : 'wait'}">${esc(w.format)}</span></td><td>${esc(w.place)}</td>
          ${mode === 'hq' ? `<td>${esc((w.councils || []).join(', '))}</td>` : ''}<td>${bk.length}${bk.length && mode === 'read' ? `<br><span class="muted" style="font-size:12px">${esc(bk.map((b) => d0.shopName(b.trader)).join(', '))}</span>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  App.forms.workshop = async (f) => {
    const fd = new FormData(f), cs = fd.getAll('councils');
    if (!cs.length) return U.toast('Pick at least one council', true);
    const r = await App.run('add_workshop', { p_name: fd.get('name'), p_date: fd.get('date') || null, p_time: fd.get('time'), p_format: fd.get('format'), p_place: fd.get('where'), p_councils: cs },
      'Workshop sent to ' + cs.length + ' council' + (cs.length > 1 ? 's' : ''));
    if (r.ok) { f.reset(); App.render(); }
  };

  // =====================================================================
  // REPORTS
  // =====================================================================
  const REP_COLUMNS = [
    { label: 'First name', key: 'first_name' }, { label: 'Last name', key: 'last_name' }, { label: 'Email', key: 'email' }, { label: 'Mobile', key: 'mobile' },
    { label: 'Postcode', key: 'postcode' }, { label: 'Contact by', key: 'contact' }, { label: 'News opt-in', get: (r) => (r.optin ? 'Yes' : 'No') },
    { label: 'Signed up (date and time)', key: 'signed_up' }, { label: 'Event', key: 'event' }, { label: 'Coupon code', key: 'code' }, { label: 'Prize', key: 'prize' },
    { label: 'Value ($)', get: (r) => (r.value == null ? '' : r.value) }, { label: 'Won (date and time)', key: 'won' }, { label: 'Status', key: 'status' },
    { label: 'Used at (shop)', key: 'used_at' }, { label: 'Used (date and time)', key: 'used' }
  ];
  const filt = () => App.state.repf || (App.state.repf = { event: '', from: '', to: '', status: '' });

  function filtered(rows) {
    const f = filt();
    return rows.filter((r) => (!f.event || String(r.event_id) === f.event)
      && (!f.from || r.signed_up.slice(0, 10) >= f.from) && (!f.to || r.signed_up.slice(0, 10) <= f.to)
      && (!f.status || r.status === f.status));
  }
  function byShop(rows) {
    const m = {};
    rows.filter((r) => r.status === 'Used' && r.value > 0 && r.used_shop_id && r.used_shop_id !== 'desk').forEach((r) => {
      const k = r.used_at || r.used_shop_id;
      (m[k] = m[k] || { shop: k, count: 0, total: 0 });
      m[k].count += 1; m[k].total += r.value;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }

  function reportsView(areaId) {
    const key = areaId || '*', R = App.state.report;
    const rows = R && R.key === key ? R.rows : null;
    if (!rows) return '<p class="muted">Loading the report…</p>';
    const f = filt(), list = filtered(rows);
    const coupons = list.filter((r) => r.prize && r.value > 0);
    const used = coupons.filter((r) => r.status === 'Used');
    const wonVal = coupons.reduce((a, r) => a + r.value, 0), usedVal = used.reduce((a, r) => a + r.value, 0);
    const events = areaId ? d0.eventsOf(areaId) : D.state.events;
    const shops = byShop(list);
    return `<div class="stats">
        <div class="stat"><b>${list.length}</b><span>sign-ups</span></div>
        <div class="stat"><b>${coupons.length}</b><span>coupons won</span></div>
        <div class="stat"><b>${money(wonVal)}</b><span>value won</span></div>
        <div class="stat"><b>${used.length}</b><span>coupons used</span></div>
        <div class="stat"><b>${money(usedVal)}</b><span>value used</span></div>
        <div class="stat"><b>${coupons.length ? Math.round((used.length / coupons.length) * 100) : 0}%</b><span>used</span></div></div>
      <div class="filters">
        <div><label for="rf-event">Event</label><select id="rf-event" data-change="rep-filter" data-k="event"><option value="">All events</option>${events.map((e) => `<option value="${e.id}" ${f.event === String(e.id) ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
        <div><label for="rf-from">From</label><input id="rf-from" type="date" data-change="rep-filter" data-k="from" value="${esc(f.from)}"></div>
        <div><label for="rf-to">To</label><input id="rf-to" type="date" data-change="rep-filter" data-k="to" value="${esc(f.to)}"></div>
        <div><label for="rf-status">Status</label><select id="rf-status" data-change="rep-filter" data-k="status"><option value="">Any</option>${['Not used', 'Used', 'Expired', 'No coupon yet'].map((s) => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <button class="btn" data-act="rep-csv" data-area="${esc(areaId || '')}">Download spreadsheet</button>
        <button class="btn sun" data-act="rep-byshop" data-area="${esc(areaId || '')}">Download "By shop"</button></div>
      <div class="table-wrap"><table><thead><tr>${REP_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
        ${list.map((r) => `<tr>${REP_COLUMNS.map((c) => `<td>${esc(typeof c.get === 'function' ? c.get(r) : r[c.key] == null ? '' : r[c.key])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${REP_COLUMNS.length}" class="muted">No sign-ups match.</td></tr>`}
      </tbody></table></div>
      <h3 style="margin-top:18px">By shop</h3><p class="muted">Every coupon each shop accepted, with totals. Use it to pay shops back.</p>
      <div class="table-wrap"><table><thead><tr><th>Shop</th><th>Coupons used</th><th>Total $</th></tr></thead><tbody>
        ${shops.map((s) => `<tr><td>${esc(s.shop)}</td><td>${s.count}</td><td>${money(s.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No coupons used yet.</td></tr>'}
        ${shops.length ? `<tr><td><b>Total</b></td><td><b>${shops.reduce((a, s) => a + s.count, 0)}</b></td><td><b>${money(shops.reduce((a, s) => a + s.total, 0))}</b></td></tr>` : ''}
      </tbody></table></div>
      <p class="muted" style="font-size:13px;margin-top:12px">Demo: this page is open to everyone. In the live version only signed-in Fruitbowl and client admins can see or download it, and every download is logged.</p>`;
  }
  async function ensureReport(areaId) {
    const key = areaId || '*', R = App.state.report;
    if (R && R.key === key && Date.now() - R.at < 4000) return;
    if (App.state.reportBusy) return;
    App.state.reportBusy = true;
    const rows = await D.read('report_rows', { p_area: areaId || null });
    App.state.reportBusy = false;
    App.state.report = { key, rows: rows || [], at: Date.now() };
    App.render();
  }
  App.changes['rep-filter'] = (el) => { filt()[el.dataset.k] = el.value; App.render(); };
  App.acts['rep-csv'] = async (b) => {
    const area = b.dataset.area || null, rows = filtered((App.state.report || { rows: [] }).rows);
    U.download(`my-main-street-signups-${area || 'all-areas'}-${U.today()}.csv`, U.csv(REP_COLUMNS, rows));
    D.rpc('report_log', { p_kind: 'signups', p_area: area || '' }, { reload: false });
    U.toast('Spreadsheet downloaded.');
  };
  App.acts['rep-byshop'] = async (b) => {
    const area = b.dataset.area || null, rows = byShop(filtered((App.state.report || { rows: [] }).rows));
    U.download(`my-main-street-by-shop-${area || 'all-areas'}-${U.today()}.csv`, U.csv([
      { label: 'Shop', key: 'shop' }, { label: 'Coupons used', key: 'count' }, { label: 'Total $', key: 'total' }], rows));
    D.rpc('report_log', { p_kind: 'by-shop', p_area: area || '' }, { reload: false });
    U.toast('"By shop" spreadsheet downloaded.');
  };

  // =====================================================================
  // CLIENT DASHBOARD  (/client)
  // =====================================================================
  const clientArea = (ctx) => (d0.area(ctx.q.get('area')) ? ctx.q.get('area') : C.demoHomeArea);
  const roleOf = (a) => App.state.clientRole || (a.type === 'Council' ? 'council' : 'street');
  const TABS = [['overview', 'Overview'], ['shops', 'Shops'], ['prizes', 'Prizes'], ['campaigns', 'Campaigns'], ['look', 'Look'], ['reports', 'Reports']];

  P.client = {
    brand: (ctx) => App.brandOf(clientArea(ctx)),
    title: () => 'Client dashboard',
    render(ctx, b) {
      const id = clientArea(ctx), a = d0.area(id), tab = TABS.some((t) => t[0] === ctx.q.get('tab')) ? ctx.q.get('tab') : 'overview';
      const role = roleOf(a);
      const link = (t) => `/client?area=${encodeURIComponent(id)}&tab=${t}`;
      let body = '';
      if (tab === 'overview') {
        body = `${statsBlock(id)}
          <div class="grid two">
            <section class="panel"><h3>Your festival</h3>${eventForm(id)}</section>
            <section class="panel"><h3>Share and print</h3>
              <ul class="list">
                <li><b>Sign-up page:</b> <a href="/${esc(id)}">${esc(location.origin)}/${esc(id)}</a></li>
                <li><b>Marquee QR poster:</b> <a href="/poster/${esc(id)}" target="_blank" rel="noopener">Open the A3 poster</a></li>
                <li><b>Counter stickers:</b> <a href="/stickers/${esc(id)}" target="_blank" rel="noopener">Open the stickers</a></li>
                <li><b>Prize desk:</b> <a href="/desk?area=${esc(id)}">Open the prize desk</a></li>
                <li><b>Shop screen:</b> <a href="/shop">Open the shop screen</a></li></ul></section></div>`;
      } else if (tab === 'shops') body = shopsPanel(id);
      else if (tab === 'prizes') body = prizesPanel(id, a.type === 'Council' ? 'council' : 'street');
      else if (tab === 'campaigns') {
        body = `<div class="row" style="margin-bottom:12px"><label for="cl-role" style="margin:0">Acting as</label>
          <select id="cl-role" data-change="client-role" style="max-width:260px"><option value="street" ${role === 'street' ? 'selected' : ''}>Street Association</option><option value="council" ${role === 'council' ? 'selected' : ''}>Council</option></select>
          <span class="muted" style="font-size:13px">Demo: you can try both. A real client only sees their own.</span></div>${campaignsSection(id, role)}
          <div class="panel gap"><h3>Workshops for ${esc(a.council_area)} vendors</h3>${wsTable(d0.workshops().filter((w) => (w.councils || []).includes(a.council_area)), 'read')}</div>`;
      } else if (tab === 'look') {
        const d = draftFor(id);
        body = `<div class="grid duo"><section class="panel">${lookForm(id, true)}
            <p class="muted" style="font-size:13px;margin-top:12px">Web address: ${esc(C.domain)}/${esc(id)} by default. Later you can use ${esc(id)}.${esc(C.domain)}, or your own domain as a paid extra.</p></section>
          <section><h3 style="margin-bottom:10px">Live preview</h3><div id="brand-preview">${brandPreview(d)}</div></section></div>`;
      } else if (tab === 'reports') body = reportsView(id);

      return `${App.band(a.name, b, 'client')}<main class="wrap" id="main">
        <div class="row" style="justify-content:space-between;margin-bottom:6px"><div><label for="cl-area" style="margin:0">Pretend you are</label>
          <select id="cl-area" data-change="client-area" style="max-width:340px">${d0.areas().map((x) => `<option value="${esc(x.id)}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <span class="tag ${a.status === 'live' ? '' : 'wait'}">${esc(STATUS_LABEL[a.status])}</span></div>
        <nav class="tabsbar" aria-label="Client dashboard">${TABS.map((t) => `<a href="${link(t[0])}"${t[0] === tab ? ' aria-current="page"' : ''}>${t[1]}</a>`).join('')}</nav>
        ${body}</main>${App.footer()}`;
    },
    after(ctx) { if ((ctx.q.get('tab') || '') === 'reports') ensureReport(clientArea(ctx)); }
  };
  App.changes['client-area'] = (el) => { App.state.brandDraft = null; App.state.report = null; App.go('/client?area=' + encodeURIComponent(el.value) + '&tab=' + (App.ctx.q.get('tab') || 'overview')); };
  App.changes['client-role'] = (el) => { App.state.clientRole = el.value; App.render(); };

  // =====================================================================
  // FRUITBOWL HQ  (/hq)
  // =====================================================================
  const HQ_TABS = [['areas', 'Areas'], ['campaigns', 'Campaigns'], ['workshops', 'Workshops'], ['settings', 'Settings'], ['reports', 'Reports']];
  P.hq = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Fruitbowl HQ',
    render(ctx) {
      const tab = HQ_TABS.some((t) => t[0] === ctx.q.get('tab')) ? ctx.q.get('tab') : 'areas', S = App.state;
      let body = '';
      if (tab === 'areas') {
        const newForm = S.hqNew ? `<div class="panel gap"><h3>Activate a new area</h3>
          <form data-form="hqnew"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
            <div><label for="g-name">Organisation name</label><input id="g-name" name="name" required placeholder="Heathmont Traders"></div>
            <div><label for="g-type">Type</label><select id="g-type" name="type"><option>Street Association</option><option>Council</option></select></div>
            <div><label for="g-area">Council area</label><input id="g-area" name="area" required placeholder="Maroondah"></div>
            <div><label for="g-slug">Web address</label><input id="g-slug" name="slug" placeholder="heathmont" maxlength="30"></div>
            <div><label for="g-cname">Contact name</label><input id="g-cname" name="cname" placeholder="Their name"></div>
            <div><label for="g-mail">Contact email</label><input id="g-mail" name="email" type="email" required placeholder="hello@theirstreet.com.au"></div></div>
          <p class="err" id="g-err" role="alert" hidden></p>
          <p style="margin-top:12px"><button class="btn" type="submit">Create the area</button> <button class="btn ghost" type="button" data-act="hq-new">Cancel</button></p></form></div>` : '';
        const invited = S.hqInvite && d0.area(S.hqInvite) ? `<div class="who" role="status"><b>${esc(d0.area(S.hqInvite).name)}</b> is set up as "Invited". Send them this invite link, or fill it in for them:<br>
          <a href="/join?area=${esc(S.hqInvite)}">${esc(location.origin)}/join?area=${esc(S.hqInvite)}</a>
          <div class="row" style="margin-top:8px"><a class="btn small" href="/join?area=${esc(S.hqInvite)}">Fill it in for them</a></div></div>` : '';
        body = `<div class="panel"><h3>Councils and streets</h3><p class="muted">Every council or street association using My Main Street. Each has its own look, shops, prizes and customers.</p>
          <div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Council area</th><th>Added by</th><th>Status</th><th></th></tr></thead><tbody>
          ${d0.areas().map((a) => `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc((a.brand || {}).color || '#560CC9')};margin-right:6px"></span>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${esc(a.council_area)}</td><td>${a.created_by === 'self' ? 'Signed up themselves' : 'Fruitbowl'}</td>
            <td><span class="tag ${a.status === 'live' ? '' : 'wait'}">${esc(STATUS_LABEL[a.status])}</span></td>
            <td><div class="row"><a class="btn ghost small" href="/client?area=${esc(a.id)}&tab=look">Brand it</a><a class="btn ghost small" href="/client?area=${esc(a.id)}">Dashboard</a>
              ${a.status === 'waiting' ? `<button class="btn small" data-act="area-status" data-id="${esc(a.id)}" data-v="setting up">Approve</button>` : ''}
              ${a.status === 'invited' || a.status === 'setting up' ? `<button class="btn sun small" data-act="area-status" data-id="${esc(a.id)}" data-v="live">Launch</button>` : ''}</div></td></tr>`).join('')}
          </tbody></table></div>
          <p style="margin-top:12px"><button class="btn" data-act="hq-new">Activate a new area</button></p></div>${invited}${newForm}`;
      } else if (tab === 'campaigns') {
        const areas = d0.areas(), camps = D.state.campaigns;
        body = `<div class="grid two"><section class="panel"><h3>Post a campaign</h3>${campaignForm('fruitbowl', '', areas)}</section>
          <section><h3 style="margin-bottom:10px">Every campaign, every level</h3>${camps.length ? camps.map((c) => campCard(c, `<p class="muted" style="font-size:13px;margin:0">${esc((d0.area(c.area) || {}).name || c.area)}</p>`)).join('') : '<p class="muted">No campaigns yet.</p>'}</section></div>`;
      } else if (tab === 'workshops') {
        body = `<div class="panel"><h3>Workshops</h3><p class="muted">Only Fruitbowl creates workshops. Pick which councils get each one. Their vendors see it and book.</p>${wsTable(d0.workshops(), 'hq')}
          <form data-form="workshop" class="gap"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div><label for="w-name">Workshop</label><input id="w-name" name="name" required placeholder="Know your brand"></div>
            <div><label for="w-date">Date</label><input id="w-date" name="date" type="date" required></div>
            <div><label for="w-time">Time</label><input id="w-time" name="time" type="time" required></div>
            <div><label for="w-format">Format</label><select id="w-format" name="format"><option>Online</option><option>In person</option></select></div>
            <div style="grid-column:1/-1"><label for="w-where">Where or link</label><input id="w-where" name="where" required placeholder="Croydon Library, or a Google Meet link"></div></div>
            <fieldset style="border:0;padding:0;margin:10px 0 0"><legend style="font-weight:700;font-size:15px">Send to</legend><div class="row">${C.allCouncils.map((c) => `<label class="check" style="margin:4px 12px 0 0"><input type="checkbox" name="councils" value="${esc(c)}" ${c === 'Maroondah' ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div></fieldset>
            <p style="margin-top:14px"><button class="btn" type="submit">Send workshop</button></p></form></div>`;
      } else if (tab === 'settings') {
        const st = d0.codeStyle();
        body = `<div class="panel"><h3>Festival day settings</h3><p class="muted">How the customer's code shows on their phone after they fill out the form. It is saved for everyone. Pick whatever your scanner reads best.</p>
          <div class="row" role="group" aria-label="Code style">${[['qr', 'QR code'], ['number', 'Number'], ['barcode', 'Barcode']].map(([v, l]) => `<button class="btn ${st === v ? '' : 'ghost'}" data-act="code-style" data-v="${v}" aria-pressed="${st === v}">${l}</button>`).join('')}</div></div>`;
      } else if (tab === 'reports') body = `${statsBlock(null)}${reportsView(null)}`;

      return `${App.band('Fruitbowl HQ', App.fruitbowlBrand(), 'hq')}<main class="wrap" id="main">
        <nav class="tabsbar" aria-label="Fruitbowl HQ">${HQ_TABS.map((t) => `<a href="/hq?tab=${t[0]}"${t[0] === tab ? ' aria-current="page"' : ''}>${t[1]}</a>`).join('')}</nav>${body}</main>${App.footer()}`;
    },
    after(ctx) { if (ctx.q.get('tab') === 'reports') ensureReport(null); }
  };
  App.acts['hq-new'] = () => { App.state.hqNew = !App.state.hqNew; App.render(); focusId('g-name'); };
  App.forms.hqnew = async (f) => {
    const d = Object.fromEntries(new FormData(f));
    const r = await App.run('area_create', { p_name: d.name, p_type: d.type, p_council_area: d.area, p_slug: d.slug || '', p_contact_name: d.cname || '', p_email: d.email, p_mobile: '', p_abn: '', p_by: 'fruitbowl' }, 'Area created.');
    if (!r.ok) { const e = document.getElementById('g-err'); if (e) { e.textContent = r.error; e.hidden = false; } return; }
    App.state.hqNew = false; App.state.hqInvite = r.id; App.render();
  };
  App.acts['area-status'] = (b) => App.run('area_set_status', { p_id: b.dataset.id, p_status: b.dataset.v }, b.dataset.v === 'live' ? 'Launched.' : 'Approved. They can finish setting up.');
  App.acts['code-style'] = (b) => App.run('set_setting', { p_key: 'code_style', p_value: b.dataset.v }, 'Phones now show a ' + U.styleName(b.dataset.v));

  // share pieces for the onboarding wizard
  App.admin = { shopsPanel, prizesPanel, lookForm, brandPreview, statsBlock, STATUS_LABEL, totals };
})();
