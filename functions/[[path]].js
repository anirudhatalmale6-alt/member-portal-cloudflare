// Main router for the Cloudflare Pages member portal.
// Bindings (set in Pages project / wrangler.toml):
//   env.DB      -> D1 database
//   env.BUCKET  -> R2 bucket (invoice PDFs)
//   env.SESSION_SECRET, env.BRAND_NAME, env.LOGO_URL  -> vars/secrets
import * as V from './_views.js';
import {
  hashPassword, verifyPassword, randomBase32, verifyTOTP, otpauthURL,
  signSession, readSession, parseCookies, addDays,
} from './_lib.js';

const COOKIE = 'mp_sess';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  // let Pages serve static assets (css/js/images/fonts) directly
  if (method === 'GET' && /\.(css|js|png|jpe?g|svg|ico|gif|webp|woff2?|map|txt)$/i.test(path))
    return context.next();

  const brand = env.BRAND_NAME || 'Nimbus';
  const logo = env.LOGO_URL || '';
  const secret = env.SESSION_SECRET || 'dev-insecure-secret-change-me';

  const cookies = parseCookies(request.headers.get('Cookie'));
  const sess = await readSession(secret, cookies[COOKIE]);
  let user = null;
  if (sess && sess.uid) user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(sess.uid).first();

  const ip = (request.headers.get('CF-Connecting-IP') || '').split(',')[0] || '';
  const ctx = { env, brand, logo, secret, user, sess, ip };

  const page = (title, body, extraHeaders = {}) =>
    new Response(V.layout({ brand, logo, title, user, body: body.replaceAll('{{brand}}', brand) }),
      { headers: { 'content-type': 'text/html; charset=utf-8', ...extraHeaders } });

  const redirect = (to, headers = {}) => new Response(null, { status: 302, headers: { Location: to, ...headers } });

  const setSession = async (payload) => {
    const val = await signSession(secret, payload);
    return `${COOKIE}=${val}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
  };
  const clearSession = `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

  const log = (uid, type, detail) =>
    env.DB.prepare('INSERT INTO activity (user_id,type,detail,ip) VALUES (?,?,?,?)').bind(uid, type, detail || '', ip).run();

  try {
    // ---------------- public ----------------
    if (path === '/' && method === 'GET') return page('Secure member portal', V.landing());

    if (path === '/register' && method === 'GET') return page('Create account', V.register(null));
    if (path === '/register' && method === 'POST') {
      const f = await request.formData();
      const name = (f.get('name') || '').trim(), email = (f.get('email') || '').trim().toLowerCase(), password = f.get('password') || '';
      if (!name || !email || password.length < 6)
        return page('Create account', V.register('Please fill all fields (password min 6 chars).', { name, email }));
      const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
      if (exists) return page('Create account', V.register('An account with that email already exists.', { name, email }));
      const hash = await hashPassword(password);
      const res = await env.DB.prepare(
        'INSERT INTO users (name,email,password_hash,is_admin,plan,plan_status,plan_renews) VALUES (?,?,?,0,?,?,?)')
        .bind(name, email, hash, 'Starter', 'Active', addDays(30)).run();
      const uid = res.meta.last_row_id;
      await log(uid, 'account_created', 'Account registered');
      await log(uid, 'login', 'First sign-in');
      return redirect('/dashboard', { 'Set-Cookie': await setSession({ uid }) });
    }

    if (path === '/login' && method === 'GET') return page('Log in', V.login(null));
    if (path === '/login' && method === 'POST') {
      const f = await request.formData();
      const email = (f.get('email') || '').trim().toLowerCase(), password = f.get('password') || '';
      const u = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      if (!u || !(await verifyPassword(password, u.password_hash)))
        return page('Log in', V.login('Invalid email or password.', email));
      if (u.twofa_enabled)
        return redirect('/2fa', { 'Set-Cookie': await setSession({ uid: u.id, pending2fa: true }) });
      await log(u.id, 'login', 'Signed in with password');
      return redirect('/dashboard', { 'Set-Cookie': await setSession({ uid: u.id }) });
    }

    if (path === '/2fa' && method === 'GET') {
      if (!sess || !sess.pending2fa) return redirect('/login');
      return page('Two-factor', V.twofaVerify(null));
    }
    if (path === '/2fa' && method === 'POST') {
      if (!sess || !sess.pending2fa || !user) return redirect('/login');
      const f = await request.formData();
      const ok = await verifyTOTP(user.twofa_secret, f.get('token') || '');
      if (!ok) return page('Two-factor', V.twofaVerify('Incorrect code, try again.'));
      await log(user.id, 'login', 'Completed 2FA verification');
      return redirect('/dashboard', { 'Set-Cookie': await setSession({ uid: user.id }) });
    }

    if (path === '/logout' && method === 'POST') {
      if (user) await log(user.id, 'logout', 'Signed out');
      return redirect('/login', { 'Set-Cookie': clearSession });
    }

    // ---------------- auth required ----------------
    const needAuth = () => { if (!user) return redirect('/login'); if (sess.pending2fa) return redirect('/2fa'); return null; };

    if (path === '/dashboard' && method === 'GET') {
      const g = needAuth(); if (g) return g;
      const activity = (await env.DB.prepare('SELECT * FROM activity WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 100').bind(user.id).all()).results;
      const invoices = (await env.DB.prepare('SELECT * FROM invoices WHERE user_id=? ORDER BY uploaded_at DESC, id DESC').bind(user.id).all()).results;
      return page('Dashboard', V.dashboard(user, activity, invoices));
    }

    if (path.startsWith('/invoice/') && method === 'GET') {
      const g = needAuth(); if (g) return g;
      const id = path.split('/')[2];
      const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(id).first();
      if (!inv) return new Response(V.layout({ brand, logo, title: 'Error', user, body: V.errorPage(404, 'Invoice not found') }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
      if (inv.user_id !== user.id && !user.is_admin) return new Response(V.layout({ brand, logo, title: 'Error', user, body: V.errorPage(403, 'Not your invoice') }), { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } });
      const obj = await env.BUCKET.get(inv.r2_key);
      if (!obj) return new Response(V.layout({ brand, logo, title: 'Error', user, body: V.errorPage(404, 'File missing in storage') }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
      await log(user.id, 'invoice_download', `Downloaded ${inv.label}`);
      return new Response(obj.body, { headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${inv.original.replace(/"/g, '')}"`,
      } });
    }

    if (path === '/account' && method === 'GET') {
      const g = needAuth(); if (g) return g;
      return page('Account', V.account({ user, msg: url.searchParams.get('msg'), error: null }));
    }
    if (path === '/account/2fa/setup' && method === 'POST') {
      const g = needAuth(); if (g) return g;
      const s = randomBase32(32);
      const otp = otpauthURL(brand, user.email, s);
      // stash pending secret in session until confirmed
      return page('Account', V.account({ user, qr: otp, secret: s }), { 'Set-Cookie': await setSession({ uid: user.id, tmpSecret: s }) });
    }
    if (path === '/account/2fa/enable' && method === 'POST') {
      const g = needAuth(); if (g) return g;
      const f = await request.formData();
      const s = sess.tmpSecret;
      const ok = s && await verifyTOTP(s, f.get('token') || '');
      if (!ok) return page('Account', V.account({ user, error: 'Code did not match. Start setup again.' }));
      await env.DB.prepare('UPDATE users SET twofa_secret=?, twofa_enabled=1 WHERE id=?').bind(s, user.id).run();
      await log(user.id, 'security', 'Enabled two-factor authentication');
      user.twofa_enabled = 1;
      return page('Account', V.account({ user, msg: 'Two-factor authentication is now enabled.' }), { 'Set-Cookie': await setSession({ uid: user.id }) });
    }
    if (path === '/account/2fa/disable' && method === 'POST') {
      const g = needAuth(); if (g) return g;
      await env.DB.prepare('UPDATE users SET twofa_enabled=0, twofa_secret=NULL WHERE id=?').bind(user.id).run();
      await log(user.id, 'security', 'Disabled two-factor authentication');
      user.twofa_enabled = 0;
      return page('Account', V.account({ user, msg: 'Two-factor authentication disabled.' }));
    }

    // ---------------- admin ----------------
    const needAdmin = () => { const g = needAuth(); if (g) return g; if (!user.is_admin) return new Response(V.layout({ brand, logo, title: 'Error', user, body: V.errorPage(403, 'Admin access required') }), { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }); return null; };

    if (path === '/admin' && method === 'GET') {
      const g = needAdmin(); if (g) return g;
      return page('Admin', await renderAdmin(env, url.searchParams.get('msg'), null));
    }
    if (path === '/admin/invoice' && method === 'POST') {
      const g = needAdmin(); if (g) return g;
      const f = await request.formData();
      const userId = f.get('user_id'), label = (f.get('label') || 'Invoice').trim(), amount = (f.get('amount') || '').trim();
      const file = f.get('pdf');
      const target = userId ? await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first() : null;
      if (!target || !file || typeof file === 'string' || file.type !== 'application/pdf')
        return page('Admin', await renderAdmin(env, null, 'Select a valid user and a PDF file.'));
      const key = `invoices/${target.id}/${Date.now()}-${crypto.randomUUID()}.pdf`;
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: 'application/pdf' } });
      await env.DB.prepare('INSERT INTO invoices (user_id,label,amount,r2_key,original) VALUES (?,?,?,?,?)')
        .bind(target.id, label, amount, key, file.name || 'invoice.pdf').run();
      await log(target.id, 'invoice_added', `Invoice "${label}" made available`);
      return redirect('/admin?msg=' + encodeURIComponent('Invoice uploaded and assigned to ' + target.name));
    }
    if (path.startsWith('/admin/invoice/') && path.endsWith('/delete') && method === 'POST') {
      const g = needAdmin(); if (g) return g;
      const id = path.split('/')[3];
      const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(id).first();
      if (inv) { await env.BUCKET.delete(inv.r2_key); await env.DB.prepare('DELETE FROM invoices WHERE id=?').bind(id).run(); }
      return redirect('/admin?msg=' + encodeURIComponent('Invoice deleted'));
    }
    if (path === '/admin/plan' && method === 'POST') {
      const g = needAdmin(); if (g) return g;
      const f = await request.formData();
      const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(f.get('user_id')).first();
      if (target) {
        await env.DB.prepare('UPDATE users SET plan=?, plan_status=?, plan_renews=? WHERE id=?')
          .bind(f.get('plan'), f.get('plan_status'), f.get('plan_renews') || null, target.id).run();
        await log(target.id, 'subscription', `Plan updated to ${f.get('plan')} (${f.get('plan_status')})`);
      }
      return redirect('/admin?msg=' + encodeURIComponent('Subscription updated'));
    }

    // static assets fall through to Pages; anything else is 404
    return new Response(V.layout({ brand, logo, title: 'Not found', user, body: V.errorPage(404, 'Page not found') }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (err) {
    return new Response(V.layout({ brand, logo, title: 'Error', user, body: V.errorPage(500, err.message || 'Something went wrong') }), { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}

async function renderAdmin(env, msg, error) {
  const users = (await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC').all()).results;
  const invoices = (await env.DB.prepare(
    'SELECT i.*, u.name AS user_name, u.email AS user_email FROM invoices i JOIN users u ON u.id=i.user_id ORDER BY i.uploaded_at DESC, i.id DESC').all()).results;
  return V.admin({ users, invoices, msg, error });
}
