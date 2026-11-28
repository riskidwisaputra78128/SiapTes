// Ringkasan papan peringkat (mingguan & bulanan) dalam 1 dokumen meta per periode.
// Setiap latihan selesai → skor pengguna di ringkasan langsung ditambah (increment), jadi membuka
// Peringkat cukup 1 kali baca, bukan membaca seluruh riwayat latihan bulan ini.
import crypto from 'node:crypto';
import { startOfWeekWIB, startOfMonthWIB } from './http.js';

export const PERIODS = ['week', 'month'];
const startOf = (period, ms) => (period === 'month' ? startOfMonthWIB(ms) : startOfWeekWIB(ms));
// Reset oleh admin: meta 'boardReset' { week: ts, month: ts }. Bila reset terjadi di periode berjalan,
// ringkasan pindah ke dokumen baru (kunci +"-r<ts>") yang hanya menghitung latihan setelah reset.
// Riwayat latihan (attempts) tidak dihapus, jadi Evaluasi pengguna tetap utuh.
const resetCache = globalThis.__boardReset || (globalThis.__boardReset = { at: 0, v: {} });
export async function resetMap(db, fresh = false) {
  if (!fresh && Date.now() - resetCache.at < 15000) return resetCache.v;
  resetCache.v = (await db.getMeta('boardReset').catch(() => null)) || {};
  resetCache.at = Date.now();
  return resetCache.v;
}
const sinceOf = (period, ms, resets = {}) => { const st = startOf(period, ms), r = Number(resets[period]) || 0; return r > st ? r : st; };
export const boardKey = (period, ms, resets = {}) => {
  const st = startOf(period, ms), r = Number(resets[period]) || 0;
  return `lb2-${period}-${st}` + (r > st ? `-r${r}` : '');
};
/** Admin: kosongkan papan peringkat periode berjalan ('week' | 'month' | 'all'). */
export async function resetBoards(db, which = 'all', now = Date.now()) {
  const periods = which === 'all' ? PERIODS : PERIODS.filter(p => p === which);
  for (const p of periods) await db.setMetaField('boardReset', p, now);
  resetCache.at = 0; boardCache.clear();
  return periods;
}
const fieldOf = uid => 'u' + crypto.createHash('sha1').update(String(uid)).digest('hex').slice(0, 20);
const shortName = n => String(n || 'Peserta').slice(0, 40);

// dipanggil setelah attempt tersimpan
export async function bumpBoards(db, a) {
  if (!a?.uid || !db.bumpBoard) return;
  const delta = { p: Number(a.points) || 0, q: Number(a.total) || 0, c: Number(a.correct) || 0, s: 1 };
  const resets = await resetMap(db);
  await Promise.all(PERIODS.map(p => db.bumpBoard(boardKey(p, a.createdAt || Date.now(), resets), fieldOf(a.uid), { uid: a.uid, name: shortName(a.name) }, delta)
    .catch(e => console.warn('board bump:', e.message))));
  boardCache.clear();
}

// akun dihapus admin → keluarkan dari ringkasan periode berjalan
export async function dropFromBoards(db, uid, now = Date.now()) {
  const resets = await resetMap(db);
  await Promise.all(PERIODS.map(p => db.setMetaField(boardKey(p, now, resets), fieldOf(uid), null).catch(() => {})));
  boardCache.clear();
}

// Dibaca bersama semua pengunjung: 1 kali baca Firestore per ±15 detik per server
const BOARD_TTL = 15000;
const boardCache = globalThis.__boardCache || (globalThis.__boardCache = new Map());
export async function readBoard(db, period, now = Date.now()) {
  const resets = await resetMap(db);
  const key = boardKey(period, now, resets);
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_TTL) return hit.rows;
  let doc = await db.getMeta(key).catch(() => null);
  if (!doc || !doc.built) doc = await buildBoard(db, period, now, key, sinceOf(period, now, resets));
  const rows = Object.entries(doc).filter(([k, v]) => k.startsWith('u') && v && typeof v === 'object')
    .map(([, v]) => ({ uid: v.uid, name: v.name, points: v.p || 0, questions: v.q || 0, correct: v.c || 0, sessions: v.s || 0 }));
  boardCache.set(key, { at: Date.now(), rows });
  return rows;
}

// Pertama kali (periode baru / sebelum fitur ini ada) → susun sekali dari riwayat latihan, lalu simpan
async function buildBoard(db, period, now, key, since) {
  const list = await db.listAttemptsSince(since || startOf(period, now));
  const doc = { built: true, at: Date.now() };
  for (const a of list) {
    const f = fieldOf(a.uid);
    const o = doc[f] || (doc[f] = { uid: a.uid, name: shortName(a.name), p: 0, q: 0, c: 0, s: 0 });
    o.p += Number(a.points) || 0; o.q += Number(a.total) || 0; o.c += Number(a.correct) || 0; o.s++; o.name = shortName(a.name);
  }
  await db.setMeta(key, doc).catch(e => console.warn('board build:', e.message));
  return doc;
}
