// A shop sets up its own account, once: it picks its shop (or adds it), gives its details and a password,
// and gets a permanent 6-digit shop code. Anyone can call this, so it checks everything.
//
// Settings: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Netlify > Site configuration > Environment variables).

const { json, client, slug } = require('./_supabase.js');

exports.handler = async (event, ...rest) => {   // rest, not named inputs: Netlify rejects 3-input handlers as the old callback style
  const inject = rest[1];
  const fetchFn = (inject && inject.fetch) || fetch;
  const env = (inject && inject.env) || process.env;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST.' });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json(500, { ok: false, error: 'Shop set-up is not ready yet.' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }

  const clean = (t, n) => String(t == null ? '' : t).trim().slice(0, n);
  const email = clean(b.email, 120).toLowerCase(), name = clean(b.name, 80), mobile = clean(b.mobile, 20).replace(/\s/g, '');
  const password = String(b.password || '');
  if (!name) return json(400, { ok: false, error: 'Please add your name.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { ok: false, error: 'Please add a real email.' });
  if (!/^04\d{8}$/.test(mobile)) return json(400, { ok: false, error: 'Mobile needs to look like 04xx xxx xxx.' });
  if (password.length < 8 || password.length > 72) return json(400, { ok: false, error: 'Your password needs 8 or more characters.' });

  const sb = client(env, fetchFn);
  const area = (await sb.rows('/rest/v1/areas?select=id&id=eq.' + encodeURIComponent(clean(b.area, 40))))[0];
  if (!area) return json(404, { ok: false, error: 'We can\'t find that street.' });

  // the shop: an existing one that nobody has claimed, or a new one
  let shopId = clean(b.shop, 60), shopName = '', isNew = false;
  if (shopId) {
    const s = (await sb.rows('/rest/v1/shops?select=id,name,claimed&hidden=eq.false&area=eq.' + area.id + '&id=eq.' + encodeURIComponent(shopId)))[0];
    if (!s) return json(404, { ok: false, error: 'We can\'t find that shop.' });
    if (s.claimed) return json(409, { ok: false, error: 'This shop has already been set up. Please log in, or use "Forgot password".' });
    shopName = s.name;
  } else {
    const n = b.newShop || {};
    shopName = clean(n.name, 60);
    if (!shopName) return json(400, { ok: false, error: 'Please add your shop name.' });
    const base = slug(shopName) || 'shop';
    const taken = new Set((await sb.rows('/rest/v1/shops?select=id&id=like.' + encodeURIComponent(base) + '*')).map((x) => x.id));
    shopId = base; let i = 1;
    while (taken.has(shopId)) { i += 1; shopId = base + '-' + i; }
    isNew = true;
  }

  // one login per email
  if ((await sb.staffRow(email))) return json(409, { ok: false, error: 'That email is already used for another login.' });

  // 1. the login
  const mk = await sb.call('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!mk.ok) {
    const j = await mk.json().catch(() => ({}));
    if (mk.status === 422 && /already|registered|exists/i.test(JSON.stringify(j))) return json(409, { ok: false, error: 'That email already has an account. Please log in, or use "Forgot password".' });
    return json(400, { ok: false, error: /password/i.test(JSON.stringify(j)) ? 'That password is too weak. Try a longer one.' : 'We could not create your login.' });
  }
  const userId = (await mk.json()).id;
  const undo = async () => { if (userId) await sb.call('/auth/v1/admin/users/' + userId, { method: 'DELETE' }); };

  // 2. the shop, claimed in one step so two people can't both get it
  if (isNew) {
    const ins = await sb.call('/rest/v1/shops', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: shopId, area: area.id, name: shopName, type: clean((b.newShop || {}).type, 30), claimed: true }) });
    if (!ins.ok) { await undo(); return json(500, { ok: false, error: 'We could not add your shop. Please try again.' }); }
  } else {
    const claim = await sb.call('/rest/v1/shops?id=eq.' + encodeURIComponent(shopId) + '&claimed=eq.false', { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ claimed: true }) });
    const got = claim.ok ? await claim.json() : [];
    if (!got.length) { await undo(); return json(409, { ok: false, error: 'This shop has just been set up by someone else.' }); }
  }

  // 3. the permanent shop code (6 digits, unique)
  let code = null;
  for (let tries = 0; tries < 12 && !code; tries++) {
    const c = String(100000 + Math.floor(Math.random() * 900000));
    const r = await sb.call('/rest/v1/shop_private?on_conflict=shop', {
      method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ shop: shopId, code: c, contact: { name, email, mobile }, claimed_at: new Date().toISOString(), fail_count: 0, locked_until: null })
    });
    if (r.ok) code = c;
    else if (r.status !== 409) break;       // 409 = that code is taken, try another
  }
  if (!code) { await sb.call('/rest/v1/shops?id=eq.' + encodeURIComponent(shopId), { method: isNew ? 'DELETE' : 'PATCH', body: isNew ? undefined : JSON.stringify({ claimed: false }) }); await undo(); return json(500, { ok: false, error: 'We could not make your shop code. Please try again.' }); }

  // 4. the login belongs to this shop
  const st = await sb.call('/rest/v1/staff', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ email, role: 'shop', shop: shopId }) });
  if (!st.ok) { await sb.call('/rest/v1/shops?id=eq.' + encodeURIComponent(shopId), { method: isNew ? 'DELETE' : 'PATCH', body: isNew ? undefined : JSON.stringify({ claimed: false }) }); await undo(); return json(500, { ok: false, error: 'We could not finish setting up. Please try again.' }); }

  return json(200, { ok: true, code, id: shopId, name: shopName });
};
