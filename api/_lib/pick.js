// Pemilihan soal bersama (dipakai /api/questions dan /api/duel)
import { getDB } from './db.js';
import { SEED_QUESTIONS } from './seed.js';

export const DIFFS = ['easy', 'normal', 'hard', 'prof'];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function shuffleOptions(q) {
  if (q.type !== 'pg' || !Array.isArray(q.options) || q.noShuffle) return q;
  const order = shuffle(q.options.map((_, i) => i));
  return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
}

// Kunci pendek soal (dipakai klien untuk mengingat soal yang sudah pernah keluar)
export const qkey = id => String(id || '').slice(-8);

/**
 * seen: daftar kunci pendek soal yang sudah pernah didapat pengguna (dari perangkatnya).
 * Soal yang belum pernah dilihat diutamakan; bila semua sudah pernah, diulang dari yang paling lama.
 */
export async function pickQuestions({ category = 'campuran', difficulty = 'all', type = 'pg', limit = 10, fresh = false, seen = [] }) {
  let dbQs = [];
  try { dbQs = await (await getDB()).listQuestions({ category, type }); } catch (e) { console.error('listQuestions', e.message); }
  const uniq = new Set();
  const pool = [...dbQs, ...SEED_QUESTIONS]
    .filter(q => q.type === type && (category === 'campuran' || q.category === category))
    .filter(q => (uniq.has(q.id) ? false : uniq.add(q.id)));
  // urutan "sudah dilihat": makin akhir di daftar = makin baru dilihat
  const seenRank = new Map(seen.map((k, i) => [k, i]));
  const order = list => {
    const unseen = list.filter(q => !seenRank.has(qkey(q.id)));
    const old = list.filter(q => seenRank.has(qkey(q.id))).sort((a, b) => seenRank.get(qkey(a.id)) - seenRank.get(qkey(b.id)));
    const head = fresh
      ? [...shuffle(unseen.filter(q => q.source)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), ...shuffle(unseen.filter(q => !q.source))]
      : shuffle(unseen);
    return [...head, ...old];                                // yang sudah dilihat paling lama → dipakai lebih dulu
  };
  const exact = difficulty === 'all' ? pool : pool.filter(q => q.difficulty === difficulty);
  let picked = order(exact).slice(0, limit);
  let filled = false;
  if (difficulty !== 'all') {
    const unseenExact = exact.filter(q => !seenRank.has(qkey(q.id))).length;
    // kurang soal, atau soal level ini yang belum dilihat sudah habis → lengkapi dari level terdekat (diacak)
    if (picked.length < limit || unseenExact < limit) {
      const idx = DIFFS.indexOf(difficulty);
      const rest = pool.filter(q => q.difficulty !== difficulty);
      const byDist = [1, 2, 3].flatMap(dd => order(rest.filter(q => Math.abs(DIFFS.indexOf(q.difficulty) - idx) === dd)));
      const freshNear = byDist.filter(q => !seenRank.has(qkey(q.id)));
      const keep = order(exact).filter(q => !seenRank.has(qkey(q.id)));
      const mix = [...keep, ...freshNear, ...order(exact).filter(q => seenRank.has(qkey(q.id))), ...byDist.filter(q => seenRank.has(qkey(q.id)))];
      const ids = new Set(); picked = mix.filter(q => (ids.has(q.id) ? false : ids.add(q.id))).slice(0, limit);
      filled = picked.some(q => q.difficulty !== difficulty);
    }
  }
  return { questions: shuffle(picked).map(shuffleOptions), available: exact.length, filled };
}
