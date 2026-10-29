// Staff pages: the prize desk (at the wheel) and the shop screen (at the counter).
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  const P = App.pages;
  const focusId = (id) => { const el = document.getElementById(id); if (el) el.focus(); };

  // =====================================================================
  // PRIZE DESK  (/desk)
  // =====================================================================
  const deskArea = (ctx) => (d0.area(ctx.q.get('area')) ? ctx.q.get('area') : C.demoHomeArea);
  const curArea = () => deskArea(App.ctx);

  function deskPick(raw) {
    App.state.deskCode = U.normCode(raw);
    App.render();
    focusId('desk-in');
    return '';
  }

  P.desk = {
    brand: (ctx) => App.brandOf(deskArea(ctx)),
    title: () => 'Prize desk',
    render(ctx, b) {
      const area = deskArea(ctx), S = App.state;
      const cur = S.deskCode ? d0.signup(S.deskCode) : null;
      const wrongArea = cur && cur.area !== area;
      const ok = cur && !wrongArea;
      const ev = d0.eventsOf(area).slice(-1)[0];
      const last = S.lastAward ? d0.signup(S.lastAward) : null;
      const styleName = U.styleName(d0.codeStyle());
      const prizes = d0.prizesOf(area);
      const liveAreas = d0.areas().filter((a) => d0.eventsOf(a.id).length);
      const staff = S.staffCode ? d0.signup(S.staffCode) : null;

      const result = last && last.prize ? `<div class="who" role="status">${esc(last.name)} won <b>${esc(last.prize.name)}</b>.
        ${last.prize.value === 0 ? 'Hand it over now.' : `Their phone shows it now. They'll get it by ${last.contact === 'text' ? 'text' : 'email'} too.`}
        ${last.redeemed && last.redeemed_at !== 'desk' ? '<br><span class="muted">Already used, so it can\'t be undone.</span>' : ` <button class="btn ghost small" data-act="desk-undo">Undo</button>`}</div>` : '';

      const staffForm = `<form data-form="staffsignup" data-area="${esc(area)}" novalidate>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
            <div><label for="ss-name">First name</label><input id="ss-name" name="name" maxlength="40"></div>
            <div><label for="ss-last">Last name</label><input id="ss-last" name="last" maxlength="40"></div>
            <div><label for="ss-post">Postcode</label><input id="ss-post" name="postcode" inputmode="numeric" maxlength="4"></div></div>
          <fieldset style="border:0;padding:0;margin:10px 0 0"><legend style="font-weight:700;font-size:15px">Send their coupon by:</legend>
            <div class="row" style="flex-wrap:nowrap"><label class="check" style="margin:4px 14px 0 0"><input type="radio" name="contact" value="email" checked> Email</label>
            <label class="check" style="margin:4px 0 0"><input type="radio" name="contact" value="text"> Text message</label></div></fieldset>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
            <div><label for="ss-email">Email</label><input id="ss-email" name="email" type="email" maxlength="120"></div>
            <div><label for="ss-mob">Mobile</label><input id="ss-mob" name="mobile" inputmode="tel" placeholder="04xx xxx xxx" maxlength="14"></div></div>
          <label class="check"><input type="checkbox" name="optin"> They'd like news and offers (optional)</label>
          <label class="check"><input type="checkbox" name="terms"> They agree to the terms and the safety and privacy page</label>
          <p class="err" id="ss-err" role="alert" hidden></p>
          <p style="margin-top:12px"><button class="btn" type="submit">Sign them up</button></p></form>`;
      const staffDone = staff ? `<div class="result" role="status"><p style="margin:0">Signed up: <b>${esc(staff.name)}</b></p>
          <div class="bigcode">${esc(staff.code)}</div><p class="muted" style="margin:4px 0 8px">Write this code down or print it for them. Then send them to the line.</p>
          <div class="row"><button class="btn small" data-act="print-page">Print</button><button class="btn ghost small" data-act="staff-next">Next person</button></div></div>` : '';

      return `${App.band('Prize desk', b, 'desk')}
        <main class="wrap" id="main">
          ${App.intro('The prize desk', `At the wheel. People join the line in person. Staff scan each phone, then tap the prize the wheel landed on.${ev ? ' Event: <b>' + esc(ev.name) + '</b>.' : ''}`,
            'Fruitbowl and street association staff at the marquee, on a laptop or iPad.', 'Tap Scan their code and pick someone. Then tap a prize.')}
          <div class="row" style="margin-bottom:12px"><label for="desk-area" style="margin:0">Street</label>
            <select id="desk-area" data-change="desk-area" style="max-width:320px">${liveAreas.map((a) => `<option value="${esc(a.id)}" ${a.id === area ? 'selected' : ''}>${esc(App.brandOf(a.id).place)}</option>`).join('')}</select></div>
          <div class="grid two">
            <section class="panel" aria-label="At the wheel">
              <button class="btn sun big" data-act="desk-scan">Scan their code</button>
              <form data-form="desk" style="margin-top:10px"><label for="desk-in">Scanner box</label>
                <input id="desk-in" name="code" placeholder="Scan, or type the 4-digit number" autocomplete="off">
                <p class="muted" style="font-size:13px;margin:4px 0 0">A USB or Bluetooth scanner can type here. You can type just the 4 digits.</p></form>
              <p class="muted" style="font-size:14px;margin-top:6px">Phones show the code as a <b>${esc(styleName)}</b>. You can change this in Fruitbowl HQ.</p>
              ${ok ? `<div class="next gap"><div class="muted">At the wheel</div><div class="nextname">${esc(cur.name)}</div><div>${esc(cur.code)}</div>
                  ${cur.prize ? `<span class="tag no">Already won: ${esc(cur.prize.name)}</span>` : '<p style="margin:8px 0 0"><b>Now tap the prize the wheel landed on.</b></p>'}</div>`
                : wrongArea ? `<div class="next gap">That code is for a different street.</div>`
                : S.deskCode ? `<div class="next gap">No sign-up with code ${esc(S.deskCode)}. Check their screen and scan again.</div>` : ''}
              <div class="prizes">${prizes.map((p) => {
                const l = d0.left(p), off = !ok || cur.prize || l <= 0;
                return `<button class="prize ${p.value >= 100 ? 'hero' : p.value === 0 ? 'filler' : ''}" data-act="desk-award" data-prize="${p.id}" ${off ? 'disabled' : ''}><span class="v">${p.value ? money(p.value) : 'Gift'}</span><span class="n">${esc(p.name)}</span><span class="left">${l} left</span></button>`;
              }).join('') || '<p class="muted">No prizes yet. Add some on the Client page.</p>'}</div>
              ${result}
            </section>
            <section class="panel" aria-label="Staff sign-up"><h3>No smartphone? Staff sign-up</h3>
              <p class="muted">Fill out the form for them on this iPad. Then print or write down their code.</p>
              ${staffDone}
              <details ${staff ? '' : ''}><summary>${staff ? 'Sign up someone else' : 'Open the form'}</summary>${staffForm}</details>
            </section>
          </div></main>${App.footer()}`;
    }
  };

  App.changes['desk-area'] = (el) => App.go('/desk?area=' + encodeURIComponent(el.value));
  App.forms.desk = (f) => deskPick(new FormData(f).get('code'));
  App.acts['desk-scan'] = () => {
    const area = curArea();
    const list = d0.signupsOf(area).filter((s) => !s.prize).slice().reverse().slice(0, 12).map((s) => ({ label: `${s.name} · ${s.code}`, code: s.code }));
    U.openScanner({ title: 'Scan their code', list, onCode: deskPick, after: () => focusId('desk-in') });
  };
  App.acts['desk-award'] = async (b) => {
    const cur = d0.signup(App.state.deskCode);
    if (!cur || cur.prize) return;
    const p = d0.prizesOf(curArea()).find((x) => Number(x.id) === Number(b.dataset.prize));
    if (!p) return;
    if (d0.left(p) <= 0) return U.toast(p.name + ' has run out', true);
    const r = await App.run('award_prize', { p_code: cur.code, p_prize: p.id });
    if (r.ok) {
      App.state.lastAward = cur.code; App.state.deskCode = '';
      if (p.value === 0) U.toast('Gift: hand it over now.');
      App.render(); focusId('desk-in');
    }
  };
  App.acts['desk-undo'] = async () => {
    const code = App.state.lastAward;
    if (!code) return;
    const s = d0.signup(code);
    if (s && s.redeemed && s.redeemed_at !== 'desk') return U.toast("Can't undo. It's already been used.", true);
    const r = await App.run('undo_prize', { p_code: code }, 'Undone');
    if (r.ok) { App.state.lastAward = null; App.render(); }
  };
  App.acts['staff-next'] = () => { App.state.staffCode = null; App.render(); };
  App.forms.staffsignup = async (f) => {
    const d = Object.fromEntries(new FormData(f)), err = document.getElementById('ss-err');
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    err.hidden = true;
    if (!d.name.trim() || !d.last.trim()) return fail('Please add their first and last name.');
    if (!/^\d{4}$/.test(d.postcode || '')) return fail('Postcode needs 4 numbers.');
    const text = d.contact === 'text';
    if (text && !/^04\d{8}$/.test((d.mobile || '').replace(/\s/g, ''))) return fail('Mobile needs to look like 04xx xxx xxx.');
    if (!text && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((d.email || '').trim())) return fail('Please add a real email, or choose text message.');
    if (!d.terms) return fail('Please tick the box to agree to the terms.');
    const r = await App.run('signup', { p_area: f.dataset.area, p_name: d.name, p_last: d.last, p_contact: d.contact, p_email: d.email || '', p_mobile: d.mobile || '', p_postcode: d.postcode, p_optin: !!d.optin });
    if (!r.ok) return fail(r.error);
    if (r.existing) U.toast('They have signed up already. Here is their code.');
    App.state.staffCode = r.code;
    f.reset(); App.render();
  };

  // =====================================================================
  // SHOP SCREEN  (/shop)
  // =====================================================================
  const loadShop = () => { try { return JSON.parse(App.store.sget('msr-shop') || 'null'); } catch (e) { return null; } };
  const saveShop = (v) => App.store.sset('msr-shop', v ? JSON.stringify(v) : '');
  const expired = (s) => s.use_by && s.use_by < U.today();

  // What the shop sees when it types a code.
  function lookupCard(code, shop) {
    if (!code) return '';
    const s = d0.signup(code), p = s && s.prize;
    const bad = (h, m) => `<div class="statecard bad" role="status"><h3><span class="dotg r"></span>${h}</h3><p style="margin:0">${m || ''}</p></div>`;
    if (!s) return bad("We can't find this code. Check it and try again.");
    if (!p) return bad('No coupon yet', `${esc(s.name)} hasn't spun the wheel yet.`);
    if (s.redeemed) {
      return bad(`Already used at ${esc(d0.shopName(s.redeemed_at))} on ${esc(U.when(s.redeemed_time))}`);
    }
    if (expired(s)) return bad(`This coupon ran out on ${esc(U.date(s.use_by))}`);
    if (s.area !== shop.area) return bad('This coupon is for a different street');
    const done = App.state.justUsed === s.code;
    return `<div class="statecard good" role="status"><h3><span class="dotg g"></span>Valid. ${money(p.value)} coupon. ${esc(s.name)} ${esc(s.last_initial)}. Use by ${esc(U.date(s.use_by))}.</h3>
      <p style="margin:0 0 10px" class="muted">${esc(p.name)}. Coupons are used in full. No change is given.</p>
      <button class="btn big" data-act="shop-use" data-code="${esc(s.code)}">Use it now</button></div>`;
  }

  P.shop = {
    brand() { const sh = loadShop(); const s = sh && d0.shop(sh.id); return s ? App.brandOf(s.area) : App.fruitbowlBrand(); },
    title: () => 'Shop screen',
    render(ctx, b) {
      const me = loadShop(), shop = me && d0.shop(me.id);
      if (!shop) {
        return `${App.band('Shop screen', b, 'shop')}<main class="wrap" id="main" style="max-width:640px">
          ${App.intro('The shop screen', 'For shop staff at the counter. Type or scan a customer\'s coupon code, check it, and use it with one tap.', 'Every shop on the street, on a phone or tablet.', 'Type 1111 to be Main St Espresso.')}
          <div class="panel"><h3>Log in with your shop PIN</h3>
            <form data-form="shoplogin"><label for="shop-pin">Your 4-digit shop PIN</label>
              <input id="shop-pin" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" style="letter-spacing:.4em;font-size:28px;text-align:center">
              <p class="err" id="sl-err" role="alert" hidden></p>
              <p style="margin-top:12px"><button class="btn big" type="submit">Log in</button></p></form>
            <p class="muted" style="font-size:13px">Demo PINs: Main St Espresso 1111, Lantern Thai 2222, The Drover Bar 3333, Gelato Lane 4444, The Corner Bookshop 5555, Croydon Op Shop 6666, Clear View Optometrist 7777, Smile Dental 8888.</p></div></main>${App.footer()}`;
      }
      const S = App.state, area = shop.area;
      const all = d0.signupsOf(area);
      const used = all.filter((s) => s.redeemed && s.redeemed_at === shop.id);
      const usedValue = used.reduce((a, s) => a + Number((s.prize || {}).value || 0), 0);
      const stamped = all.reduce((a, s) => a + U.stampsAt(s, shop.id), 0);
      const code = S.shopCode || '';
      const cust = code ? d0.signup(code) : null;
      const camps = d0.campaignsOf(area).filter(d0.live);
      const ws = d0.workshops().filter((w) => (w.councils || []).includes((d0.area(area) || {}).council_area));
      const booked = (w) => D.state.bookings.some((x) => Number(x.workshop) === Number(w.id) && x.trader === shop.id);
      const justDone = S.justUsed && cust && cust.code === S.justUsed && cust.redeemed && cust.redeemed_at === shop.id;
      return `${App.band(shop.name, b, 'shop')}<main class="wrap" id="main">
        <div class="row" style="justify-content:space-between;margin-bottom:14px"><span class="muted">Logged in as <b>${esc(shop.name)}</b> (${esc(shop.type)})</span><button class="btn ghost small" data-act="shop-logout">Log out</button></div>
        <div class="grid two">
          <section class="panel"><h2>Type or scan the coupon code</h2>
            <form data-form="shopcode"><label for="shop-code" class="sr">Coupon code</label>
              <input id="shop-code" name="code" placeholder="CMS-4821 or just 4821" autocomplete="off" style="font-size:26px;padding:16px" value="${esc(code)}">
              <div class="row" style="margin-top:10px"><button class="btn" type="submit">Check it</button><button class="btn sun" type="button" data-act="shop-scan">Scan with the camera</button></div></form>
            <p class="muted" style="font-size:13px">A USB or Bluetooth barcode scanner can type into the box. It sends when it presses Enter.</p>
            ${justDone ? `<div class="statecard good" role="status"><h3><span class="dotg g"></span>Done! Take ${money((cust.prize || {}).value)} off their bill.</h3><p style="margin:0" class="muted">Coupons are used in full. No change is given.</p></div>`
              : lookupCard(code, shop)}
            ${cust && cust.area === area ? `<div class="result"><h3 style="font-size:17px">${esc(cust.name)} · ${esc(cust.code)}</h3>
              <p class="muted" style="margin:0 0 8px">${U.stampsAt(cust, shop.id)} stamps here · ${U.stampTotal(cust)}/${C.stampsForDraw} overall</p>
              <div class="row"><button class="btn small" data-act="shop-stamp">Give a stamp</button>
              ${U.rewardsLeft(cust, shop.id) > 0 ? `<button class="btn sun small" data-act="shop-reward">Use ${C.stampsForReward}-stamp reward</button>` : ''}
              <button class="btn ghost small" data-act="shop-next">Next customer</button></div></div>` : ''}
          </section>
          <section class="panel"><h3>Your numbers</h3>
            <div class="stats" style="margin:6px 0 14px"><div class="stat"><b>${used.length}</b><span>coupons used here</span></div><div class="stat"><b>${money(usedValue)}</b><span>total value</span></div><div class="stat"><b>${stamped}</b><span>stamps given here</span></div></div>
            ${used.length ? `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Customer</th><th>Value</th><th>When</th></tr></thead><tbody>${used.slice().reverse().slice(0, 8).map((s) => `<tr><td>${esc(s.code)}</td><td>${esc(s.name)} ${esc(s.last_initial)}.</td><td>${money(s.prize.value)}</td><td>${esc(U.when(s.redeemed_time))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No coupons used here yet.</p>'}
            <p class="muted" style="font-size:13px;margin-top:10px">You only see your own coupons and totals. Your street association uses these to pay you back.</p>
          </section>
        </div>
        <div class="kit gap">
          <div class="howcard"><h3>Stamps: nothing to do</h3><p>After paying, customers scan the QR code on your counter or tap the sticker. The stamp lands on their pass by itself.</p></div>
          <div class="howcard"><h3>Your counter sticker</h3><p>Print this QR code. The NFC tap sticker has the same link.</p>
            <div class="qr" role="img" aria-label="Counter sticker QR code" style="background:#fff;border-radius:8px;padding:8px;width:fit-content;margin:8px 0">${U.qrSvg(location.origin + '/tap/' + shop.id, 4)}</div>
            <p><a class="btn small" href="/stickers/${esc(shop.id)}" target="_blank" rel="noopener">Print the sticker</a></p></div>
        </div>
        <h2 style="margin-top:24px">Campaigns you can join</h2>
        <div class="grid cards" style="margin-top:8px">${camps.length ? camps.map((c) => {
          const t = (c.traders || {})[shop.id];
          return `<div class="camp"><h3>${esc(c.title)}</h3><div class="muted">${esc(c.month)}</div><p>${esc(c.blurb)}</p>${c.street_extra ? `<p><b>Street extra:</b> ${esc(c.street_extra)}</p>` : ''}
            ${t ? `<p><span class="tag ${t.status === 'in' ? '' : 'no'}">${t.status === 'in' ? "You're in" : 'Not this time'}</span> ${esc(t.offer || '')}</p><button class="btn ghost small" data-act="trader-undo" data-id="${c.id}">Change my answer</button>`
              : `<form data-form="optin" data-id="${c.id}"><label for="o-${c.id}">Your offer (optional)</label><input id="o-${c.id}" name="offer" placeholder="A stamp with any purchase" maxlength="120">
                <div class="row" style="margin-top:10px"><button class="btn" type="submit">I'm in</button><button class="btn ghost" type="button" data-act="trader-out" data-id="${c.id}">Not this time</button></div></form>`}</div>`;
        }).join('') : '<p class="muted">No campaigns yet. They show here when your council or street backs one.</p>'}</div>
        <div class="panel gap"><h3>Workshops for your area</h3><p class="muted">Run by Fruitbowl. Book a spot with one tap.</p>
          ${ws.length ? `<div class="table-wrap"><table><thead><tr><th>Workshop</th><th>When</th><th>Format</th><th>Where</th><th></th></tr></thead><tbody>${ws.map((w) => `<tr><td>${esc(w.name)}</td><td>${U.date(w.date)} ${U.time(w.time)}</td><td><span class="tag ${w.format === 'Online' ? '' : 'wait'}">${esc(w.format)}</span></td><td>${esc(w.place)}</td><td>${booked(w) ? '<span class="tag">Booked</span>' : `<button class="btn small" data-act="book" data-w="${w.id}">Book</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No workshops for your area yet.</p>'}</div>
      </main>${App.footer()}`;
    },
  };

  App.forms.shoplogin = async (f) => {
    const pin = new FormData(f).get('pin'), err = document.getElementById('sl-err');
    const r = await D.rpc('shop_login', { p_pin: pin }, { reload: false });
    if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
    saveShop({ id: r.shop, pin: String(pin).trim() });
    App.state.shopCode = ''; App.render(); focusId('shop-code');
  };
  App.acts['shop-logout'] = () => { saveShop(null); App.state.shopCode = ''; App.render(); };
  const shopCodeSet = (raw) => { App.state.shopCode = U.normCode(raw); App.state.justUsed = null; App.render(); return ''; };
  App.forms.shopcode = (f) => { shopCodeSet(new FormData(f).get('code')); focusId('shop-code'); };
  App.acts['shop-scan'] = () => {
    const me = loadShop(), shop = me && d0.shop(me.id);
    const list = shop ? d0.signupsOf(shop.area).slice(-12).reverse().map((s) => ({ label: `${s.name} · ${s.code}`, code: s.code })) : [];
    U.openScanner({ title: "Scan the customer's code", list, onCode: shopCodeSet, after: () => focusId('shop-code') });
  };
  App.acts['shop-next'] = () => { App.state.shopCode = ''; App.state.justUsed = null; App.render(); focusId('shop-code'); };
  App.acts['shop-use'] = async (b) => {
    const me = loadShop();
    const r = await App.run('use_coupon', { p_code: b.dataset.code, p_pin: me.pin });
    if (r.ok) { App.state.justUsed = b.dataset.code; App.render(); }
    else App.render();
  };
  App.acts['shop-stamp'] = async () => {
    const me = loadShop(), s = d0.signup(App.state.shopCode);
    if (s && me) await App.addStamp(s, me.id);
  };
  App.acts['shop-reward'] = async () => {
    const me = loadShop(), s = d0.signup(App.state.shopCode);
    if (s && me) await App.run('use_reward', { p_code: s.code, p_shop: me.id }, 'Reward used.');
  };
  const shopId = () => { const me = loadShop(); return me && me.id; };
  App.acts['trader-out'] = (b) => App.run('set_trader', { p_id: Number(b.dataset.id), p_shop: shopId(), p_status: 'out', p_offer: '' });
  App.acts['trader-undo'] = (b) => App.run('set_trader', { p_id: Number(b.dataset.id), p_shop: shopId(), p_status: 'none', p_offer: '' });
  App.forms.optin = (f) => App.run('set_trader', { p_id: Number(f.dataset.id), p_shop: shopId(), p_status: 'in', p_offer: new FormData(f).get('offer') || 'Stamp with any purchase' }, "You're in");
  App.acts.book = (b) => App.run('book_workshop', { p_trader: shopId(), p_workshop: Number(b.dataset.w) }, 'Booked. Details coming by email.');

  // =====================================================================
  // SHOP ONBOARDING  (/shop/join/<token>)  about a minute
  // =====================================================================
  P.shopjoin = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Join as a shop',
    async enter(ctx) { ctx.info = null; const r = await D.rpc('shop_invite', { p_token: ctx.params.token }, { reload: false }); ctx.info = r; if (App.ctx === ctx) App.render(); },
    render(ctx) {
      const r = ctx.info, S = App.state;
      let inner;
      if (!r) inner = '<p>Checking your invite…</p>';
      else if (!r.ok) inner = `<div class="panel"><h2>This invite link is not right</h2><p>${esc(r.error)}</p></div>`;
      else if (S.shopJoined === r.id) {
        inner = `<div class="panel"><h2>You're in, ${esc(S.shopJoinedName || r.name)}!</h2>
          <ol class="whathappens"><li>Add this page to your phone's home screen so the shop screen is one tap away.</li>
          <li>Print your counter sticker and stick it by the till.</li></ol>
          <div class="qr" style="background:#fff;border-radius:8px;padding:8px;width:fit-content">${U.qrSvg(location.origin + '/tap/' + r.id, 4)}</div>
          <p class="row" style="margin-top:12px"><a class="btn" href="/stickers/${esc(r.id)}" target="_blank" rel="noopener">Print the counter sticker</a><a class="btn sun" href="/shop">Open the shop screen</a></p></div>`;
      } else {
        inner = `<div class="panel"><h2>Join ${esc(r.place || 'the street')}'s My Main Street</h2>
          <p class="muted">It takes about a minute. Check your shop name, then choose a 4-digit PIN. Staff type this PIN to use coupons.</p>
          <form data-form="shopactivate" data-token="${esc(ctx.params.token)}">
            <label for="sj-name">Shop name</label><input id="sj-name" name="name" value="${esc(r.name)}" maxlength="60">
            <label for="sj-pin">Choose a 4-digit PIN</label><input id="sj-pin" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" style="letter-spacing:.4em;font-size:24px;text-align:center">
            <p class="err" id="sj-err" role="alert" hidden></p>
            <p style="margin-top:14px"><button class="btn big" type="submit">Join</button></p></form></div>`;
      }
      return `${App.band('Shop sign-up', App.fruitbowlBrand(), '')}<main class="wrap" id="main" style="max-width:560px">${inner}</main>${App.footer()}`;
    }
  };
  App.forms.shopactivate = async (f) => {
    const d = Object.fromEntries(new FormData(f)), err = document.getElementById('sj-err');
    const r = await App.run('shop_activate', { p_token: f.dataset.token, p_name: d.name, p_pin: d.pin });
    if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
    App.state.shopJoined = r.id; App.state.shopJoinedName = d.name;
    saveShop({ id: r.id, pin: d.pin });
    App.render();
  };
})();
