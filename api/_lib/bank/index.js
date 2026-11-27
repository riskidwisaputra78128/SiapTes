// Bank soal bawaan (offline): ±100 soal per kategori — tetap bisa latihan walau Firebase/AI sedang tidak tersedia.
// Format per kategori (file ./<kategori>.js):
//   pg: [level, soal, [A,B,C,D(,E)], indexJawaban, pembahasan]
//   es: [level, soal, [poin kunci], jawabanAcuan]
//   ix: [level, jenis, soal, data, pembahasan]   jenis: order | match | fill | tf | odd | sort
// level: e = easy, n = normal, h = hard, p = prof
import twk from './twk.js';
import tiu from './tiu.js';
import tkp from './tkp.js';
import ojk from './ojk.js';
import bi from './bi.js';
import bumn from './bumn.js';
import telkom from './telkom.js';
import keuangan from './keuangan.js';
import english from './english.js';
import isu from './isu.js';
import psikologi from './psikologi.js';
import twk26 from './twk-2026.js';
import tiu26 from './tiu-2026.js';
import tkp26 from './tkp-2026.js';

const LV = { e: 'easy', n: 'normal', h: 'hard', p: 'prof' };
const SETS = { twk, tiu, tkp, ojk, bi, bumn, telkom, keuangan, english, isu, psikologi };

export const BANK = [];
for (const [cat, set] of Object.entries(SETS)) {
  (set.pg || []).forEach(([d, question, options, answer, explanation], i) =>
    BANK.push({ id: `b-${cat}-p${i + 1}`, type: 'pg', category: cat, difficulty: LV[d] || 'normal', question, options, answer, explanation }));
  (set.es || []).forEach(([d, question, keyPoints, modelAnswer], i) =>
    BANK.push({ id: `b-${cat}-e${i + 1}`, type: 'essay', category: cat, difficulty: LV[d] || 'normal', question, keyPoints, modelAnswer, explanation: '' }));
  (set.ix || []).forEach(([d, kind, question, data, explanation], i) =>
    BANK.push({ id: `b-${cat}-i${i + 1}`, type: 'interactive', kind, category: cat, difficulty: LV[d] || 'normal', question, ...data, explanation }));
}

// Soal inti CPNS sesuai kisi-kisi Kepmen PANRB 674/2026 (SKD 2026)
//   tkp5: [level, soal, [5 pilihan urut skor 5→1], pembahasan] → setiap pilihan punya skor 1–5 (seperti CAT BKN)
const SKD26 = { twk: twk26, tiu: tiu26, tkp: tkp26 };
for (const [cat, set] of Object.entries(SKD26)) {
  (set.pg || []).forEach(([d, question, options, answer, explanation], i) =>
    BANK.push({ id: `b-${cat}-k26p${i + 1}`, type: 'pg', category: cat, difficulty: LV[d] || 'normal', question, options: [...options], answer, explanation, skd26: true }));
  (set.tkp5 || []).forEach(([d, question, options, explanation], i) =>
    BANK.push({ id: `b-${cat}-k26s${i + 1}`, type: 'pg', category: cat, difficulty: LV[d] || 'normal', question, options: [...options], answer: 0, scores: [5, 4, 3, 2, 1], explanation, skd26: true }));
}
