// GET /api/materials           → daftar materi harian (14 hari terakhir) + materi inti
// GET /api/materials?id=xxx    → isi lengkap satu materi
// DELETE /api/materials?id=xxx → hapus materi harian (khusus admin)
import { handle, query, send, httpError } from './_lib/http.js';
import { requireUser, isAdmin } from './_lib/auth.js';
import { getDB, dataVersion } from './_lib/db.js';
import { CORE_MATERIALS } from './_lib/seed-materials.js';
import { enrichMaterial } from './_lib/ogimage.js';
const MAX_MATERIALS = 80;
// daftar materi dipakai bersama semua pengunjung (memori server), diganti otomatis bila ada materi baru/diubah/dihapus
const LIST_TTL = 2 * 60 * 1000;
const listCache = globalThis.__matList || (globalThis.__matList = { at: 0, ver: -1, daily: null });

const brief = m => ({
  id: m.id, core: !!m.core, category: m.category, title: m.title, summary: m.summary,
  day: m.day || null, readMin: m.readMin || 3, createdAt: m.createdAt || null, sourcesCount: m.sources?.length || 0, basis: m.core ? 'inti' : m.basis || 'terkini',
  cover: m.cover || null, highlight: (m.stats?.[0] ? `${m.stats[0].value}${m.stats[0].unit ? ' ' + m.stats[0].unit : ''} · ${m.stats[0].label}` : m.keyPoints?.[0]) || null, extras: true,
});

export default handle(['GET', 'DELETE'], async (req, res) => {
  const id = query(req).get('id');
  const db = await getDB();
  if (req.method === 'DELETE') {
    if (!isAdmin(requireUser(req))) throw httpError(403, 'Hanya admin yang bisa menghapus materi');
    if (!id || CORE_MATERIALS.some(x => x.id === id)) throw httpError(400, 'Materi inti tidak bisa dihapus');
    if (!(await db.getMaterial(id))) throw httpError(404, 'Materi tidak ditemukan');
    await db.deleteMaterial(id);
    return send(res, 200, { ok: true });
  }
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
  const ver = (await dataVersion(db))?.m || 0;
  if (listCache.daily && listCache.ver === ver && Date.now() - listCache.at < LIST_TTL) daily = listCache.daily;
  else try {
    daily = await db.listMaterials(MAX_MATERIALS + 10);
    if (daily.some(m => !m.title || !m.category)) db.pruneMaterials(MAX_MATERIALS).catch(() => {}); // bersihkan materi rusak
    daily = daily.filter(m => m.title && m.category).slice(0, MAX_MATERIALS);
    // sampul: lengkapi beberapa materi terbaru yang belum punya foto
    const todo = daily.filter(m => !m.imgTried).slice(0, 4);
    if (todo.length) {
      const adds = await Promise.all(todo.map(m => enrichMaterial(m, 7000).catch(() => null)));
      todo.forEach((m, i) => { if (adds[i]) { Object.assign(m, adds[i]); db.updateMaterial(m.id, adds[i]).catch(() => {}); } });
    }
    Object.assign(listCache, { at: Date.now(), ver: (await dataVersion(db))?.m || 0, daily });
  } catch (e) { console.error('listMaterials', e.message); if (listCache.daily) daily = listCache.daily; }
  res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=120');
  send(res, 200, { daily: daily.map(brief), core: CORE_MATERIALS.map(brief), max: MAX_MATERIALS });
});
