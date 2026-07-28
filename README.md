# Modern Branded Member Portal — Cloudflare edition

The same portal (branded landing, login, 2FA, dashboard, admin invoice management), running
**100% on Cloudflare — no VPS, no server to maintain**:

- **Cloudflare Pages + Functions** — the app and all backend logic (Workers runtime)
- **Cloudflare D1** — the database (users, activity, subscriptions, invoice records)
- **Cloudflare R2** — secure storage for uploaded invoice PDFs

All crypto is Workers-native (WebCrypto): passwords hashed with PBKDF2-SHA256, 2FA is TOTP
(RFC 6238) verified with HMAC-SHA1, sessions are HMAC-signed cookies. No Node-only dependencies.

---

## 🚀 Deploy to your Cloudflare account

You need Node 18+ installed. That's it — no VPS.

```bash
# 1. Sign in to Cloudflare (opens your browser once)
npx wrangler login

# 2. Run the deploy script
bash deploy.sh
```

`deploy.sh` will:
1. create the D1 database (you paste its `database_id` into `wrangler.toml` once, then re-run),
2. create the R2 bucket,
3. load the schema + demo accounts,
4. set a random `SESSION_SECRET`,
5. deploy the Pages project and print your live `*.pages.dev` URL.

### Demo logins (created by the seed step)
| Role   | Email            | Password    |
|--------|------------------|-------------|
| Admin  | `admin@demo.com` | `Admin@123` |
| Member | `demo@demo.com`  | `Demo@123`  |

---

## 🎨 Branding

Set these in `wrangler.toml` (or in the Pages project → Settings → Variables) and redeploy:

| Variable     | What it does                                                        |
|--------------|---------------------------------------------------------------------|
| `BRAND_NAME` | Brand name shown across the whole site + the logo fallback initial. |
| `LOGO_URL`   | URL to your logo image (shown in the nav). Leave blank for the initial. |

Colours live at the top of `public/style.css` (`--brand`, `--brand-2`, …).

To use a **custom domain**, add it in the Pages project → Custom domains (Cloudflare handles the DNS + SSL automatically).

---

## 🧪 Run it locally first (optional)

```bash
npm install
npm run db:schema:local     # create local tables
npm run db:seed:local       # seed demo accounts
npm run dev                 # http://localhost:8788
```

---

## 📁 Structure

```
functions/[[path]].js   The whole app — routing, auth, 2FA, admin, uploads (one Pages Function)
functions/_lib.js       WebCrypto helpers: password hashing, TOTP, signed sessions
functions/_views.js     Server-rendered HTML (same design as the Node version)
public/                 Static assets (style.css, qrcode.min.js) — served by Pages
schema.sql              D1 tables
seed.sql / gen-seed.js  Demo data (gen-seed.js fills in real password hashes)
wrangler.toml           Bindings (D1, R2) + brand variables
deploy.sh               One-shot deploy to your Cloudflare account
```

## 🔐 Security notes
- Passwords: PBKDF2-SHA256, 100k iterations, per-user salt.
- 2FA: TOTP via authenticator apps (Google Authenticator / Authy / 1Password).
- Sessions: HMAC-signed, HttpOnly + Secure + SameSite cookies.
- Invoice access is scoped — a member can only download their own invoices; admins can view any.
- PDFs are validated on upload and stored privately in R2 (served only through the access-checked route).
- `SESSION_SECRET` is a Cloudflare secret, never in the code.
