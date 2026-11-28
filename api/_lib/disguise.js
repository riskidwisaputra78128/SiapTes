// 🎭 Penyamaran opsi jawaban: mencegah jawaban benar ketahuan karena kalimatnya paling panjang/paling lengkap.
// 1) lenBias()   → ukur seberapa mencolok panjang jawaban benar dibanding pengecoh
// 2) qfix-<kat>  → opsi pengecoh hasil tulis ulang (Gemini) disimpan di meta, ditimpa saat soal dimuat
// 3) runDisguise → pekerjaan admin/cron: tulis ulang pengecoh soal yang masih mencolok, sedikit demi sedikit
import { geminiJSON } from './ai.js';

const optLen = o => String(o ?? '').trim().length;
/** Rasio panjang jawaban benar ÷ pengecoh terpanjang (1 = seimbang). */
export function lenBias(q) {
  if (q?.type !== 'pg' || !Array.isArray(q.options) || q.options.length < 3 || Array.isArray(q.scores)) return 0;
  const L = q.options.map(optLen), a = L[q.answer];
  const mx = Math.max(...L.filter((_, i) => i !== q.answer));
  if (!mx) return 0;
  return a <= mx ? a / mx : a / mx + (a - mx >= 8 ? 0 : -0.5);   // selisih sangat kecil (<8 huruf) tidak dianggap mencolok
}
/** Mencolok: jawaban benar ≥ 25% lebih panjang dari pengecoh terpanjang. */
export const isTell = q => lenBias(q) >= 1.25;

// ───── perbaikan tersimpan ─────
const FIX_TTL = 10 * 60 * 1000;
const fixCache = globalThis.__qfixCache || (globalThis.__qfixCache = new Map());
export async function fixesFor(db, cat) {
  const hit = fixCache.get(cat);
  if (hit && Date.now() - hit.at < FIX_TTL) return hit.map;
  const map = (await db.getMeta('qfix-' + cat).catch(() => null)) || {};
  fixCache.set(cat, { at: Date.now(), map });
  return map;
}
export function applyFix(q, map) {
  const f = map?.[q.id];
  if (!f || !Array.isArray(f.o) || f.o.length !== q.options?.length || f.a !== q.answer) return q;
  return { ...q, options: f.o, disguised: true };
}

// ───── pekerjaan penyamaran ─────
const PER_CALL = 8;
function prompt(batch) {
  return `Kamu editor bank soal tes seleksi Indonesia (CPNS, BUMN, OJK, BI, Telkom).
Masalah: pada soal di bawah, jawaban benar jauh LEBIH PANJANG/lengkap daripada opsi lain, sehingga peserta bisa menebak tanpa berpikir.
Tugasmu: tulis ulang HANYA opsi pengecoh (yang salah) agar:
- panjangnya setara dengan jawaban benar (selisih maks. ±15% jumlah karakter) dan gaya/struktur kalimatnya mirip;
- tetap SALAH dengan jelas bagi yang paham materi, tetapi masuk akal (bisa menjebak), memakai istilah yang relevan;
- tidak mengandung kata mutlak yang gampang ditebak salah ("selalu", "pasti", "tidak pernah") kecuali memang perlu;
- tidak mengulang/menyalin jawaban benar, tidak saling sama, tanpa huruf A/B/C di depan, bahasa Indonesia baku (atau bahasa Inggris bila soalnya berbahasa Inggris).
JANGAN mengubah jawaban benar dan JANGAN mengubah urutan pengecoh.

Soal:
${batch.map((q, i) => `#${i + 1}
Pertanyaan: ${q.question}
Jawaban benar (${optLen(q.options[q.answer])} karakter): ${q.options[q.answer]}
Pengecoh lama: ${q.options.filter((_, k) => k !== q.answer).map(o => JSON.stringify(String(o))).join(' | ')}`).join('\n\n')}

Balas JSON saja: {"items":[{"n":1,"distractors":["...","...","..."]}, ...]} — jumlah distractors tiap soal sama dengan jumlah pengecoh lama.`;
}
function merge(q, ds) {
  const wrongIdx = q.options.map((_, k) => k).filter(k => k !== q.answer);
  if (!Array.isArray(ds) || ds.length !== wrongIdx.length) return null;
  const clean = ds.map(d => String(d || '').replace(/^\s*[A-Ea-e][.)]\s+/, '').trim());
  const correct = String(q.options[q.answer]).trim().toLowerCase();
  if (clean.some(d => !d || d.length > 400 || d.toLowerCase() === correct) || new Set(clean.map(d => d.toLowerCase())).size !== clean.length) return null;
  const o = q.options.slice(); wrongIdx.forEach((k, j) => { o[k] = clean[j]; });
  const fixed = { ...q, options: o };
  return lenBias(fixed) <= 1.12 ? o : null;     // masih mencolok → tolak
}

/**
 * Kandidat: soal pilihan ganda yang jawabannya masih mencolok & belum pernah diperbaiki.
 * listAll(cat) → daftar soal (bank bawaan + soal AI) per kategori.
 */
export async function disguiseStatus(db, cats, listAll, { since = 0 } = {}) {
  let total = 0, tell = 0, fixed = 0;
  const todo = [];
  for (const cat of cats) {
    const map = await fixesFor(db, cat);
    for (const q of await listAll(cat)) {
      if (q.type !== 'pg' || Array.isArray(q.scores)) continue;
      total++;
      const cur = applyFix(q, map);
      if (cur.disguised) { fixed++; continue; }
      if (isTell(q)) { tell++; if (!(map[q.id]?.fail >= 2) && (!since || (q.createdAt || 0) >= since)) todo.push(q); }
    }
  }
  // soal hasil generate 3 hari terakhir didahulukan, lalu yang paling mencolok
  const recent = q => (q.createdAt || 0) > Date.now() - 3 * 86400000;
  todo.sort((a, b) => (recent(b) - recent(a)) || lenBias(b) - lenBias(a));
  return { total, tell, fixed, todo };
}

export async function runDisguise(db, { cats, listAll, deadline = Date.now() + 45000, maxCalls = 3, since = 0 }) {
  const st = await disguiseStatus(db, cats, listAll, { since });
  let done = 0, failed = 0, calls = 0, quota = false;
  const queue = st.todo.slice();
  while (queue.length && calls < maxCalls && deadline - Date.now() > 15000) {
    const batch = queue.splice(0, PER_CALL);
    calls++;
    let out;
    try { out = await geminiJSON(prompt(batch), { deadline, prefer: 'lite', feature: 'samarkan-opsi' }); }
    catch (e) { if (e.quota || e.status === 429) { quota = true; break; } failed += batch.length; continue; }
    const items = Array.isArray(out?.items) ? out.items : [];
    for (let i = 0; i < batch.length; i++) {
      const q = batch[i], it = items.find(x => +x.n === i + 1) || items[i];
      const o = it ? merge(q, it.distractors) : null;
      const cat = q.category || 'campuran';
      const prev = (await fixesFor(db, cat))[q.id];
      if (o) { await db.setMetaField('qfix-' + cat, q.id, { o, a: q.answer, at: Date.now() }); done++; }
      else { await db.setMetaField('qfix-' + cat, q.id, { fail: (prev?.fail || 0) + 1, at: Date.now() }); failed++; }
    }
    batch.forEach(q => fixCache.delete(q.category || 'campuran'));
  }
  return { fixed: done, failed, quota, remaining: Math.max(0, st.todo.length - done), tellBefore: st.tell, total: st.total, alreadyFixed: st.fixed + done };
}
