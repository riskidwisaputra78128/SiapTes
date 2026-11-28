// Pemilihan soal bersama (dipakai /api/questions dan /api/duel)
import { getDB, dataVersion } from './db.js';
import { SEED_QUESTIONS } from './seed.js';
import { fixesFor, applyFix, isTell } from './disguise.js';

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

/** Semua soal satu kategori (bank bawaan + soal AI), tanpa duplikat — dipakai juga oleh fitur Samarkan opsi. */
export async function listAll(cat) {
  let dbQs = [];
  try { dbQs = await cachedQuestions(cat); } catch {}
  const uniq = new Set();
  return [...dbQs, ...SEED_QUESTIONS].filter(q => q.category === cat && (uniq.has(q.id) ? false : uniq.add(q.id)));
}

export async function pickQuestions({ category = 'campuran', difficulty = 'all', type = 'pg', limit = 10, fresh = false, seen = [], only = null }) {
  let dbQs = [];
  try { dbQs = await cachedQuestions(category); } catch (e) { console.error('listQuestions', e.message); }
  const uniq = new Set();
  let pool = [...dbQs, ...SEED_QUESTIONS]
    .filter(q => q.type === type && (category === 'campuran' || q.category === category) && (!only || only(q)))
    .filter(q => (uniq.has(q.id) ? false : uniq.add(q.id)));
  // opsi pengecoh yang sudah disamarkan (tulis ulang AI) menimpa opsi lama
  if (type === 'pg') {
    const db = await getDB().catch(() => null);
    const cats = [...new Set(pool.map(q => q.category))];
    const maps = db ? Object.fromEntries(await Promise.all(cats.map(async c => [c, await fixesFor(db, c).catch(() => ({}))]))) : {};
    for (let i = 0; i < pool.length; i++) pool[i] = applyFix(pool[i], maps[pool[i].category]);
  }
  // soal yang jawabannya masih ketahuan dari panjang kalimat → dipakai paling akhir
  const fair = list => [...shuffle(list.filter(q => !isTell(q))), ...shuffle(list.filter(q => isTell(q)))];
  // urutan "sudah dilihat": makin akhir di daftar = makin baru dilihat
  const seenRank = new Map(seen.map((k, i) => [k, i]));
  const order = list => {
    const unseen = list.filter(q => !seenRank.has(qkey(q.id)));
    const old = list.filter(q => seenRank.has(qkey(q.id))).sort((a, b) => seenRank.get(qkey(a.id)) - seenRank.get(qkey(b.id)));
    const head = fresh
      ? [...shuffle(unseen.filter(q => q.source)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), ...fair(unseen.filter(q => !q.source))]
      : fair(unseen);
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

// ───── Simulasi seleksi ─────
// skd    : SKD CPNS sesuai Kepmen PANRB 674/2026 — TWK 30 + TIU 35 + TKP 45 (TKP hanya soal berskor 1–5)
// bi     : pola seleksi PCPM Bank Indonesia — Potensi Dasar + Pengetahuan Teknis (kebanksentralan, pengetahuan umum, bahasa Inggris)
// ojk    : pola seleksi PCAM OJK — Tes Potensi Dasar + Tes Kemampuan Umum (jasa keuangan, bahasa Inggris, isu)
// telkom : pola tes online Telkom / Rekrutmen Bersama BUMN — TKD, AKHLAK, TWK, bidang, bahasa Inggris
const scored = q => Array.isArray(q.scores) && q.scores.length === q.options.length;
// ix: jumlah soal INTERAKTIF (urutkan, cocokkan, isi rumpang, benar/salah, dst.) di bagian itu — seperti tes online
// BI/OJK/BUMN masa kini. Total soal per bagian tetap; sisanya pilihan ganda. CPNS (SKD) tetap pilihan ganda penuh.
export const SIM_PLANS = {
  skd: [{ key: 'twk', cats: [['twk', 30]] }, { key: 'tiu', cats: [['tiu', 35]] }, { key: 'tkp', cats: [['tkp', 45]], only: scored }],
  bi: [{ key: 'tpd', cats: [['tiu', 30]], ix: 4 }, { key: 'bank', cats: [['bi', 25]], ix: 4 }, { key: 'umum', cats: [['isu', 8], ['keuangan', 7]], ix: 2 }, { key: 'eng', cats: [['english', 20]], ix: 3 }],
  ojk: [{ key: 'tpd', cats: [['tiu', 30]], ix: 4 }, { key: 'sjk', cats: [['ojk', 20], ['keuangan', 10]], ix: 5 }, { key: 'eng', cats: [['english', 15]], ix: 2 }, { key: 'isu', cats: [['isu', 10]], ix: 2 }],
  telkom: [{ key: 'tkd', cats: [['tiu', 40]], ix: 5 }, { key: 'akhlak', cats: [['bumn', 30]], ix: 4 }, { key: 'twk', cats: [['twk', 10]], ix: 1 }, { key: 'bidang', cats: [['telkom', 20]], ix: 3 }, { key: 'eng', cats: [['english', 10]], ix: 2 }],
};
export async function pickSim(exam, seen = []) {
  const plan = SIM_PLANS[exam];
  if (!plan) return null;
  const parts = await Promise.all(plan.map(async p => {
    const total = p.cats.reduce((a, [, n]) => a + n, 0);
    const lists = await Promise.all(p.cats.map(async ([category, n]) => {
      // bagi kuota interaktif sebanding jumlah soal tiap kategori di bagian ini
      const want = p.ix ? Math.round((p.ix * n) / total) : 0;
      const ix = want ? (await pickQuestions({ category, difficulty: 'all', type: 'interactive', limit: want, seen })).questions : [];
      const pg = await pickQuestions({ category, difficulty: 'all', type: 'pg', limit: n - ix.length, seen, only: p.only || null });
      return [...pg.questions, ...ix];
    }));
    return shuffle(lists.flat()).map(q => ({ ...q, section: p.key }));
  }));
  return { exam, questions: parts.flat() };
}
export const pickSKD = seen => pickSim('skd', seen);
