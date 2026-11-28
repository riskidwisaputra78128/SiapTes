// 📢 Iklan / promosi yang dipasang admin di beranda
// - Data iklan: meta 'ads' { id: { title, text, img, link, cta, active, start, end, tiers, createdAt, updatedAt } }
// - Statistik: meta 'adstats' { id: { v: tayang, c: klik } } — dikumpulkan dulu di memori server lalu disimpan
//   sekaligus (±30 detik) dengan increment, supaya tidak memakan kuota tulis Firestore per tayangan.
import crypto from 'node:crypto';
import { handle, readBody, send, query, httpError } from './http.js';
import { requireUser, isAdmin, getUser } from './auth.js';
import { getDB } from './db.js';

const cleanUrl = (u, allowEmpty = false) => {
  const s = String(u || '').trim();
  if (!s && allowEmpty) return '';
  if (!/^https:\/\/[^\s"'<>]{4,500}$/i.test(s)) throw httpError(400, 'Link harus diawali https:// dan valid');
  return s;
};
export function activeAds(map, now = Date.now()) {
  return Object.entries(map || {}).map(([id, a]) => ({ id, ...a }))
    .filter(a => a.active && (!a.start || a.start <= now) && (!a.end || a.end >= now))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(({ id, title, text, img, link, cta, tiers }) => ({ id, title, text, img, link, cta, tiers: tiers || ['guest', 'free', 'plus'] }));
}

// buffer tayang/klik per server
const buf = globalThis.__adBuf || (globalThis.__adBuf = { at: Date.now(), data: {}, flushing: false });
async function flush(db, force = false) {
  if (buf.flushing || (!force && Date.now() - buf.at < 30000)) return;
  const data = buf.data; buf.data = {}; buf.at = Date.now();
  if (!Object.keys(data).length) return;
  buf.flushing = true;
  try { await Promise.all(Object.entries(data).map(([id, d]) => db.bumpBoard('adstats', id, {}, d))); }
  catch (e) { console.warn('ads flush:', e.message); for (const [id, d] of Object.entries(data)) { const o = buf.data[id] ||= {}; for (const k in d) o[k] = (o[k] || 0) + d[k]; } }
  finally { buf.flushing = false; }
}

export const adsRoute = handle(['GET', 'POST'], async (req, res) => {
  const db = await getDB();
  const q = query(req);
  // pelacakan tayang/klik (boleh tamu)
  if (req.method === 'POST' && q.get('t') === '1') {
    const b = await readBody(req);
    const ids = new Set(Object.keys((await db.getMeta('ads').catch(() => null)) || {}));
    const add = (id, k) => { if (!ids.has(id)) return; const o = buf.data[id] ||= {}; o[k] = (o[k] || 0) + 1; };
    (Array.isArray(b.v) ? b.v : []).slice(0, 10).forEach(id => add(String(id), 'v'));
    (Array.isArray(b.c) ? b.c : []).slice(0, 3).forEach(id => add(String(id), 'c'));
    await flush(db, (Array.isArray(b.c) && b.c.length > 0));   // klik langsung disimpan
    return send(res, 200, { ok: true });
  }
  // kelola iklan (admin)
  if (!isAdmin(requireUser(req))) throw httpError(403, 'Khusus admin');
  if (req.method === 'GET') {
    await flush(db, true);
    const [ads, stats] = await Promise.all([db.getMeta('ads').catch(() => null), db.getMeta('adstats').catch(() => null)]);
    const list = Object.entries(ads || {}).map(([id, a]) => ({ id, ...a, views: stats?.[id]?.v || 0, clicks: stats?.[id]?.c || 0 }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return send(res, 200, { ads: list });
  }
  const b = await readBody(req);
  if (b.action === 'delete') {
    const id = String(b.id || '');
    await db.setMetaField('ads', id, null);
    await db.setMetaField('adstats', id, null).catch(() => {});
    return send(res, 200, { ok: true });
  }
  if (b.action !== 'save') throw httpError(400, 'Aksi tidak dikenal');
  const title = String(b.title || '').trim().slice(0, 80);
  if (title.length < 3) throw httpError(400, 'Judul iklan minimal 3 karakter');
  const tiers = (Array.isArray(b.tiers) ? b.tiers : ['guest', 'free', 'plus']).filter(t => ['guest', 'free', 'plus', 'pro'].includes(t));
  const id = /^ad_[a-z0-9]{6,20}$/.test(b.id) ? b.id : 'ad_' + crypto.randomBytes(5).toString('hex');
  const prev = ((await db.getMeta('ads').catch(() => null)) || {})[id];
  const rec = {
    title, text: String(b.text || '').trim().slice(0, 200), link: cleanUrl(b.link), img: cleanUrl(b.img, true),
    cta: String(b.cta || 'Lihat promo').trim().slice(0, 24), active: b.active !== false, tiers: tiers.length ? tiers : ['guest', 'free'],
    start: Number(b.start) || 0, end: Number(b.end) || 0, createdAt: prev?.createdAt || Date.now(), updatedAt: Date.now(),
  };
  await db.setMetaField('ads', id, rec);
  return send(res, 200, { ok: true, id, ad: rec });
});
export { getUser };
