// POST /api/attempt — simpan hasil latihan (butuh login)
import { handle, readBody, send, httpError, dayKey } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { getDB } from './_lib/db.js';

const MODES = ['pg', 'game', 'essay', 'interaktif', 'duel'];
const DIFFS = ['easy', 'normal', 'hard', 'prof', 'all'];
const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

export default handle(['POST'], async (req, res) => {
  const user = requireUser(req);
  const b = await readBody(req);
  if (!MODES.includes(b.mode)) throw httpError(400, 'Mode tidak valid');
  const total = num(b.total, 100);
  if (!total) throw httpError(400, 'Tidak ada soal yang dikerjakan');
  const now = Date.now();
  const attempt = {
    uid: user.uid,
    name: String(user.name || 'Peserta').slice(0, 40),
    mode: b.mode,
    category: String(b.category || 'campuran').slice(0, 20),
    difficulty: DIFFS.includes(b.difficulty) ? b.difficulty : 'all',
    total,
    correct: Math.min(num(b.correct, 100), total),
    score: num(b.score, 100),
    points: num(b.points, 100000),
    durationSec: num(b.durationSec, 86400),
    details: Array.isArray(b.details) ? b.details.slice(0, 100).map(d => ({
      id: String(d.id || '').slice(0, 60), c: d.correct ? 1 : 0, cat: String(d.category || '').slice(0, 20),
    })) : [],
    createdAt: now,
    day: dayKey(now),
  };
  const id = await (await getDB()).addAttempt(attempt);
  send(res, 200, { saved: true, id });
});
