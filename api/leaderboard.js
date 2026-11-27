// GET /api/leaderboard?period=week|month
import { handle, query, send } from './_lib/http.js';
import { getUser } from './_lib/auth.js';
import { getDB } from './_lib/db.js';
import { avatarMap, avatarUrl } from './_lib/avatar.js';
import { readBoard } from './_lib/board.js';

export default handle(['GET'], async (req, res) => {
  const period = query(req).get('period') === 'month' ? 'month' : 'week';
  const db = await getDB();
  // ringkasan per periode (1 dokumen) — bukan lagi membaca seluruh riwayat latihan
  const [rows, avs] = await Promise.all([readBoard(db, period), avatarMap(db)]);
  const me = getUser(req);
  const ranked = rows.filter(o => o.sessions > 0).sort((a, b) => b.points - a.points).map((o, i) => ({
    rank: i + 1,
    name: String(o.name || 'Peserta').split(' ').slice(0, 2).join(' '),
    points: o.points, questions: o.questions, sessions: o.sessions,
    accuracy: o.questions ? Math.round((o.correct / o.questions) * 100) : 0,
    me: !!me && o.uid === me.uid,
    avatar: avatarUrl(o.uid, avs),
  }));
  const mine = ranked.find(r => r.me) || null;
  send(res, 200, { period, top: ranked.slice(0, 20), mine, participants: ranked.length });
});
