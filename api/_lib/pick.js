// Pemilihan soal bersama (dipakai /api/questions dan /api/duel)
import { getDB, dataVersion } from './db.js';
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
  const out = { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
  if (Array.isArray(q.scores)) out.scores = order.map(i => q.scores[i]);   // TKP: skor 1–5 ikut teracak
  return out;
}

// Kunci pendek soal (dipakai klien untuk mengingat soal yang sudah pernah keluar)
export const qkey = id => String(id || '').slice(-8);

/**
 * seen: daftar kunci pendek soal yang sudah pernah didapat pengguna (dari perangkatnya).
 * Soal yang belum pernah dilihat diutamakan; bila semua sudah pernah, diulang dari yang paling lama.
 */
// Daftar soal hasil AI per kategori disimpan sementara di memori server & dipakai bersama semua peserta.
// Tanpa ini, setiap sesi latihan membaca hingga 600 dokumen Firestore. Cache otomatis diganti bila
// ada soal baru/dihapus (versi data berubah) atau sudah 10 menit.
const Q_TTL = 10 * 60 * 1000;
const qCache = globalThis.__qListCache || (globalThis.__qListCache = new Map());
const qFlight = new Map();
async function cachedQuestions(category) {
  const db = await getDB();
  const ver = (await dataVersion(db))?.q || 0;
  const k = category || 'campuran', hit = qCache.get(k);
  if (hit && hit.ver === ver && Date.now() - hit.at < Q_TTL) return hit.list;
  const fk = k + '|' + ver;
  if (!qFlight.has(fk)) qFlight.set(fk, db.listQuestions({ category: k })
    .then(list => { qCache.set(k, { at: Date.now(), ver, list }); return list; })
    .finally(() => qFlight.delete(fk)));
  try { return await qFlight.get(fk); }
  catch (e) { if (hit?.list) return hit.list; throw e; }   // Firestore gagal → pakai salinan lama bila ada
}

export async function pickQuestions({ category = 'campuran', difficulty = 'all', type = 'pg', limit = 10, fresh = false, seen = [], only = null }) {
  let dbQs = [];
  try { dbQs = await cachedQuestions(category); } catch (e) { console.error('listQuestions', e.message); }
  const uniq = new Set();
  const pool = [...dbQs, ...SEED_QUESTIONS]
    .filter(q => q.type === type && (category === 'campuran' || q.category === category) && (!only || only(q)))
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
  // Interaktif: ratakan variasi cara mengerjakan (urutan, cocokkan, isi rumpang, benar/salah, dst.)
  if (type === 'interactive' && picked.length > 1) {
    const cands = [...picked, ...order(exact), ...order(pool)];
    const ids = new Set(), groups = new Map();
    for (const q of cands) { if (ids.has(q.id)) continue; ids.add(q.id); const k = q.kind || 'order'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    const lanes = shuffle([...groups.values()]), out = [];
    while (out.length < limit && lanes.some(l => l.length)) for (const l of lanes) { if (l.length && out.length < limit) out.push(l.shift()); }
    picked = out;
  }
  return { questions: shuffle(picked).map(shuffleOptions), available: exact.length, filled };
}

// Simulasi SKD CAT sesuai Kepmen PANRB 674/2026: TWK 30 + TIU 35 + TKP 45 (TKP hanya soal berskor 1–5), urut TWK → TIU → TKP
export const SKD_PLAN = [
  { key: 'twk', n: 30, max: 150, pass: 65 },
  { key: 'tiu', n: 35, max: 175, pass: 80 },
  { key: 'tkp', n: 45, max: 225, pass: 166 },
];
export async function pickSKD(seen = []) {
  const parts = await Promise.all(SKD_PLAN.map(p => pickQuestions({
    category: p.key, difficulty: 'all', type: 'pg', limit: p.n, seen,
    only: p.key === 'tkp' ? q => Array.isArray(q.scores) && q.scores.length === q.options.length : null,
  })));
  return {
    questions: parts.flatMap((r, i) => r.questions.map(q => ({ ...q, section: SKD_PLAN[i].key }))),
    plan: SKD_PLAN, minutes: 100,
  };
}
