// GET /api/materials           → daftar materi harian (14 hari terakhir) + materi inti
// GET /api/materials?id=xxx    → isi lengkap satu materi
import { handle, query, send, httpError } from './_lib/http.js';
import { getDB } from './_lib/db.js';
import { CORE_MATERIALS } from './_lib/seed-materials.js';
import { enrichMaterial } from './_lib/ogimage.js';

const brief = m => ({
  id: m.id, core: !!m.core, category: m.category, title: m.title, summary: m.summary,
  day: m.day || null, readMin: m.readMin || 3, createdAt: m.createdAt || null, sourcesCount: m.sources?.length || 0,
  cover: m.cover || null, highlight: (m.stats?.[0] ? `${m.stats[0].value}${m.stats[0].unit ? ' ' + m.stats[0].unit : ''} · ${m.stats[0].label}` : m.keyPoints?.[0]) || null, extras: !!(m.flow?.length || m.stats?.length || m.quiz?.length),
});

export default handle(['GET'], async (req, res) => {
  const id = query(req).get('id');
  const db = await getDB();
  if (id) {
    const m = CORE_MATERIALS.find(x => x.id === id) || (await db.getMaterial(id).catch(() => null));
    if (!m) throw httpError(404, 'Materi tidak ditemukan');
    // cari foto dari artikel sumber (sekali saja, lalu disimpan)
    const add = await enrichMaterial(m, 8000).catch(e => { console.error('enrich', e.message); return null; });
    if (add) { Object.assign(m, add); db.updateMaterial(m.id, add).catch(() => {}); }
    res.setHeader('Cache-Control', add ? 'no-store' : 'public, s-maxage=600');
    return send(res, 200, { material: m });
  }
  let daily = [];
  try {
    daily = await db.listMaterials(60);
    if (daily.some(m => !m.title || !m.category)) db.pruneMaterials(50).catch(() => {}); // bersihkan materi rusak
    daily = daily.filter(m => m.title && m.category).slice(0, 50);
    // sampul: lengkapi beberapa materi terbaru yang belum punya foto
    const todo = daily.filter(m => !m.imgTried).slice(0, 4);
    if (todo.length) {
      const adds = await Promise.all(todo.map(m => enrichMaterial(m, 7000).catch(() => null)));
      todo.forEach((m, i) => { if (adds[i]) { Object.assign(m, adds[i]); db.updateMaterial(m.id, adds[i]).catch(() => {}); } });
    }
  } catch (e) { console.error('listMaterials', e.message); }
  res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=30');
  send(res, 200, { daily: daily.map(brief), core: CORE_MATERIALS.map(brief), max: 50 });
});
