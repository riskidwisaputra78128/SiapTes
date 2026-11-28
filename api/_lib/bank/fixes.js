// 🎭 Pengecoh hasil tulis ulang untuk soal inti yang jawabannya dulu ketahuan dari panjang kalimat.
// Tiap file: { idSoal: [pengecoh1, pengecoh2, ...] } — urutan sama dengan urutan opsi salah di soal asli.
import twk from './fix-twk.js';
import tkp from './fix-tkp.js';
import ojk from './fix-ojk.js';
import bi from './fix-bi.js';
import bumn from './fix-bumn.js';
import telkom from './fix-telkom.js';
import umum from './fix-umum.js';
import isu from './fix-isu.js';

const ALL = { ...twk, ...tkp, ...ojk, ...bi, ...bumn, ...telkom, ...umum, ...isu };

/** Ganti opsi pengecoh soal bawaan (jawaban benar & posisinya tidak berubah). */
export function applyStaticFixes(list) {
  for (const q of list) {
    const ds = ALL[q.id];
    if (!ds || q.type !== 'pg' || !Array.isArray(q.options)) continue;
    const wrong = q.options.map((_, i) => i).filter(i => i !== q.answer);
    if (ds.length !== wrong.length) continue;
    const o = q.options.slice(); wrong.forEach((i, j) => { o[i] = ds[j]; });
    q.options = o;
  }
  return list;
}
export const STATIC_FIX_COUNT = Object.keys(ALL).length;
