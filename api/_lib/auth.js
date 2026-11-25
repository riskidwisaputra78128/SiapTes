import crypto from 'node:crypto';
import { httpError } from './http.js';

const TOKEN_DAYS = 14;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.VERCEL_ENV === 'production') throw httpError(500, 'AUTH_SECRET belum diatur di Vercel');
    return 'dev-secret-ganti-di-production';
  }
  return s;
}

export function signToken(user) {
  const payload = {
    uid: user.uid, name: user.name, email: user.email, target: user.target || '',
    exp: Date.now() + TOKEN_DAYS * 86400000,
  };
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  return `${p}.${s}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [p, s] = token.split('.');
  if (!p || !s) return null;
  const expected = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  const a = Buffer.from(s), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); } catch { return null; }
  if (!data.exp || Date.now() > data.exp) return null;
  return data;
}

export function getUser(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || '';
  return verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}

export function requireUser(req) {
  const u = getUser(req);
  if (!u) throw httpError(401, 'Sesi berakhir, silakan masuk lagi');
  return u;
}

export function isAdmin(u) {
  if (!u) return false;
  const list = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(String(u.email || '').toLowerCase());
}

// Hash untuk mode dev (tanpa Apps Script). Di production, hash dilakukan di Apps Script.
export function devHash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 50000, 32, 'sha256').toString('hex');
}
