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
// Gambar banner yang di-upload admin disimpan di koleksi gambar (sama dengan foto profil), bukan Storage
const IMG_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const imgKey = id => 'adimg_' + id;
const ownImg = (u, id) => typeof u === 'string' && u.startsWith(`/api/presence?op=ads&img=${id}`);
async function dropImg(db, id) { await db.deleteAvatar(imgKey(id)).catch(() => {}); }

export function activeAds(map, now = Date.now()) {
  return Object.entries(map || {}).map(([id, a]) => ({ id, ...a }))
    .filter(a => a.active && (!a.start || a.start <= now) && (!a.end || a.end >= now))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(({ id, title, text, img, link, cta, tiers, wide }) => ({ id, title, text, img, link, cta, wide: !!(img && wide), tiers: tiers || ['guest', 'free', 'plus'] }));
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
  // gambar banner hasil upload (publik, di-cache lama karena URL berversi)
  if (req.method === 'GET' && q.get('img')) {
    const id = q.get('img').replace(/[^\w-]/g, '').slice(0, 30);
    const a = await db.getAvatar(imgKey(id));
    if (!a?.data) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=60'); return res.end(); }
    const bin = Buffer.from(a.data, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', a.mime || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', bin.length);
    return res.end(bin);
  }
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
    await dropImg(db, id);                       // gambar upload ikut terhapus
    return send(res, 200, { ok: true });
  }
  if (b.action !== 'save') throw httpError(400, 'Aksi tidak dikenal');
  const title = String(b.title || '').trim().slice(0, 80);
  if (title.length < 3) throw httpError(400, 'Judul iklan minimal 3 karakter');
  const tiers = (Array.isArray(b.tiers) ? b.tiers : ['guest', 'free', 'plus']).filter(t => ['guest', 'free', 'plus', 'pro'].includes(t));
  const id = /^ad_[a-z0-9]{6,20}$/.test(b.id) ? b.id : 'ad_' + crypto.randomBytes(5).toString('hex');
  const prev = ((await db.getMeta('ads').catch(() => null)) || {})[id];
  // gambar: upload baru (imgData) → simpan & pakai URL internal; link https biasa; atau dikosongkan
  let img;
  const m = IMG_RE.exec(String(b.imgData || ''));
  if (b.imgData && !m) throw httpError(400, 'Format gambar tidak didukung (pakai JPG, PNG, atau WebP)');
  if (m) {
    if (m[2].length > 900000) throw httpError(413, 'Ukuran gambar terlalu besar (maks. ±650 KB setelah dikompres)');
    await db.setAvatar(imgKey(id), { mime: m[1], data: m[2], updatedAt: Date.now() });
    img = `/api/presence?op=ads&img=${id}&v=${Date.now().toString(36)}`;
  } else if (ownImg(b.img, id)) {
    img = b.img;                                  // gambar upload lama tetap dipakai
  } else {
    img = cleanUrl(b.img, true);
    if (ownImg(prev?.img, id)) await dropImg(db, id);   // diganti link lain / dihapus → file lama dihapus
  }
  const rec = {
    title, text: String(b.text || '').trim().slice(0, 200), link: cleanUrl(b.link), img,
    wide: !!(img && b.wide),
    cta: String(b.cta || 'Lihat promo').trim().slice(0, 24), active: b.active !== false, tiers: tiers.length ? tiers : ['guest', 'free'],
    start: Number(b.start) || 0, end: Number(b.end) || 0, createdAt: prev?.createdAt || Date.now(), updatedAt: Date.now(),
  };
  await db.setMetaField('ads', id, rec);
  return send(res, 200, { ok: true, id, ad: rec });
});
export { getUser };
