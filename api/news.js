// GET /api/news — berita terkini untuk dashboard + status sistem
import { handle, send } from './_lib/http.js';
import { getDB, firebaseEnabled } from './_lib/db.js';
import { aiEnabled } from './_lib/ai.js';
import { fetchHeadlines } from './_lib/news.js';

const CACHE_MS = 3 * 3600 * 1000;

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
  const last = await db.getMeta('lastGenerate').catch(() => null);
  let bank = 0;
  try { bank = await db.countQuestions(); } catch {}
  res.setHeader('Cache-Control', 'public, s-maxage=600');
  send(res, 200, {
    items: (news?.items || []).slice(0, 8),
    updatedAt: news?.at || null,
    status: { firebase: firebaseEnabled(), ai: aiEnabled(), generatedQuestions: bank, lastGenerate: last },
  });
});
