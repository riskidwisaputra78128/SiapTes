// GET /api/news — berita terkini + jumlah bank soal (publik) + status sistem
import { handle, send, startOfDayWIB } from './_lib/http.js';
import { getDB, firebaseEnabled } from './_lib/db.js';
import { aiEnabled } from './_lib/ai.js';
import { fetchHeadlines } from './_lib/news.js';
import { SEED_QUESTIONS } from './_lib/seed.js';

const CACHE_MS = 3 * 3600 * 1000;
const CATS = ['twk', 'tiu', 'tkp', 'ojk', 'bi', 'bumn', 'telkom', 'keuangan', 'english', 'isu'];

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
  let news = await db.getMeta('news').catch(() => null);
  if (!news || Date.now() - news.at > CACHE_MS) {
    const [eco, fin, bumn] = await Promise.all([
      fetchHeadlines('ekonomi Indonesia', 3), fetchHeadlines('Bank Indonesia OJK', 3), fetchHeadlines('BUMN', 2),
    ]);
    const items = [...eco.map(h => ({ ...h, cat: 'isu' })), ...fin.map(h => ({ ...h, cat: 'bi' })), ...bumn.map(h => ({ ...h, cat: 'bumn' }))];
    if (items.length) { news = { at: Date.now(), items }; db.setMeta('news', news).catch(() => {}); }
  }
  const [last, bank] = await Promise.all([db.getMeta('lastGenerate').catch(() => null), questionBank(db)]);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  send(res, 200, {
    items: (news?.items || []).slice(0, 8),
    updatedAt: news?.at || null,
    bank,
    status: { firebase: firebaseEnabled(), ai: aiEnabled(), generatedQuestions: bank.generated, lastGenerate: last },
  });
});
