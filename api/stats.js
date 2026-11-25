// GET /api/stats — evaluasi harian / mingguan / bulanan untuk akun yang login
import { handle, send, dayKey, monthKey, startOfDayWIB, startOfWeekWIB, startOfMonthWIB, wibDate } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { getDB } from './_lib/db.js';

const CAT_NAMES = {
  twk: 'TWK', tiu: 'TIU', tkp: 'TKP', ojk: 'OJK', bi: 'Bank Indonesia', bumn: 'BUMN', telkom: 'Telkom & Digital',
  keuangan: 'Perbankan & Keuangan', english: 'Bahasa Inggris', isu: 'Isu Terkini', campuran: 'Campuran',
};
const DIFF_NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard', prof: 'Prof', all: 'Semua' };
const MODE_NAMES = { pg: 'Pilihan Ganda', game: 'Arena Game', essay: 'Esai' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function agg(list) {
  const o = { sessions: list.length, questions: 0, correct: 0, points: 0, minutes: 0, scoreSum: 0 };
  for (const a of list) {
    o.questions += a.total; o.correct += a.correct; o.points += a.points || 0;
    o.minutes += (a.durationSec || 0) / 60; o.scoreSum += a.score || 0;
  }
  o.accuracy = o.questions ? Math.round((o.correct / o.questions) * 100) : 0;
  o.avgScore = o.sessions ? Math.round(o.scoreSum / o.sessions) : 0;
  o.minutes = Math.round(o.minutes);
  delete o.scoreSum;
  return o;
}

function groupBy(list, keyFn) {
  const m = new Map();
  for (const a of list) { const k = keyFn(a); if (!m.has(k)) m.set(k, []); m.get(k).push(a); }
  return m;
}

export default handle(['GET'], async (req, res) => {
  const user = requireUser(req);
  const now = Date.now();
  const since = startOfMonthWIB(now) - 200 * 86400000; // ± 7 bulan
  const all = await (await getDB()).listAttemptsByUser(user.uid, since);

  const today0 = startOfDayWIB(now), week0 = startOfWeekWIB(now), month0 = startOfMonthWIB(now);
  const summary = {
    today: agg(all.filter(a => a.createdAt >= today0)),
    week: agg(all.filter(a => a.createdAt >= week0)),
    month: agg(all.filter(a => a.createdAt >= month0)),
    allTime: agg(all),
  };

  // Harian: 14 hari terakhir
  const byDay = groupBy(all, a => dayKey(a.createdAt));
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const t = today0 - i * 86400000; const k = dayKey(t); const d = wibDate(t);
    daily.push({ key: k, label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, ...agg(byDay.get(k) || []) });
  }
  // Mingguan: 8 minggu terakhir
  const weekly = [];
  for (let i = 7; i >= 0; i--) {
    const s = week0 - i * 7 * 86400000, e = s + 7 * 86400000; const d = wibDate(s);
    weekly.push({ label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, ...agg(all.filter(a => a.createdAt >= s && a.createdAt < e)) });
  }
  // Bulanan: 6 bulan terakhir
  const byMonth = groupBy(all, a => monthKey(a.createdAt));
  const monthly = [];
  const md = wibDate(month0);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(md.getUTCFullYear(), md.getUTCMonth() - i, 1));
    const k = d.toISOString().slice(0, 7);
    monthly.push({ label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, ...agg(byMonth.get(k) || []) });
  }

  // Per kategori dihitung per-soal (detail) agar mode campuran pun terbagi rapi
  const catMap = new Map();
  for (const a of all) {
    if (a.details?.length) {
      for (const d of a.details) {
        const c = d.cat || a.category; const o = catMap.get(c) || { q: 0, c: 0 }; o.q++; o.c += d.c; catMap.set(c, o);
      }
    } else {
      const o = catMap.get(a.category) || { q: 0, c: 0 }; o.q += a.total; o.c += a.correct; catMap.set(a.category, o);
    }
  }
  const byCategory = [...catMap.entries()].map(([k, v]) => ({
    key: k, name: CAT_NAMES[k] || k, questions: v.q, accuracy: v.q ? Math.round((v.c / v.q) * 100) : 0,
  })).sort((a, b) => b.questions - a.questions);

  const byMode = [...groupBy(all, a => a.mode)].map(([k, l]) => ({ key: k, name: MODE_NAMES[k] || k, ...agg(l) }));
  const byDifficulty = ['easy', 'normal', 'hard', 'prof'].map(k => ({ key: k, name: DIFF_NAMES[k], ...agg(all.filter(a => a.difficulty === k)) }));

  // Streak hari berturut-turut
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const k = dayKey(today0 - i * 86400000);
    if (byDay.has(k)) streak++;
    else if (i === 0) continue; // belum latihan hari ini, streak kemarin masih dihitung
    else break;
  }

  const totalPoints = summary.allTime.points;
  const level = Math.floor(Math.sqrt(totalPoints / 50)) + 1;
  const curBase = 50 * (level - 1) ** 2, nextBase = 50 * level ** 2;

  // Rekomendasi otomatis
  const tips = [];
  const weak = byCategory.filter(c => c.questions >= 5).sort((a, b) => a.accuracy - b.accuracy)[0];
  const strong = byCategory.filter(c => c.questions >= 5).sort((a, b) => b.accuracy - a.accuracy)[0];
  if (!all.length) tips.push({ type: 'info', text: 'Belum ada latihan. Mulai dengan 10 soal Campuran level Easy untuk memetakan kemampuanmu.' });
  if (weak && weak.accuracy < 70) tips.push({ type: 'warn', cat: weak.key, text: `Fokus ke ${weak.name}: akurasi baru ${weak.accuracy}%. Ulangi di level yang sama sampai ≥70% sebelum naik level.` });
  if (strong && strong.accuracy >= 80) tips.push({ type: 'good', cat: strong.key, text: `${strong.name} sudah kuat (${strong.accuracy}%). Coba naikkan ke level Hard atau Prof.` });
  if (summary.week.sessions < 3 && all.length) tips.push({ type: 'info', text: `Minggu ini baru ${summary.week.sessions} sesi. Targetkan minimal 1 sesi per hari agar streak terjaga.` });
  if (!byMode.find(m => m.key === 'essay') && all.length) tips.push({ type: 'info', text: 'Coba Mode Esai untuk melatih pemahaman konsep — sangat membantu untuk tes wawancara & studi kasus.' });
  const lastWeek = weekly[weekly.length - 2], thisWeek = weekly[weekly.length - 1];
  if (lastWeek?.questions && thisWeek.questions && thisWeek.accuracy > lastWeek.accuracy) {
    tips.push({ type: 'good', text: `Akurasi naik dari ${lastWeek.accuracy}% ke ${thisWeek.accuracy}% dibanding minggu lalu. Pertahankan!` });
  }

  send(res, 200, {
    summary, daily, weekly, monthly, byCategory, byMode, byDifficulty, streak,
    level: { level, points: totalPoints, progress: Math.round(((totalPoints - curBase) / (nextBase - curBase)) * 100), next: nextBase },
    tips,
    recent: all.slice(-12).reverse().map(a => ({
      mode: a.mode, category: a.category, difficulty: a.difficulty, total: a.total, correct: a.correct,
      score: a.score, points: a.points, createdAt: a.createdAt,
    })),
  });
});
