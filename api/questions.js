// GET  /api/questions?sim=skd|bi|ojk|telkom    → paket simulasi seleksi (lihat SIM_PLANS di _lib/pick.js)
// GET  /api/questions?category=bi&difficulty=normal&mode=pg|game|essay|interaktif&limit=10&fresh=1&seen=k1,k2
// POST /api/questions {action:'purge', count:100-200, dry?:true}  → hapus soal hasil generate secara acak (khusus admin)
//      Penghapusan "meratakan": tiap soal yang dihapus diambil dari topik yang saat itu jumlahnya paling banyak.
import { handle, query, send, readBody, httpError } from './_lib/http.js';
import { pickQuestions, pickSim, DIFFS, shuffle } from './_lib/pick.js';
import { requireUser, isAdmin } from './_lib/auth.js';
import { getDB } from './_lib/db.js';

const CATS = ['isu', 'twk', 'tiu', 'tkp', 'ojk', 'bi', 'bumn', 'telkom', 'keuangan', 'english', 'psikologi'];

async function purge(b) {
  const count = Math.max(100, Math.min(200, parseInt(b.count, 10) || 100));
  const db = await getDB();
  const counts = Object.fromEntries(await Promise.all(CATS.map(async c => [c, await db.countQuestions({ category: c }).catch(() => 0)])));
  const total = Object.values(counts).reduce((a, x) => a + x, 0);
  const take = Object.fromEntries(CATS.map(c => [c, 0]));
  const n = Math.min(count, total);
  for (let i = 0; i < n; i++) {                       // ambil satu per satu dari topik yang sisanya paling banyak
    const c = CATS.reduce((best, x) => (counts[x] - take[x] > counts[best] - take[best] ? x : best), CATS[0]);
    take[c]++;
  }
  const plan = CATS.map(c => ({ cat: c, before: counts[c], remove: take[c], after: counts[c] - take[c] })).filter(p => p.before > 0).sort((a, b) => b.before - a.before);
  if (b.dry) return { dry: true, count: n, total, plan };
  let removed = 0;
  for (const p of plan) {
    if (!p.remove) continue;
    const ids = shuffle(await db.listQuestionIds(p.cat)).slice(0, p.remove);
    removed += await db.deleteQuestions(ids);
  }
  return { dry: false, count: n, removed, total: total - removed, plan };
}

export default handle(['GET', 'POST'], async (req, res) => {
  if (req.method === 'POST') {
    if (!isAdmin(requireUser(req))) throw httpError(403, 'Khusus admin');
    const b = await readBody(req);
    if (b.action !== 'purge') throw httpError(400, 'Aksi tidak dikenal');
    return send(res, 200, await purge(b));
  }
  const p = query(req);
  // Simulasi seleksi: skd (CPNS 2026), bi, ojk, telkom
  if (p.get('sim')) {
    const d = await pickSim(p.get('sim'), (p.get('seen') || '').split(',').filter(Boolean).slice(-300));
    if (!d) throw httpError(400, 'Jenis simulasi tidak dikenal');
    return send(res, 200, d);
  }
  const mode = p.get('mode') || 'pg';
  const result = await pickQuestions({
    category: p.get('category') || 'campuran',
    difficulty: DIFFS.includes(p.get('difficulty')) ? p.get('difficulty') : 'all',
    type: mode === 'essay' ? 'essay' : mode === 'interaktif' ? 'interactive' : 'pg',
    limit: Math.min(Math.max(parseInt(p.get('limit') || '10', 10) || 10, 1), 50),
    fresh: p.get('fresh') === '1',
    seen: (p.get('seen') || '').split(',').filter(Boolean).slice(-300),
  });
  send(res, 200, result);
});
