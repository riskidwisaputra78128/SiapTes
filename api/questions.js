// GET /api/questions?category=bi&difficulty=normal&mode=pg|game|essay|interaktif&limit=10&fresh=1
import { handle, query, send } from './_lib/http.js';
import { getDB } from './_lib/db.js';
import { SEED_QUESTIONS } from './_lib/seed.js';

const DIFFS = ['easy', 'normal', 'hard', 'prof'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function shuffleOptions(q) {
  if (q.type !== 'pg' || !Array.isArray(q.options) || q.noShuffle) return q;
  const order = shuffle(q.options.map((_, i) => i));
  return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
}

export default handle(['GET'], async (req, res) => {
  const p = query(req);
  const category = p.get('category') || 'campuran';
  const difficulty = DIFFS.includes(p.get('difficulty')) ? p.get('difficulty') : 'all';
  const mode = p.get('mode') || 'pg';
  const type = mode === 'essay' ? 'essay' : mode === 'interaktif' ? 'interactive' : 'pg';
  const limit = Math.min(Math.max(parseInt(p.get('limit') || '10', 10) || 10, 1), 50);
  const fresh = p.get('fresh') === '1';

  let dbQs = [];
  try { dbQs = await (await getDB()).listQuestions({ category, type }); } catch (e) { console.error('listQuestions', e.message); }

  const seen = new Set();
  const pool = [...dbQs, ...SEED_QUESTIONS]
    .filter(q => q.type === type && (category === 'campuran' || q.category === category))
    .filter(q => (seen.has(q.id) ? false : seen.add(q.id)));

  const exact = difficulty === 'all' ? pool : pool.filter(q => q.difficulty === difficulty);
  // Prioritaskan soal berbasis berita terbaru (punya sumber) bila fresh=1
  const sortFresh = list => fresh
    ? [...shuffle(list.filter(q => q.source)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), ...shuffle(list.filter(q => !q.source))]
    : shuffle(list);

  let picked = sortFresh(exact).slice(0, limit);
  let filled = false;
  if (picked.length < limit && difficulty !== 'all') {
    // Lengkapi dengan level terdekat
    const idx = DIFFS.indexOf(difficulty);
    const near = pool.filter(q => q.difficulty !== difficulty)
      .sort((a, b) => Math.abs(DIFFS.indexOf(a.difficulty) - idx) - Math.abs(DIFFS.indexOf(b.difficulty) - idx));
    picked = picked.concat(near.slice(0, limit - picked.length));
    filled = picked.length > exact.length;
  }

  send(res, 200, {
    questions: picked.map(shuffleOptions),
    available: exact.length,
    filled,
  });
});
