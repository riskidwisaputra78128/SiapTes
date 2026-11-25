// Foto profil: disimpan di Firestore (koleksi "avatars") sebagai gambar kecil 256px.
// ID publik = hash dari uid, jadi uid/email asli tidak pernah terlihat di URL.
import crypto from 'node:crypto';

export function pidOf(uid) {
  const key = process.env.AUTH_SECRET || 'dev-secret-ganti-di-production';
  return crypto.createHmac('sha256', key).update('avatar:' + uid).digest('base64url').slice(0, 16);
}

let cache = null;
export async function avatarMap(db, fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < 20000) return cache.map;
  const map = (await db.getMeta('avatars').catch(() => null)) || {};
  cache = { at: Date.now(), map };
  return map;
}
export function bumpCache(pid, v) { if (cache) { if (v) cache.map[pid] = v; else delete cache.map[pid]; } }

export function avatarUrl(uid, map) {
  if (!uid) return null;
  const pid = pidOf(uid); const v = map?.[pid];
  return v ? `/api/avatar?id=${pid}&v=${v}` : null;
}
