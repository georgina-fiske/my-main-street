// Screens and actions for the demo.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, esc = U.esc;
  const root = document.getElementById('app');

  const TABS = [
    ['start', 'Start here'], ['festival', 'Festival day'], ['vendor', 'Vendor'], ['customer', 'Customer'],
    ['fruitbowl', 'Fruitbowl'], ['council', 'Council'], ['street', 'Street Association']
  ];
  const ui = {
    tab: 'start',
    shop: C.shops[0].id,
    desk: { code: null, last: null, err: '' },
    vcode: null,        // customer scanned at the vendor counter
    vErr: ''
  };

  // ---- small helpers ----
  const S = () => D.state;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const me = () => { const c = store.get('msr_code'); return c ? S().signups.find((s) => s.code === c) || null : null; };
  const byCode = (code) => S().signups.find((s) => s.code === code);
  const codeStyle = () => S().settings.code_style || 'qr';
  const roleName = (r) => ({ fruitbowl: C.org, council: C.councilLabel, street: C.streetOrg }[r]);
  const isLive = (c) => c.council === 'approved' || c.street === 'yes';
  const liveCampaigns = () => S().campaigns.filter(isLive);
  const shop = () => U.shopById(ui.shop);
  const prizeClass = (p) => (p.value >= 100 ? 'red' : p.value === 0 ? 'yellow' : 'green');
  const wonCount = (p) => S().signups.filter((s) => s.prize && Number(s.prize.id) === Number(p.id)).length;
  const councilWorkshops = () => S().workshops.filter((w) => (w.councils || []).includes(C.council));

  async function run(name, args, okMsg) {
    const r = await D.rpc(name, args);
    if (!r.ok) U.toast(r.error || 'Something went wrong.', true);
    else if (okMsg) U.toast(okMsg);
    return r;
  }

  // ---- shared pieces ----
  function explainer(what, who, tryIt) {
    return `<section class="explainer" aria-label="About this screen">
      <div><b>What it is</b><p>${what}</p></div>
      <div><b>Who uses it</b><p>${who}</p></div>
      <div><b>Try it</b><p>${tryIt}</p></div>
    </section>`;
  }

  function liveNums() {
    const all = S().signups;
    const won = all.filter((s) => s.prize);
    const nums = [
      [all.length, 'Sign-ups'],
      [all.reduce((a, s) => a + U.stampTotal(s), 0), 'Stamps given'],
      [won.length, 'Prizes won'],
      [U.money(won.reduce((a, s) => a + Number(s.prize.value || 0), 0)), 'Prize value'],
      [all.filter((s) => s.redeemed).length, 'Prizes used'],
      [all.filter((s) => U.stampTotal(s) >= C.stampsForDraw).length, 'In the big draw']
    ];
    return `<div class="nums" aria-label="Live numbers">${nums.map((n) => `<div class="num"><b>${n[0]}</b><span>${n[1]}</span></div>`).join('')}</div>`;
  }

  function signupForm() {
    return `<form data-form="signup" novalidate>
      <h3>Join the ${esc(C.festivalName)}</h3>
      <label for="su-name">First name</label>
      <input id="su-name" name="name" type="text" autocomplete="given-name" maxlength="40">
      <label for="su-email">Email</label>
      <input id="su-email" name="email" type="email" autocomplete="email" maxlength="120">
      <p class="muted small" style="margin:.25rem 0 0">Demo: use a made-up email.</p>
      <label for="su-pc">Postcode</label>
      <input id="su-pc" name="postcode" type="text" inputmode="numeric" maxlength="4" autocomplete="postal-code">
      <label class="check"><input type="checkbox" name="optin"> <span>Yes, send me news from local shops.</span></label>
      <label class="check"><input type="checkbox" name="terms"> <span>I agree to the terms. (Needed)</span></label>
      <button class="btn big" type="submit">Sign up</button>
    </form>`;
  }

  function passCard(s) {
    const total = U.stampTotal(s);
    const dots = Array.from({ length: C.stampsForDraw }, (_, i) => `<span class="dot${i < total ? ' on' : ''}"></span>`).join('');
    return `<div class="pass">
      <div class="who">${esc(s.name)}</div>
      <div class="stamps" aria-label="${Math.min(total, 99)} of ${C.stampsForDraw} stamps">Stamps: ${total}/${C.stampsForDraw}</div>
      <div class="dots" aria-hidden="true">${dots}</div>
      ${U.codeBlock(s.code, codeStyle())}
    </div>`;
  }

  function rewardsUnder(s) {
    let out = '';
    if (s.prize) {
      const p = s.prize;
      out += s.redeemed
        ? `<div class="reward used"><b>${U.money(p.value)} ${esc(p.name)}</b><br>Used at ${esc(s.redeemed_at)}.</div>`
        : `<div class="reward"><b>Festival prize: ${U.money(p.value)} ${esc(p.name)}</b><br>
             Collect at ${esc(p.collect_at)}.
             <button class="btn gold" type="button" data-act="pin-prize">Staff: tap to use this</button></div>`;
    }
    C.shops.forEach((sh) => {
      const left = U.rewardsLeft(s, sh.id);
      for (let i = 0; i < left; i++) {
        out += `<div class="reward"><b>${C.stampsForReward}-stamp reward</b><br>Use it at ${esc(sh.name)} only.
          <button class="btn gold" type="button" data-act="pin-reward" data-shop="${sh.id}">Staff: tap to use this</button></div>`;
      }
    });
    if (U.stampTotal(s) >= C.stampsForDraw) out += `<div class="reward"><b>You're in the big draw!</b></div>`;
    return out;
  }

  function banner(s) {
    if (!s || !s.prize || s.redeemed) return '';
    const p = s.prize;
    return `<div class="won-banner" role="status"><span class="big">You won! ${U.money(p.value)} ${esc(p.name)}</span>
      Go to ${esc(p.collect_at)} to collect it. Show this screen. Use it by ${U.useBy(s.spun_at)}.</div>`;
  }

  function phone(inner) {
    return `<div class="phone"><div class="phone-notch"></div><div class="phone-screen">${inner}</div></div>`;
  }

  function phoneContent(intro) {
    const s = me();
    if (!s) return phone(signupForm());
    return phone(`${banner(s)}
      ${intro && !s.prize ? `<p class="ok">You're in! Now get in line for the wheel. When you reach the wheel, show this screen. Staff will scan it.</p>` : ''}
      ${passCard(s)}
      ${rewardsUnder(s)}
      <p class="small muted" style="margin-top:12px"><a href="#" data-act="forget">Not you? Start again.</a></p>`);
  }

  function qrBox(text) { return `<div class="qrbox" role="img" aria-label="QR code">${U.qrSvg(text, 4)}</div>`; }

  function fmtWorkshopWhere(w) { return w.format === 'Online' ? 'Online' : esc(w.place); }

  // ---- campaigns ----
  function postForm(role) {
    return `<form data-form="campaign" data-role="${role}" class="card" novalidate>
      <h3>Post a campaign</h3>
      <label for="cf-${role}-title">Name</label>
      <input id="cf-${role}-title" name="title" type="text" maxlength="80">
      <label for="cf-${role}-month">When</label>
      <input id="cf-${role}-month" name="month" type="text" maxlength="40" placeholder="e.g. March 2027">
      <label for="cf-${role}-blurb">The idea</label>
      <textarea id="cf-${role}-blurb" name="blurb" maxlength="300"></textarea>
      <div class="row" style="margin-top:12px">
        <button class="btn" type="submit">${role === 'fruitbowl' ? 'Send to council and the street' : 'Post and send to vendors'}</button>
      </div>
      <label for="idea-${role}">Need an idea?</label>
      <div class="row">
        <select id="idea-${role}" style="flex:1;min-width:200px">
          ${C.ideas.map((x, i) => `<option value="${i}">${esc(x.title)} (${esc(x.month)})</option>`).join('')}
        </select>
        <button class="btn ghost" type="button" data-act="use-idea" data-role="${role}">Use this</button>
      </div>
    </form>`;
  }

  function tagFor(who, v) {
    const text = v === 'approved' || v === 'yes' ? 'backing it' : v === 'declined' || v === 'no' ? 'passed' : 'deciding';
    const cls = text === 'backing it' ? 'yes' : text === 'passed' ? 'no' : '';
    return `<span class="tag ${cls}">${who}: ${text}</span>`;
  }

  function campaignCard(c, role) {
    const inCount = Object.values(c.traders || {}).filter((t) => t.status === 'in').length;
    let actions = '';
    if (role === 'council' && c.council === 'pending') {
      actions = `<div class="row" style="margin-top:8px">
        <button class="btn" data-act="council-back" data-id="${c.id}">Back it and send to vendors</button>
        <button class="btn ghost" data-act="council-no" data-id="${c.id}">Not for us</button></div>`;
    }
    if (role === 'street' && c.street === 'pending') {
      actions = `<label for="extra-${c.id}">Street extra (optional)</label>
        <input id="extra-${c.id}" type="text" maxlength="200" placeholder="e.g. Live music on Saturday">
        <div class="row" style="margin-top:8px">
          <button class="btn" data-act="street-back" data-id="${c.id}">Back it and send to vendors</button>
          <button class="btn ghost" data-act="street-no" data-id="${c.id}">Not for us</button></div>`;
    }
    if (role === 'street' && c.street === 'yes') {
      actions = `<h3 style="margin-top:12px">Which vendors are in</h3>
        <div class="tablewrap"><table><thead><tr><th>Shop</th><th>Answer</th></tr></thead><tbody>
        ${C.shops.map((sh) => {
          const t = (c.traders || {})[sh.id];
          const v = t ? t.status : 'none';
          return `<tr><td>${esc(sh.name)}${t && t.offer ? `<br><span class="muted small">${esc(t.offer)}</span>` : ''}</td>
            <td><label class="sr" for="v-${c.id}-${sh.id}" style="position:absolute;left:-999px">Answer for ${esc(sh.name)}</label>
            <select id="v-${c.id}-${sh.id}" data-change="trader-sel" data-id="${c.id}" data-shop="${sh.id}">
              <option value="none"${v === 'none' ? ' selected' : ''}>No answer</option>
              <option value="in"${v === 'in' ? ' selected' : ''}>In</option>
              <option value="out"${v === 'out' ? ' selected' : ''}>Out</option></select></td></tr>`;
        }).join('')}</tbody></table></div>`;
    }
    return `<article class="card">
      <h3>${esc(c.title)}</h3>
      <div class="muted">${esc(c.month)} · From ${esc(roleName(c.posted_by))}</div>
      <p style="margin-top:.5rem">${esc(c.blurb)}</p>
      ${c.street_extra ? `<p><b>Street extra:</b> ${esc(c.street_extra)}</p>` : ''}
      <div class="tags">${tagFor('Council', c.council)}${tagFor('Street', c.street)}
        ${isLive(c) ? `<span class="tag live">Live for vendors · ${inCount}/${C.shops.length} vendors in</span>` : ''}</div>
      ${actions}
    </article>`;
  }

  function campaignList(role) {
    const list = S().campaigns;
    return `<section><h2>Campaigns</h2><div class="grid cards">${list.map((c) => campaignCard(c, role)).join('') || '<p>No campaigns yet.</p>'}</div></section>`;
  }

  // ---- prizes ----
  function prizesPanel(role) {
    const rows = S().prizes.map((p) => {
      const won = wonCount(p);
      return `<tr>
        <td><span class="dot-pill ${prizeClass(p)}"></span>${esc(p.name)}</td>
        <td>${U.money(p.value)}</td><td>${won}</td><td>${p.stock}</td>
        <td>${esc(roleName(p.added_by))}</td><td>${esc(p.collect_at)}</td>
        <td><button class="btn small ghost" data-act="stock" data-id="${p.id}" aria-label="Add 10 ${esc(p.name)}">+10</button></td>
        <td>${won === 0 ? `<button class="btn small ghost" data-act="rm-prize" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>` : ''}</td></tr>`;
    }).join('');
    return `<section><h2>Prizes</h2>
      <p class="muted">Desk colours: $100 or more is red. $0 gifts are yellow. The rest are green.</p>
      <div class="tablewrap"><table><thead><tr><th>Prize</th><th>Value</th><th>Won</th><th>Stock</th><th>Added by</th><th>Where to collect</th><th></th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <form data-form="prize" data-role="${role}" class="card" style="margin-top:12px" novalidate>
        <h3>Add a prize</h3>
        <div class="grid cards">
          <div><label for="pz-${role}-name">Prize name</label><input id="pz-${role}-name" name="name" type="text" maxlength="60"></div>
          <div><label for="pz-${role}-value">Value ($)</label><input id="pz-${role}-value" name="value" type="number" min="0" max="10000" inputmode="numeric"></div>
          <div><label for="pz-${role}-where">Where to collect</label><input id="pz-${role}-where" name="where" type="text" maxlength="80"></div>
          <div><label for="pz-${role}-n">How many</label><input id="pz-${role}-n" name="stock" type="number" min="1" max="10000" inputmode="numeric"></div>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn" type="submit">Add prize</button></div>
      </form></section>`;
  }

  // ---- workshops ----
  function workshopTable(list, withBooked) {
    if (!list.length) return '<p>No workshops yet.</p>';
    return `<div class="tablewrap"><table><thead><tr><th>Workshop</th><th>Date</th><th>Time</th><th>Format</th><th>Where</th>${withBooked ? '<th>Sent to</th><th>Booked</th>' : ''}</tr></thead><tbody>
      ${list.map((w) => {
        const b = S().bookings.filter((x) => Number(x.workshop) === Number(w.id));
        return `<tr><td>${esc(w.name)}</td><td>${U.date(w.date)}</td><td>${esc(w.time)}</td><td>${esc(w.format)}</td><td>${fmtWorkshopWhere(w)}</td>
          ${withBooked ? `<td>${esc((w.councils || []).join(', '))}</td><td>${b.length}${b.length ? `<br><span class="muted small">${esc(b.map((x) => U.shopName(x.trader)).join(', '))}</span>` : ''}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // ======== SCREENS ========
  function screenStart() {
    const cards = [
      ['festival', 'Festival day', 'See sign-up, the prize desk and the shop PIN, side by side.', 'Sign up, then spin the wheel on the desk.'],
      ['vendor', 'Vendor', 'What a shop sees: numbers, PIN, campaigns and workshops.', 'Say "I\'m in" to a campaign.'],
      ['customer', 'Customer', 'The pass on a phone. Get stamps and see rewards.', 'Tap a shop to get a stamp.'],
      ['fruitbowl', 'Fruitbowl', 'Post campaigns and workshops. Set how codes look.', 'Send a workshop to Maroondah only.'],
      ['council', 'Council', 'Back campaigns, add prizes, see workshops.', 'Back a campaign so shops can join.'],
      ['street', 'Street Association', 'Back campaigns and pick which shops are in.', 'Add a street extra and back a campaign.']
    ];
    return `<div class="screen">
      <section class="card">
        <h1>${esc(C.siteName)}</h1>
        <p><b>The idea.</b> One site for a whole shopping street. ${esc(C.org)} posts campaigns, like Christmas. The council or the street association backs a campaign. Then it goes straight to the shops. Shops tap "I'm in."</p>
        <p><b>How customers get a stamp.</b> After paying, they scan the QR code on the counter, or tap the sticker. That's it. The shop does almost nothing.</p>
        <p><b>How customers win.</b> 6 stamps at one shop gives that shop's reward. 10 stamps anywhere gives an entry in the big draw.</p>
        <p><b>Later:</b> link your bank card so stamps happen when you pay.</p>
        <p class="who-box"><b>This is a demo.</b> Shops and prizes are made up.</p>
      </section>
      <div class="grid cards">${cards.map((c) => `<article class="card startcard">
        <h3>${c[1]}</h3><p>${c[2]}</p><p class="muted"><b>Example:</b> ${c[3]}</p>
        <a class="btn" href="#/${c[0]}">Open</a></article>`).join('')}</div>
    </div>`;
  }

  function screenFestival() {
    const st = codeStyle();
    const s = ui.desk.code ? byCode(ui.desk.code) : null;
    const last = ui.desk.last ? byCode(ui.desk.last) : null;
    const prizes = S().prizes;
    const desk = `
      <button class="btn big" type="button" data-act="desk-scan">Scan their code</button>
      <form data-form="deskscan" style="margin-top:10px">
        <label for="desk-scan">Scanner box</label>
        <input id="desk-scan" name="code" type="text" autocomplete="off" placeholder="Scan, or type the number">
        <p class="muted small">A USB or Bluetooth scanner can type here. Press Enter.</p>
      </form>
      ${ui.desk.err ? `<p class="err" role="alert">${esc(ui.desk.err)}</p>` : ''}
      ${s ? `<div class="deskstate">At the wheel: ${esc(s.name)} · ${esc(s.code)}</div>
        ${prizes.map((p) => `<button class="prizebtn ${prizeClass(p)}" data-act="award" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>
          <span class="v">${U.money(p.value)}</span> ${esc(p.name)}<br><span class="small">${p.stock} left</span></button>`).join('')}` : ''}
      ${last && last.prize ? `<div class="result" role="status"><b>${esc(last.name)} won ${esc(last.prize.name)}.</b>
        Collect at ${esc(last.prize.collect_at)}. Their phone shows it now.
        ${last.redeemed ? `<br><span class="muted">Already used, so it can't be undone.</span>` : ` · <a href="#" data-act="undo" data-code="${esc(last.code)}">Undo</a>`}</div>` : ''}
      <p class="muted small">Phones are showing: ${U.styleName(st)}.</p>`;
    const marquee = `<section class="card marquee">
      <h2>Scan to join the ${esc(C.festivalName)}</h2>
      ${qrBox(location.origin + '/#/festival')}
      <p class="no-print"><button class="btn gold" type="button" data-act="print-marquee">Print this</button></p></section>`;
    return `<div class="screen">
      <h1>Festival day</h1>
      ${explainer(
        `The ${esc(C.festivalName)} launch. People sign up, then spin the wheel for a prize.`,
        'Customers on their phones. Fruitbowl staff at the wheel. Shops, to use prizes.',
        'Sign up in box 1. Then pick yourself in box 2.')}
      ${liveNums()}
      <div class="grid three">
        <section class="card"><div class="step"><i>1</i><h2>What the customer sees</h2></div>${phoneContent(true)}</section>
        <section class="card"><div class="step"><i>2</i><h2>What our team sees</h2></div><p class="muted">The prize desk at the wheel. People line up in person. There is no queue in the app.</p>${desk}</section>
        <section class="card"><div class="step"><i>3</i><h2>What the vendor does</h2></div>
          <div class="card tint"><h3>The easy way</h3><p>Staff type the shop's 4-digit PIN on the customer's phone. That marks the prize as used.</p></div>
          <div class="card tint" style="margin-top:12px"><h3>Busy counters</h3><p>Use the Scan button, or a barcode scanner on the POS tablet.</p></div>
          <p style="margin-top:12px"><a class="btn" href="#/vendor">Go to the Vendor screen</a></p></section>
      </div>
      ${marquee}
    </div>`;
  }

  function vendorScanCard() {
    const sh = shop();
    const s = ui.vcode ? byCode(ui.vcode) : null;
    let card = '';
    if (s) {
      const left = U.rewardsLeft(s, sh.id);
      card = `<div class="result"><h3>${esc(s.name)} · ${esc(s.code)}</h3>
        <p>Stamps here: <b>${U.stampsAt(s, sh.id)}</b> · Stamps overall: <b>${U.stampTotal(s)}</b></p>
        <div class="grid cards">
          ${s.prize && !s.redeemed ? `<button class="btn big gold" data-act="v-prize">Use festival prize (${esc(s.prize.name)})</button>` : ''}
          ${s.prize && s.redeemed ? `<p class="muted">Festival prize used at ${esc(s.redeemed_at)}.</p>` : ''}
          ${left > 0 ? `<button class="btn big gold" data-act="v-reward">Use ${C.stampsForReward}-stamp reward</button>` : ''}
          <button class="btn big" data-act="v-stamp">Give a stamp</button>
          <button class="btn big ghost" data-act="v-next">Next customer</button></div></div>`;
    }
    return `<section class="card"><h2>Busy counter? Scan instead.</h2>
      <button class="btn big" type="button" data-act="v-scan">Scan a customer's pass</button>
      <form data-form="vscan" style="margin-top:10px">
        <label for="v-scanbox">Scanner box</label>
        <input id="v-scanbox" name="code" type="text" autocomplete="off" placeholder="Scan, or type the number">
        <p class="muted small">A USB or Bluetooth barcode scanner can type here. It sends when it presses Enter.</p>
      </form>
      ${ui.vErr ? `<p class="err" role="alert">${esc(ui.vErr)}</p>` : ''}
      ${card}</section>`;
  }

  function screenVendor() {
    const sh = shop();
    const all = S().signups;
    const stampsHere = all.reduce((a, s) => a + U.stampsAt(s, sh.id), 0);
    const usedPrizes = all.filter((s) => s.redeemed && s.redeemed_at === sh.name);
    const rewardsUsed = all.reduce((a, s) => a + Number((s.rewards_used || {})[sh.id] || 0), 0);
    const spent = usedPrizes.reduce((a, s) => a + Number((s.prize || {}).value || 0), 0);
    const live = liveCampaigns();
    const ws = councilWorkshops();

    const camp = live.map((c) => {
      const t = (c.traders || {})[sh.id];
      return `<article class="card">
        <h3>${esc(c.title)}</h3><div class="muted">${esc(c.month)}</div><p>${esc(c.blurb)}</p>
        ${c.street_extra ? `<p><b>Street extra:</b> ${esc(c.street_extra)}</p>` : ''}
        ${t ? `<div class="tags"><span class="tag ${t.status === 'in' ? 'yes' : 'no'}">${t.status === 'in' ? "You're in" : 'Not this time'}</span></div>
              ${t.offer ? `<p class="offer">Your offer: ${esc(t.offer)}</p>` : ''}
              <button class="btn ghost small" data-act="trader-clear" data-id="${c.id}">Change my answer</button>`
          : `<label for="offer-${c.id}">Your offer (optional)</label>
             <input id="offer-${c.id}" type="text" maxlength="120" placeholder="e.g. Free upsize + a stamp">
             <div class="row" style="margin-top:8px">
               <button class="btn" data-act="trader-in" data-id="${c.id}">I'm in</button>
               <button class="btn ghost" data-act="trader-out" data-id="${c.id}">Not this time</button></div>`}
      </article>`;
    }).join('');

    const wsRows = ws.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Time</th><th>Online or in person</th><th>Where</th><th></th></tr></thead><tbody>
      ${ws.map((w) => {
        const booked = S().bookings.some((b) => Number(b.workshop) === Number(w.id) && b.trader === sh.id);
        return `<tr><td>${U.date(w.date)}<br><b>${esc(w.name)}</b></td><td>${esc(w.time)}</td><td>${esc(w.format)}</td><td>${fmtWorkshopWhere(w)}</td>
          <td>${booked ? `<span class="ok">Booked ✓</span> <button class="btn small ghost" data-act="unbook" data-id="${w.id}">Cancel</button>`
                        : `<button class="btn small" data-act="book" data-id="${w.id}">Book</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p>No workshops for your area yet.</p>';

    return `<div class="screen">
      <h1>Vendor</h1>
      ${explainer('What a shop owner sees: their numbers, their PIN, and campaigns to join.', 'Shop owners and their staff.', 'Pick a shop, then say "I\'m in" to a campaign.')}
      <div class="card"><label for="pretend" style="margin-top:0">Pretend you are</label>
        <select id="pretend" data-change="pretend">${C.shops.map((x) => `<option value="${x.id}"${x.id === ui.shop ? ' selected' : ''}>${esc(x.name)} (${esc(x.type)})</option>`).join('')}</select></div>
      <div class="nums">
        <div class="num"><b>${stampsHere}</b><span>Stamps given here</span></div>
        <div class="num"><b>${usedPrizes.length + rewardsUsed}</b><span>Prizes used here</span></div>
        <div class="num"><b>${U.money(spent)}</b><span>Prize money spent here</span></div></div>
      <section><h2>How you'll use it</h2><div class="grid cards">
        <div class="card"><h3>Stamps</h3><p><b>Nothing to do.</b> Customers scan the counter QR or tap the sticker after paying. Same as StampMe.</p></div>
        <div class="card"><h3>Prizes and rewards</h3><p>Type your PIN on the customer's phone.</p><div class="pin" aria-label="Shop PIN ${sh.pin.split('').join(' ')}">${sh.pin}</div></div>
        <div class="card"><h3>Your counter sticker</h3><p>Print this QR for your counter.</p>${qrBox(location.origin + '/tap/' + sh.id)}
          <p class="small muted">Opens ${esc(location.origin)}/tap/${esc(sh.id)}</p></div></div></section>
      ${vendorScanCard()}
      <section><h2>Campaigns you can join</h2><div class="grid cards">${camp || '<p>No live campaigns yet. Ask council or the street to back one.</p>'}</div></section>
      <section><h2>Workshops for your area</h2>${wsRows}</section>
    </div>`;
  }

  function screenCustomer() {
    const s = me();
    const demo = C.shops.map((sh) => `<button class="btn ghost" data-act="stamp" data-shop="${sh.id}" ${s ? '' : 'disabled'}>
      Scan the QR at ${esc(sh.name)}${s ? ` (${U.stampsAt(s, sh.id)})` : ''}</button>`).join('');
    const live = liveCampaigns().map((c) => {
      const ins = Object.entries(c.traders || {}).filter(([, t]) => t.status === 'in');
      return `<article class="card"><h3>${esc(c.title)}</h3><div class="muted">${esc(c.month)}</div>
        ${ins.map(([id, t]) => `<p class="offer"><b>${esc(U.shopName(id))}</b>${t.offer ? ': ' + esc(t.offer) : ''}</p>`).join('') || '<p class="muted">No shops are in yet.</p>'}</article>`;
    }).join('');
    return `<div class="screen">
      <h1>Customer</h1>
      ${explainer('The customer\'s pass on their phone. It holds stamps and rewards.', 'Shoppers on the street.', 'Tap a shop button to get a stamp.')}
      <div class="grid three">
        <section class="card"><h2>Your pass</h2>${phoneContent(false)}
          <p class="muted small" style="margin-top:12px">In the real version this pass lives in Apple or Google Wallet. No app needed.</p></section>
        <section class="card"><h2>Get a stamp after you pay</h2>
          <p><b>In real life:</b> scan the QR on the counter or tap the sticker.</p>
          ${s ? '' : '<p class="err">Sign up first to collect stamps.</p>'}
          <p class="muted">In this demo, these buttons act like scanning:</p><div class="shopbtns">${demo}</div>
          <p class="muted small" style="margin-top:10px">Real life: 1 stamp per shop per day. In the demo you can repeat, so you can try it.</p></section>
        <section><h2>Happening now</h2><div class="grid">${live || '<p>No live campaigns yet.</p>'}</div></section>
      </div>
    </div>`;
  }

  function screenFruitbowl() {
    const st = codeStyle();
    return `<div class="screen">
      <h1>Fruitbowl</h1>
      ${explainer(`${esc(C.org)} runs the show. It posts campaigns and workshops and sets up the festival.`, `${esc(C.org)} staff.`, 'Change the code style, then look at a phone on Festival day.')}
      <section class="card"><h2>Festival day settings</h2>
        <p>How should customers' codes show on their phones? It is saved for everyone.</p>
        <div class="seg" role="group" aria-label="Code style">
          ${['qr', 'number', 'barcode'].map((k) => `<button class="btn" type="button" aria-pressed="${st === k}" data-act="style" data-style="${k}">${U.styleName(k)}</button>`).join('')}
        </div></section>
      ${liveNums()}
      <section><h2>Post a campaign</h2>${postForm('fruitbowl')}</section>
      <section><h2>Every campaign, every level</h2><div class="grid cards">${S().campaigns.map((c) => campaignCard(c, 'fruitbowl')).join('')}</div></section>
      ${prizesPanel('fruitbowl')}
      <section><h2>Workshops</h2><p class="muted">Only ${esc(C.org)} makes workshops. Vendors only see workshops sent to their council.</p>
        ${workshopTable(S().workshops, true)}
        <form data-form="workshop" class="card" style="margin-top:12px" novalidate>
          <h3>Add a workshop</h3>
          <div class="grid cards">
            <div><label for="ws-name">Name</label><input id="ws-name" name="name" type="text" maxlength="80"></div>
            <div><label for="ws-date">Date</label><input id="ws-date" name="date" type="date"></div>
            <div><label for="ws-time">Time</label><input id="ws-time" name="time" type="text" maxlength="20" placeholder="e.g. 6:30pm"></div>
            <div><label for="ws-format">Format</label><select id="ws-format" name="format"><option>Online</option><option>In person</option></select></div>
            <div><label for="ws-where">Where, or link</label><input id="ws-where" name="place" type="text" maxlength="120"></div>
          </div>
          <fieldset style="border:0;padding:0;margin:.75rem 0 0"><legend style="font-weight:700">Send to</legend>
            <div class="checks">${C.allCouncils.map((n) => `<label class="check"><input type="checkbox" name="councils" value="${esc(n)}"> <span>${esc(n)}</span></label>`).join('')}</div></fieldset>
          <div class="row" style="margin-top:12px"><button class="btn" type="submit">Send workshop</button></div>
        </form></section>
    </div>`;
  }

  function screenCouncil() {
    return `<div class="screen">
      <h1>Council</h1>
      ${explainer(`${esc(C.councilLabel)} sees every campaign and decides what to back.`, 'Council staff.', 'Back a campaign. Then check the Vendor screen.')}
      ${liveNums()}
      <section><h2>Post your own campaign</h2>${postForm('council')}</section>
      ${campaignList('council')}
      ${prizesPanel('council')}
      <section><h2>Workshops for ${esc(C.council)} vendors</h2>${workshopTable(councilWorkshops(), true)}</section>
    </div>`;
  }

  function screenStreet() {
    return `<div class="screen">
      <h1>Street Association</h1>
      ${explainer(`${esc(C.streetOrg)} backs campaigns for the street and picks which shops are in.`, 'Street association members.', 'Back a campaign, then pick the shops that are in.')}
      ${liveNums()}
      <section><h2>Post your own campaign</h2>${postForm('street')}</section>
      ${campaignList('street')}
      ${prizesPanel('street')}
    </div>`;
  }

  const SCREENS = { start: screenStart, festival: screenFestival, vendor: screenVendor, customer: screenCustomer, fruitbowl: screenFruitbowl, council: screenCouncil, street: screenStreet };

  // ======== RENDER ========
  function snapshotFields() {
    const snap = {};
    root.querySelectorAll('input[id],select[id],textarea[id]').forEach((el) => {
      snap[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return snap;
  }
  function restoreFields(snap) {
    Object.keys(snap).forEach((id) => {
      const el = root.querySelector('#' + CSS.escape(id));
      if (!el) return;
      if (el.type === 'checkbox') el.checked = snap[id];
      else if (el.tagName === 'SELECT') { if ([...el.options].some((o) => o.value === snap[id])) el.value = snap[id]; }
      else el.value = snap[id];
    });
  }

  function renderTabs() {
    document.getElementById('tabs').innerHTML = TABS.map(([k, n]) =>
      `<a href="#/${k}"${k === ui.tab ? ' aria-current="page"' : ''}>${n}</a>`).join('');
  }

  function render() {
    renderTabs();
    if (!D.ready) {
      root.innerHTML = D.error === 'not-configured'
        ? `<div class="card"><h1>Almost there</h1><p>This site needs its database. Add the Supabase URL and key in <code>js/config.js</code>. See the README.</p></div>`
        : D.error
          ? `<div class="card"><h1>Can't reach the demo data</h1><p>${esc(D.error)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`
          : `<p>Loading…</p>`;
      return;
    }
    const snap = snapshotFields();
    root.innerHTML = SCREENS[ui.tab]();
    restoreFields(snap);
  }

  let pending = false;
  function scheduleRender() {
    const a = document.activeElement;
    if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
      if (!pending) {
        pending = true;
        a.addEventListener('blur', () => { setTimeout(() => { pending = false; scheduleRender(); }, 400); }, { once: true });
      }
      return;
    }
    render();
  }

  function route() {
    const k = (location.hash.replace(/^#\/?/, '') || 'start').split('?')[0];
    ui.tab = SCREENS[k] ? k : 'start';
    render();
    window.scrollTo(0, 0);
  }

  // ======== ACTIONS ========
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

  function deskPick(raw) {
    const s = byCode(U.normCode(raw));
    if (!s) return 'No one has that code.';
    if (s.prize) return `${s.name} has already spun.`;
    ui.desk = { code: s.code, last: null, err: '' };
    render();
    return '';
  }

  function vendorPick(raw) {
    const s = byCode(U.normCode(raw));
    if (!s) return 'No customer has that code.';
    ui.vcode = s.code; ui.vErr = '';
    render();
    return '';
  }

  // Checks a PIN against a shop. Returns the shop or an error text.
  const pinShop = (pin) => U.shopByPin(pin) || null;

  const ACTS = {
    async reset() {
      if (!confirm('Reset the demo? This wipes all changes and reloads the demo data.')) return;
      const r = await run('reset_demo', {}, 'Demo reset.');
      if (r.ok) { store.del('msr_code'); ui.desk = { code: null, last: null, err: '' }; ui.vcode = null; render(); }
    },
    forget() { store.del('msr_code'); render(); },
    style(b) { return run('set_setting', { p_key: 'code_style', p_value: b.dataset.style }, 'Saved for everyone.'); },
    'use-idea'(b) {
      const role = b.dataset.role, i = Number(val('idea-' + role));
      const idea = C.ideas[i];
      document.getElementById(`cf-${role}-title`).value = idea.title;
      document.getElementById(`cf-${role}-month`).value = idea.month;
      document.getElementById(`cf-${role}-blurb`).value = idea.blurb;
    },
    'council-back': (b) => run('council_decide', { p_id: Number(b.dataset.id), p_approve: true }, 'Backed. Vendors can see it now.'),
    'council-no': (b) => run('council_decide', { p_id: Number(b.dataset.id), p_approve: false }, 'Marked as not for us.'),
    'street-back': (b) => run('street_decide', { p_id: Number(b.dataset.id), p_yes: true, p_extra: val('extra-' + b.dataset.id) }, 'Backed. Vendors can see it now.'),
    'street-no': (b) => run('street_decide', { p_id: Number(b.dataset.id), p_yes: false, p_extra: '' }, 'Marked as not for us.'),
    'trader-in': (b) => run('set_trader', { p_id: Number(b.dataset.id), p_shop: ui.shop, p_status: 'in', p_offer: val('offer-' + b.dataset.id) }, "You're in!"),
    'trader-out': (b) => run('set_trader', { p_id: Number(b.dataset.id), p_shop: ui.shop, p_status: 'out', p_offer: '' }, 'Noted.'),
    'trader-clear': (b) => run('set_trader', { p_id: Number(b.dataset.id), p_shop: ui.shop, p_status: 'none', p_offer: '' }),
    stock: (b) => run('add_stock', { p_id: Number(b.dataset.id), p_n: 10 }, 'Added 10.'),
    'rm-prize': (b) => run('remove_prize', { p_id: Number(b.dataset.id) }, 'Prize removed.'),
    book: (b) => run('book_workshop', { p_trader: ui.shop, p_workshop: Number(b.dataset.id) }, 'Booked!'),
    unbook: (b) => run('cancel_booking', { p_trader: ui.shop, p_workshop: Number(b.dataset.id) }, 'Booking cancelled.'),
    'print-marquee'() {
      document.body.classList.add('printing');
      window.print();
      setTimeout(() => document.body.classList.remove('printing'), 500);
    },

    // festival desk
    'desk-scan'() {
      const list = S().signups.filter((s) => !s.prize).map((s) => ({ label: `${s.name} · ${s.code}`, code: s.code }));
      U.openScanner({ title: 'Scan their code', list, onCode: (c) => deskPick(c) });
    },
    async award(b) {
      const code = ui.desk.code;
      if (!code) return;
      const r = await run('award_prize', { p_code: code, p_prize: Number(b.dataset.id) });
      if (r.ok) ui.desk = { code: null, last: code, err: '' };
      else ui.desk.err = r.error;
      render();
    },
    async undo(b) {
      const r = await run('undo_prize', { p_code: b.dataset.code }, 'Undone.');
      if (r.ok) ui.desk.last = null;
      render();
    },

    // customer pass: staff use prize / reward with a PIN
    'pin-prize'() {
      const s = me();
      if (!s) return;
      U.askPin('Staff: type the shop PIN', 'The shop PIN marks this prize as used.', async (pin) => {
        const sh = pinShop(pin);
        if (!sh) return "That PIN doesn't match a shop.";
        const r = await D.rpc('redeem_prize', { p_code: s.code, p_shop_name: sh.name });
        if (!r.ok) return r.error;
        U.toast('Prize used at ' + sh.name + '.');
        return '';
      });
    },
    'pin-reward'(b) {
      const s = me();
      if (!s) return;
      const target = U.shopById(b.dataset.shop);
      U.askPin('Staff: type the shop PIN', `This reward can only be used at ${target.name}.`, async (pin) => {
        const sh = pinShop(pin);
        if (!sh) return "That PIN doesn't match a shop.";
        if (sh.id !== target.id) return `This reward can only be used at ${target.name}.`;
        const r = await D.rpc('use_reward', { p_code: s.code, p_shop: sh.id });
        if (!r.ok) return r.error;
        U.toast('Reward used at ' + sh.name + '.');
        return '';
      });
    },
    async stamp(b) {
      const s = me();
      if (!s) return U.toast('Sign up first to collect stamps.', true);
      await run('give_stamp', { p_code: s.code, p_shop: b.dataset.shop }, 'Stamp from ' + U.shopName(b.dataset.shop) + '!');
    },

    // vendor counter
    'v-scan'() { U.openScanner({ title: "Scan a customer's pass", onCode: (c) => vendorPick(c) }); },
    async 'v-prize'() {
      const s = byCode(ui.vcode);
      if (s) await run('redeem_prize', { p_code: s.code, p_shop_name: shop().name }, 'Festival prize used.');
    },
    async 'v-reward'() {
      const s = byCode(ui.vcode);
      if (s) await run('use_reward', { p_code: s.code, p_shop: ui.shop }, 'Reward used.');
    },
    async 'v-stamp'() {
      const s = byCode(ui.vcode);
      if (s) await run('give_stamp', { p_code: s.code, p_shop: ui.shop }, 'Stamp given.');
    },
    'v-next'() { ui.vcode = null; ui.vErr = ''; render(); }
  };

  const FORMS = {
    async signup(f) {
      const d = new FormData(f);
      if (!d.get('terms')) return U.toast('Please tick the terms.', true);
      const r = await run('signup', { p_name: d.get('name'), p_email: d.get('email'), p_postcode: d.get('postcode'), p_optin: !!d.get('optin') });
      if (r.ok) {
        store.set('msr_code', r.code);
        ['su-name', 'su-email', 'su-pc'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
        render();
      }
    },
    deskscan(f) {
      const input = f.querySelector('input');
      const msg = deskPick(input.value);
      if (msg) { ui.desk.err = msg; render(); } else { const el = document.getElementById('desk-scan'); if (el) el.value = ''; }
    },
    vscan(f) {
      const input = f.querySelector('input');
      const msg = vendorPick(input.value);
      if (msg) { ui.vErr = msg; render(); } else { const el = document.getElementById('v-scanbox'); if (el) el.value = ''; }
    },
    async campaign(f) {
      const role = f.dataset.role, d = new FormData(f);
      const r = await run('post_campaign', { p_title: d.get('title'), p_month: d.get('month'), p_blurb: d.get('blurb'), p_from: role },
        role === 'fruitbowl' ? 'Sent to council and the street.' : 'Posted. Vendors can see it now.');
      if (r.ok) { f.reset(); render(); }
    },
    async prize(f) {
      const role = f.dataset.role, d = new FormData(f);
      const r = await run('add_prize', { p_name: d.get('name'), p_value: parseInt(d.get('value'), 10), p_collect_at: d.get('where'), p_stock: parseInt(d.get('stock'), 10), p_added_by: role },
        'Prize added. It is on the festival desk now.');
      if (r.ok) { f.reset(); render(); }
    },
    async workshop(f) {
      const d = new FormData(f);
      const r = await run('add_workshop', { p_name: d.get('name'), p_date: d.get('date') || null, p_time: d.get('time'), p_format: d.get('format'), p_place: d.get('place'), p_councils: d.getAll('councils') },
        'Workshop sent.');
      if (r.ok) { f.reset(); render(); }
    }
  };

  const CHANGES = {
    pretend(el) {
      ui.shop = el.value; ui.vcode = null; ui.vErr = '';
      root.querySelectorAll('input[id^="offer-"]').forEach((i) => (i.value = '')); render(); },
    'trader-sel'(el) {
      const c = S().campaigns.find((x) => x.id === Number(el.dataset.id));
      const t = c && (c.traders || {})[el.dataset.shop];
      return run('set_trader', { p_id: Number(el.dataset.id), p_shop: el.dataset.shop, p_status: el.value, p_offer: t ? t.offer : '' });
    }
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.tagName === 'A') e.preventDefault();
    const fn = ACTS[b.dataset.act];
    if (fn) fn(b);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    FORMS[f.dataset.form](f);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el) CHANGES[el.dataset.change](el);
  });
  window.addEventListener('hashchange', route);

  // ======== BOOT ========
  document.getElementById('logo').innerHTML = C.logoSvg;
  document.getElementById('siteName').textContent = C.siteName;
  document.getElementById('streetName').textContent = C.streetName;
  document.title = C.siteName + ' demo';
  const root_ = document.documentElement.style;
  root_.setProperty('--green', C.colors.green);
  root_.setProperty('--gold', C.colors.gold);
  root_.setProperty('--red', C.colors.red);
  root_.setProperty('--light', C.colors.light);
  root_.setProperty('--ink', C.colors.ink);

  // /tap/<shop-id>: add a stamp, then show the Customer screen.
  let tapShop = null;
  const m = location.pathname.match(/^\/tap\/([\w-]+)\/?$/);
  if (m) tapShop = m[1];

  async function afterFirstLoad() {
    if (!tapShop) return;
    const id = tapShop;
    tapShop = null;
    history.replaceState(null, '', '/#/customer');
    ui.tab = 'customer';
    const sh = U.shopById(id), s = me();
    if (!sh) U.toast('That shop sticker is not part of this demo.', true);
    else if (!s) U.toast('Sign up first to collect stamps.', true);
    else await run('give_stamp', { p_code: s.code, p_shop: sh.id }, 'Stamp from ' + sh.name + '!');
    render();
  }

  D.onChange(() => { scheduleRender(); });
  if (tapShop) { history.replaceState(null, '', '/#/customer'); }
  route();
  D.start().then(afterFirstLoad);
})();
