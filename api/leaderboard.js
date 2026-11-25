// GET /api/leaderboard?period=week|month
import { handle, query, send, startOfWeekWIB, startOfMonthWIB } from './_lib/http.js';
import { getUser } from './_lib/auth.js';
import { getDB } from './_lib/db.js';
import { avatarMap, avatarUrl } from './_lib/avatar.js';

export default handle(['GET'], async (req, res) => {
  const period = query(req).get('period') === 'month' ? 'month' : 'week';
  const since = period === 'month' ? startOfMonthWIB(Date.now()) : startOfWeekWIB(Date.now());
  const db = await getDB();
  const [list, avs] = await Promise.all([db.listAttemptsSince(since), avatarMap(db)]);
  const me = getUser(req);
  const m = new Map();
  for (const a of list) {
    const o = m.get(a.uid) || { uid: a.uid, name: a.name, points: 0, questions: 0, correct: 0, sessions: 0 };
    o.points += a.points || 0; o.questions += a.total; o.correct += a.correct; o.sessions++; o.name = a.name;
    m.set(a.uid, o);
  }
  const ranked = [...m.values()].sort((a, b) => b.points - a.points).map((o, i) => ({
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
