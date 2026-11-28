// Duel multiplayer (khusus pengguna login) — 5 mode: Pilihan Ganda, Arena, Esai, Interaktif, Tes Psikologi
// GET  /api/duel?list=1              → daftar room publik (menunggu, berlangsung, baru selesai)
// GET  /api/duel?code=ABC123[&view=1] → status room (anggota) / tampilan penonton "View duel"
// POST /api/duel { action: 'create' | 'join' | 'leave' | 'start' | 'answer' | 'power', ... }
import crypto from 'node:crypto';
import { handle, readBody, query, send, httpError } from './_lib/http.js';
import { requireUser, getUser } from './_lib/auth.js';
import { getDB } from './_lib/db.js';
import { avatarMap, avatarUrl } from './_lib/avatar.js';
import { pickQuestions, DIFFS } from './_lib/pick.js';
import { keywordGrade } from './_lib/keyword-grade.js';
import { guardDuel } from './_lib/plan.js';

const CATS = ['campuran', 'twk', 'tiu', 'tkp', 'ojk', 'bi', 'bumn', 'telkom', 'keuangan', 'english', 'isu', 'psikologi'];
const MODES = {
  pg: { counts: [5, 10, 15], def: 10, type: 'pg' },
  arena: { counts: [5, 10, 15], def: 10, type: 'pg' },
  esai: { counts: [3, 5], def: 3, type: 'essay' },
  interaktif: { counts: [5, 8, 10], def: 5, type: 'interactive' },
  psikotes: { counts: [3, 5, 8], def: 5, type: null },
};
const PER_Q = { easy: 20, normal: 17, hard: 14, prof: 12, all: 17 }; // detik per soal PG
function perQOf(mode, diff, psiType) {
  if (mode === 'arena') return Math.max(10, PER_Q[diff] - 4);
  if (mode === 'esai') return 90;
  if (mode === 'interaktif') return { easy: 75, normal: 60, hard: 50, prof: 45 }[diff] || 60;
  if (mode === 'psikotes') return psiType === 'cermat' ? 30 : 20;
  return PER_Q[diff] || 17;
}
const REVEAL = 4;       // detik jeda pembahasan (esai/interaktif sedikit lebih lama)
const revealOf = room => (room.mode === 'esai' || room.mode === 'interaktif' ? 7 : room.mode === 'psikotes' ? 5 : REVEAL);
const COUNTDOWN = 5;
const MAX_PTS = 1000;
const LIVES = 3;
const BOTS = {
  easy: { name: 'Bot Pemula', ico: '🐣', acc: 0.45, t: [0.5, 0.95], rate: 0.9 },
  normal: { name: 'Bot Cerdas', ico: '🤖', acc: 0.65, t: [0.35, 0.85], rate: 1.3 },
  hard: { name: 'Bot Jenius', ico: '🧠', acc: 0.8, t: [0.25, 0.7], rate: 1.8 },
  prof: { name: 'Bot Profesor', ico: '🎓', acc: 0.92, t: [0.15, 0.55], rate: 2.4 },
};
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL = 2 * 3600 * 1000;
const FINISHED_SHOW = 10 * 60 * 1000;  // room selesai masih bisa ditonton (podium) 10 menit, selama host belum keluar

const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const cleanName = s => String(s || 'Peserta').split(' ').slice(0, 2).join(' ').slice(0, 24);

function rng(seed) {
  let h = crypto.createHash('sha1').update(seed).digest().readUInt32LE(0);
  return () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const points = (ms, perQ) => Math.round(MAX_PTS * (0.5 + 0.5 * Math.max(0, 1 - ms / (perQ * 1000))));
const psiPts = (right, wrong) => Math.max(0, right * 10 - wrong * 5);

// jawaban bot (deterministik per room+soal)
function botAnswer(room, i) {
  const b = BOTS[room.bot]; const q = room.questions[i]; const r = rng(`${room.code}:${i}:${room.bot}`);
  if (room.mode === 'psikotes') {
    const right = Math.round(room.perQ * b.rate * (0.85 + r() * 0.3)), wrong = Math.round(right * (1 - b.acc) * 0.4 * r());
    return { right, wrong, ms: room.perQ * 1000, ok: true, pts: psiPts(right, wrong) };
  }
  const ms = Math.round((b.t[0] + r() * (b.t[1] - b.t[0])) * room.perQ * 1000);
  if (room.mode === 'esai' || room.mode === 'interaktif') {
    const ratio = Math.min(1, Math.max(0, b.acc + (r() - 0.5) * 0.5));
    const rr = room.mode === 'esai' ? Math.round(ratio * 100) / 100 : ratio > 0.85 ? 1 : Math.round(ratio * 4) / 4;
    return { ratio: rr, ok: rr >= (room.mode === 'esai' ? 0.75 : 0.999), ms, pts: Math.round(rr * points(ms, room.perQ)) };
  }
  const ok = r() < b.acc;
  const wrong = q.options.map((_, k) => k).filter(k => k !== q.answer);
  return { c: ok ? q.answer : wrong[Math.floor(r() * wrong.length)], ok, ms, pts: ok ? points(ms, room.perQ) : 0 };
}

// Arena: nyawa habis setelah 3 salah/terlewat
function livesBefore(room, p, i) {
  let lost = 0;
  for (let j = 0; j < i; j++) { const a = p.answers?.[j]; if (!a || !a.ok) lost++; }
  return LIVES - lost;
}

// Masih ada pemain manusia yang hidup (nyawa > 0) & belum keluar saat soal ke-i dibuka?
function arenaAlive(room, i, open) {
  return Object.values(room.players).some(p => !(p.left && (p.leftAt || 0) <= open) && livesBefore(room, p, i) > 0);
}

// Waktu tutup soal ke-i: penuh, ATAU lebih cepat bila semua peserta aktif sudah menjawab
function closeOf(room, i, open) {
  const full = open + room.perQ * 1000;
  if (room.mode === 'psikotes') return full;     // sprint psikotes selalu penuh
  const times = [];
  for (const p of Object.values(room.players)) {
    if (p.left && (p.leftAt || 0) <= open) continue;
    if (room.mode === 'arena' && livesBefore(room, p, i) <= 0) continue;
    const a = p.answers?.[i];
    if (a) times.push(open + a.ms);
    else if (p.left && p.leftAt < full) times.push(p.leftAt);
    else return full;
  }
  if (room.bot) times.push(open + botAnswer(room, i).ms);
  if (!times.length) return full;
  return Math.min(full, Math.max(...times) + 600);
}

function timeline(room, now) {
  if (room.status === 'waiting' || room.status === 'closed') return { phase: room.status };
  if (now < room.startAt) return { phase: 'countdown', idx: -1 };
  const n = room.questions.length, rv = revealOf(room) * 1000;
  let open = room.startAt;
  for (let i = 0; i < n; i++) {
    // Arena: semua pemain (manusia) sudah gugur → duel selesai, tidak perlu menunggu sisa soal
    if (room.mode === 'arena' && i > 0 && !arenaAlive(room, i, open)) return { phase: 'finished', idx: i, endAt: open, early: true };
    const close = closeOf(room, i, open), next = close + rv;
    if (now < next) return { phase: now < close ? 'question' : 'reveal', idx: i, open, close, next, early: close < open + room.perQ * 1000 - 50 };
    open = next;
  }
  return { phase: 'finished', idx: n, endAt: open };
}

function standings(room, now, tl) {
  const list = Object.entries(room.players).map(([uid, p]) => {
    const cur = tl.phase === 'question' ? p.answers?.[tl.idx] : null;
    // sembunyikan poin soal yang sedang berjalan (kecuali sprint psikotes yang tampil langsung)
    const hide = cur && room.mode !== 'psikotes';
    return { uid, ...p, score: (p.score || 0) - (hide ? cur.pts || 0 : 0), correct: (p.correct || 0) - (hide && cur.ok ? 1 : 0) };
  });
  if (room.bot) {
    const b = BOTS[room.bot]; const answers = {}; let score = 0, correct = 0;
    const doneUpto = tl.phase === 'finished' ? Math.min(tl.idx ?? room.questions.length, room.questions.length) - 1 : Math.min(tl.idx ?? -1, room.questions.length - 1);
    for (let i = 0; i <= doneUpto; i++) {
      const a = botAnswer(room, i);
      if (i === tl.idx && tl.phase === 'question') {
        if (room.mode === 'psikotes') { const f = Math.min(1, (now - tl.open) / (room.perQ * 1000)); const lr = Math.round(a.right * f), lw = Math.round(a.wrong * f); answers[i] = { ...a, right: lr, wrong: lw, pts: psiPts(lr, lw), live: true }; score += psiPts(lr, lw); continue; }
        if (now - tl.open >= a.ms) answers[i] = { ...a, hidden: true };
        continue;
      }
      answers[i] = a; score += a.pts; correct += a.ok ? 1 : 0;
    }
    list.push({ uid: 'bot', name: `${b.ico} ${b.name}`, isBot: true, answers, score, correct });
  }
  return list.sort((a, b) => b.score - a.score);
}

const qPublic = q => {
  const { id, type, answer, keyPoints, modelAnswer, explanation, source, seenKey, createdAt, ...rest } = q;
  return rest;
};

function publicView(room, me, now, avs = {}, viewers = 0) {
  const tl = timeline(room, now);
  const member = !!room.players[me];
  const players = standings(room, now, tl).map((p, rank) => {
    const cur = tl.idx >= 0 ? p.answers?.[tl.idx] : null;
    const showLast = tl.phase === 'reveal' || tl.phase === 'finished';
    return {
      uid: p.uid === me ? p.uid : undefined, name: p.name, isBot: !!p.isBot, isHost: p.uid === room.host.uid, me: p.uid === me,
      avatar: p.isBot ? null : avatarUrl(p.uid, avs),
      score: p.score || 0, correct: p.correct || 0, left: !!p.left, rank: rank + 1,
      answered: !!cur,
      lives: room.mode === 'arena' && !p.isBot ? Math.max(0, livesBefore(room, p, Math.max(0, tl.phase === 'finished' ? Math.min(tl.idx ?? room.questions.length, room.questions.length) : tl.phase === 'reveal' ? tl.idx + 1 : tl.idx))) : undefined,
      live: room.mode === 'psikotes' && cur ? { right: cur.right || 0, wrong: cur.wrong || 0 } : undefined,
      last: showLast ? (cur ? { ok: cur.ok, pts: cur.pts, ms: cur.ms, ratio: cur.ratio, right: cur.right, wrong: cur.wrong } : null) : undefined,
    };
  });
  let question = null;
  if (tl.phase === 'question' || tl.phase === 'reveal') {
    const q = room.questions[tl.idx];
    const mine = room.players[me]?.answers?.[tl.idx];
    question = { index: tl.idx, total: room.questions.length, category: q.category, difficulty: q.difficulty, ...qPublic(q), mine: mine || null };
    if (room.mode === 'arena' && member) {
      const p = room.players[me];
      question.lives = livesBefore(room, p, tl.idx);
      question.removed = p.power?.idx === tl.idx ? p.power.removed : null;
      question.powerUsed = !!p.power;
      let streak = 0; for (let j = tl.idx - 1; j >= 0 && p.answers?.[j]?.ok; j--) streak++;
      question.streak = streak;
    }
    if (tl.phase === 'reveal') Object.assign(question, { answer: q.answer, explanation: q.explanation || '', keyPoints: q.keyPoints, modelAnswer: q.modelAnswer });
  }
  const review = tl.phase === 'finished' && member ? room.questions.slice(0, Math.min(tl.idx ?? room.questions.length, room.questions.length)).map((q, i) => ({
    mode: room.mode, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation || '', modelAnswer: q.modelAnswer, kind: q.kind,
    mine: room.players[me]?.answers?.[i] ?? null,
  })) : undefined;
  return {
    code: room.code, title: room.title, status: room.status, phase: tl.phase, allOut: tl.phase === 'finished' && !!tl.early, closedReason: room.closedReason || null, visibility: room.visibility, mode: room.mode, psiType: room.psiType || null,
    settings: { category: room.category, difficulty: room.difficulty, count: room.questions?.length || room.count, perQ: room.perQ, maxPlayers: room.maxPlayers, bot: room.bot, mode: room.mode },
    host: { name: room.host.name, me: room.host.uid === me },
    players, question, review, viewers,
    timing: { serverNow: now, startAt: room.startAt || null, open: tl.open || null, close: tl.close || null, next: tl.next || null, reveal: revealOf(room), early: !!tl.early },
    isMember: member, spectator: !member && tl.phase !== 'waiting',
  };
}

function listItem(room, now) {
  const tl = timeline(room, now);
  return {
    code: room.code, title: room.title, host: room.host.name, category: room.category, difficulty: room.difficulty, mode: room.mode || 'pg', psiType: room.psiType || null,
    count: room.count, players: Object.values(room.players).filter(p => !p.left).length + (room.bot ? 1 : 0),
    maxPlayers: room.maxPlayers, bot: room.bot, phase: tl.phase, createdAt: room.createdAt, endAt: tl.endAt || null,
    qIndex: tl.idx >= 0 ? tl.idx + 1 : 0, viewers: countViewers(room, now),
  };
}
const countViewers = (room, now) => Object.values(room.viewers || {}).filter(t => now - t < 40000).length;

const humansIn = r => Object.values(r.players).filter(p => !p.left).length;
// host keluar → room ditutup/diarsipkan; semua manusia keluar → room juga hilang
function leaveRoom(r, uid) {
  if (!r || !r.players[uid]) return { result: null };
  const now = Date.now(), isHost = r.host.uid === uid;
  if (r.status === 'waiting') {
    if (isHost) { r.status = 'closed'; r.closedReason = 'host'; }
    else delete r.players[uid];
    return { room: r, result: null };
  }
  r.players[uid].left = true; r.players[uid].leftAt = now;
  const finished = r.status === 'finished' || timeline(r, now).phase === 'finished';
  if (finished) { if (isHost || !humansIn(r)) { r.status = 'archived'; r.finishedAt = r.finishedAt || now; } }
  else if (r.status === 'playing') {
    if (isHost) { r.status = 'closed'; r.closedReason = 'host'; r.closedAt = now; }
    else if (!humansIn(r)) { r.status = 'closed'; r.closedReason = 'empty'; r.closedAt = now; }
  }
  return { room: r, result: null };
}

export default handle(['GET', 'POST'], async (req, res) => {
  // Tamu (belum daftar) boleh melihat daftar room & menonton duel, tetapi tidak bisa membuat/gabung
  const guestId = 'tamu-' + crypto.createHash('sha1').update(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x')).digest('hex').slice(0, 10);
  const user = req.method === 'GET' ? (getUser(req) || { uid: guestId, name: 'Tamu', guest: true }) : requireUser(req);
  const db = await getDB();
  const now = Date.now();

  if (req.method === 'GET') {
    const p = query(req);
    if (p.get('list')) {
      // cache singkat per server agar polling lobby tidak menghabiskan kuota baca Firestore
      if (!globalThis.__roomsCache || now - globalThis.__roomsCache.at > 6000) globalThis.__roomsCache = { at: now, p: db.listRooms() };
      const all = await globalThis.__roomsCache.p.catch(e => { globalThis.__roomsCache = null; throw e; });
      // rapikan room lama (best effort) supaya daftar tidak penuh room basi
      const stale = all.filter(r => now - r.createdAt > ROOM_TTL || (timeline(r, now).phase === 'finished' && now - (timeline(r, now).endAt || r.createdAt) > FINISHED_SHOW)).slice(0, 5);
      stale.forEach(r => db.updateRoom(r.code, x => (x ? { room: { ...x, status: 'archived' } } : { result: null })).catch(() => {}));
      const fresh = all.filter(r => !stale.includes(r) && humansIn(r) > 0 && r.status !== 'closed' && r.status !== 'archived');
      const rooms = fresh.filter(r => r.visibility === 'public').map(r => listItem(r, now))
        .filter(r => r.phase !== 'closed')
        .sort((a, b) => ({ waiting: 0, countdown: 1, question: 1, reveal: 1, finished: 2 }[a.phase] - { waiting: 0, countdown: 1, question: 1, reveal: 1, finished: 2 }[b.phase]) || b.createdAt - a.createdAt)
        .slice(0, 30);
      const mine = fresh.filter(r => r.players[user.uid] && !r.players[user.uid].left && timeline(r, now).phase !== 'finished').map(r => listItem(r, now));
      return send(res, 200, { rooms, mine, serverNow: now });
    }
    const code = String(p.get('code') || '').toUpperCase();
    let room = await db.getRoom(code);
    if (!room || room.status === 'archived' && !room.players[user.uid]) throw httpError(404, 'Room tidak ditemukan');
    const tl = timeline(room, now);
    const isMember = !!room.players[user.uid];
    const wantView = !isMember && tl.phase !== 'waiting' && tl.phase !== 'closed' && room.status !== 'closed';
    const seen = room.viewers?.[user.uid] || 0;
    if ((room.status === 'playing' && tl.phase === 'finished') || (wantView && now - seen > 25000)) {
      try {
        room = await db.updateRoom(code, r => {
          if (!r) return { result: null };
          if (r.status === 'playing' && timeline(r, now).phase === 'finished') { r.status = 'finished'; r.finishedAt = now; }
          if (wantView) {
            r.viewers = Object.fromEntries(Object.entries(r.viewers || {}).filter(([, t]) => now - t < 60000));
            r.viewers[user.uid] = now;
          }
          return { room: r, result: r };
        }) || room;
      } catch (e) { console.warn('duel update view:', e.message); }
    }
    return send(res, 200, publicView(room, user.uid, now, await avatarMap(db), countViewers(room, now)));
  }

  const b = await readBody(req);
  const action = b.action;
  const me = { name: cleanName(user.name), joinedAt: now, score: 0, correct: 0, answers: {} };

  if (action === 'create') {
    await guardDuel(db, user);   // Free: maks 3 room/hari
    const mode = MODES[b.mode] ? b.mode : 'pg';
    const M = MODES[mode];
    const psiType = mode === 'psikotes' ? (b.psiType === 'cermat' ? 'cermat' : 'kraepelin') : null;
    const category = mode === 'psikotes' ? 'psikologi' : CATS.includes(b.category) ? b.category : 'campuran';
    const difficulty = DIFFS.includes(b.difficulty) ? b.difficulty : 'normal';
    const count = M.counts.includes(+b.count) ? +b.count : M.def;
    const bot = BOTS[b.bot] ? b.bot : null;
    const maxPlayers = Math.max(2, Math.min(8, parseInt(b.maxPlayers, 10) || 4));
    const room = {
      code: '', title: String(b.title || '').trim().slice(0, 40) || `Duel ${me.name}`,
      host: { uid: user.uid, name: me.name }, mode, psiType, category, difficulty, count, perQ: perQOf(mode, difficulty, psiType), maxPlayers, bot,
      visibility: b.visibility === 'private' ? 'private' : 'public', status: 'waiting',
      players: { [user.uid]: me }, viewers: {}, questions: [], createdAt: now, startAt: null,
    };
    for (let i = 0; i < 5; i++) { room.code = newCode(); if (await db.createRoom(room)) return send(res, 200, { code: room.code }); }
    throw httpError(500, 'Gagal membuat kode room, coba lagi');
  }

  // logout → keluar dari semua room yang masih diikuti
  if (action === 'leaveAll') {
    const rooms = (await db.listRooms()).filter(r => r.players[user.uid] && !r.players[user.uid].left);
    await Promise.all(rooms.map(r => db.updateRoom(r.code, x => leaveRoom(x, user.uid)).catch(() => {})));
    return send(res, 200, { ok: true, left: rooms.length });
  }

  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw httpError(400, 'Kode room harus 6 karakter');

  if (action === 'join') {
    const result = await db.updateRoom(code, r => {
      if (!r || r.status === 'archived' || r.status === 'closed') throw httpError(404, r?.status === 'closed' ? 'Room ini sudah ditutup host.' : 'Room tidak ditemukan. Cek lagi kodenya.');
      if (r.players[user.uid]) { r.players[user.uid].left = false; delete r.players[user.uid].leftAt; return { room: r, result: { code } }; }
      if (r.status !== 'waiting') throw httpError(400, 'Duel sudah dimulai — kamu bisa menontonnya lewat "View duel"');
      const count = Object.values(r.players).filter(p => !p.left).length + (r.bot ? 1 : 0);
      if (count >= r.maxPlayers) throw httpError(400, 'Room sudah penuh');
      r.players[user.uid] = me;
      return { room: r, result: { code } };
    });
    return send(res, 200, result);
  }

  if (action === 'leave') {
    await db.updateRoom(code, r => leaveRoom(r, user.uid));
    return send(res, 200, { ok: true });
  }
  if (action === 'start') {
    const room = await db.getRoom(code);
    if (!room) throw httpError(404, 'Room tidak ditemukan');
    if (room.host.uid !== user.uid) throw httpError(403, 'Hanya host yang bisa memulai');
    if (room.status !== 'waiting') throw httpError(400, 'Duel sudah dimulai');
    const participants = Object.values(room.players).filter(p => !p.left).length + (room.bot ? 1 : 0);
    if (participants < 2) throw httpError(400, 'Butuh minimal 2 peserta (atau tambahkan bot)');
    const mode = room.mode || 'pg';
    let questions;
    if (mode === 'psikotes') {
      questions = Array.from({ length: room.count }, (_, i) => ({ question: room.psiType === 'cermat' ? `Ronde ${i + 1}: Tes kecermatan` : `Kolom ${i + 1}: Kraepelin`, psi: room.psiType, round: i + 1, category: 'psikologi', difficulty: room.difficulty }));
    } else {
      ({ questions } = await pickQuestions({ category: room.category, difficulty: room.difficulty, type: MODES[mode].type, limit: room.count }));
      if (!questions.length) throw httpError(400, 'Soal untuk pilihan ini belum tersedia — coba materi/level lain');
      questions = questions.map(q => {
        const { seenKey, createdAt, type, source, ...rest } = q;
        return JSON.parse(JSON.stringify({ ...rest, explanation: q.explanation || '' }));
      });
    }
    await db.updateRoom(code, r => {
      if (!r || r.status !== 'waiting') throw httpError(400, 'Duel sudah dimulai');
      r.questions = questions; r.count = questions.length;
      r.status = 'playing'; r.startAt = Date.now() + COUNTDOWN * 1000;
      return { room: r, result: null };
    });
    return send(res, 200, { ok: true });
  }

  if (action === 'power') {   // Arena: 50:50 sekali per duel
    const index = parseInt(b.index, 10);
    const result = await db.updateRoom(code, r => {
      if (!r || !r.players[user.uid]) throw httpError(403, 'Kamu bukan peserta room ini');
      if ((r.mode || 'pg') !== 'arena') throw httpError(400, 'Power-up hanya di mode Arena');
      const tl = timeline(r, Date.now()); const p = r.players[user.uid];
      if (tl.phase !== 'question' || tl.idx !== index) throw httpError(409, 'Waktu soal ini sudah habis');
      if (p.power) throw httpError(400, '50:50 sudah dipakai');
      const q = r.questions[index];
      const removed = q.options.map((_, k) => k).filter(k => k !== q.answer).sort(() => Math.random() - 0.5).slice(0, q.options.length - 2);
      p.power = { idx: index, removed };
      return { room: r, result: { removed } };
    });
    return send(res, 200, result);
  }

  if (action === 'answer') {
    const index = parseInt(b.index, 10);
    const result = await db.updateRoom(code, r => {
      if (!r || !r.players[user.uid]) throw httpError(403, 'Kamu bukan peserta room ini');
      const t = Date.now(); const mode = r.mode || 'pg';
      let tl = timeline(r, t);
      // sprint psikotes: laporan terakhir masih diterima 2 detik setelah waktu kolom habis
      if (mode === 'psikotes' && tl.phase === 'reveal' && tl.idx === index && t - tl.close < 2000) tl = { ...tl, phase: 'question' };
      if (tl.phase !== 'question' || tl.idx !== index) throw httpError(409, 'Waktu menjawab soal ini sudah habis');
      const p = r.players[user.uid]; const q = r.questions[index]; const ms = Math.min(t - tl.open, r.perQ * 1000);
      if (mode === 'arena' && livesBefore(r, p, index) <= 0) throw httpError(400, 'Nyawamu habis — tonton sampai selesai ya!');
      if (mode === 'psikotes') {
        const prev = p.answers[index];
        const right = Math.max(prev?.right || 0, Math.min(r.perQ * 6, parseInt(b.right, 10) || 0));
        const wrong = Math.max(prev?.wrong || 0, Math.min(r.perQ * 6, parseInt(b.wrong, 10) || 0));
        const pts = psiPts(right, wrong);
        p.score += pts - (prev?.pts || 0);
        if (!prev) p.correct += 1;
        p.answers[index] = { right, wrong, ok: true, ms, pts };
        return { room: r, result: { accepted: true, pts } };
      }
      if (p.answers[index]) return { result: { already: true } };
      let a;
      if (mode === 'esai') {
        const text = String(b.text || '').trim().slice(0, 1500);
        if (text.length < 3) throw httpError(400, 'Tulis jawabanmu dulu');
        const g = keywordGrade(text, q.keyPoints || [], q.modelAnswer || '');
        const ratio = g.score / 100;
        a = { text, ratio, ok: g.score >= 75, ms, pts: Math.round(ratio * points(ms, r.perQ)), covered: g.covered.length, of: (q.keyPoints || []).length };
      } else if (mode === 'interaktif') {
        const ratio = Math.max(0, Math.min(1, Number(b.ratio) || 0));
        a = { ratio, ok: ratio >= 0.999, ms, pts: Math.round(ratio * points(ms, r.perQ)) };
      } else {
        const choice = parseInt(b.choice, 10);
        if (!(choice >= 0 && choice < (q.options?.length || 4))) throw httpError(400, 'Pilihan tidak valid');
        const ok = choice === q.answer;
        let pts = ok ? points(ms, r.perQ) : 0;
        if (mode === 'arena' && ok) { let streak = 0; for (let j = index - 1; j >= 0 && p.answers?.[j]?.ok; j--) streak++; pts = Math.round(pts * Math.min(1.5, 1 + streak * 0.1)); }
        a = { c: choice, ok, ms, pts };
      }
      p.answers[index] = a; p.score += a.pts; p.correct += a.ok ? 1 : 0;
      return { room: r, result: { accepted: true, ...(mode === 'esai' ? { score: Math.round(a.ratio * 100) } : {}) } };
    });
    return send(res, 200, result);
  }

  throw httpError(400, 'Aksi tidak dikenal');
});
