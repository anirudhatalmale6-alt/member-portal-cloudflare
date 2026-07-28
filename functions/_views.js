// HTML views (server-rendered template strings). Mirrors the Express/EJS design.
import { esc } from './_lib.js';

const icons = { login: '🔑', logout: '🚪', account_created: '✨', invoice_download: '⬇️', invoice_added: '📄', security: '🔐', subscription: '💳' };

function statusBadge(s) {
  if (s === 'Active') return '<span class="badge good">● Active</span>';
  if (s === 'Past due') return '<span class="badge warn">● Past due</span>';
  if (s === 'Cancelled') return '<span class="badge bad">● Cancelled</span>';
  return `<span class="badge info">● ${esc(s)}</span>`;
}

export function layout({ brand, logo, title, user, body }) {
  const brandMark = logo
    ? `<img src="${esc(logo)}" alt="${esc(brand)}" style="width:34px;height:34px;border-radius:9px;object-fit:cover">`
    : `<span class="logo">${esc(brand.charAt(0))}</span>`;
  const nav = user
    ? `<a href="/dashboard">Dashboard</a><a href="/account">Account</a>${user.is_admin ? '<a href="/admin">Admin</a>' : ''}
       <form action="/logout" method="post" style="margin:0"><button class="btn btn-ghost btn-sm">Sign out</button></form>`
    : `<a href="/login">Log in</a><a class="btn btn-primary btn-sm" href="/register">Get started</a>`;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? title + ' · ' + brand : brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head><body>
<div class="container"><nav class="nav">
  <a class="brand" href="/">${brandMark}${esc(brand)}</a>
  <div class="nav-links">${nav}</div>
</nav></div>
${body}
</body></html>`;
}

export function landing() {
  return `<div class="container">
  <section class="hero">
    <span class="pill">● Secure member portal</span>
    <h1>One clean home for your<br><span>account, plan &amp; invoices</span></h1>
    <p>Create an account, sign in with two-factor security, and track your activity, subscription and downloadable invoices — all from one modern dashboard.</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="/register">Create your account →</a>
      <a class="btn btn-ghost" href="/login">I already have one</a>
    </div>
  </section>
  <section class="features grid grid-3">
    <div class="card feature"><div class="ic">🔐</div><h3>2FA-protected sign-in</h3><p>Email &amp; password plus an authenticator code (TOTP) before anyone reaches your private area.</p></div>
    <div class="card feature"><div class="ic">📊</div><h3>Activity &amp; subscription</h3><p>A live timeline of every sign-in and action, with your current membership status always in view.</p></div>
    <div class="card feature"><div class="ic">📄</div><h3>Downloadable invoices</h3><p>Your PDF invoices, uploaded from the back-end and available to download any time — securely.</p></div>
  </section>
</div>
<div class="footer">© {{brand}} — modern branded member portal</div>`;
}

export function login(error, email) {
  return `<div class="container narrow auth-wrap"><div class="card card-pad" style="width:100%">
    <h1 style="font-size:24px;margin:0 0 6px">Welcome back</h1>
    <p class="muted" style="margin:0 0 8px;font-size:14px">Sign in to your account.</p>
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    <form action="/login" method="post">
      <label class="f">Email address</label>
      <input type="email" name="email" value="${esc(email || '')}" required autofocus>
      <label class="f">Password</label>
      <input type="password" name="password" required>
      <button class="btn btn-primary btn-block mt">Continue</button>
    </form>
    <div class="divider"></div>
    <p class="center muted" style="font-size:14px;margin:0">No account? <a href="/register">Create one</a></p>
  </div></div>`;
}

export function register(error, form = {}) {
  return `<div class="container narrow auth-wrap"><div class="card card-pad" style="width:100%">
    <h1 style="font-size:24px;margin:0 0 6px">Create your account</h1>
    <p class="muted" style="margin:0 0 8px;font-size:14px">It takes less than a minute.</p>
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    <form action="/register" method="post">
      <label class="f">Full name</label>
      <input type="text" name="name" value="${esc(form.name || '')}" required autofocus>
      <label class="f">Email address</label>
      <input type="email" name="email" value="${esc(form.email || '')}" required>
      <label class="f">Password</label>
      <input type="password" name="password" minlength="6" required>
      <div class="hint">Minimum 6 characters. You can turn on 2FA right after signing in.</div>
      <button class="btn btn-primary btn-block mt">Create account</button>
    </form>
    <div class="divider"></div>
    <p class="center muted" style="font-size:14px;margin:0">Already registered? <a href="/login">Log in</a></p>
  </div></div>`;
}

export function twofaVerify(error) {
  return `<div class="container narrow auth-wrap"><div class="card card-pad" style="width:100%">
    <div class="ic" style="width:48px;height:48px;border-radius:12px;background:rgba(109,124,255,.12);display:grid;place-items:center;font-size:24px;margin-bottom:12px">🔐</div>
    <h1 style="font-size:23px;margin:0 0 6px">Two-factor verification</h1>
    <p class="muted" style="margin:0 0 8px;font-size:14px">Enter the 6-digit code from your authenticator app.</p>
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    <form action="/2fa" method="post">
      <label class="f">Authentication code</label>
      <input type="text" name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" placeholder="123 456" style="font-size:22px;letter-spacing:4px;text-align:center" required autofocus>
      <button class="btn btn-primary btn-block mt">Verify &amp; continue</button>
    </form>
    <div class="divider"></div>
    <form action="/logout" method="post" class="center"><button class="btn btn-ghost btn-sm">Cancel</button></form>
  </div></div>`;
}

export function dashboard(user, activity, invoices) {
  const tl = activity.length ? `<div class="timeline">${activity.map((a) => `
      <div class="tl-item"><div class="tl-dot"></div>
        <div class="t">${icons[a.type] || '•'} ${esc(a.detail || a.type)}</div>
        <div class="m">${esc(a.created_at)} UTC${a.ip ? ' · ' + esc(a.ip) : ''}</div></div>`).join('')}</div>`
    : '<p class="muted">No activity yet.</p>';
  const inv = invoices.length ? invoices.map((i) => `
      <div class="inv"><div>
        <div style="font-weight:600">📄 ${esc(i.label)}${i.amount ? ' · ' + esc(i.amount) : ''}</div>
        <div class="meta">${esc(i.uploaded_at.slice(0, 10))} · ${esc(i.original)}</div>
      </div><a class="btn btn-ghost btn-sm" href="/invoice/${i.id}">Download</a></div>`).join('')
    : `<p class="muted">No invoices yet. They'll appear here when uploaded.</p>`;
  return `<div class="container" style="padding-bottom:50px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin:10px 0 22px">
    <div><h1 style="margin:0;font-size:26px">Hi, ${esc(user.name.split(' ')[0])} 👋</h1>
      <p class="muted" style="margin:4px 0 0">Here's what's happening with your account.</p></div>
    ${!user.twofa_enabled ? '<a class="btn btn-ghost btn-sm" href="/account">🔐 Enable 2FA</a>' : ''}
  </div>
  <div class="tiles">
    <div class="card tile"><div class="k">Membership</div><div class="v">${esc(user.plan)}</div><div style="margin-top:8px">${statusBadge(user.plan_status)}</div></div>
    <div class="card tile"><div class="k">Renews / next bill</div><div class="v">${esc(user.plan_renews || '—')}</div><div class="muted" style="font-size:13px;margin-top:8px">Auto-managed from admin</div></div>
    <div class="card tile"><div class="k">Invoices available</div><div class="v">${invoices.length}</div><div class="muted" style="font-size:13px;margin-top:8px">Download any time below</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card card-pad">
      <div class="sec-head"><h2>Account activity</h2><span class="badge info">${activity.length} events</span></div>
      ${tl}
    </div>
    <div class="grid">
      <div class="card card-pad">
        <div class="sec-head"><h2>Subscription</h2></div>
        <table>
          <tr><td class="muted">Plan</td><td style="text-align:right"><strong>${esc(user.plan)}</strong></td></tr>
          <tr><td class="muted">Status</td><td style="text-align:right">${statusBadge(user.plan_status)}</td></tr>
          <tr><td class="muted">Renews on</td><td style="text-align:right">${esc(user.plan_renews || '—')}</td></tr>
          <tr><td class="muted">Member since</td><td style="text-align:right">${esc(user.created_at.slice(0, 10))}</td></tr>
        </table>
      </div>
      <div class="card card-pad">
        <div class="sec-head"><h2>Invoices</h2></div>
        ${inv}
      </div>
    </div>
  </div>
</div>`;
}

export function account({ user, qr, secret, msg, error }) {
  let block;
  if (qr) {
    block = `<p class="muted" style="font-size:14px">1. Scan this with Google Authenticator, Authy or 1Password. 2. Enter the 6-digit code to confirm.</p>
      <div class="center"><div class="qr"><canvas id="qrc"></canvas></div></div>
      <p class="muted center" style="font-size:12.5px;margin:12px 0 6px">Can't scan? Enter this key manually:</p>
      <div class="center"><span class="code">${esc(secret)}</span></div>
      <form action="/account/2fa/enable" method="post">
        <label class="f">Verification code</label>
        <input type="text" name="token" inputmode="numeric" placeholder="123 456" style="text-align:center;letter-spacing:3px" required>
        <button class="btn btn-primary btn-block mt">Confirm &amp; enable</button>
      </form>
      <script src="/qrcode.min.js"></script>
      <script>new QRCode(document.getElementById('qrc'),{text:${JSON.stringify(qr)},width:190,height:190,correctLevel:QRCode.CorrectLevel.M});</script>`;
  } else if (user.twofa_enabled) {
    block = `<p class="muted" style="font-size:14px">Your account is protected with an authenticator app. You'll be asked for a code each time you sign in.</p>
      <form action="/account/2fa/disable" method="post"><button class="btn btn-danger">Disable 2FA</button></form>`;
  } else {
    block = `<p class="muted" style="font-size:14px">Add an extra layer of security. You'll enter a one-time code from your phone when signing in.</p>
      <form action="/account/2fa/setup" method="post"><button class="btn btn-primary">Set up 2FA</button></form>`;
  }
  return `<div class="container narrow" style="padding:20px 0 50px">
  <h1 style="font-size:24px;margin:6px 0 18px">Account &amp; security</h1>
  <div class="card card-pad" style="margin-bottom:20px">
    <div class="sec-head"><h2>Profile</h2></div>
    <table>
      <tr><td class="muted">Name</td><td style="text-align:right">${esc(user.name)}</td></tr>
      <tr><td class="muted">Email</td><td style="text-align:right">${esc(user.email)}</td></tr>
      <tr><td class="muted">Role</td><td style="text-align:right">${user.is_admin ? 'Administrator' : 'Member'}</td></tr>
    </table>
  </div>
  <div class="card card-pad">
    <div class="sec-head"><h2>Two-factor authentication</h2>${user.twofa_enabled ? '<span class="badge good">● Enabled</span>' : '<span class="badge warn">● Off</span>'}</div>
    ${msg ? `<div class="alert ok">${esc(msg)}</div>` : ''}
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    ${block}
  </div>
</div>`;
}

export function admin({ users, invoices, msg, error }) {
  const userOpts = (placeholder) =>
    (placeholder ? '<option value="">Select a user…</option>' : '') +
    users.map((u) => `<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join('');
  const invRows = invoices.length ? invoices.map((i) => `
      <tr><td>📄 ${esc(i.label)}</td>
        <td>${esc(i.user_name)}<div class="muted" style="font-size:12px">${esc(i.user_email)}</div></td>
        <td>${esc(i.amount || '—')}</td>
        <td class="muted">${esc(i.uploaded_at.slice(0, 16))}</td>
        <td style="text-align:right;white-space:nowrap">
          <a class="btn btn-ghost btn-sm" href="/invoice/${i.id}">View</a>
          <form action="/admin/invoice/${i.id}/delete" method="post" style="display:inline" onsubmit="return confirm('Delete this invoice?')"><button class="btn btn-danger">Delete</button></form>
        </td></tr>`).join('') : '';
  const userRows = users.map((u) => `
      <tr><td>${esc(u.name)}</td><td class="muted">${esc(u.email)}</td><td>${esc(u.plan)}</td>
        <td>${esc(u.plan_status)}</td><td>${u.twofa_enabled ? '✅' : '—'}</td><td>${u.is_admin ? 'Admin' : 'Member'}</td></tr>`).join('');
  return `<div class="container" style="padding-bottom:50px">
  <h1 style="font-size:26px;margin:10px 0 4px">Admin panel</h1>
  <p class="muted" style="margin:0 0 22px">Upload invoices, assign them to users, and manage subscriptions.</p>
  ${msg ? `<div class="alert ok">${esc(msg)}</div>` : ''}
  ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
  <div class="grid grid-2">
    <div class="card card-pad">
      <div class="sec-head"><h2>Upload invoice</h2></div>
      <form action="/admin/invoice" method="post" enctype="multipart/form-data" id="upForm">
        <label class="f">Assign to user</label>
        <select name="user_id" required>${userOpts(true)}</select>
        <div class="grid grid-2" style="gap:12px">
          <div><label class="f">Label</label><input type="text" name="label" placeholder="Invoice — Jan 2026"></div>
          <div><label class="f">Amount (optional)</label><input type="text" name="amount" placeholder="$49.00"></div>
        </div>
        <label class="f">PDF file</label>
        <div class="drop" id="drop"><div id="dropText"><strong>Drag &amp; drop</strong> a PDF here, or click to select</div>
          <input type="file" name="pdf" id="pdf" accept="application/pdf" required style="display:none"></div>
        <button class="btn btn-primary btn-block mt">Upload &amp; assign</button>
      </form>
    </div>
    <div class="card card-pad">
      <div class="sec-head"><h2>Update subscription</h2></div>
      <form action="/admin/plan" method="post">
        <label class="f">User</label>
        <select name="user_id" required>${userOpts(false)}</select>
        <div class="grid grid-2" style="gap:12px">
          <div><label class="f">Plan</label><select name="plan"><option>Free</option><option selected>Starter</option><option>Pro</option><option>Enterprise</option></select></div>
          <div><label class="f">Status</label><select name="plan_status"><option selected>Active</option><option>Past due</option><option>Cancelled</option></select></div>
        </div>
        <label class="f">Renews on</label>
        <input type="date" name="plan_renews">
        <button class="btn btn-primary btn-block mt">Save subscription</button>
      </form>
    </div>
  </div>
  <div class="card card-pad" style="margin-top:20px">
    <div class="sec-head"><h2>All invoices</h2><span class="badge info">${invoices.length} total</span></div>
    ${invoices.length ? `<div style="overflow-x:auto"><table><tr><th>Label</th><th>Assigned to</th><th>Amount</th><th>Uploaded</th><th></th></tr>${invRows}</table></div>` : '<p class="muted">No invoices uploaded yet.</p>'}
  </div>
  <div class="card card-pad" style="margin-top:20px">
    <div class="sec-head"><h2>Users</h2><span class="badge info">${users.length} total</span></div>
    <div style="overflow-x:auto"><table><tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th><th>2FA</th><th>Role</th></tr>${userRows}</table></div>
  </div>
</div>
<script>
  const drop=document.getElementById('drop'),pdf=document.getElementById('pdf'),dt=document.getElementById('dropText');
  drop.addEventListener('click',()=>pdf.click());
  ['dragenter','dragover'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('drag')}));
  ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('drag')}));
  drop.addEventListener('drop',ev=>{if(ev.dataTransfer.files.length){pdf.files=ev.dataTransfer.files;show()}});
  pdf.addEventListener('change',show);
  function show(){if(pdf.files.length)dt.innerHTML='📄 <strong>'+pdf.files[0].name+'</strong> selected';}
</script>`;
}

export function errorPage(code, msg) {
  return `<div class="container narrow auth-wrap"><div class="card card-pad center" style="width:100%">
    <div style="font-size:52px;font-weight:800;background:linear-gradient(120deg,var(--brand-2),var(--brand));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">${code}</div>
    <p class="muted" style="margin:8px 0 18px">${esc(msg)}</p>
    <a class="btn btn-primary" href="/">Back home</a>
  </div></div>`;
}
