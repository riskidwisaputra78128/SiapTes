// Pemilihan soal bersama (dipakai /api/questions dan /api/duel)
import { getDB } from './db.js';
import { SEED_QUESTIONS } from './seed.js';

export const DIFFS = ['easy', 'normal', 'hard', 'prof'];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function shuffleOptions(q) {
  if (q.type !== 'pg' || !Array.isArray(q.options) || q.noShuffle) return q;
  const order = shuffle(q.options.map((_, i) => i));
  return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
}

export async function pickQuestions({ category = 'campuran', difficulty = 'all', type = 'pg', limit = 10, fresh = false }) {
  let dbQs = [];
  try { dbQs = await (await getDB()).listQuestions({ category, type }); } catch (e) { console.error('listQuestions', e.message); }
  const seen = new Set();
  const pool = [...dbQs, ...SEED_QUESTIONS]
    .filter(q => q.type === type && (category === 'campuran' || q.category === category))
    .filter(q => (seen.has(q.id) ? false : seen.add(q.id)));
  const exact = difficulty === 'all' ? pool : pool.filter(q => q.difficulty === difficulty);
  const sortFresh = list => fresh
    ? [...shuffle(list.filter(q => q.source)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), ...shuffle(list.filter(q => !q.source))]
    : shuffle(list);
  let picked = sortFresh(exact).slice(0, limit);
  let filled = false;
  if (picked.length < limit && difficulty !== 'all') {
    const idx = DIFFS.indexOf(difficulty);
    const near = pool.filter(q => q.difficulty !== difficulty)
      .sort((a, b) => Math.abs(DIFFS.indexOf(a.difficulty) - idx) - Math.abs(DIFFS.indexOf(b.difficulty) - idx));
    picked = picked.concat(near.slice(0, limit - picked.length));
    filled = picked.length > exact.length;
  }
  return { questions: picked.map(shuffleOptions), available: exact.length, filled };
}
