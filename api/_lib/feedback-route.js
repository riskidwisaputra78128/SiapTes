// Kritik & saran (dilayani lewat /api/presence?op=feedback, karena batas 12 function di paket Hobby)
// POST  {type, message, rating, page}         → kirim (tamu boleh)
// GET   (admin)                               → daftar pesan
// POST  {action:'done', id} (admin)           → tandai sudah dibaca
import { handle, readBody, send, httpError } from './http.js';
import { getUser, isAdmin } from './auth.js';
import { getDB } from './db.js';
import { gasCall } from './gas.js';

const TYPES = ['saran', 'kritik', 'bug', 'pujian'];
const recent = new Map();

export const feedbackRoute = handle(['GET', 'POST'], async (req, res) => {
  const db = await getDB(); const user = getUser(req);
  if (req.method === 'GET') {
    if (!isAdmin(user)) throw httpError(403, 'Khusus admin');
    const list = await db.listFeedback(80);
    return send(res, 200, { items: list, unread: list.filter(f => !f.done).length });
  }
  const b = await readBody(req);
  if (b.action === 'done') {
    if (!isAdmin(user)) throw httpError(403, 'Khusus admin');
    await db.updateFeedback(String(b.id || ''), { done: b.done !== false });
    return send(res, 200, { ok: true });
  }
  const message = String(b.message || '').trim().slice(0, 1500);
  if (message.length < 5) throw httpError(400, 'Tulis pesan minimal 5 karakter');
  const who = user?.uid || (req.headers['x-forwarded-for'] || 'tamu').split(',')[0];
  if (Date.now() - (recent.get(who) || 0) < 20000) throw httpError(429, 'Tunggu sebentar sebelum mengirim lagi');
  recent.set(who, Date.now());
  const f = {
    type: TYPES.includes(b.type) ? b.type : 'saran', message, rating: Math.max(0, Math.min(5, parseInt(b.rating, 10) || 0)),
    page: String(b.page || '').slice(0, 40), name: user?.name || 'Tamu', email: user?.email || '', uid: user?.uid || null,
    createdAt: Date.now(), done: false,
  };
  await db.addFeedback(f);
  await gasCall({ action: 'feedback', ...f }, 6000).catch(() => null); // salinan ke Google Sheet (tab "Kritik & Saran")
  send(res, 200, { ok: true });
});
