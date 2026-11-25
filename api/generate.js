// GET/POST /api/generate — buat soal baru dari berita terkini (Gemini)
// Dipanggil otomatis oleh Vercel Cron setiap hari (Authorization: Bearer CRON_SECRET)
// atau manual oleh admin (token login + email ada di ADMIN_EMAILS).
import crypto from 'node:crypto';
import { handle, send, httpError, query } from './_lib/http.js';
import { getUser, isAdmin } from './_lib/auth.js';
import { getDB } from './_lib/db.js';
import { aiEnabled, geminiJSON } from './_lib/ai.js';
import { NEWS_TOPICS, fetchHeadlines } from './_lib/news.js';

const CAT_LABEL = {
  bi: 'Bank Indonesia, kebijakan moneter & sistem pembayaran',
  ojk: 'OJK, regulasi & perlindungan konsumen jasa keuangan',
  bumn: 'BUMN, Danantara & tata kelola perusahaan negara',
  telkom: 'Telkom Indonesia, telekomunikasi & transformasi digital',
  keuangan: 'perbankan, LPS, pembayaran digital & literasi keuangan',
  isu: 'isu terkini ekonomi, sosial & kebijakan nasional',
  twk: 'wawasan kebangsaan, konstitusi, lembaga negara & hukum',
};
const DIFFS = ['easy', 'normal', 'hard', 'prof'];

function authorize(req) {
  const h = req.headers['authorization'] || '';
  if (process.env.CRON_SECRET && h === `Bearer ${process.env.CRON_SECRET}`) return 'cron';
  const u = getUser(req);
  if (u && isAdmin(u)) return 'admin:' + u.email;
  throw httpError(403, 'Hanya admin atau cron yang dapat membuat soal');
}

function validate(q, cat, headlines) {
  const diff = DIFFS.includes(q.difficulty) ? q.difficulty : 'normal';
  const src = headlines[Number(q.sourceIndex)] || null;
  const base = {
    category: cat, difficulty: diff, question: String(q.question || '').trim(),
    explanation: String(q.explanation || '').trim(),
    source: src ? { title: src.title, link: src.link, publisher: src.source, date: src.date } : null,
    createdAt: Date.now(), generated: true,
  };
  if (base.question.length < 15) return null;
  if (q.type === 'interactive') {
    const strs = arr => (Array.isArray(arr) ? arr.map(x => String(x || '').trim()).filter(Boolean) : []);
    if (q.kind === 'order') {
      const items = strs(q.items).slice(0, 7);
      if (items.length < 3 || new Set(items).size !== items.length) return null;
      return { ...base, type: 'interactive', kind: 'order', items, id: id(cat, base.question) };
    }
    if (q.kind === 'match') {
      const pairs = (q.pairs || []).map(p => ({ a: String(p?.a || '').trim(), b: String(p?.b || '').trim() })).filter(p => p.a && p.b).slice(0, 5);
      if (pairs.length < 3 || new Set(pairs.map(p => p.b)).size !== pairs.length) return null;
      return { ...base, type: 'interactive', kind: 'match', pairs, id: id(cat, base.question) };
    }
    return null;
  }
  if (q.type === 'essay') {
    const keyPoints = (q.keyPoints || []).map(String).filter(Boolean).slice(0, 6);
    if (keyPoints.length < 2) return null;
    return { ...base, type: 'essay', modelAnswer: String(q.modelAnswer || ''), keyPoints, id: id(cat, base.question) };
  }
  const options = (q.options || []).map(o => String(o).replace(/^[A-D][.)]\s*/, '').trim());
  const answer = Number(q.answer);
  if (options.length !== 4 || options.some(o => !o) || !(answer >= 0 && answer <= 3)) return null;
  return { ...base, type: 'pg', options, answer, id: id(cat, base.question) };
}

function id(cat, text) {
  return `n-${cat}-${crypto.createHash('sha1').update(text.toLowerCase()).digest('hex').slice(0, 12)}`;
}

async function generateFor(cat) {
  const lists = await Promise.all(NEWS_TOPICS[cat].map(q => fetchHeadlines(q, 6)));
  const seen = new Set();
  const headlines = lists.flat().filter(h => (seen.has(h.title) ? false : seen.add(h.title))).slice(0, 10);
  if (headlines.length < 2) return { cat, saved: 0, reason: 'berita tidak ditemukan', headlines: [] };

  const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long' });
  const out = await geminiJSON(`Kamu penyusun soal tes seleksi kerja Indonesia (CPNS SKD, BUMN/Rekrutmen Bersama, OJK, Bank Indonesia PCPM, Telkom).
Hari ini ${today}. Topik: ${CAT_LABEL[cat]}.

Berikut judul berita terbaru (index: judul — media):
${headlines.map((h, i) => `${i}: ${h.title} — ${h.source}`).join('\n')}

Buat 10 soal: 6 pilihan ganda (type "pg"), 2 esai (type "essay"), dan 2 soal interaktif (type "interactive").
Aturan:
- Dasarkan soal pada fakta yang JELAS dari judul berita di atas, digabung pengetahuan umum yang mapan (dasar hukum, fungsi lembaga, konsep ekonomi). Jangan mengarang angka/tanggal yang tidak ada di judul.
- Sebar tingkat kesulitan: easy, normal, hard, prof (prof = analisis/studi kasus tingkat lanjut).
- Pilihan ganda: tepat 4 opsi tanpa huruf di depan, satu jawaban benar, opsi pengecoh masuk akal, JANGAN pakai opsi "semua benar"/"semua salah".
- "explanation": 1-3 kalimat kenapa jawaban benar, sebut konteks beritanya.
- Esai: pertanyaan analitis, beri "keyPoints" (3-5 poin kunci) dan "modelAnswer" (4-6 kalimat).
- Interaktif #1 kind "match": 4 pasangan {"a","b"} yang saling cocok (mis. lembaga ↔ peran, istilah ↔ arti) terkait topik/berita; setiap "b" harus unik.
- Interaktif #2 kind "order": 4-6 langkah/kronologi/proses dalam URUTAN YANG BENAR di "items" (mis. alur kebijakan, tahapan proses), yang urutannya jelas dan tidak ambigu.
- "sourceIndex": index berita yang menjadi dasar soal.
Format JSON:
{"questions":[{"type":"pg","difficulty":"normal","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","sourceIndex":0},
{"type":"essay","difficulty":"hard","question":"...","keyPoints":["..."],"modelAnswer":"...","explanation":"...","sourceIndex":1},
{"type":"interactive","kind":"match","difficulty":"normal","question":"Cocokkan ...","pairs":[{"a":"...","b":"..."}],"explanation":"...","sourceIndex":2},
{"type":"interactive","kind":"order","difficulty":"hard","question":"Urutkan ...","items":["langkah 1","langkah 2","langkah 3","langkah 4"],"explanation":"...","sourceIndex":3}]}`);

  const qs = (out.questions || []).map(q => validate(q, cat, headlines)).filter(Boolean);
  const db = await getDB();
  const saved = qs.length ? await db.addQuestions(qs) : 0;
  return { cat, saved, headlines };
}

export default handle(['GET', 'POST'], async (req, res) => {
  const by = authorize(req);
  if (!aiEnabled()) throw httpError(400, 'GEMINI_API_KEY belum diatur. Tambahkan di Environment Variables Vercel.');

  const all = Object.keys(NEWS_TOPICS);
  const requested = query(req).get('cats');
  let cats;
  if (requested) cats = requested.split(',').filter(c => all.includes(c)).slice(0, 4);
  else {
    // Rotasi harian: 3 kategori + isu terkini, agar muat dalam batas waktu fungsi
    const dayIdx = Math.floor(Date.now() / 86400000);
    const rot = all.filter(c => c !== 'isu');
    cats = ['isu', ...[0, 1, 2].map(i => rot[(dayIdx * 3 + i) % rot.length])];
    cats = [...new Set(cats)];
  }

  const results = await Promise.allSettled(cats.map(generateFor));
  const summary = results.map((r, i) => r.status === 'fulfilled'
    ? { cat: r.value.cat, saved: r.value.saved, reason: r.value.reason }
    : { cat: cats[i], saved: 0, reason: String(r.reason?.message || r.reason).slice(0, 160) });

  const headlines = results.flatMap(r => (r.status === 'fulfilled' ? r.value.headlines.slice(0, 3).map(h => ({ ...h, cat: r.value.cat })) : []));
  const db = await getDB();
  const log = { at: Date.now(), by, summary, total: summary.reduce((s, x) => s + x.saved, 0) };
  await db.setMeta('lastGenerate', log);
  if (headlines.length) await db.setMeta('news', { at: Date.now(), items: headlines });
  send(res, 200, log);
});
