// The live prize desk. Runs on two iPads at once: both stay in step, and a short Wi-Fi drop never loses a tap.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc, money = U.money, d0 = App.d;
  if (!D.live) return;
  const LP = App.livePages, LB = App.live;
  const focusId = (id) => { const el = document.getElementById(id); if (el) el.focus(); };

  const deskArea = (ctx) => {
    const s = D.staff || {};
    if (['desk', 'council', 'street'].includes(s.role) && s.area) return s.area;
    return ctx.area || C.demoHomeArea;
  };
  const limitOf = () => { const v = parseInt(D.state.settings.budget_limit, 10); return Number.isFinite(v) ? v : 5000; };
  const spentOf = (area) => d0.signupsOf(area).reduce((a, s) => a + (s.prize ? Number(s.prize.value || 0) : 0), 0);

  LP.desk = {
    brand: (ctx) => (d0.area(deskArea(ctx)) ? App.brandOf(deskArea(ctx)) : LB.fb()),
    title: () => 'Prize desk',
    render(ctx, b) {
      const area = deskArea(ctx), S = App.state;
      if (!D.user || !LB.canDesk(area)) return LB.gate('Prize desk');
      const a = d0.area(area);
      const prizes = d0.prizesOf(area);
      const limit = limitOf(), spent = spentOf(area), pct = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      const warn = spent > limit * 0.9;
      const cur = S.deskCode ? d0.signup(S.deskCode) : null;
      const ok = cur && cur.area === area;
      const last = S.lastAward && d0.signup(S.lastAward.code);
      const undoLeft = S.lastAward ? Math.max(0, 10 - Math.floor((Date.now() - S.lastAward.at) / 1000)) : 0;
      const saving = S.saving;
      const staffRes = S.staffCode ? d0.signup(S.staffCode) : null;

      const wheel = prizes.map((p) => {
        const l = d0.left(p), over = p.value > 0 && spent + p.value > limit;
        const off = !ok || cur.prize || l <= 0 || over || !!saving;
        const label = l <= 0 ? 'Used up' : over ? 'Over budget' : l + ' left';
        return `<button class="wheelbtn" data-act="ldesk-award" data-prize="${p.id}" ${off ? 'disabled' : ''} style="background:${esc(p.color)};color:${U.textOn(p.color)}">
          <span class="n">${esc(p.name)}</span><span class="left">${label}</span></button>`;
      }).join('') || '<p class="muted">No prizes yet. Add them in Admin.</p>';

      const canUndo = undoLeft > 0 && last && (!last.redeemed || last.redeemed_at === 'desk');
      const result = last && last.prize ? `<div class="who" role="status"><b>${esc(S.lastAward.name)} won ${esc(S.lastAward.prize)}.</b>
          ${S.lastAward.value > 0 ? (S.notice ? esc(S.notice) : 'Sending their coupon…') : ('Hand it over now.' + (S.lastAward.note ? ' ' + esc(S.lastAward.note) : ''))}
          ${S.noticeBad && S.lastAward.value > 0 ? ` <button class="btn small" data-act="ldesk-resend">Send again</button>` : ''}
          ${canUndo ? ` <button class="btn ghost small" data-act="ldesk-undo">Undo (${undoLeft}s)</button>` : ''}</div>` : '';

      const form = `<form data-form="ldeskstaff" data-area="${esc(area)}" novalidate>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
            <div><label for="ss-name">First name</label><input id="ss-name" name="name" maxlength="40"></div>
            <div><label for="ss-last">Last name</label><input id="ss-last" name="last" maxlength="40"></div>
            <div><label for="ss-post">Postcode</label><input id="ss-post" name="postcode" inputmode="numeric" maxlength="4"></div></div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">
            <div><label for="ss-email">Email</label><input id="ss-email" name="email" type="email" maxlength="120"></div>
            <div><label for="ss-mob">Mobile</label><input id="ss-mob" name="mobile" inputmode="tel" placeholder="04xx xxx xxx" maxlength="14"></div></div>
          <fieldset style="border:0;padding:0;margin:10px 0 0"><legend style="font-weight:700;font-size:15px">Send their coupon by:</legend>
            <div class="row" style="flex-wrap:nowrap"><label class="check" style="margin:4px 14px 0 0"><input type="radio" id="ss-c-email" name="contact" value="email" checked> Email</label>
            <label class="check" style="margin:4px 0 0"><input type="radio" id="ss-c-text" name="contact" value="text"> Text message</label></div></fieldset>
          <label class="check"><input type="checkbox" id="ss-optin" name="optin"> <span>They agree to receive news and updates from ${esc(LB.councilName(d0.area(area)))}, the ${esc(App.brandOf(area).place)} Traders Association, or related parties (optional)</span></label>
          <label class="check"><input type="checkbox" id="ss-terms" name="terms"> They agree to the terms and the safety and privacy page (a parent or guardian, if under 18)</label>
          <p class="err" id="ss-err" role="alert" hidden></p>
          <p style="margin-top:12px"><button class="btn" type="submit">Fill out the form</button></p></form>`;
      const staffDone = staffRes ? `<div class="result" role="status"><p style="margin:0">Signed up: <b>${esc(staffRes.name)}</b></p>
          <div class="bigcode">${esc(staffRes.code)}</div><p class="muted" style="margin:4px 0 8px">${staffRes.local ? 'Saved on this iPad. It will send by itself. ' : ''}Show them this code. They can now join the line.</p>
          <button class="btn ghost small" data-act="ldesk-staff-next">Next person</button></div>`
        : S.staffExisting ? `<div class="result" role="status"><p style="margin:0"><b>They've already signed up.</b> Their code is</p><div class="bigcode">${esc(S.staffExisting)}</div>
          <button class="btn ghost small" data-act="ldesk-staff-next">Next person</button></div>` : '';

      return `${LB.band('Prize desk', b, [['/desk', 'Prize desk', true]])}<main class="wrap" id="main">
        ${LB.netBanner('the name, code and prize')}
        ${LB.syncBar()}
        ${LB.dq.conflicts().length ? `<div class="statecard bad" role="alert"><h3>These did not save. Please check them by hand.</h3><ul style="margin:6px 0">${LB.dq.conflicts().map((c) => `<li><b>${esc(c.who)}</b> (${esc(c.what)}): ${esc(c.msg || 'could not be saved')}</li>`).join('')}</ul><button class="btn ghost small" data-act="ldesk-conflict-ok">Got it</button></div>` : ''}
        <section class="panel meter ${warn ? 'warn' : ''}" aria-label="Prize budget"><div class="row" style="justify-content:space-between"><b>${money(spent)} of ${money(limit)} spent</b><span class="muted">${esc(a ? a.name : '')}</span></div>
          <div class="bar big"><i style="width:${pct}%"></i></div></section>
        <div class="deskgrid gap">
          <section class="panel" aria-label="At the wheel">
            <button class="btn sun big" data-act="ldesk-scan" ${saving ? 'disabled' : ''}>Scan their code</button>
            <form data-form="ldeskfind" style="margin-top:10px"><label for="desk-in">Or type their 4-digit number</label>
              <input id="desk-in" name="code" inputmode="numeric" placeholder="e.g. 4821" autocomplete="off" ${saving ? 'disabled' : ''}></form>
            ${ok ? `<div class="next gap"><div class="muted">At the wheel</div><div class="nextname">${esc(cur.name)}</div><div>${esc(cur.code)}</div>
                ${cur.dup_of ? `<p class="statecard bad" style="margin:8px 0"><b>Possible duplicate</b> of ${esc(cur.dup_of)}. Ask a person on the team before giving a prize.</p>` : ''}${cur.prize ? `<span class="tag no">Already spun: ${esc(cur.prize.name)}. One spin per person.</span>` : '<p style="margin:8px 0 0"><b>Now tap the prize the wheel landed on.</b></p>'}</div>`
              : cur ? '<div class="next gap">That code is for a different street.</div>'
              : S.deskCode ? `<div class="next gap">No sign-up with code ${esc(S.deskCode)}. Check their screen and try again.</div>` : ''}
            <div class="wheelgrid">${wheel}</div>
            ${result}
          </section>
          <section class="panel" aria-label="Staff sign-up"><h3>No smartphone? Staff sign-up</h3>
            <p class="muted">Fill out the form for them here, then show them their code.</p>${staffDone}
            <details><summary>${staffRes || S.staffExisting ? 'Sign up someone else' : 'Open the form'}</summary>${form}</details>
          </section>
        </div></main>${LB.footer()}`;
    },
    after(ctx) {
      if (!ctx.started) {
        ctx.started = true;
        if (LB.waiting()) LB.offlineKick();
        // keep every iPad in step: refresh often (live updates arrive too)
        const poll = setInterval(() => { if (!document.hidden) D.load(); }, 3000);
        const tick = setInterval(() => { if (App.state.lastAward && Date.now() - App.state.lastAward.at < 11000 && App.ctx === ctx) App.render(); }, 1000);
        ctx.stop = () => { clearInterval(poll); clearInterval(tick); };
      }
    }
  };

  const pick = (raw) => { App.state.deskCode = U.normCode(raw); App.render(); focusId('desk-in'); return ''; };
  App.forms.ldeskfind = (f) => pick(new FormData(f).get('code'));
  App.acts['ldesk-scan'] = () => U.openScanner({ title: 'Scan their code', onCode: pick, after: () => focusId('desk-in') });

  App.acts['ldesk-award'] = (b) => {
    const S = App.state, ctx = App.ctx, area = deskArea(ctx);
    const cur = d0.signup(S.deskCode);
    const p = d0.prizesOf(area).find((x) => Number(x.id) === Number(b.dataset.prize));
    if (!cur || !p || cur.prize) return;
    // Shown at once and kept on this iPad. It is sent in the background, and again if the signal drops.
    LB.dq.award(cur, p);
    S.lastAward = { code: cur.code, name: cur.name, prize: p.name, value: Number(p.value), note: p.message || '', at: Date.now() };
    S.deskCode = ''; S.notice = '';
    App.render(); focusId('desk-in');
  };

  // Undo is there for 10 seconds, to fix a wrong tap.
  App.acts['ldesk-undo'] = () => {
    const S = App.state;
    if (!S.lastAward) return;
    if (Date.now() - S.lastAward.at > 10500) { U.toast('Too late to undo.', true); S.lastAward = null; return App.render(); }
    LB.dq.undo(S.lastAward.code);
    S.lastAward = null; U.toast('Undone');
    App.render();
  };

  App.forms.ldeskstaff = async (f) => {
    const d = Object.fromEntries(new FormData(f)), S = App.state;
    const err = (m) => { const e = document.getElementById('ss-err'); if (e) { e.textContent = m; e.hidden = false; } };
    const bad = LB.checkSignup(d);
    if (bad) return err(bad);
    const r = await LB.sq.submit(f.dataset.area, d, { staff: true });
    if (r.state === 'error') return err(r.error);
    if (r.state === 'existing') { S.staffExisting = r.code; S.staffCode = null; } else { S.staffCode = r.code; S.staffExisting = null; }
    App.render();
    D.load();                       // refresh in the background: with no signal it would otherwise make the desk wait
  };
  App.acts['ldesk-resend'] = async () => {
    const S = App.state;
    if (!S.lastAward) return;
    S.notice = 'Sending…'; App.render();
    const n = await D.notifyCoupon(S.lastAward.code);
    S.notice = n.ok ? (n.message || 'Their coupon was sent.') : (n.error + ' Their phone still shows the coupon.'); S.noticeBad = !n.ok;
    App.render();
  };
  App.acts['ldesk-conflict-ok'] = () => { LB.dq.clearConflicts(); App.render(); };
  App.acts['ldesk-staff-next'] = () => { App.state.staffCode = null; App.state.staffExisting = null; App.render(); };
})();
