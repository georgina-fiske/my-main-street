// Staff log in (a link sent by email, no password) and the unsubscribe page.
(function () {
  const C = window.CONFIG, D = window.DB, U = window.U, App = window.App, esc = U.esc;
  const P = App.pages;

  const homeFor = (staff) => (staff.role === 'fruitbowl' ? '/hq' : staff.role === 'client' ? '/client' : staff.role === 'desk' ? '/desk' : '/join');

  P.login = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Log in',
    render(ctx) {
      const e = D.user && D.user.email, next = ctx.q.get('next') || '';
      let body;
      if (App.isDemo()) {
        body = `<div class="panel"><h2>Logins are off in the demo</h2><p>In the demo every page is open. Go to the <a href="/demo">guided demo</a>.</p></div>`;
      } else if (e) {
        body = `<div class="panel"><h2>You're logged in</h2><p>Logged in as <b>${esc(e)}</b>${D.staff.role ? ` (${esc(D.staff.role)})` : ''}.</p>
          <p class="row">${D.staff.role ? `<a class="btn" href="${esc(next || homeFor(D.staff))}">Continue</a>` : '<span class="muted">This email is not on the staff list yet. Ask Fruitbowl to add it.</span>'}
          <button class="btn ghost" data-act="logout">Log out</button></p></div>`;
      } else {
        body = `<div class="panel"><h2>Staff log in</h2>
          <p>Enter your email. We'll send you a link that logs you in. No password needed.</p>
          ${ctx.sent ? `<p class="statecard good"><b>Check your email.</b> We sent a login link to ${esc(ctx.sent)}. Open it on this device.</p>` : ''}
          <form data-form="login" data-next="${esc(next)}"><label for="lg-email">Email</label><input id="lg-email" name="email" type="email" autocomplete="email" required value="${esc(ctx.sent || '')}">
          <p class="err" id="lg-err" role="alert" hidden></p><p style="margin-top:12px"><button class="btn big" type="submit">Email me a login link</button></p></form></div>`;
      }
      return `${App.band('Log in', App.fruitbowlBrand(), '')}<main class="wrap" id="main" style="max-width:560px">${body}</main>${App.footer()}`;
    },
    // Back from the email link: go to the right page.
    after(ctx) {
      if (!App.isDemo() && D.user && D.staff.role && !ctx.redirected) {
        ctx.redirected = true;
        App.go(ctx.q.get('next') || homeFor(D.staff), true);
      }
    }
  };

  App.forms.login = async (f) => {
    const email = String(new FormData(f).get('email') || '').trim();
    const showErr = (m) => { const e = document.getElementById('lg-err'); if (e) { e.textContent = m; e.hidden = false; } };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showErr('Please add a real email.');
    const r = await D.signIn(email, f.dataset.next || '');
    if (!r.ok) return showErr(r.error);
    if (App.ctx.name === 'login') { App.ctx.sent = email; App.render(); }
    else U.toast('Check your email for the login link.');
  };

  // "Unsubscribe" link in an email.
  P.unsub = {
    brand: () => App.fruitbowlBrand(),
    title: () => 'Unsubscribe',
    async after(ctx) {
      if (ctx.asked) return;
      ctx.asked = true;
      ctx.result = await D.rpc('unsubscribe', { p_token: ctx.params.token });
      App.render();
    },
    render(ctx) {
      const r = ctx.result;
      return `<main class="wrap" id="main" style="max-width:560px;padding-top:40px"><div class="panel">
        ${!r ? '<p>One moment…</p>' : r.ok ? `<h2>You're unsubscribed</h2><p>We won't send you news and offers. You can still use any coupon you've already won.</p>`
          : `<h2>That link isn't right</h2><p>${esc(r.error || '')}</p>`}
        <p><a href="/safety">Safety and privacy</a></p></div></main>${App.footer()}`;
    }
  };
})();
