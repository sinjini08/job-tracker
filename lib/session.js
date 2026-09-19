// Signed session cookie: "<role>.<expiresAtMs>.<hmac>". Web Crypto only, so the
// same code runs in proxy.js and in route handlers.

export const COOKIE = 'jt_session';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
const enc = new TextEncoder();

function secret() {
  const s = process.env.SESSION_SECRET?.trim();
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)');
  return s;
}

async function hmac(message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Constant-time compare via hashing both sides first, so length and content
// differences don't leak through timing.
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha), vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

// Returns 'edit' | 'view' | null for a submitted access code.
export async function roleForCode(code) {
  const input = String(code ?? '').trim();
  if (!input) return null;
  // Trim: values pasted into a hosting dashboard often pick up a stray space or newline.
  const EDIT_CODE = process.env.EDIT_CODE?.trim();
  const VIEW_CODE = process.env.VIEW_CODE?.trim();
  if (EDIT_CODE && (await safeEqual(input, EDIT_CODE))) return 'edit';
  if (VIEW_CODE && (await safeEqual(input, VIEW_CODE))) return 'view';
  return null;
}

export async function createSession(role) {
  const exp = Date.now() + MAX_AGE_S * 1000;
  const payload = `${role}.${exp}`;
  return { value: `${payload}.${await hmac(payload)}`, maxAge: MAX_AGE_S };
}

// Returns 'edit' | 'view' | null.
export async function readSession(value) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [role, exp, sig] = parts;
  if (role !== 'edit' && role !== 'view') return null;
  if (!(Number(exp) > Date.now())) return null;
  return (await safeEqual(sig, await hmac(`${role}.${exp}`))) ? role : null;
}
