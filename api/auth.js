// POST /api/auth
//   { action: 'login'|'register', name?, email, password, target? }
//   { action: 'forgot', email }                    → kirim kode reset ke email
//   { action: 'reset', email, code, password }     → ganti kata sandi & langsung masuk
//   ADMIN (token admin): { action: 'admin-list' } · { action: 'admin-delete', email } · { action: 'admin-password', email, password }
// Akun disimpan & divalidasi oleh Google Apps Script + Google Sheet (env GAS_URL + GAS_API_KEY).
// Vercel lalu menerbitkan token bertanda tangan (HMAC) untuk akses API lain.
import crypto from 'node:crypto';
import { handle, readBody, send, httpError } from './_lib/http.js';
import { signToken, isAdmin, devHash, requireUser, revokeSessions } from './_lib/auth.js';
import { pidOf } from './_lib/avatar.js';
import { avatarMap, avatarUrl } from './_lib/avatar.js';
import { getDB } from './_lib/db.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACTIONS = ['login', 'register', 'forgot', 'reset'];

async function callGAS(payload) {
  const r = await fetch(process.env.GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, apiKey: process.env.GAS_API_KEY }),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch {
    throw httpError(502, 'Server akun (Apps Script) tidak merespons dengan benar. Cek deployment Web App.');
  }
}

// ───── Kelola akun (khusus admin) ─────
async function accountStore(payload) {
  if (process.env.GAS_URL) return callGAS(payload);
  if (process.env.VERCEL_ENV === 'production') throw httpError(500, 'GAS_URL belum diatur di Vercel');
  const users = (await getDB()).users;
  if (payload.action === 'adminList') return { ok: true, users: [...users.values()].map(u => ({ uid: u.uid, name: u.name, email: u.email, target: u.target || '', createdAt: u.createdAt || null, lastLogin: u.lastLogin || null, loginCount: u.loginCount || 0, status: 'active' })) };
  const u = users.get(payload.email);
  if (!u) return { ok: false, error: 'Akun tidak ditemukan' };
  if (payload.action === 'adminDelete') { users.delete(payload.email); return { ok: true, user: { uid: u.uid, name: u.name, email: u.email } }; }
  if (payload.action === 'adminSetPassword') { const salt = crypto.randomBytes(16).toString('hex'); Object.assign(u, { salt, hash: devHash(payload.newPassword, salt) }); return { ok: true, user: { uid: u.uid, name: u.name, email: u.email } }; }
  return { ok: false, error: 'Aksi tidak dikenal' };
}
async function adminAction(req, res, b) {
  const admin = requireUser(req);
  if (!isAdmin(admin)) throw httpError(403, 'Khusus admin');
  const db = await getDB();
  if (b.action === 'admin-list') {
    const r = await accountStore({ action: 'adminList' });
    if (!r?.ok) throw httpError(502, r?.error || 'Gagal mengambil daftar akun. Pastikan Code.gs Apps Script sudah diperbarui & di-deploy ulang.');
    const [avs, online] = await Promise.all([avatarMap(db).catch(() => ({})), db.listPresence(Date.now() - 150000).catch(() => [])]);
    const on = new Set(online.map(p => p.uid));
    const users = r.users.map(u => ({ ...u, admin: isAdmin(u), me: u.email === String(admin.email).toLowerCase(), avatar: avatarUrl(u.uid, avs), online: on.has(u.uid) }))
      .sort((a, b) => (b.lastLogin || b.createdAt || 0) - (a.lastLogin || a.createdAt || 0));
    return send(res, 200, { users, total: users.length });
  }
  const email = String(b.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw httpError(400, 'Email akun tidak valid');
  if (b.action === 'admin-delete') {
    if (email === String(admin.email).toLowerCase()) throw httpError(400, 'Kamu tidak bisa menghapus akunmu sendiri');
    if (isAdmin({ email })) throw httpError(400, 'Akun admin tidak bisa dihapus dari sini (atur lewat ADMIN_EMAILS di Vercel)');
    const r = await accountStore({ action: 'adminDelete', email, by: admin.email });
    if (!r?.ok) throw httpError(400, r?.error || 'Gagal menghapus akun. Pastikan Code.gs Apps Script sudah diperbarui & di-deploy ulang.');
    const uid = r.user.uid;
    // bersihkan jejak di website: sesi aktif, riwayat latihan/peringkat, status online, foto profil
    const [attempts] = await Promise.all([
      db.deleteAttemptsByUser(uid).catch(() => 0),
      revokeSessions(db, uid),
      db.deletePresence(uid).catch(() => {}),
      db.deleteAvatar(pidOf(uid)).catch(() => {}),
    ]);
    return send(res, 200, { ok: true, deleted: r.user, attempts });
  }
  if (b.action === 'admin-password') {
    const pw = String(b.password || '');
    if (pw.length < 6) throw httpError(400, 'Kata sandi baru minimal 6 karakter');
    const r = await accountStore({ action: 'adminSetPassword', email, newPassword: pw, by: admin.email });
    if (!r?.ok) throw httpError(400, r?.error || 'Gagal mengganti kata sandi. Pastikan Code.gs Apps Script sudah diperbarui & di-deploy ulang.');
    // sesi lama pemilik akun dikeluarkan (kecuali admin mengganti sandinya sendiri)
    if (email !== String(admin.email).toLowerCase()) await revokeSessions(db, r.user.uid);
    return send(res, 200, { ok: true, user: r.user });
  }
  throw httpError(400, 'Aksi admin tidak dikenal');
}

// Mode dev lokal (tanpa Apps Script): akun di memori
async function devAuth(db, { action, name, email, password, target, code }) {
  const users = db.users;
  const codes = (globalThis.__slCodes ||= new Map());
  if (action === 'register') {
    if (users.has(email)) return { ok: false, error: 'Email sudah terdaftar' };
    const salt = crypto.randomBytes(16).toString('hex');
    const user = { uid: 'u_' + crypto.randomBytes(6).toString('hex'), name, email, target };
    users.set(email, { ...user, salt, hash: devHash(password, salt), createdAt: Date.now(), lastLogin: Date.now(), loginCount: 1 });
    return { ok: true, user };
  }
  if (action === 'forgot') {
    if (!users.has(email)) return { ok: true };
    const c = String(100000 + crypto.randomInt(900000));
    codes.set(email, { c, exp: Date.now() + 900000 });
    console.log(`[dev] kode reset untuk ${email}: ${c}`);
    return { ok: true, devCode: c };
  }
  if (action === 'reset') {
    const rec = codes.get(email);
    if (!rec || rec.exp < Date.now()) return { ok: false, error: 'Kode sudah kedaluwarsa. Minta kode baru.' };
    if (rec.c !== code) return { ok: false, error: 'Kode salah' };
    const u = users.get(email); const salt = crypto.randomBytes(16).toString('hex');
    Object.assign(u, { salt, hash: devHash(password, salt) }); codes.delete(email);
    return { ok: true, user: { uid: u.uid, name: u.name, email: u.email, target: u.target } };
  }
  const u = users.get(email);
  if (!u || devHash(password, u.salt) !== u.hash) return { ok: false, error: 'Email atau kata sandi salah' };
  u.lastLogin = Date.now(); u.loginCount = (u.loginCount || 0) + 1;
  return { ok: true, user: { uid: u.uid, name: u.name, email: u.email, target: u.target } };
}

export default handle(['POST'], async (req, res) => {
  const b = await readBody(req);
  if (String(b.action || '').startsWith('admin-')) return adminAction(req, res, b);
  const action = ACTIONS.includes(b.action) ? b.action : 'login';
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const name = String(b.name || '').trim().slice(0, 60);
  const target = String(b.target || '').slice(0, 40);
  const code = String(b.code || '').replace(/\D/g, '').slice(0, 6);

  if (!EMAIL_RE.test(email)) throw httpError(400, 'Format email tidak valid');
  if (action !== 'forgot' && password.length < 6) throw httpError(400, 'Kata sandi minimal 6 karakter');
  if (action === 'register' && name.length < 2) throw httpError(400, 'Nama minimal 2 karakter');
  if (action === 'reset' && code.length !== 6) throw httpError(400, 'Kode harus 6 digit');

  const payload = { action, name, email, password, target, code };
  let result;
  if (process.env.GAS_URL) {
    result = await callGAS(payload);
  } else {
    if (process.env.VERCEL_ENV === 'production') throw httpError(500, 'GAS_URL belum diatur di Vercel');
    result = await devAuth(await getDB(), payload);
  }
  if (!result || !result.ok) throw httpError(action === 'login' ? 401 : 400, result?.error || 'Gagal memproses akun');

  if (action === 'forgot') {
    return send(res, 200, {
      sent: true,
      message: 'Jika email terdaftar, kode 6 digit sudah dikirim. Cek juga folder Spam.',
      ...(result.devCode && process.env.VERCEL_ENV !== 'production' ? { devCode: result.devCode } : {}),
    });
  }
  const user = result.user;
  const avatar = avatarUrl(user.uid, await avatarMap(await getDB()).catch(() => ({})));
  send(res, 200, { token: signToken(user), user: { ...user, admin: isAdmin(user), avatar } });
});
