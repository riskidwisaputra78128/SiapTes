// GET /api/questions?category=bi&difficulty=normal&mode=pg|game|essay|interaktif&limit=10&fresh=1
import { handle, query, send } from './_lib/http.js';
import { pickQuestions, DIFFS } from './_lib/pick.js';

export default handle(['GET'], async (req, res) => {
  const p = query(req);
  const mode = p.get('mode') || 'pg';
  const result = await pickQuestions({
    category: p.get('category') || 'campuran',
    difficulty: DIFFS.includes(p.get('difficulty')) ? p.get('difficulty') : 'all',
    type: mode === 'essay' ? 'essay' : mode === 'interaktif' ? 'interactive' : 'pg',
    limit: Math.min(Math.max(parseInt(p.get('limit') || '10', 10) || 10, 1), 50),
    fresh: p.get('fresh') === '1',
  });
  send(res, 200, result);
});
