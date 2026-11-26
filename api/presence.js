// Status online pengguna
// POST /api/presence { page, duel?, hidden? }  → heartbeat (±45 dtk sekali) + daftar yang online
// GET  /api/presence                           → daftar yang online (tamu hanya mendapat jumlah)
import { handle, readBody, send, query, httpError } from './_lib/http.js';
import { avatarRoute } from './_lib/avatar-route.js';
import { feedbackRoute } from './_lib/feedback-route.js';

// Pengaturan situs (khusus admin): tema default untuk pengguna yang belum memilih tema sendiri
const THEME_KEYS = ['dark', 'light', 'dongeng', 'modern', 'senja', 'fajar', 'malam', 'pagi', 'sakura', 'pro'];
const settingsRoute = handle(['POST'], async (req, res) => {
  if (!isAdmin(requireUser(req))) throw httpError(403, 'Khusus admin');
  const b = await readBody(req);
  const patch = {};
  if (b.defaultTheme !== undefined) { if (!THEME_KEYS.includes(b.defaultTheme)) throw httpError(400, 'Tema tidak dikenal'); patch.defaultTheme = b.defaultTheme; }
  if (b.tutorEnabled !== undefined) patch.tutorEnabled = !!b.tutorEnabled;
  if (b.tutorDaily !== undefined) { const n = parseInt(b.tutorDaily, 10); if (!(n >= 1 && n <= 200)) throw httpError(400, 'Batas harian 1–200'); patch.tutorDaily = n; }
  if (!Object.keys(patch).length) throw httpError(400, 'Tidak ada pengaturan yang diubah');
  const db = await getDB();
  const cur = (await db.getMeta('settings').catch(() => null)) || {};
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  await db.setMeta('settings', next);
  send(res, 200, { ok: true, ...patch });
});
import { getUser, requireUser, isAdmin } from './_lib/auth.js';
import { getDB } from './_lib/db.js';
import { avatarMap, avatarUrl } from './_lib/avatar.js';

const ONLINE_MS = 2.5 * 60 * 1000;
const PAGES = ['beranda', 'latihan', 'quiz', 'hasil', 'materi', 'duel', 'evaluasi', 'peringkat', 'profil', 'teknologi', 'kantor'];

async function onlineList(db, meUid) {
  const now = Date.now();
  const [all, avs] = await Promise.all([db.listPresence(now - ONLINE_MS), avatarMap(db)]);
  const list = all.filter(p => !p.hidden);
  return list
    .sort((a, b) => (b.uid === meUid) - (a.uid === meUid) || b.lastSeen - a.lastSeen)
    .map(p => ({
      name: p.name, avatar: avatarUrl(p.uid, avs), target: p.target || '', page: p.page, me: p.uid === meUid,
      duel: p.duel || null, since: p.since, idleSec: Math.round((now - p.lastSeen) / 1000),
    }));
}

const presenceRoute = handle(['GET', 'POST'], async (req, res) => {
  const db = await getDB();
  if (req.method === 'GET') {
    const me = getUser(req);
    const list = await onlineList(db, me?.uid);
    return send(res, 200, me ? { count: list.length, users: list } : { count: list.length });
  }
  const user = requireUser(req);
  const b = await readBody(req);
  const now = Date.now();
  if (b.hidden) await db.deletePresence(user.uid);
  else {
    const duel = b.duel && /^[A-Z0-9]{6}$/.test(b.duel) ? b.duel : null;
    await db.setPresence(user.uid, {
      name: String(user.name || 'Peserta').split(' ').slice(0, 2).join(' ').slice(0, 24),
      target: String(user.target || '').slice(0, 30),
      page: PAGES.includes(b.page) ? b.page : 'beranda',
      duel, lastSeen: now, since: Number(b.since) > now - 12 * 3600e3 && Number(b.since) <= now ? Number(b.since) : now, hidden: false,
    });
  }
  const list = await onlineList(db, user.uid);
  send(res, 200, { count: list.length, users: list, hidden: !!b.hidden });
});

// Foto profil ikut di endpoint ini agar total function tetap 12 (batas paket Hobby)
export default function (req, res) {
  const q = query(req);
  if (q.get('op') === 'feedback') return feedbackRoute(req, res);
  if (q.get('op') === 'settings') return settingsRoute(req, res);
  return q.get('avatar') || q.get('op') === 'avatar' ? avatarRoute(req, res) : presenceRoute(req, res);
}
