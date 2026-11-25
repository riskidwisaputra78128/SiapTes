// GET /api/admin-live — data Kantor Live (semua pengguna login)
import crypto from 'node:crypto';
import { handle, send, httpError, startOfDayWIB, dayKey } from './_lib/http.js';
import { requireUser, isAdmin } from './_lib/auth.js';
import { getDB, firebaseEnabled } from './_lib/db.js';
import { aiEnabled } from './_lib/ai.js';
import { SEED_QUESTIONS } from './_lib/seed.js';

const ONLINE_MS = 2.5 * 60 * 1000;
const key = uid => crypto.createHash('sha1').update(String(uid)).digest('hex').slice(0, 10);

export default handle(['GET'], async (req, res) => {
  requireUser(req);
  const db = await getDB();
  const now = Date.now(), day0 = startOfDayWIB(now);

  const [presence, rooms, attempts, genStatus, lastGenerate, materials, generated] = await Promise.all([
    db.listPresence(now - ONLINE_MS).catch(() => []),
    db.listRooms().catch(() => []),
    db.listAttemptsSince(day0).catch(() => []),
    db.getMeta('genStatus').catch(() => null),
    db.getMeta('lastGenerate').catch(() => null),
    db.listMaterials(20).catch(() => []),
    db.countQuestions().catch(() => 0),
  ]);

  const users = presence.filter(p => !p.hidden).map(p => ({
    key: key(p.uid), name: p.name, target: p.target || '', page: p.page, duel: p.duel || null,
    since: p.since, lastSeen: p.lastSeen, justLoggedIn: now - (p.since || now) < 90 * 1000,
  }));

  const duels = rooms.filter(r => now - r.createdAt < 2 * 3600e3).map(r => {
    const slot = (r.perQ + 4) * 1000;
    let phase = r.status;
    if (r.status === 'playing') {
      if (now < r.startAt) phase = 'countdown';
      else { const idx = Math.floor((now - r.startAt) / slot); phase = idx >= (r.questions?.length || 0) ? 'finished' : `soal ${idx + 1}/${r.questions.length}`; }
    }
    return {
      code: r.code, title: r.title, phase, playing: r.status === 'playing', category: r.category, difficulty: r.difficulty,
      players: Object.entries(r.players).filter(([, p]) => !p.left).map(([uid, p]) => ({ key: key(uid), name: p.name, score: p.score || 0 })),
      bot: r.bot,
    };
  }).filter(d => d.phase !== 'finished');

  const recent = attempts.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(a => ({
    name: a.name, mode: a.mode, category: a.category, difficulty: a.difficulty, score: a.score, correct: a.correct, total: a.total, createdAt: a.createdAt,
  }));

  send(res, 200, {
    serverNow: now,
    users, duels, recent,
    today: {
      sessions: attempts.length, questions: attempts.reduce((s, a) => s + a.total, 0),
      learners: new Set(attempts.map(a => a.uid)).size,
      materials: materials.filter(m => m.day === dayKey(now)).length,
    },
    system: {
      firebase: firebaseEnabled(), ai: aiEnabled(), bank: SEED_QUESTIONS.length + generated, generated,
      generating: !!(genStatus?.running && now - genStatus.at < 3 * 60 * 1000), genStartedAt: genStatus?.at || null,
      lastGenerate: lastGenerate ? { at: lastGenerate.at, total: lastGenerate.total, materials: lastGenerate.materials || 0 } : null,
    },
  });
});
