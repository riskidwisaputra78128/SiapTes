// Ringkasan papan peringkat (mingguan & bulanan) dalam 1 dokumen meta per periode.
// Setiap latihan selesai → skor pengguna di ringkasan langsung ditambah (increment), jadi membuka
// Peringkat cukup 1 kali baca, bukan membaca seluruh riwayat latihan bulan ini.
import crypto from 'node:crypto';
import { startOfWeekWIB, startOfMonthWIB } from './http.js';

export const PERIODS = ['week', 'month'];
const startOf = (period, ms) => (period === 'month' ? startOfMonthWIB(ms) : startOfWeekWIB(ms));
export const boardKey = (period, ms) => `lb-${period}-${startOf(period, ms)}`;
const fieldOf = uid => 'u' + crypto.createHash('sha1').update(String(uid)).digest('hex').slice(0, 20);
const shortName = n => String(n || 'Peserta').slice(0, 40);

// dipanggil setelah attempt tersimpan
export async function bumpBoards(db, a) {
  if (!a?.uid || !db.bumpBoard) return;
  const delta = { p: Number(a.points) || 0, q: Number(a.total) || 0, c: Number(a.correct) || 0, s: 1 };
  await Promise.all(PERIODS.map(p => db.bumpBoard(boardKey(p, a.createdAt || Date.now()), fieldOf(a.uid), { uid: a.uid, name: shortName(a.name) }, delta)
    .catch(e => console.warn('board bump:', e.message))));
  boardCache.clear();
}

// akun dihapus admin → keluarkan dari ringkasan periode berjalan
export async function dropFromBoards(db, uid, now = Date.now()) {
  await Promise.all(PERIODS.map(p => db.setMetaField(boardKey(p, now), fieldOf(uid), null).catch(() => {})));
  boardCache.clear();
}

// Dibaca bersama semua pengunjung: 1 kali baca Firestore per ±15 detik per server
const BOARD_TTL = 15000;
const boardCache = globalThis.__boardCache || (globalThis.__boardCache = new Map());
export async function readBoard(db, period, now = Date.now()) {
  const key = boardKey(period, now);
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_TTL) return hit.rows;
  let doc = await db.getMeta(key).catch(() => null);
  if (!doc || !doc.built) doc = await buildBoard(db, period, now, key);
  const rows = Object.entries(doc).filter(([k, v]) => k.startsWith('u') && v && typeof v === 'object')
    .map(([, v]) => ({ uid: v.uid, name: v.name, points: v.p || 0, questions: v.q || 0, correct: v.c || 0, sessions: v.s || 0 }));
  boardCache.set(key, { at: Date.now(), rows });
  return rows;
}

// Pertama kali (periode baru / sebelum fitur ini ada) → susun sekali dari riwayat latihan, lalu simpan
async function buildBoard(db, period, now, key) {
  const list = await db.listAttemptsSince(startOf(period, now));
  const doc = { built: true, at: Date.now() };
  for (const a of list) {
    const f = fieldOf(a.uid);
    const o = doc[f] || (doc[f] = { uid: a.uid, name: shortName(a.name), p: 0, q: 0, c: 0, s: 0 });
    o.p += Number(a.points) || 0; o.q += Number(a.total) || 0; o.c += Number(a.correct) || 0; o.s++; o.name = shortName(a.name);
  }
  await db.setMeta(key, doc).catch(e => console.warn('board build:', e.message));
  return doc;
}
