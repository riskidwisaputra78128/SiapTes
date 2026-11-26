// Duel multiplayer (khusus pengguna login)
// GET  /api/duel?list=1            → daftar room publik yang aktif
// GET  /api/duel?code=ABC123       → status room (untuk anggota)
// POST /api/duel { action: 'create' | 'join' | 'leave' | 'start' | 'answer', ... }
import crypto from 'node:crypto';
import { handle, readBody, query, send, httpError } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { getDB } from './_lib/db.js';
import { avatarMap, avatarUrl } from './_lib/avatar.js';
import { pickQuestions, DIFFS } from './_lib/pick.js';

const CATS = ['campuran', 'twk', 'tiu', 'tkp', 'ojk', 'bi', 'bumn', 'telkom', 'keuangan', 'english', 'isu', 'psikologi'];
const PER_Q = { easy: 20, normal: 17, hard: 14, prof: 12, all: 17 }; // detik per soal
const REVEAL = 4;       // detik jeda pembahasan
const COUNTDOWN = 5;    // detik hitung mundur
const MAX_PTS = 1000;
const BOTS = {
  easy: { name: 'Bot Pemula', ico: '🐣', acc: 0.45, t: [0.5, 0.95] },
  normal: { name: 'Bot Cerdas', ico: '🤖', acc: 0.65, t: [0.35, 0.85] },
  hard: { name: 'Bot Jenius', ico: '🧠', acc: 0.8, t: [0.25, 0.7] },
  prof: { name: 'Bot Profesor', ico: '🎓', acc: 0.92, t: [0.15, 0.55] },
};
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL = 2 * 3600 * 1000;

const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const cleanName = s => String(s || 'Peserta').split(' ').slice(0, 2).join(' ').slice(0, 24);

// RNG deterministik agar jawaban bot konsisten di setiap request
function rng(seed) {
  let h = crypto.createHash('sha1').update(seed).digest().readUInt32LE(0);
  return () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function botAnswer(room, i) {
  const b = BOTS[room.bot]; const q = room.questions[i]; const r = rng(`${room.code}:${i}:${room.bot}`);
  const ok = r() < b.acc;
  const ms = Math.round((b.t[0] + r() * (b.t[1] - b.t[0])) * room.perQ * 1000);
  const wrong = [0, 1, 2, 3].filter(k => k !== q.answer);
  return { c: ok ? q.answer : wrong[Math.floor(r() * wrong.length)], ok, ms, pts: ok ? points(ms, room.perQ) : 0 };
}
const points = (ms, perQ) => Math.round(MAX_PTS * (0.5 + 0.5 * Math.max(0, 1 - ms / (perQ * 1000))));

function timeline(room, now) {
  const slot = (room.perQ + REVEAL) * 1000;
  const n = room.questions.length;
  if (room.status === 'waiting' || room.status === 'closed') return { phase: room.status };
  if (now < room.startAt) return { phase: 'countdown', idx: -1 };
  const idx = Math.floor((now - room.startAt) / slot);
  if (idx >= n || room.status === 'finished') return { phase: 'finished', idx: n };
  const open = room.startAt + idx * slot, close = open + room.perQ * 1000;
  return { phase: now < close ? 'question' : 'reveal', idx, open, close, next: open + slot };
}

// Gabungkan pemain manusia + bot (bot dihitung on-the-fly)
function standings(room, now, tl) {
  const list = Object.entries(room.players).map(([uid, p]) => {
    // sembunyikan poin soal yang sedang berjalan agar tidak membocorkan benar/salah
    const cur = tl.phase === 'question' ? p.answers?.[tl.idx] : null;
    return { uid, ...p, score: (p.score || 0) - (cur?.pts || 0), correct: (p.correct || 0) - (cur?.ok ? 1 : 0) };
  });
  if (room.bot) {
    const b = BOTS[room.bot]; const answers = {}; let score = 0, correct = 0;
    const doneUpto = tl.phase === 'finished' ? room.questions.length : tl.idx ?? -1;
    for (let i = 0; i <= Math.min(doneUpto, room.questions.length - 1); i++) {
      if (i < 0) continue;
      const a = botAnswer(room, i);
      const isCurrent = i === tl.idx && tl.phase === 'question';
      if (isCurrent && now - tl.open < a.ms) continue; // bot belum menjawab
      if (i === tl.idx && tl.phase === 'question') { answers[i] = { ...a, hidden: true }; continue; }
      answers[i] = a; score += a.pts; correct += a.ok ? 1 : 0;
    }
    list.push({ uid: 'bot', name: `${b.ico} ${b.name}`, isBot: true, answers, score, correct });
  }
  return list.sort((a, b) => b.score - a.score);
}

function publicView(room, me, now, avs = {}) {
  const tl = timeline(room, now);
  const players = standings(room, now, tl).map((p, rank) => {
    const cur = tl.idx >= 0 ? p.answers?.[tl.idx] : null;
    return {
      uid: p.uid === me ? p.uid : undefined, name: p.name, isBot: !!p.isBot, isHost: p.uid === room.host.uid, me: p.uid === me,
      avatar: p.isBot ? null : avatarUrl(p.uid, avs),
      score: p.score || 0, correct: p.correct || 0, left: !!p.left, rank: rank + 1,
      answered: !!cur,
      last: tl.phase === 'reveal' || tl.phase === 'finished' ? (cur ? { ok: cur.ok, pts: cur.pts, ms: cur.ms } : null) : undefined,
    };
  });
  let question = null;
  if (tl.phase === 'question' || tl.phase === 'reveal') {
    const q = room.questions[tl.idx];
    const mine = room.players[me]?.answers?.[tl.idx];
    question = {
      index: tl.idx, total: room.questions.length, question: q.question, options: q.options, category: q.category, difficulty: q.difficulty,
      source: q.source || null, myChoice: mine ? mine.c : null,
      ...(tl.phase === 'reveal' ? { answer: q.answer, explanation: q.explanation || '' } : {}),
    };
  }
  const review = tl.phase === 'finished' ? room.questions.map((q, i) => ({
    question: q.question, options: q.options, answer: q.answer, explanation: q.explanation || '', mine: room.players[me]?.answers?.[i] ?? null,
  })) : undefined;
  return {
    code: room.code, title: room.title, status: room.status, phase: tl.phase, visibility: room.visibility,
    settings: { category: room.category, difficulty: room.difficulty, count: room.questions?.length || room.count, perQ: room.perQ, maxPlayers: room.maxPlayers, bot: room.bot },
    host: { name: room.host.name, me: room.host.uid === me },
    players, question, review,
    timing: { serverNow: now, startAt: room.startAt || null, open: tl.open || null, close: tl.close || null, next: tl.next || null, reveal: REVEAL },
    isMember: !!room.players[me],
  };
}

function listItem(room, now) {
  const tl = timeline(room, now);
  return {
    code: room.code, title: room.title, host: room.host.name, category: room.category, difficulty: room.difficulty,
    count: room.count, players: Object.values(room.players).filter(p => !p.left).length + (room.bot ? 1 : 0),
    maxPlayers: room.maxPlayers, bot: room.bot, phase: tl.phase, createdAt: room.createdAt,
  };
}

export default handle(['GET', 'POST'], async (req, res) => {
  const user = requireUser(req);
  const db = await getDB();
  const now = Date.now();

  if (req.method === 'GET') {
    const p = query(req);
    if (p.get('list')) {
      const rooms = (await db.listRooms())
        .filter(r => r.visibility === 'public' && now - r.createdAt < ROOM_TTL)
        .map(r => listItem(r, now))
        .filter(r => r.phase === 'waiting' || r.phase === 'countdown' || r.phase === 'question' || r.phase === 'reveal')
        .sort((a, b) => (a.phase === 'waiting' ? 0 : 1) - (b.phase === 'waiting' ? 0 : 1) || b.createdAt - a.createdAt)
        .slice(0, 30);
      const mine = (await db.listRooms()).filter(r => r.players[user.uid] && !r.players[user.uid].left && now - r.createdAt < ROOM_TTL).map(r => listItem(r, now));
      return send(res, 200, { rooms, mine, serverNow: now });
    }
    const code = String(p.get('code') || '').toUpperCase();
    let room = await db.getRoom(code);
    if (!room) throw httpError(404, 'Room tidak ditemukan');
    // tandai selesai sekali saja
    if (room.status === 'playing' && timeline(room, now).phase === 'finished') {
      await db.updateRoom(code, r => (r && r.status === 'playing' ? { room: { ...r, status: 'finished', finishedAt: now } } : { result: null }));
      room.status = 'finished';
    }
    return send(res, 200, publicView(room, user.uid, now, await avatarMap(db)));
  }

  const b = await readBody(req);
  const action = b.action;
  const me = { name: cleanName(user.name), joinedAt: now, score: 0, correct: 0, answers: {} };

  if (action === 'create') {
    const category = CATS.includes(b.category) ? b.category : 'campuran';
    const difficulty = DIFFS.includes(b.difficulty) ? b.difficulty : 'normal';
    const count = [5, 10, 15].includes(+b.count) ? +b.count : 10;
    const bot = BOTS[b.bot] ? b.bot : null;
    const maxPlayers = Math.max(2, Math.min(8, parseInt(b.maxPlayers, 10) || 4));
    const room = {
      code: '', title: String(b.title || '').trim().slice(0, 40) || `Duel ${me.name}`,
      host: { uid: user.uid, name: me.name }, category, difficulty, count, perQ: PER_Q[difficulty], maxPlayers, bot,
      visibility: b.visibility === 'private' ? 'private' : 'public', status: 'waiting',
      players: { [user.uid]: me }, questions: [], createdAt: now, startAt: null,
    };
    for (let i = 0; i < 5; i++) { room.code = newCode(); if (await db.createRoom(room)) return send(res, 200, { code: room.code }); }
    throw httpError(500, 'Gagal membuat kode room, coba lagi');
  }

  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw httpError(400, 'Kode room harus 6 karakter');

  if (action === 'join') {
    const result = await db.updateRoom(code, r => {
      if (!r) throw httpError(404, 'Room tidak ditemukan. Cek lagi kodenya.');
      if (r.players[user.uid]) { r.players[user.uid].left = false; return { room: r, result: { code } }; }
      if (r.status !== 'waiting') throw httpError(400, 'Duel sudah dimulai atau selesai');
      const count = Object.values(r.players).filter(p => !p.left).length + (r.bot ? 1 : 0);
      if (count >= r.maxPlayers) throw httpError(400, 'Room sudah penuh');
      r.players[user.uid] = me;
      return { room: r, result: { code } };
    });
    return send(res, 200, result);
  }

  if (action === 'leave') {
    await db.updateRoom(code, r => {
      if (!r || !r.players[user.uid]) return { result: null };
      if (r.status === 'waiting') {
        if (r.host.uid === user.uid) { r.status = 'closed'; }
        else delete r.players[user.uid];
      } else r.players[user.uid].left = true;
      return { room: r, result: null };
    });
    return send(res, 200, { ok: true });
  }

  if (action === 'start') {
    const room = await db.getRoom(code);
    if (!room) throw httpError(404, 'Room tidak ditemukan');
    if (room.host.uid !== user.uid) throw httpError(403, 'Hanya host yang bisa memulai');
    if (room.status !== 'waiting') throw httpError(400, 'Duel sudah dimulai');
    const participants = Object.values(room.players).filter(p => !p.left).length + (room.bot ? 1 : 0);
    if (participants < 2) throw httpError(400, 'Butuh minimal 2 peserta (atau tambahkan bot)');
    const { questions } = await pickQuestions({ category: room.category, difficulty: room.difficulty, type: 'pg', limit: room.count });
    if (!questions.length) throw httpError(400, 'Soal untuk pilihan ini belum tersedia');
    await db.updateRoom(code, r => {
      if (!r || r.status !== 'waiting') throw httpError(400, 'Duel sudah dimulai');
      r.questions = questions.map(q => ({ id: q.id, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation || '', category: q.category, difficulty: q.difficulty, source: q.source || null }));
      r.status = 'playing'; r.startAt = Date.now() + COUNTDOWN * 1000;
      return { room: r, result: null };
    });
    return send(res, 200, { ok: true });
  }

  if (action === 'answer') {
    const index = parseInt(b.index, 10), choice = parseInt(b.choice, 10);
    if (!(choice >= 0 && choice <= 3)) throw httpError(400, 'Pilihan tidak valid');
    const result = await db.updateRoom(code, r => {
      if (!r || !r.players[user.uid]) throw httpError(403, 'Kamu bukan peserta room ini');
      const t = Date.now(); const tl = timeline(r, t);
      if (tl.phase !== 'question' || tl.idx !== index) throw httpError(409, 'Waktu menjawab soal ini sudah habis');
      const p = r.players[user.uid];
      if (p.answers[index]) return { result: { already: true } };
      const q = r.questions[index]; const ms = t - tl.open; const ok = choice === q.answer;
      const pts = ok ? points(ms, r.perQ) : 0;
      p.answers[index] = { c: choice, ok, ms, pts }; p.score += pts; p.correct += ok ? 1 : 0;
      return { room: r, result: { accepted: true } };
    });
    return send(res, 200, result);
  }

  throw httpError(400, 'Aksi tidak dikenal');
});
