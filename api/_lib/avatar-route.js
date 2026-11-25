// Foto profil
// Dilayani lewat /api/presence (paket Hobby Vercel dibatasi 12 function)
// GET    /api/presence?avatar=<pid>&v=<versi> → gambar (publik, di-cache lama karena URL berversi)
// GET    /api/presence?op=avatar&me=1         → { avatar } milik akun yang login
// POST   /api/presence?op=avatar {image}      → simpan foto (JPEG/PNG/WebP)
// DELETE /api/presence?op=avatar              → hapus foto
import { handle, query, readBody, send, httpError } from './http.js';
import { requireUser } from './auth.js';
import { getDB } from './db.js';
import { pidOf, avatarMap, avatarUrl, bumpCache } from './avatar.js';

const RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export const avatarRoute = handle(['GET', 'POST', 'DELETE'], async (req, res) => {
  const db = await getDB();
  const q = query(req);
  if (req.method === 'GET' && q.get('avatar')) {
    const id = q.get('avatar').replace(/[^\w-]/g, '').slice(0, 24);
    const a = await db.getAvatar(id);
    if (!a?.data) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=60'); return res.end(); }
    const buf = Buffer.from(a.data, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', a.mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  }
  const user = requireUser(req);
  const pid = pidOf(user.uid);
  if (req.method === 'GET') return send(res, 200, { avatar: avatarUrl(user.uid, await avatarMap(db, true)) });

  if (req.method === 'DELETE') {
    await db.deleteAvatar(pid);
    await db.setMetaField('avatars', pid, null);
    bumpCache(pid, null);
    return send(res, 200, { avatar: null });
  }
  const b = await readBody(req);
  const m = RE.exec(String(b.image || ''));
  if (!m) throw httpError(400, 'Format foto tidak didukung (pakai JPG, PNG, atau WebP)');
  if (m[2].length > 190000) throw httpError(413, 'Ukuran foto terlalu besar');
  const v = Date.now().toString(36);
  await db.setAvatar(pid, { mime: m[1], data: m[2], updatedAt: Date.now() });
  await db.setMetaField('avatars', pid, v);
  bumpCache(pid, v);
  send(res, 200, { avatar: `/api/presence?avatar=${pid}&v=${v}` });
});
