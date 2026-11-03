// Small helpers shared by the Netlify functions. (The leading underscore keeps this file from becoming a function.)
exports.json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

// A tiny client for Supabase using the secret service_role key. This runs only on the server.
exports.client = (env, fetchFn) => {
  const base = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  const call = (path, opts) => fetchFn(base + path, Object.assign({}, opts, {
    headers: Object.assign({ apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' }, (opts && opts.headers) || {})
  }));
  return {
    call,
    async rows(path) { const r = await call(path); return r.ok ? r.json() : []; },
    // Who is this login? Returns {email} or null.
    async whoIs(token) {
      const r = await fetchFn(base + '/auth/v1/user', { headers: { apikey: key, authorization: 'Bearer ' + token } });
      if (!r.ok) return null;
      const u = await r.json();
      return { id: u.id, email: String(u.email || '').toLowerCase() };
    },
    async staffRow(email) { return (await this.rows('/rest/v1/staff?select=role,area,shop&email=eq.' + encodeURIComponent(email)))[0] || null; }
  };
};
exports.bearer = (event) => String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
exports.slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
