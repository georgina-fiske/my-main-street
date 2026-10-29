// Demo mode: the whole backend runs inside the visitor's own browser (no database needed).
// It does the same jobs, with the same rules and messages, as the functions in sql/01_schema.sql.
// Changes are saved in this browser only. Frames on the same page (the guided demo) share them.
// Each night (Melbourne time) the demo puts itself back.
(function () {
  const U = window.U;
  const KEY = 'msr-local-v1';
  const TZ = 'Australia/Melbourne';
  const err = (m) => ({ ok: false, error: m });
  const ok = (x) => Object.assign({ ok: true }, x || {});
  const clean = (t, n) => String(t == null ? '' : t).trim().slice(0, n);
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const plusDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
  const dow = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const stamp = (iso) => {                         // "2026-10-29 23:13" in Melbourne
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { timeZone: TZ }) + ' ' + d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  };
  const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const RESERVED = ['demo', 'join', 'safety', 'c', 'desk', 'shop', 'client', 'hq', 'wallet', 'poster', 'stickers', 'tap', 'reports', 'api', 'img', 'css', 'js', 'vendor', 'sql', 'index', 'admin', 'login'];
  const nextId = (B, t) => (B.seq[t] = (B.seq[t] || 0) + 1);

  // ---------- demo data ----------
  function seed() {
    const day = today();
    const B = {
      v: 1, day, seq: {}, settings: { code_style: 'qr' }, areas: [], area_private: {}, events: [], shops: [], shop_private: {},
      signups: [], signup_private: {}, campaigns: [], prizes: [], workshops: [], bookings: [], download_log: []
    };
    const area = (id, name, type, council_area, status, created_by, sort_order, brand, email_name, email_address, reply_to) =>
      B.areas.push({ id, name, type, council_area, status, created_by, sort_order, brand, email_name, email_address, reply_to });
    area('croydon', 'Croydon Main Street Association', 'Street Association', 'Maroondah', 'live', 'fruitbowl', 1,
      { place: 'Croydon Main Street', color: '#560CC9', accent: '#F9DE4B', logo: '', welcome: 'Win something on Main Street', web: 'mymainstreet.com.au/croydon' },
      'Croydon Main Street', 'croydon@mymainstreet.com.au', 'hello@croydonmainstreet.example');
    area('ringwood', 'Ringwood Village Traders', 'Street Association', 'Maroondah', 'invited', 'fruitbowl', 2,
      { place: 'Ringwood Village', color: '#0E6E5C', accent: '#FFC845', logo: '', welcome: 'Win something in Ringwood Village', web: 'mymainstreet.com.au/ringwood' },
      'Ringwood Village', 'ringwood@mymainstreet.com.au', '');
    area('knox', 'Knox City Council', 'Council', 'Knox', 'waiting', 'self', 3,
      { place: 'Knox', color: '#B0174F', accent: '#FFD54F', logo: '', welcome: 'Shop local in Knox and win', web: 'mymainstreet.com.au/knox' },
      'Knox', 'knox@mymainstreet.com.au', '');
    B.area_private = {
      croydon: { name: 'Alex Demo', email: 'alex@croydonmainstreet.example', mobile: '0400 000 001' },
      ringwood: { name: 'Pat Demo', email: 'pat@ringwood.example', mobile: '0400 000 002' },
      knox: { name: 'Robin Demo', email: 'robin@knox.example', mobile: '0400 000 003' }
    };
    // the festival is the first Saturday at least a week away; coupons last 7 days after it
    let sat = plusDays(day, 7);
    while (dow(sat) !== 6) sat = plusDays(sat, 1);
    const ev = { id: nextId(B, 'events'), area: 'croydon', name: 'Maroondah Festival', starts_on: sat, use_by: plusDays(sat, 7) };
    B.events.push(ev);

    [['espresso', 'Main St Espresso', 'Cafe', '1111'], ['lantern', 'Lantern Thai', 'Restaurant', '2222'], ['drover', 'The Drover Bar', 'Bar', '3333'],
      ['gelato', 'Gelato Lane', 'Dessert', '4444'], ['books', 'The Corner Bookshop', 'Bookshop', '5555'], ['opshop', 'Croydon Op Shop', 'Op shop', '6666'],
      ['optom', 'Clear View Optometrist', 'Optometrist', '7777'], ['dental', 'Smile Dental', 'Dentist', '8888']].forEach((s, i) => {
      B.shops.push({ id: s[0], area: 'croydon', name: s[1], type: s[2], status: 'active', sort_order: i + 1 });
      B.shop_private[s[0]] = { pin: s[3], token: 'demo-' + s[0], contact: '' };
    });

    [['Free coffee', 5, 150, 'Main St Espresso', 'fruitbowl'], ['Sweet treat', 5, 80, 'Gelato Lane', 'fruitbowl'], ['Drink at a bar tonight', 10, 60, 'The Drover Bar, tonight only', 'street'],
      ['Shop voucher', 20, 30, 'The Corner Bookshop or Croydon Op Shop', 'street'], ['Dinner voucher', 25, 30, 'Lantern Thai', 'council'],
      ['Big dining prize', 100, 3, 'Lantern Thai', 'council'], ['Croydon tote bag', 0, 200, 'the marquee desk, right now', 'fruitbowl']].forEach((p, i) => {
      B.prizes.push({ id: nextId(B, 'prizes'), area: 'croydon', name: p[0], value: p[1], stock: p[2], collect_at: p[3], added_by: p[4], sort_order: i + 1 });
    });

    const camp = (title, month, blurb, posted_by, council, street, street_extra, traders, sort_order) =>
      B.campaigns.push({ id: nextId(B, 'campaigns'), area: 'croydon', title, month, blurb, posted_by, council, street, street_extra, traders, sort_order });
    camp('Tinsel & Thongs: a Croydon Summer Christmas', 'December 2026', 'An Aussie summer Christmas. Stamp trail, late-night Thursdays, Santa on a banana lounge.',
      'fruitbowl', 'approved', 'yes', 'Santa on a banana lounge, Saturday afternoons.', {
        espresso: { status: 'in', offer: 'Free iced coffee upsize + a stamp' }, gelato: { status: 'in', offer: 'Christmas pudding gelato, stamp with any scoop' },
        books: { status: 'in', offer: 'Free gift wrapping + a stamp' }, optom: { status: 'in', offer: 'Free sunnies fitting + a stamp' } }, 1);
    camp('Hot Days, Cool Street', 'January 2027', 'Beat the heat. Cold drink deals, chill stops in shops, water stations.', 'fruitbowl', 'approved', 'pending', '', {}, 2);
    camp('Back to School', 'February 2027', 'Shoes, books, haircuts, eye checks and lunchbox treats for families.', 'fruitbowl', 'pending', 'pending', '', {}, 3);
    camp('Croydon Twilight Market', 'Friday 4 December 2026', 'Shops stay open late. Stamps count double on the night.', 'council', 'approved', 'pending', '', {}, 4);

    [['Christmas in a box', '2026-11-10', '18:30', 'Online', 'Google Meet link sent on booking', ['Maroondah', 'Knox']],
      ['How to use My Main Street', '2026-11-12', '14:00', 'Online', 'Google Meet link sent on booking', ['Maroondah']],
      ['Phone photos that sell', '2026-11-17', '10:00', 'In person', 'Croydon, venue to be confirmed', ['Maroondah']]].forEach((w) =>
      B.workshops.push({ id: nextId(B, 'workshops'), name: w[0], date: w[1], time: w[2], format: w[3], place: w[4], councils: w[5] }));

    const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
    const su = (o) => Object.assign({ id: 'u' + Math.random().toString(36).slice(2), area: 'croydon', event: ev.id, contact: 'email', prize: null, spun_at: null, use_by: null,
      redeemed: false, redeemed_at: null, redeemed_time: null, stamps: {}, rewards_used: {}, cards: [], card_stamps: {} }, o);
    B.signups.push(su({ code: 'CMS-1001', name: 'Jo', last_initial: 'D', created_at: ago(20) }));
    B.signups.push(su({ code: 'CMS-1002', name: 'Priya', last_initial: 'D', contact: 'text', created_at: ago(40),
      prize: { id: 1, name: 'Free coffee', value: 5, collect_at: 'Main St Espresso' }, spun_at: ago(30), use_by: ev.use_by }));
    B.signups.push(su({ code: 'CMS-1003', name: 'Alex', last_initial: 'D', created_at: ago(2880), stamps: { espresso: 4, gelato: 3, books: 2 } }));
    B.signup_private = {
      'CMS-1001': { event: ev.id, last_name: 'Demo', email: 'jo@example.com', mobile: '', postcode: '3136', optin: true },
      'CMS-1002': { event: ev.id, last_name: 'Demo', email: '', mobile: '0400000002', postcode: '3136', optin: false },
      'CMS-1003': { event: ev.id, last_name: 'Demo', email: 'alex@example.com', mobile: '', postcode: '3136', optin: true }
    };
    return B;
  }

  // ---------- storage ----------
  function loadB() {
    let B = null;
    try { B = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { B = null; }
    if (!B || B.v !== 1 || B.day !== today()) { B = seed(); saveB(B); }
    return B;
  }
  function saveB(B) { try { localStorage.setItem(KEY, JSON.stringify(B)); } catch (e) { /* storage full or blocked */ } }

  const byKey = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  function view(B, DB) {
    DB.state = {
      settings: Object.assign({}, B.settings),
      areas: B.areas.slice().sort(byKey('sort_order')),
      events: B.events.slice().sort(byKey('id')),
      shops: B.shops.slice().sort(byKey('sort_order')),
      signups: B.signups.slice().sort(byKey('created_at')),
      campaigns: B.campaigns.slice().sort(byKey('sort_order')),
      prizes: B.prizes.slice().sort(byKey('sort_order')),
      workshops: B.workshops.slice().sort(byKey('date')),
      bookings: B.bookings.slice().sort(byKey('id'))
    };
  }

  // ---------- helpers ----------
  const signupOf = (B, code) => B.signups.find((s) => s.code === code);
  const shopByPin = (B, pin) => {
    const p = clean(pin, 4);
    const sh = B.shops.find((s) => s.status === 'active' && (B.shop_private[s.id] || {}).pin === p);
    return p && sh ? sh : null;
  };
  const given = (B, prizeId) => B.signups.filter((s) => s.prize && Number(s.prize.id) === Number(prizeId)).length;
  const dayLabel = (iso) => U.date(iso);

  // ---------- the functions (same names and rules as sql/01_schema.sql) ----------
  const F = {};

  F.reset_demo = (B) => { Object.keys(B).forEach((k) => delete B[k]); Object.assign(B, seed()); return ok(); };

  F.signup = (B, a) => {
    const n = clean(a.p_name, 40), l = clean(a.p_last, 40);
    let e = clean(a.p_email, 120).toLowerCase(), m = String(a.p_mobile || '').replace(/\s/g, '');
    if (!n) return err('Please add your first name.');
    if (!l) return err('Please add your last name.');
    if (!['email', 'text'].includes(a.p_contact)) return err('Choose email or text message.');
    if (e && !isEmail(e)) e = '';
    if (m && !/^04\d{8}$/.test(m)) m = '';
    if (a.p_contact === 'email' && !e) return err('Please add a real email, or choose text message.');
    if (a.p_contact === 'text' && !m) return err('Mobile needs to look like 04xx xxx xxx.');
    if (!/^\d{4}$/.test(a.p_postcode || '')) return err('Postcode needs 4 numbers.');
    if (!B.areas.find((x) => x.id === a.p_area)) return err("We can't find that street.");
    const ev = B.events.filter((x) => x.area === a.p_area).sort((x, y) => (x.starts_on < y.starts_on ? 1 : -1))[0];
    if (!ev) return err('No festival is open for this street yet.');
    const dupe = B.signups.find((s) => { const p = B.signup_private[s.code]; return p && p.event === ev.id && ((e && p.email.toLowerCase() === e) || (m && p.mobile === m)); });
    if (dupe) return ok({ code: dupe.code, existing: true });
    if (B.signups.length >= 400) return err('The demo is full. Press Reset demo.');
    let code, tries = 0;
    do { code = 'CMS-' + (1000 + Math.floor(Math.random() * 9000)); if (++tries > 50) return err('Please try again.'); } while (signupOf(B, code));
    B.signups.push({ id: 'u' + Math.random().toString(36).slice(2), code, area: a.p_area, event: ev.id, name: n, last_initial: l.slice(0, 1).toUpperCase(), contact: a.p_contact,
      created_at: new Date().toISOString(), prize: null, spun_at: null, use_by: null, redeemed: false, redeemed_at: null, redeemed_time: null,
      stamps: {}, rewards_used: {}, cards: [], card_stamps: {} });
    B.signup_private[code] = { event: ev.id, last_name: l, email: e, mobile: m, postcode: a.p_postcode, optin: !!a.p_optin };
    return ok({ code, existing: false });
  };

  F.give_stamp = (B, a) => {
    const sh = clean(a.p_shop, 30);
    if (!B.shops.find((s) => s.id === sh)) return err("We can't find that shop.");
    const s = signupOf(B, a.p_code);
    if (!s) return err('No one has that code.');
    s.stamps[sh] = (Number(s.stamps[sh]) || 0) + 1;
    return ok();
  };
  F.use_reward = (B, a) => {
    const s = signupOf(B, a.p_code), sh = clean(a.p_shop, 30);
    if (!s) return err('No one has that code.');
    const have = Math.floor((Number(s.stamps[sh]) || 0) / 6), used = Number(s.rewards_used[sh]) || 0;
    if (have - used < 1) return err('No 6-stamp reward to use here.');
    s.rewards_used[sh] = used + 1;
    return ok();
  };
  F.add_card = (B, a) => {
    if (!B.areas.find((x) => x.id === a.p_area)) return err("We can't find that street.");
    const s = signupOf(B, a.p_code);
    if (!s) return err('No one has that code.');
    if (a.p_area !== s.area && !s.cards.includes(a.p_area)) s.cards.push(a.p_area);
    return ok();
  };
  F.card_stamp = (B, a) => {
    const s = signupOf(B, a.p_code);
    if (!s) return err('No one has that code.');
    if (a.p_area === s.area) return err('Use a shop to stamp the home pass.');
    if (!s.cards.includes(a.p_area)) return err('Add that pass first.');
    s.card_stamps[a.p_area] = (Number(s.card_stamps[a.p_area]) || 0) + 1;
    return ok();
  };

  F.award_prize = (B, a) => {
    const s = signupOf(B, a.p_code);
    if (!s) return err('No one has that code.');
    if (s.prize) return err(s.name + ' has already spun.');
    const p = B.prizes.find((x) => Number(x.id) === Number(a.p_prize));
    if (!p) return err('That coupon is gone.');
    if (p.area !== s.area) return err('That prize belongs to a different street.');
    if (p.stock - given(B, p.id) < 1) return err('That prize has run out.');
    const ev = B.events.find((x) => x.id === s.event);
    s.prize = { id: p.id, name: p.name, value: p.value, collect_at: p.collect_at };
    s.spun_at = new Date().toISOString();
    s.use_by = ev ? ev.use_by : plusDays(today(), 7);
    if (p.value === 0) { s.redeemed = true; s.redeemed_at = 'desk'; s.redeemed_time = s.spun_at; }   // gifts are handed over at the desk
    else { s.redeemed = false; s.redeemed_at = null; s.redeemed_time = null; }
    return ok();
  };
  F.undo_prize = (B, a) => {
    const s = signupOf(B, a.p_code);
    if (!s) return err('No one has that code.');
    if (!s.prize) return err('No prize to undo.');
    if (s.redeemed && s.redeemed_at !== 'desk') return err('Already used. Cannot undo.');
    Object.assign(s, { prize: null, spun_at: null, use_by: null, redeemed: false, redeemed_at: null, redeemed_time: null });
    return ok();
  };

  F.shop_login = (B, a) => {
    const sh = shopByPin(B, a.p_pin);
    if (!sh) return err("That PIN doesn't match a shop");
    return ok({ shop: sh.id, name: sh.name, area: sh.area, type: sh.type });
  };
  F.use_coupon = (B, a) => {
    const sh = shopByPin(B, a.p_pin);
    if (!sh) return err("That PIN doesn't match a shop");
    const s = signupOf(B, String(a.p_code || '').trim().toUpperCase());
    if (!s) return err("We can't find this code. Check it and try again.");
    if (!s.prize) return err('This code has no coupon yet.');
    if (s.redeemed) {
      const at = B.shops.find((x) => x.id === s.redeemed_at);
      return err('Already used at ' + (at ? at.name : 'the prize desk') + ' on ' + U.when(s.redeemed_time));
    }
    if (s.use_by < today()) return err('This coupon ran out on ' + dayLabel(s.use_by));
    if (sh.area !== s.area) return err('This coupon is for a different street.');
    s.redeemed = true; s.redeemed_at = sh.id; s.redeemed_time = new Date().toISOString();
    return ok({ shop: sh.name, value: Number(s.prize.value), name: s.name });
  };

  F.add_shop = (B, a) => {
    if (!B.areas.find((x) => x.id === a.p_area)) return err("We can't find that street.");
    if (!clean(a.p_name, 60)) return err('Please add the shop name.');
    if (B.shops.length >= 120) return err('Too many shops. Press Reset demo.');
    let base = slug(clean(a.p_name, 60)) || 'shop', id = base, i = 1;
    while (B.shops.find((s) => s.id === id)) { i += 1; id = base + '-' + i; }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
    B.shops.push({ id, area: a.p_area, name: clean(a.p_name, 60), type: clean(a.p_type, 30), status: 'invited',
      sort_order: Math.max(0, ...B.shops.filter((s) => s.area === a.p_area).map((s) => s.sort_order)) + 1 });
    B.shop_private[id] = { pin: null, token, contact: clean(a.p_contact, 120) };
    return ok({ id, token });
  };
  const shopByToken = (B, t) => B.shops.find((s) => (B.shop_private[s.id] || {}).token === clean(t, 64));
  const BAD_INVITE = 'Not available on the demo site: this invite link only works in the browser that made it.';
  F.shop_invite = (B, a) => {
    const sh = shopByToken(B, a.p_token);
    if (!sh) return err(BAD_INVITE);
    const ar = B.areas.find((x) => x.id === sh.area);
    return ok({ id: sh.id, name: sh.name, status: sh.status, area: ar.id, place: ar.brand.place });
  };
  F.shop_activate = (B, a) => {
    const sh = shopByToken(B, a.p_token);
    if (!sh) return err(BAD_INVITE);
    if (!/^\d{4}$/.test(a.p_pin || '')) return err('Your PIN needs 4 numbers.');
    if (Object.entries(B.shop_private).some(([id, p]) => p.pin === a.p_pin && id !== sh.id)) return err('That PIN is taken. Please choose another.');
    B.shop_private[sh.id].pin = a.p_pin;
    sh.status = 'active';
    if (clean(a.p_name, 60)) sh.name = clean(a.p_name, 60);
    return ok({ id: sh.id });
  };

  F.post_campaign = (B, a) => {
    const t = clean(a.p_title, 80), m = clean(a.p_month, 40), b = clean(a.p_blurb, 300);
    if (!['fruitbowl', 'council', 'street'].includes(a.p_from)) return err('Who is posting?');
    if (!B.areas.find((x) => x.id === a.p_area)) return err("We can't find that street.");
    if (!t) return err('Please add a name.');
    if (!m) return err('Please add when.');
    if (B.campaigns.length >= 60) return err('Too many campaigns. Press Reset demo.');
    const lo = Math.min(1, ...B.campaigns.map((c) => c.sort_order)) - 1;
    B.campaigns.push({ id: nextId(B, 'campaigns'), area: a.p_area, title: t, month: m, blurb: b, posted_by: a.p_from,
      council: a.p_from === 'council' ? 'approved' : 'pending', street: a.p_from === 'street' ? 'yes' : 'pending', street_extra: '', traders: {}, sort_order: lo });
    return ok();
  };
  const campaign = (B, id) => B.campaigns.find((c) => Number(c.id) === Number(id));
  F.council_decide = (B, a) => { const c = campaign(B, a.p_id); if (!c) return err('Campaign not found.'); c.council = a.p_approve ? 'approved' : 'declined'; return ok(); };
  F.street_decide = (B, a) => {
    const c = campaign(B, a.p_id); if (!c) return err('Campaign not found.');
    c.street = a.p_yes ? 'yes' : 'no';
    if (a.p_yes) c.street_extra = clean(a.p_extra, 200);
    return ok();
  };
  F.set_trader = (B, a) => {
    const sh = clean(a.p_shop, 60), c = campaign(B, a.p_id);
    if (!B.shops.find((s) => s.id === sh) || !['in', 'out', 'none'].includes(a.p_status)) return err('Bad answer.');
    if (!c) return err('Campaign not found.');
    if (a.p_status === 'none') delete c.traders[sh];
    else c.traders[sh] = { status: a.p_status, offer: a.p_status === 'in' ? clean(a.p_offer, 120) : '' };
    return ok();
  };

  F.add_prize = (B, a) => {
    if (!['fruitbowl', 'council', 'street'].includes(a.p_added_by)) return err('Who is adding this?');
    if (!B.areas.find((x) => x.id === a.p_area)) return err("We can't find that street.");
    if (!clean(a.p_name, 60)) return err('Please add a name.');
    if (a.p_value == null || !(a.p_value >= 0) || a.p_value > 10000) return err('Value must be $0 or more.');
    if (a.p_stock == null || !(a.p_stock >= 1) || a.p_stock > 10000) return err('How many? Use 1 or more.');
    if (B.prizes.length >= 80) return err('Too many prizes. Press Reset demo.');
    B.prizes.push({ id: nextId(B, 'prizes'), area: a.p_area, name: clean(a.p_name, 60), value: Math.round(a.p_value), stock: Math.round(a.p_stock),
      collect_at: clean(a.p_collect_at, 80), added_by: a.p_added_by, sort_order: Math.max(0, ...B.prizes.map((p) => p.sort_order)) + 1 });
    return ok();
  };
  F.add_stock = (B, a) => {
    if (!(a.p_n >= 1) || a.p_n > 1000) return err('Bad number.');
    const p = B.prizes.find((x) => Number(x.id) === Number(a.p_id));
    if (!p) return err('Prize not found.');
    p.stock += a.p_n;
    return ok();
  };
  F.remove_prize = (B, a) => {
    if (given(B, a.p_id) > 0) return err('Someone already won this, so it cannot be removed.');
    B.prizes = B.prizes.filter((p) => Number(p.id) !== Number(a.p_id));
    return ok();
  };

  F.add_workshop = (B, a) => {
    if (!clean(a.p_name, 80)) return err('Please add a name.');
    if (!a.p_date) return err('Please add a date.');
    if (!clean(a.p_time, 20)) return err('Please add a time.');
    if (!['Online', 'In person'].includes(a.p_format)) return err('Online or in person?');
    const allowed = new Set(['Maroondah', 'Knox', 'Monash'].concat(B.areas.map((x) => x.council_area)));
    const cs = [...new Set((a.p_councils || []).filter((c) => allowed.has(c)))];
    if (!cs.length) return err('Pick at least one council.');
    if (B.workshops.length >= 40) return err('Too many workshops. Press Reset demo.');
    B.workshops.push({ id: nextId(B, 'workshops'), name: clean(a.p_name, 80), date: a.p_date, time: clean(a.p_time, 20), format: a.p_format, place: clean(a.p_place, 120), councils: cs });
    return ok();
  };
  F.book_workshop = (B, a) => {
    if (!B.shops.find((s) => s.id === clean(a.p_trader, 60))) return err('Which shop?');
    if (!B.workshops.find((w) => Number(w.id) === Number(a.p_workshop))) return err('Workshop not found.');
    if (!B.bookings.find((b) => b.trader === a.p_trader && Number(b.workshop) === Number(a.p_workshop))) {
      B.bookings.push({ id: nextId(B, 'bookings'), trader: clean(a.p_trader, 60), workshop: Number(a.p_workshop), at: new Date().toISOString() });
    }
    return ok();
  };
  F.set_setting = (B, a) => {
    if (a.p_key === 'code_style' && ['qr', 'number', 'barcode'].includes(a.p_value)) { B.settings.code_style = a.p_value; return ok(); }
    return err('That setting is not allowed.');
  };

  // ---------- areas ----------
  F.area_create = (B, a) => {
    if (!clean(a.p_name, 80)) return err('Please add your organisation name.');
    if (!['Street Association', 'Council'].includes(a.p_type)) return err('Council or Street Association?');
    if (!clean(a.p_council_area, 40)) return err('Please add your council area.');
    if (!isEmail(a.p_email || '')) return err('Please add a real contact email.');
    if (!['fruitbowl', 'self'].includes(a.p_by)) return err('Who is creating this?');
    if (B.areas.length >= 30) return err('Too many areas. Press Reset demo.');
    let base = slug(clean(a.p_slug, 30) || clean(a.p_name, 80).split(' ')[0]) || 'area';
    if (RESERVED.includes(base)) base += '-area';
    let id = base, i = 1;
    while (B.areas.find((x) => x.id === id)) { i += 1; id = base + '-' + i; }
    const place = clean(a.p_name, 80);
    B.areas.push({ id, name: place, type: a.p_type, council_area: clean(a.p_council_area, 40), status: a.p_by === 'fruitbowl' ? 'invited' : 'waiting', created_by: a.p_by,
      sort_order: Math.max(0, ...B.areas.map((x) => x.sort_order)) + 1,
      brand: { place, color: '#560CC9', accent: '#F9DE4B', logo: '', welcome: 'Win something on Main Street', web: 'mymainstreet.com.au/' + id },
      email_name: place, email_address: id + '@mymainstreet.com.au', reply_to: '' });
    B.area_private[id] = { name: clean(a.p_contact_name, 80), email: clean(a.p_email, 120), mobile: clean(a.p_mobile, 20), abn: clean(a.p_abn, 20) };
    const starts = plusDays(today(), 30);
    B.events.push({ id: nextId(B, 'events'), area: id, name: 'Launch day', starts_on: starts, use_by: plusDays(starts, 7) });
    return ok({ id });
  };
  F.area_save_about = (B, a) => {
    if (!clean(a.p_name, 80)) return err('Please add your organisation name.');
    if (!['Street Association', 'Council'].includes(a.p_type)) return err('Council or Street Association?');
    if (!isEmail(a.p_email || '')) return err('Please add a real contact email.');
    const ar = B.areas.find((x) => x.id === a.p_id);
    if (!ar) return err("We can't find that street.");
    Object.assign(ar, { name: clean(a.p_name, 80), type: a.p_type, council_area: clean(a.p_council_area, 40) });
    B.area_private[ar.id] = { name: clean(a.p_contact_name, 80), email: clean(a.p_email, 120), mobile: clean(a.p_mobile, 20), abn: clean(a.p_abn, 20) };
    return ok();
  };
  F.area_contact = (B, a) => ({ read: true, data: B.area_private[a.p_id] || {} });
  F.area_save_brand = (B, a) => {
    const ar = B.areas.find((x) => x.id === a.p_id);
    if (!ar) return err("We can't find that street.");
    const b = Object.assign({}, ar.brand), pb = a.p_brand || {};
    ['place', 'welcome', 'web'].forEach((k) => { const v = clean(pb[k], 120); if (k in pb && v) b[k] = v; });
    for (const k of ['color', 'accent']) {
      if (k in pb) { if (!/^#[0-9A-Fa-f]{6}$/.test(pb[k] || '')) return err('Colours need to look like #560CC9.'); b[k] = pb[k].toUpperCase(); }
    }
    if ('logo' in pb) {
      const v = pb.logo || '';
      if (v && (!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 90000)) return err('That logo file is too big or not a picture.');
      b.logo = v;
    }
    ar.brand = b;
    if (clean(a.p_email_name, 80)) ar.email_name = clean(a.p_email_name, 80);
    if (clean(a.p_email_address, 120)) ar.email_address = clean(a.p_email_address, 120);
    if (a.p_reply_to != null) ar.reply_to = clean(a.p_reply_to, 120);
    return ok();
  };
  F.area_set_status = (B, a) => {
    if (!['invited', 'waiting', 'setting up', 'live'].includes(a.p_status)) return err('Bad status.');
    const ar = B.areas.find((x) => x.id === a.p_id);
    if (!ar) return err("We can't find that street.");
    ar.status = a.p_status;
    return ok();
  };
  F.event_save = (B, a) => {
    if (!clean(a.p_name, 80)) return err('Please add an event name.');
    if (!a.p_starts || !a.p_use_by) return err('Please add both dates.');
    if (a.p_use_by < a.p_starts) return err('The use-by date has to be after the event.');
    const ev = B.events.find((x) => Number(x.id) === Number(a.p_id));
    if (!ev) return err('Event not found.');
    Object.assign(ev, { name: clean(a.p_name, 80), starts_on: a.p_starts, use_by: a.p_use_by });
    B.signups.forEach((s) => { if (s.event === ev.id && s.prize && !s.redeemed) s.use_by = a.p_use_by; });
    return ok();
  };

  // ---------- reports ----------
  F.report_rows = (B, a) => {
    const rows = B.signups.filter((s) => !a.p_area || s.area === a.p_area).map((s) => {
      const p = B.signup_private[s.code] || {}, ev = B.events.find((x) => x.id === s.event) || {}, sh = B.shops.find((x) => x.id === s.redeemed_at);
      const status = !s.prize ? 'No coupon yet' : s.redeemed ? 'Used' : s.use_by < today() ? 'Expired' : 'Not used';
      return { area: s.area, first_name: s.name, last_name: p.last_name || s.last_initial, email: p.email || '', mobile: p.mobile || '', postcode: p.postcode || '',
        contact: s.contact === 'text' ? 'Text' : 'Email', optin: !!p.optin, signed_up: stamp(s.created_at), event_id: s.event, event: ev.name, code: s.code,
        prize: s.prize ? s.prize.name : null, value: s.prize ? Number(s.prize.value) : null, won: stamp(s.spun_at), status,
        used_at: s.redeemed ? (sh ? sh.name : 'Prize desk') : null, used_shop_id: s.redeemed ? s.redeemed_at : null, used: stamp(s.redeemed_time) };
    });
    return { read: true, data: rows.sort((x, y) => (x.signed_up < y.signed_up ? 1 : -1)) };
  };
  F.report_log = (B, a) => { B.download_log.push({ at: new Date().toISOString(), who: 'Demo viewer', kind: clean(a.p_kind, 40), area: clean(a.p_area, 40) }); return ok(); };

  const READ_ONLY = ['shop_login', 'shop_invite', 'area_contact', 'report_rows'];

  // ---------- the same interface as the Supabase version ----------
  window.LocalDB = {
    start(DB) {
      const refresh = () => { view(loadB(), DB); };
      refresh();
      DB.ready = true; DB.error = null; DB.mode = 'local';
      DB.load = async () => { refresh(); DB.listeners.forEach((fn) => fn()); };
      // other frames or tabs in this browser changed something
      window.addEventListener('storage', (e) => { if (e.key === KEY) { refresh(); DB.listeners.forEach((fn) => fn()); } });
      // after midnight (Melbourne) the demo puts itself back
      setInterval(() => { try { const B = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!B || B.day !== today()) { refresh(); DB.listeners.forEach((fn) => fn()); } } catch (e) { /* ignore */ } }, 60000);
      DB.rpc = async (name, args, opts) => {
        const fn = F[name];
        if (!fn) return err('Not available on the demo site.');
        const B = loadB();
        let r;
        try { r = fn(B, args || {}); } catch (e) { return err('Something went wrong. Please try again.'); }
        if (r && r.read) return r.data;
        if (!READ_ONLY.includes(name)) saveB(B);
        view(B, DB);
        if (!opts || opts.reload !== false) DB.listeners.forEach((fn2) => fn2());
        return r;
      };
      DB.read = async (name, args) => {
        const fn = F[name];
        if (!fn) return null;
        const r = fn(loadB(), args || {});
        return r && r.read ? r.data : r;
      };
      DB.listeners.forEach((fn) => fn());
    }
  };
})();
