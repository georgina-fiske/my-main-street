// Client onboarding (/join), the safety and privacy page (/safety), and the "not found" page.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  const P = App.pages;
  const STEPS = ['About you', 'Your look', 'Shops and prizes', 'Check and launch'];

  // =====================================================================
  // ONBOARDING  (/join and /join?area=ringwood)  four quick steps
  // =====================================================================
  const joinArea = (ctx) => {
    const id = ctx.q.get('area') || App.state.joinArea;
    return id && d0.area(id) ? id : null;
  };
  const step = () => App.state.joinStep || 1;
  const setStep = (n) => { App.state.joinStep = n; App.render(); window.scrollTo(0, 0); };

  P.join = {
    brand: (ctx) => (joinArea(ctx) ? App.brandOf(joinArea(ctx)) : App.fruitbowlBrand()),
    title: () => 'Set up your area',
    async enter(ctx) {
      const id = ctx.q.get('area');
      ctx.contact = null;
      if (id) { const c = await D.read('area_contact', { p_id: id }); ctx.contact = c || {}; if (App.ctx === ctx) App.render(); }
    },
    render(ctx, b) {
      const id = joinArea(ctx), a = id && d0.area(id), n = step();
      const bar = `<div class="progress" aria-label="Step ${n} of 4">${STEPS.map((_, i) => `<i class="${i < n ? 'done' : ''}"></i>`).join('')}</div>
        <p class="partlabel">Step ${n} of 4: ${STEPS[n - 1]}</p>`;
      let body = '';
      if (n === 1) {
        const c = ctx.contact || {};
        body = `<h2>About you</h2><p class="muted">Tell us who you are. It takes about 10 minutes to set everything up.</p>
          <form data-form="joinabout" novalidate><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
            <div><label for="j-name">Organisation name</label><input id="j-name" name="name" value="${esc(a ? a.name : '')}" required maxlength="80" placeholder="Ringwood Village Traders"></div>
            <div><label for="j-type">Council or Street Association</label><select id="j-type" name="type"><option ${a && a.type === 'Street Association' ? 'selected' : ''}>Street Association</option><option ${a && a.type === 'Council' ? 'selected' : ''}>Council</option></select></div>
            <div><label for="j-area">Council area</label><input id="j-area" name="area" value="${esc(a ? a.council_area : '')}" required maxlength="40" placeholder="Maroondah"></div>
            <div><label for="j-cname">Contact name</label><input id="j-cname" name="cname" value="${esc(c.name || '')}" maxlength="80"></div>
            <div><label for="j-email">Email</label><input id="j-email" name="email" type="email" value="${esc(c.email || '')}" required maxlength="120"></div>
            <div><label for="j-mob">Mobile</label><input id="j-mob" name="mobile" inputmode="tel" value="${esc(c.mobile || '')}" maxlength="20" placeholder="04xx xxx xxx"></div>
            <div><label for="j-abn">ABN (optional)</label><input id="j-abn" name="abn" value="${esc(c.abn || '')}" maxlength="20"></div></div>
          <p class="err" id="j-err" role="alert" hidden></p>
          <div class="wizard-nav"><span></span><button class="btn" type="submit">Next →</button></div></form>`;
      } else if (n === 2) {
        const d = App.draftFor(id);
        body = `<h2>Your look</h2><p class="muted">Add your logo, heading and colours. You can change them any time.</p>
          <div class="grid duo"><section>${App.admin.lookForm(id, false, true)}</section>
          <section><h3 style="margin-bottom:10px">Live preview</h3><div id="brand-preview">${App.admin.brandPreview(d)}</div></section></div>
          <div class="wizard-nav"><button class="btn ghost" data-act="join-back">← Back</button><button class="btn" data-act="join-look-next">Next →</button></div>`;
      } else if (n === 3) {
        body = `<h2>Your shops and prizes</h2><p class="muted">Add the shops that will take part and the coupons they'll honour. Each shop gets an invite link.</p>
          ${App.admin.shopsPanel(id)}<div class="gap"></div>${App.admin.prizesPanel(id, a.type === 'Council' ? 'council' : 'street')}
          <div class="wizard-nav"><button class="btn ghost" data-act="join-back">← Back</button><button class="btn" data-act="join-next">Next →</button></div>`;
      } else {
        const shops = d0.shopsOf(id), prizes = d0.prizesOf(id);
        const budget = prizes.reduce((x, p) => x + p.value * p.stock, 0);
        const statusNote = a.status === 'waiting'
          ? `<div class="who"><b>Waiting for Fruitbowl.</b> Fruitbowl runs the program for councils and street associations, so it checks every new area first. We'll let you know when you can launch.</div>`
          : a.status === 'live' ? `<div class="statecard good"><h3>You're live!</h3><p style="margin:0">Your sign-up page is <a href="/${esc(id)}">${esc(location.origin)}/${esc(id)}</a>.</p></div>` : '';
        body = `<h2>Check and launch</h2>
          <div class="grid two"><section class="panel"><h3>${esc(a.name)}</h3><p class="muted">${esc(a.type)} · ${esc(a.council_area)}</p>
            <ul class="list"><li><b>${shops.length}</b> shops (${shops.filter((s) => s.status === 'active').length} active)</li>
            <li><b>${prizes.length}</b> prizes. Budget if every coupon is used: <b>${money(budget)}</b></li>
            <li>Sign-up page: ${esc(location.origin)}/${esc(id)}</li></ul>
            <p class="row"><a class="btn" href="/poster/${esc(id)}" target="_blank" rel="noopener">Download the QR poster (A3)</a><a class="btn ghost" href="/stickers/${esc(id)}" target="_blank" rel="noopener">Counter stickers</a></p>
            <p class="muted" style="font-size:13px">These open a print page. Choose "Save as PDF" to keep a file.</p></section>
          <section><h3 style="margin-bottom:10px">Preview</h3>${App.admin.brandPreview(App.brandOf(id))}</section></div>
          ${statusNote}
          <div class="wizard-nav"><button class="btn ghost" data-act="join-back">← Back</button>
            ${a.status === 'live' ? '<span></span>' : a.status === 'waiting' ? '<button class="btn sun" disabled>Launch (waiting for Fruitbowl)</button>' : '<button class="btn sun" data-act="join-launch">Launch</button>'}</div>`;
      }
      return `${App.band('Set up your area', b, 'join')}<main class="wrap" id="main" style="max-width:980px">${bar}${body}</main>${App.footer()}`;
    }
  };

  App.forms.joinabout = async (f) => {
    const d = Object.fromEntries(new FormData(f)), err = document.getElementById('j-err');
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    err.hidden = true;
    let id = joinArea(App.ctx);
    let r;
    if (!id) {
      r = await App.run('area_create', { p_name: d.name, p_type: d.type, p_council_area: d.area, p_slug: '', p_contact_name: d.cname || '', p_email: d.email, p_mobile: d.mobile || '', p_abn: d.abn || '', p_by: App.ctx.q.get('by') === 'fruitbowl' ? 'fruitbowl' : 'self' });
      if (!r.ok) return fail(r.error);
      id = r.id; App.state.joinArea = id;
      try { history.replaceState(null, '', App.href('/join?area=' + id)); App.ctx = Object.assign(App.ctx, { q: new URLSearchParams('area=' + id + (App.ctx.embed ? '&embed=1' : '')) }); } catch (e) { /* ignore */ }
    } else {
      r = await App.run('area_save_about', { p_id: id, p_name: d.name, p_type: d.type, p_council_area: d.area, p_contact_name: d.cname || '', p_email: d.email, p_mobile: d.mobile || '', p_abn: d.abn || '' });
      if (!r.ok) return fail(r.error);
    }
    App.state.brandDraft = null;
    setStep(2);
  };
  App.acts['join-back'] = () => setStep(Math.max(1, step() - 1));
  App.acts['join-next'] = () => setStep(Math.min(4, step() + 1));
  App.acts['join-look-next'] = async () => {
    const id = joinArea(App.ctx), f = document.querySelector('form[data-form="brand"]');
    const r = await App.saveBrand(id, f);
    if (r.ok) setStep(3);
  };
  App.acts['join-launch'] = async () => {
    const id = joinArea(App.ctx);
    const r = await App.run('area_set_status', { p_id: id, p_status: 'live' }, "You're live!");
    if (r.ok) App.render();
  };

  // =====================================================================
  // SAFETY AND PRIVACY  (/safety)
  // =====================================================================
  const ph = (t) => `<mark>[${esc(t)}]</mark>`;
  P.safety = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Safety and privacy',
    render() {
      return `${App.band('Safety and privacy', App.fruitbowlBrand(), '')}<main class="wrap" id="main" style="max-width:820px">
        <p class="who" style="margin-top:0"><b>${ph('to be checked by a lawyer')}</b> This page is a plain-words draft. Anything in yellow brackets still needs filling in.</p>
        <h1 style="font-size:32px;margin:14px 0 6px">Safety and privacy</h1>
        <p class="muted">The short version: we only collect what we need, we keep it in Australia, we never sell it, and you can ask us to delete it.</p>

        <h2 style="margin-top:22px">1. Who runs My Main Street</h2>
        <p>My Main Street is built and run by ${esc(C.runBy)}, an Australian business owned by Georgina ${ph('surname')}, sole trader, ABN ${ph('ABN')}, Melbourne. It's delivered with ${esc(C.homeCompany)} for your council or street association.</p>

        <h2 style="margin-top:22px">2. What we collect</h2>
        <p>Your first and last name, your email or mobile number, your postcode, your coupon, where and when you used it, and whether you want news.</p>

        <h2 style="margin-top:22px">3. Why</h2>
        <p>To send your coupon, check it at shops, pay shops back, and (only if you say yes) send you news.</p>

        <h2 style="margin-top:22px">4. Where it's stored</h2>
        <ul><li>Database: Supabase, <b>Sydney, Australia</b> region</li><li>Website: Netlify</li><li>Emails: Resend</li><li>Texts: ${ph('SMS provider')}</li></ul>

        <h2 style="margin-top:22px">5. Who can see it</h2>
        <p>${esc(C.runBy)}, ${esc(C.homeCompany)}, and your council or street association, for your area only. Shops only see a coupon when you show it.</p>

        <h2 style="margin-top:22px">6. We never sell your data</h2>
        <p>Never. Not to anyone.</p>

        <h2 style="margin-top:22px">7. How long we keep it</h2>
        <p>${ph('2 years')}, then it's deleted. You can ask us to delete it sooner.</p>

        <h2 style="margin-top:22px">8. Your choices</h2>
        <p>Unsubscribe from any email. Reply STOP to any text. Or email ${ph('privacy@our domain')} to see or delete your data.</p>

        <h2 style="margin-top:22px">9. How we keep it safe</h2>
        <p>A secure connection (HTTPS), staff logins, and each area only sees its own data.</p>

        <h2 style="margin-top:22px">10. Contact</h2>
        <p>${ph('email')}</p>
      </main>${App.footer()}`;
    }
  };

  P.notfound = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Not found',
    render() {
      return `<main class="wrap" id="main" style="max-width:600px;padding-top:40px"><div class="panel"><h2>We can't find that page</h2><p>Check the web address and try again.</p>
        <p><a class="btn" href="/demo">Go to the demo</a></p></div></main>${App.footer()}`;
    }
  };
})();
