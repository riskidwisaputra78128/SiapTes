// GET /api/news — berita terkini + jumlah bank soal (publik) + status sistem
import { handle, send, startOfDayWIB } from './_lib/http.js';
import { getDB, firebaseEnabled } from './_lib/db.js';
import { aiEnabled, aiModelsInfo } from './_lib/ai.js';
import { fetchHeadlines, backupAll, CAT_KEYWORDS } from './_lib/news.js';
import { imageForNews } from './_lib/ogimage.js';
import { SEED_QUESTIONS } from './_lib/seed.js';

const CACHE_MS = 3 * 3600 * 1000;
const CATS = ['twk', 'tiu', 'tkp', 'ojk', 'bi', 'bumn', 'telkom', 'keuangan', 'english', 'isu', 'psikologi'];

async function questionBank(db) {
  const seedBy = {};
  for (const q of SEED_QUESTIONS) seedBy[q.category] = (seedBy[q.category] || 0) + 1;
  let genBy = {}, today = 0, generated = 0;
  try {
    const counts = await Promise.all(CATS.map(c => db.countQuestions({ category: c })));
    CATS.forEach((c, i) => (genBy[c] = counts[i]));
    generated = counts.reduce((a, b) => a + b, 0);
    today = await db.countQuestions({ sinceMs: startOfDayWIB(Date.now()) });
  } catch (e) { console.error('count', e.message); }
  const byCategory = Object.fromEntries(CATS.map(c => [c, (seedBy[c] || 0) + (genBy[c] || 0)]));
  return {
    total: SEED_QUESTIONS.length + generated,
    seed: SEED_QUESTIONS.length,
    generated,
    today,
    byCategory: { ...byCategory, campuran: SEED_QUESTIONS.length + generated },
  };
}

export default handle(['GET'], async (req, res) => {
  const db = await getDB();
  let news = await db.getMeta('news3').catch(() => null);
  if (!news || Date.now() - news.at > CACHE_MS) {
    const [eco, fin, bumn, extra] = await Promise.all([
      fetchHeadlines('ekonomi Indonesia', 4), fetchHeadlines('Bank Indonesia OJK', 3), fetchHeadlines('BUMN', 2),
      backupAll().catch(() => []),
    ]);
    // Berita bergambar (ANTARA, CNBC) diutamakan; Google News sebagai pelengkap
    const kw = [...CAT_KEYWORDS.bi, ...CAT_KEYWORDS.ojk, ...CAT_KEYWORDS.bumn, ...CAT_KEYWORDS.keuangan, 'ekonomi', 'ihsg', 'saham', 'pajak', 'apbn', 'investasi', 'ekspor', 'impor'];
    const pics = extra.filter(i => i.image && Date.now() - i.date < 2 * 86400000)
      .sort((a, b) => (kw.some(k => b.title.toLowerCase().includes(k)) - kw.some(k => a.title.toLowerCase().includes(k))) || b.date - a.date)
      .slice(0, 5).map(h => ({ ...h, cat: 'isu' }));
    const g = [...eco.map(h => ({ ...h, cat: 'isu' })), ...fin.map(h => ({ ...h, cat: 'bi' })), ...bumn.map(h => ({ ...h, cat: 'bumn' }))];
    const seen = new Set();
    const items = [...pics, ...g].filter(i => { const k = i.title.toLowerCase().slice(0, 50); return seen.has(k) ? false : seen.add(k); })
      .sort((a, b) => b.date - a.date).slice(0, 10);
    // berita tanpa foto (Google News) → ambil foto dari artikel aslinya
    const timer = new Promise(r => setTimeout(r, 7000));
    await Promise.all(items.slice(0, 6).map(async it => {
      if (it.image) return;
      const img = await Promise.race([imageForNews(it, extra).catch(() => null), timer.then(() => null)]);
      if (img) it.image = img;
    }));
    if (items.length) { news = { at: Date.now(), items }; db.setMeta('news3', news).catch(() => {}); }
  }
  const [last, bank, settings, mats] = await Promise.all([db.getMeta('lastGenerate').catch(() => null), questionBank(db), db.getMeta('settings').catch(() => null), db.listMaterials(90).catch(() => [])]);
  // ringkasan update hari ini (untuk pop-up harian setelah login)
  const sod = startOfDayWIB(Date.now());
  const newMats = mats.filter(m => m.title && m.createdAt >= sod);
  const daily = {
    day: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
    materials: newMats.length,
    materialTitles: newMats.slice(0, 3).map(m => ({ id: m.id, title: m.title, category: m.category })),
    news: (news?.items || []).filter(i => i.date >= sod - 6 * 3600e3).length,
    newsTitles: (news?.items || []).slice(0, 3).map(i => i.title),
    questions: bank.today,
    sinceMs: sod,
  };
  const models = new URL(req.url, 'http://x').searchParams.get('fresh') && aiEnabled() ? await aiModelsInfo().catch(() => null) : undefined;
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
  send(res, 200, {
    items: (news?.items || []).slice(0, 10),
    updatedAt: news?.at || null,
    bank,
    daily,
    settings: { defaultTheme: settings?.defaultTheme || 'dark', tutorEnabled: settings?.tutorEnabled !== false, tutorDaily: settings?.tutorDaily || 20 },
    status: { firebase: firebaseEnabled(), ai: aiEnabled(), generatedQuestions: bank.generated, lastGenerate: last, models },
  });
});
