// Shared helpers for the Cloudflare Pages Functions member portal.
// All crypto uses the Workers-native WebCrypto API (no Node deps).

const enc = new TextEncoder();

// ---------- Password hashing (PBKDF2-SHA256) ----------
const PBKDF2_ITER = 100000;

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function ub64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iter, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'pbkdf2') return false;
    const salt = ub64(saltB64);
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: Number(iter), hash: 'SHA-256' }, key, 256);
    return timingSafeEqual(b64(bits), hashB64);
  } catch { return false; }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ---------- Base32 (RFC 4648) for TOTP secrets ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomBase32(len = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += B32[b % 32];
  return out;
}

function base32Decode(input) {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

// ---------- TOTP (RFC 6238, SHA-1, 6 digits, 30s) ----------
async function hotp(secretBytes, counter) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter >>> 0, false);
  view.setUint32(0, Math.floor(counter / 2 ** 32), false);
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = sig[sig.length - 1] & 0xf;
  const code = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
  return String(code % 1000000).padStart(6, '0');
}

export async function verifyTOTP(secretB32, token, window = 1) {
  const clean = (token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(secretB32);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (await hotp(secret, step + w) === clean) return true;
  }
  return false;
}

export function otpauthURL(brand, email, secretB32) {
  const label = encodeURIComponent(`${brand}:${email}`);
  const issuer = encodeURIComponent(brand);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// ---------- Signed session cookie (HMAC-SHA256) ----------
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signSession(secret, payload) {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

export async function readSession(secret, cookie) {
  if (!cookie) return null;
  const [body, sig] = cookie.split('.');
  if (!body || !sig) return null;
  if (await hmac(secret, body) !== sig) return null;
  try {
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
}

export function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// ---------- misc ----------
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function addDays(days) {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}
