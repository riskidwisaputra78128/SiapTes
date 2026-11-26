// Bank soal bawaan (offline): ±100 soal per kategori — tetap bisa latihan walau Firebase/AI sedang tidak tersedia.
// Format per kategori (file ./<kategori>.js):
//   pg: [level, soal, [A,B,C,D], indexJawaban, pembahasan]
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
