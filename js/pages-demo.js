// The guided demo (/demo): instructions on the left, a live preview on the right.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  const P = App.pages;
  const HOME = C.demoHomeArea;

  // ---------- device frames ----------
  const emb = (path) => path + (path.includes('?') ? '&' : '?') + 'embed=1';
  const phoneFrame = (src, small, title) => `<div class="devphone${small ? ' sm' : ''}"><iframe src="${esc(emb(src))}" title="${esc(title || 'Phone preview')}"></iframe></div>`;
  const phoneInner = (html) => `<div class="devphone"><div class="inner">${html}</div></div>`;
  const laptopFrame = (src, title) => `<div class="devlaptop"><div class="bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="addr">${esc(C.domain + src.split('?')[0])}</span></div>
    <iframe src="${esc(emb(src))}" title="${esc(title || 'Laptop preview')}"></iframe></div>`;

  const myCode = () => App.store.get('msr-code') || '';
  const mySignup = () => { const c = myCode(); return c ? d0.signup(c) : null; };
  const needSignup = (small) => `<div class="devphone${small ? ' sm' : ''}"><div class="inner" style="padding:22px;display:flex;flex-direction:column;gap:12px;justify-content:center">
      <h2>Fill out the form first</h2><p>This step needs someone who has signed up. Go back and do the steps before it.</p>
      <a class="btn sun" href="/demo/5">Go to step 5: Fill out the form</a></div></div>`;
  const couponPhone = (small) => (myCode() ? phoneFrame('/c/' + myCode(), small, "The customer's phone") : needSignup(small));

  // ---------- the steps ----------
  const MSG_TAB_KEY = 'msr-msgtab';
  const sample = () => {
    const s = mySignup(), p = s && s.prize && s.prize.value > 0 ? s.prize : null;
    const a = d0.area(s ? s.area : HOME), b = App.brandOf(a.id), ev = d0.eventsOf(a.id).slice(-1)[0] || {};
    const useBy = s && s.use_by ? s.use_by : (ev.use_by || '2026-11-14');
    return {
      real: !!p,
      d: {
        name: s ? s.name : 'Sam', value: p ? p.value : 5, code: p && s ? s.code : 'CMS-4821', area: a.id, place: b.place, event: ev.name || 'Maroondah Festival',
        useBy: U.date(useBy), useByShort: U.date(useBy).replace(/^\w+\s/, ''),
        fromName: a.email_name || b.place, fromAddress: a.email_address || (a.id + '@' + C.domain), replyTo: a.reply_to || 'hello@example.com'
      },
      contact: s ? s.contact : 'email'
    };
  };
  function messagePane() {
    const tab = App.store.sget(MSG_TAB_KEY) || 'screen';
    if (tab === 'screen') return couponPhone(false);
    const { d, real } = sample();
    if (tab === 'email') {
      const m = window.Messages.email(d);
      return `<div class="devphone"><div class="inner emailview"><div class="emailmeta"><b>From:</b> ${esc(m.from)}<br><b>Reply-to:</b> ${esc(m.replyTo)}<br><b>Subject:</b> ${esc(m.subject)}</div>${m.html}
        ${real ? '' : '<p style="font-size:12px;color:#5E5180">Example. Do steps 5 to 7 to see your own.</p>'}</div></div>`;
    }
    const m = window.Messages.sms(d);
    return `<div class="devphone"><div class="inner smsview"><p class="who">Text message · now</p><div class="bubble">${esc(m.text)}</div>
      <div class="sms-len">${m.length} characters${real ? '' : ' · Example. Do steps 5 to 7 to see your own.'}</div></div></div>`;
  }
  const msgTabs = () => {
    const tab = App.store.sget(MSG_TAB_KEY) || 'screen';
    return `<div class="msgtabs" role="group" aria-label="Which message">${[['screen', 'Screen'], ['email', 'Email'], ['text', 'Text']].map(([k, l]) => `<button data-act="demo-msgtab" data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>`;
  };

  const STEPS = [
    { part: 1, title: 'Fruitbowl activates an area', who: 'The Fruitbowl team, on a laptop.',
      what: ['Fruitbowl opens Fruitbowl HQ.', 'The list shows every council and street, and where each one is up to: Invited, Waiting for Fruitbowl, Setting up or Live.', '"Activate a new area" starts a new one.', 'Fruitbowl then sends an invite link, or fills it in for them.'],
      tryit: 'Click "Activate a new area" in the preview.', preview: () => laptopFrame('/hq?tab=areas', 'Fruitbowl HQ') },
    { part: 1, title: 'Client onboarding', who: 'A council or street association, on a laptop.',
      what: ['They open their invite link, or sign up themselves at /join. Self sign-ups wait for Fruitbowl to approve.', 'Step 1: about you. Step 2: your look. Step 3: your shops and prizes.', 'Step 4: check everything, download the QR poster and counter stickers, and press Launch.'],
      tryit: 'Click through the 4 steps with the Next button. This one is Ringwood Village Traders.', preview: () => laptopFrame('/join?area=ringwood', 'Client onboarding') },
    { part: 1, title: 'Make it theirs', who: 'A council or street association, on a laptop.',
      what: ['They add their logo and a heading.', 'They pick a main colour and a highlight colour. Text turns white or dark by itself so it is always easy to read.', 'The phone on the right changes as they type. The name is always My Main Street.'],
      tryit: 'Change the main colour and the heading. Watch the phone change.', preview: () => laptopFrame('/client?area=ringwood&tab=look', 'Make it theirs') },
    { part: 2, title: 'Scan the QR code', who: 'Anyone at the festival, on their own phone.',
      what: ['They see the big sign at the marquee: "Scan, spin and win."', 'Open your phone camera.', 'Point it at the QR code.', 'Tap the link that pops up. The street\'s page opens in their web browser. Nothing to download.'],
      tryit: 'Tap the QR code on the poster.', preview: () => phoneInner(App.posterHtml(HOME, { tap: true })) },
    { part: 2, title: 'Fill out the form', who: 'Customers, on their own phone.',
      what: ['They fill out the form: name, postcode, and how they want their coupon (email or text).', 'They tick the box to agree to the terms.', 'The same email or mobile can only sign up once per event. Trying again shows their existing code.', 'No smartphone? Staff fill out the form for them on the desk iPad.'],
      tryit: 'Press "Fill it in for me", then Sign up.', extra: () => '<p style="margin-top:12px"><button class="btn sun" data-act="demo-fill">Fill it in for me</button></p>',
      preview: () => phoneFrame('/' + HOME, false, 'Sign-up form') },
    { part: 2, title: 'Join the line', who: 'Customers, on their own phone.',
      what: ['Their phone says "You\'re in! Now join the line for the wheel."', 'It shows their code as a QR code, a number or a barcode. Fruitbowl chooses which, in Fruitbowl HQ.', 'When it\'s their turn, they show this screen to the staff.'],
      tryit: 'Check the phone. Your code is on the screen.', preview: () => couponPhone(false) },
    { part: 2, title: 'At the wheel', who: 'Prize desk staff on a laptop or iPad. The customer\'s phone is shown beside it.',
      what: ['The customer reaches the front of the line.', 'Staff tap "Scan their code" (camera), or use a scanner, or type the 4-digit number.', 'The customer\'s name shows. Then the prize buttons light up.', 'One tap on the prize the wheel landed on. Undo is there for mistakes.'],
      tryit: 'Tap "Scan their code", pick yourself, then tap a prize. Watch the phone.',
      preview: () => `<div class="pair">${laptopFrame('/desk', 'Prize desk')}${couponPhone(true)}</div>` },
    { part: 2, title: 'You won!', who: 'The customer. Use the tabs to see all three ways we tell them.',
      what: ['The phone shows a yellow banner with their coupon and code.', 'We email it too (or text, if they chose that).', 'A gift, like a tote bag, says "Collect it at the desk now."'],
      tryit: 'Click Screen, Email and Text above the phone.', tabs: true, preview: () => `${msgTabs()}<div id="msgpane">${messagePane()}</div>` },
    { part: 2, title: 'Spend it at a shop', who: 'Shop staff, at the counter. The customer\'s coupon is shown beside the shop screen.',
      what: ['The customer shows their coupon at any participating shop on the street.', 'Staff log in to the shop screen with their shop PIN.', 'They type or scan the coupon code. Green means valid. Red says why not.', 'One tap on "Use it now". The shop, date and time are saved.'],
      tryit: 'Log in with 1111 (Main St Espresso). Type your code. Tap "Use it now". Then try the same code again.',
      preview: () => `<div class="pair">${couponPhone(true)}${phoneFrame('/shop', true, 'Shop screen')}</div>` },
    { part: 3, title: 'Data and reports', who: 'The client and Fruitbowl, on a laptop.',
      what: ['Every sign-up and coupon is in one table.', 'Filter by event, date or status.', '"Download spreadsheet" opens in Excel or Google Sheets.', '"Download By shop" lists the coupons each shop accepted. Use it to pay shops back.'],
      tryit: 'Press "Download spreadsheet".', preview: () => laptopFrame('/client?area=' + HOME + '&tab=reports', 'Reports') },
    { part: 3, title: 'Phase 2: the Wallet pass', who: 'Customers, after the festival.',
      what: ['The customer adds a pass to their phone\'s Wallet, like a concert ticket or boarding pass.', 'Shop on more than one street? They get a pass for each, stacked like cards. Each says My Main Street in that street\'s colours.', '6 stamps at one shop gets that shop\'s reward. 10 stamps anywhere gets them into the big draw.'],
      tryit: 'Add a pass for another street. Tap a card to bring it to the front.', preview: () => (myCode() ? phoneFrame('/wallet', false, 'Wallet pass') : needSignup(false)) },
    { part: 3, title: 'Safety and privacy', who: 'Anyone. It is linked from the sign-up form.',
      what: ['A plain-words page says what we collect and why.', 'It says where it is stored (Sydney, Australia) and who can see it.', 'It says we never sell data, and how to delete it.'],
      tryit: 'Scroll the page.', preview: () => laptopFrame('/safety', 'Safety and privacy') }
  ];
  const PARTS = ['Set up an area', 'Festival day', 'After the festival'];
  const stepNum = (ctx) => { const n = parseInt(ctx.params.step, 10); return n >= 1 && n <= STEPS.length ? n : 0; };

  // ---------- the page ----------
  P.demo = {
    brand: () => App.fruitbowlBrand(),
    // Pick up anything the preview frames just changed.
    enter() { if (D.ready) D.load(); },
    title(ctx) { const n = stepNum(ctx); return n ? `Step ${n}: ${STEPS[n - 1].title}` : 'Demo'; },
    render(ctx) {
      const n = stepNum(ctx);
      const head = `<header class="band"><div class="wrap"><div class="brandline"><div><div class="small-street">Guided demo <span class="demo">Demo, not live yet</span></div><div class="title">${esc(C.siteName)}</div></div></div>
        <nav aria-label="Pages"><a href="/demo" ${n === 0 ? 'aria-current="page"' : ''}>Start</a><a href="/hq">Fruitbowl HQ</a><a href="/client">Client</a><a href="/desk">Prize desk</a><a href="/shop">Shop screen</a><a href="/safety">Safety</a></nav></div></header>`;
      if (!n) {
        return `${head}<main class="wrap" id="main">
          <div class="hero"><h1>${esc(C.siteName)}</h1>
            <p>One website for a whole main street. At a festival, people scan a QR code, fill out a form, spin the wheel and win a coupon. They spend it at shops on their street. Council and the street association see what's working.</p>
            <p style="font-size:15px;opacity:.85">This is a demo you can click through. The shops and coupons are made up. Nothing is sent to real people.${D.mode === 'local' ? ' It runs in your own browser, so what you do here stays on your device.' : ''}</p>
            <a class="btn sun big" href="/demo/1" style="max-width:320px;margin-top:10px">Start the demo →</a></div>
          <h2 style="margin:6px 0 12px">The demo, step by step</h2>
          <div class="partcards">${PARTS.map((name, pi) => `<div class="partcard"><h3>Part ${pi + 1}: ${name}</h3><ol start="${STEPS.findIndex((s) => s.part === pi + 1) + 1}">
            ${STEPS.map((s, i) => (s.part === pi + 1 ? `<li><a href="/demo/${i + 1}">${esc(s.title)}</a></li>` : '')).join('')}</ol></div>`).join('')}</div>
          </main>${App.footer()}`;
      }
      const s = STEPS[n - 1], prev = n > 1 ? n - 1 : 0, next = n < STEPS.length ? n + 1 : 0;
      return `${head}<div class="demoshell"><section class="demoleft" id="main" aria-label="Instructions">
          <p class="partlabel">Part ${s.part}: ${PARTS[s.part - 1]} · Step ${n} of ${STEPS.length}</p>
          <div class="stepbig"><span class="stepnum">${n}</span><div><h2>${esc(s.title)}</h2></div></div>
          <p class="who-line"><b>Who uses this:</b> ${s.who}</p>
          <h3 style="font-size:16px;margin-bottom:6px">What happens</h3>
          <ol class="whathappens">${s.what.map((w) => `<li>${w}</li>`).join('')}</ol>
          <p class="try"><b>Try it:</b> ${s.tryit}</p>${s.extra ? s.extra() : ''}
          <div class="stepnav">${prev ? `<a class="btn ghost" href="/demo/${prev}">← Back</a>` : '<a class="btn ghost" href="/demo">← Back</a>'}
            ${next ? `<a class="btn sun" href="/demo/${next}">Next →</a>` : '<a class="btn sun" href="/demo">Finish</a>'}</div>
          <footer class="foot" style="padding:24px 0 0;margin-top:24px;border-top:1px solid var(--line)"><p>This is a demo. Everything here is made up. <a href="/safety">Safety and privacy</a></p><button type="button" class="btn ghost small" data-act="reset">Reset demo</button></footer>
        </section>
        <section class="demoright" aria-label="Preview">${s.preview()}</section></div>`;
    },
    // Do not rebuild the frames when data changes (they update themselves). Only refresh the messages.
    onData() {
      const n = stepNum(App.ctx);
      if (n === 8) { const el = document.getElementById('msgpane'); if (el) el.innerHTML = messagePane(); }
    }
  };

  App.acts['demo-msgtab'] = (b) => { App.store.sset(MSG_TAB_KEY, b.dataset.tab); App.render(); };
  App.acts['poster-scan'] = () => App.go('/demo/5');
  App.acts['demo-fill'] = () => {
    const fr = document.querySelector('.devphone iframe');
    const doc = fr && fr.contentDocument;
    const f = doc && doc.querySelector('form[data-form="signup"]');
    if (!f) return U.toast('Open the form in the preview first.', true);
    const set = (n, v) => { const el = f.querySelector(`[name="${n}"]`); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('name', 'Sam'); set('last', 'Smith'); set('postcode', '3136');
    set('email', 'sam.' + Math.floor(Math.random() * 90000 + 10000) + '@example.com');
    const t = f.querySelector('[name="terms"]'); if (t) t.checked = true;
    U.toast('Filled in. Now press Sign up.');
  };
  // After a reset, reload the frames.
  document.addEventListener('msr-reset', () => { if (App.ctx && App.ctx.name === 'demo') App.render(); });
})();
