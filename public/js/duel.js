// Arena Duel: lobby (buat/gabung/tonton room) + ruang duel real-time (polling) — 5 mode + penonton "View duel"
import { api, session } from './api.js';
import { $, $$, esc, toast, sheet, confetti, vibrate, fmt, icons, avatar } from './ui.js';
import { sfx } from './sound.js';
import { CATEGORIES, DIFFS, catByKey, diffByKey } from './data.js';
import { setDuelPresence, onlineWidget } from './presence.js';
import { mountEngine, IX_KIND } from './interactive.js';
import { mountSprint } from './psikotes.js';
import { setMood } from './sound.js';

const L = ['A', 'B', 'C', 'D'];
const BOT_INFO = {
  easy: { ico: '🐣', name: 'Pemula', desc: '±45% benar' },
  normal: { ico: '🤖', name: 'Cerdas', desc: '±65% benar' },
  hard: { ico: '🧠', name: 'Jenius', desc: '±80% benar, cepat' },
  prof: { ico: '🎓', name: 'Profesor', desc: '±92% benar, sangat cepat' },
};
const MODE_INFO = {
  pg: { ico: '📝', name: 'Pilihan Ganda', desc: 'Adu cepat & tepat A–D' },
  arena: { ico: '🎮', name: 'Arena Game', desc: '3 nyawa, combo poin, 50:50' },
  esai: { ico: '✍️', name: 'Esai', desc: 'Jawab bebas, dinilai otomatis' },
  interaktif: { ico: '🧩', name: 'Interaktif Visual', desc: 'Susun, cocokkan, isi rumpang…' },
  psikotes: { ico: '🧠', name: 'Tes Psikologi', desc: 'Sprint Kraepelin / kecermatan' },
};
const COUNTS = { pg: [5, 10, 15], arena: [5, 10, 15], esai: [3, 5], interaktif: [5, 8, 10], psikotes: [3, 5, 8] };
const modeChip = r => { const m = MODE_INFO[r.mode || 'pg']; return `<span class="chip mode-chip">${m.ico} ${m.name}${r.mode === 'psikotes' ? (r.psiType === 'cermat' ? ' · Kecermatan' : ' · Kraepelin') : ''}</span>`; };
const phaseLabel = { waiting: '🟢 Menunggu pemain', countdown: '⏳ Segera mulai', question: '⚔️ Sedang duel', reveal: '⚔️ Sedang duel', finished: '🏁 Selesai' };

function guestBlock(app) {
  app.innerHTML = `<div class="glass card empty fade-in"><div style="font-size:52px">⚔️</div><h2 class="h2">Arena Duel khusus pemilik akun</h2>
    <p class="muted">Buat room, ajak teman dengan kode, atau tantang bot. Daftar gratis untuk ikut duel.</p>
    <button class="btn" id="toLogin">Daftar / Masuk</button></div>`;
  $('#toLogin').onclick = () => { session.clear(); location.hash = '#/login'; };
}

export async function renderDuel(app, params) {
  if (!session.loggedIn) return guestBlock(app);
  const code = (params.get('code') || '').toUpperCase();
  if (code) return renderRoom(app, code, params.get('view') === '1');
  return renderLobby(app);
}

/* ───────── Lobby ───────── */
function roomCard(r, mine) {
  const c = catByKey[r.category] || {};
  const canJoin = r.phase === 'waiting' && r.players < r.maxPlayers;
  const live = ['countdown', 'question', 'reveal'].includes(r.phase);
  return `
    <div class="glass duel-card tilt">
      <div class="row between" style="gap:8px">
        <span class="chip ${r.phase === 'waiting' ? 'live' : ''}">${phaseLabel[r.phase] || r.phase}</span>
        <span class="code-tag">#${r.code}</span>
      </div>
      <b class="duel-title">${esc(r.title)}</b>
      <div class="row wrap" style="gap:6px">
        ${modeChip(r)}
        ${r.mode === 'psikotes' ? '' : `<span class="chip">${c.ico || ''} ${esc(c.name || r.category)}</span>`}
        <span class="chip ${r.difficulty}">${diffByKey[r.difficulty]?.name || ''}</span>
        <span class="chip">${r.count} soal</span>
        ${r.bot ? `<span class="chip">${BOT_INFO[r.bot].ico} Bot ${BOT_INFO[r.bot].name}</span>` : ''}
      </div>
      <div class="row between">
        <span class="dim">👑 ${esc(r.host)} · 👥 ${r.players}/${r.maxPlayers}${live ? ` · Soal ${r.qIndex}/${r.count}` : ''}${r.viewers ? ` · 👁️ ${r.viewers}` : ''}</span>
        ${mine ? `<a class="btn sm" href="#/duel?code=${r.code}">Masuk</a>`
          : canJoin ? `<button class="btn sm" data-join="${r.code}">Gabung</button>`
            : live || r.phase === 'finished' ? `<a class="btn sm view-btn" href="#/duel?code=${r.code}&view=1">👁️ ${r.phase === 'finished' ? 'Lihat podium' : 'View duel'}</a>`
              : `<span class="dim">Penuh</span>`}
      </div>
    </div>`;
}

async function joinRoom(code) {
  try {
    await api('/duel', { method: 'POST', body: { action: 'join', code } });
    location.hash = `#/duel?code=${code}`;
  } catch (e) { toast(e.message, 'err'); }
}

function renderLobby(app) {
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="glass hero-card duel-hero tilt">
      <span class="hero-tag">⚔️ Multiplayer</span>
      <h1 class="h1" style="margin-top:10px">Arena <span class="grad-text">Duel</span></h1>
      <p class="muted" style="margin:0 0 14px">Adu cepat & tepat menjawab soal yang sama, di waktu yang sama — Pilihan Ganda, Arena, Esai, Interaktif, atau Tes Psikologi. Ajak teman lewat kode, tantang bot, atau tonton duel yang sedang berlangsung.</p>
      <form class="join-row" id="joinForm">
        <input id="joinCode" class="input code-input" maxlength="6" placeholder="KODE ROOM" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="btn" type="submit">Gabung</button>
      </form>
      <button class="btn warm block" id="createBtn" style="margin-top:12px">＋ Buat room duel</button>
    </div>
    <div id="onlineDuel" hidden></div>
    <div id="mineBox"></div>
    <div>
      <div class="section-head"><h2 class="h2">🟢 Room aktif & tontonan</h2><span class="dim" id="lobbyUpd"></span></div>
      <div id="roomList" class="duel-grid"><div class="skeleton" style="height:140px"></div></div>
    </div>
  </section>`;
  const ci = $('#joinCode');
  ci.oninput = () => (ci.value = ci.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  $('#joinForm').onsubmit = e => { e.preventDefault(); if (ci.value.length !== 6) return toast('Kode room 6 karakter', 'err'); joinRoom(ci.value); };
  $('#createBtn').onclick = openCreate;
  setDuelPresence(null);
  onlineWidget($('#onlineDuel'));

  const load = async () => {
    if (!document.body.contains($('#roomList'))) return false;
    try {
      const d = await api('/duel?list=1');
      $('#mineBox').innerHTML = d.mine.length ? `<div class="section-head"><h2 class="h2">🎮 Room kamu</h2></div><div class="duel-grid">${d.mine.map(r => roomCard(r, true)).join('')}</div>` : '';
      $('#roomList').innerHTML = d.rooms.length ? d.rooms.map(r => roomCard(r, d.mine.some(m => m.code === r.code))).join('')
        : `<div class="glass card empty" style="grid-column:1/-1"><div style="font-size:40px">🏟️</div>Belum ada room publik. Buat room pertama dan ajak temanmu!</div>`;
      $$('[data-join]', app).forEach(b => (b.onclick = () => joinRoom(b.dataset.join)));
      $('#lobbyUpd').textContent = 'diperbarui otomatis';
    } catch (e) { $('#roomList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    return true;
  };
  const loop = async () => { if (await load()) setTimeout(() => !document.hidden ? loop() : setTimeout(loop, 8000), 8000); };
  loop();
}

function openCreate() {
  const cfg = { title: '', mode: 'pg', psiType: 'kraepelin', category: 'campuran', difficulty: 'normal', count: 10, bot: null, maxPlayers: 4, visibility: 'public' };
  sheet(`
    <h3 class="h2">＋ Buat room duel</h3>
    <div class="stack" style="gap:14px;margin-top:12px">
      <div class="field"><label>Nama room (opsional)</label><input class="input" id="cTitle" maxlength="40" placeholder="Contoh: Latihan OJK bareng"></div>
      <div class="field"><label>Mode duel</label><div class="mode-pick" id="cMode">${Object.entries(MODE_INFO).map(([k, m]) => `<button class="glass mp" data-v="${k}"><span class="mp-ico">${m.ico}</span><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div></div>
      <div class="field" id="psiRow"><label>Jenis tes psikologi</label><div class="pill-group" id="cPsi"><button class="pill" data-v="kraepelin">🔢 Kraepelin / Pauli</button><button class="pill" data-v="cermat">🔍 Kecermatan</button></div>
        <p class="dim" style="margin:6px 0 0;font-size:12.5px">Tiap ronde semua peserta mengerjakan sprint bersamaan. Poin = benar × 10 − salah × 5.</p></div>
      <div class="field" id="catRow"><label>Materi</label><select class="input" id="cCat">${CATEGORIES.map(c => `<option value="${c.key}">${c.ico} ${c.name}</option>`).join('')}</select></div>
      <div class="field"><label>Level</label><div class="pill-group" id="cDiff">${DIFFS.map(d => `<button class="pill" data-v="${d.key}">${d.name}</button>`).join('')}</div></div>
      <div class="field"><label id="cCountLbl">Jumlah soal</label><div class="pill-group" id="cCount"></div></div>
      <div class="field"><label>Lawan bot</label><div class="pill-group" id="cBot">
        <button class="pill" data-v="">Tanpa bot</button>
        ${Object.entries(BOT_INFO).map(([k, b]) => `<button class="pill" data-v="${k}">${b.ico} ${b.name}<span class="sub">${b.desc}</span></button>`).join('')}</div></div>
      <div class="row between">
        <div class="field"><label>Maks. peserta</label>
          <div class="row" style="gap:8px"><button class="icon-btn" id="mMinus">−</button><b id="mVal" style="font-family:var(--num);font-size:20px;min-width:24px;text-align:center"></b><button class="icon-btn" id="mPlus">+</button></div></div>
        <div class="field"><label>Visibilitas</label><div class="tabs" id="cVis"><button data-v="public">🌐 Publik</button><button data-v="private">🔒 Privat</button></div></div>
      </div>
      <p class="dim" style="margin:-4px 0 0">Room publik tampil di daftar dan bisa ditonton orang lain lewat <b>View duel</b>. Room privat hanya lewat kode.</p>
      <button class="btn block" id="cGo">⚔️ Buat room</button>
    </div>`,
  (el, close) => {
    const sync = () => {
      if (!COUNTS[cfg.mode].includes(cfg.count)) cfg.count = COUNTS[cfg.mode][Math.min(1, COUNTS[cfg.mode].length - 1)];
      $$('#cMode .mp', el).forEach(b => b.classList.toggle('on', b.dataset.v === cfg.mode));
      $('#psiRow', el).hidden = cfg.mode !== 'psikotes'; $('#catRow', el).hidden = cfg.mode === 'psikotes';
      $$('#cPsi .pill', el).forEach(b => b.classList.toggle('on', b.dataset.v === cfg.psiType));
      $('#cCountLbl', el).textContent = cfg.mode === 'psikotes' ? 'Jumlah ronde' : 'Jumlah soal';
      $('#cCount', el).innerHTML = COUNTS[cfg.mode].map(n => `<button class="pill ${n === cfg.count ? 'on' : ''}" data-v="${n}">${n}</button>`).join('');
      $$('#cCount .pill', el).forEach(b => (b.onclick = () => { cfg.count = +b.dataset.v; sync(); }));
      $$('#cDiff .pill', el).forEach(b => b.classList.toggle('on', b.dataset.v === cfg.difficulty));
      $$('#cBot .pill', el).forEach(b => b.classList.toggle('on', (b.dataset.v || null) === cfg.bot));
      $$('#cVis button', el).forEach(b => b.classList.toggle('on', b.dataset.v === cfg.visibility));
      $('#mVal', el).textContent = cfg.maxPlayers;
    };
    $$('#cMode .mp', el).forEach(b => (b.onclick = () => { cfg.mode = b.dataset.v; sync(); }));
    $$('#cPsi .pill', el).forEach(b => (b.onclick = () => { cfg.psiType = b.dataset.v; sync(); }));
    $$('#cDiff .pill', el).forEach(b => (b.onclick = () => { cfg.difficulty = b.dataset.v; sync(); }));
    $$('#cBot .pill', el).forEach(b => (b.onclick = () => { cfg.bot = b.dataset.v || null; sync(); }));
    $$('#cVis button', el).forEach(b => (b.onclick = () => { cfg.visibility = b.dataset.v; sync(); }));
    $('#mMinus', el).onclick = () => { cfg.maxPlayers = Math.max(2, cfg.maxPlayers - 1); sync(); };
    $('#mPlus', el).onclick = () => { cfg.maxPlayers = Math.min(8, cfg.maxPlayers + 1); sync(); };
    sync();
    $('#cGo', el).onclick = async () => {
      const btn = $('#cGo', el); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const r = await api('/duel', { method: 'POST', body: { action: 'create', ...cfg, title: $('#cTitle', el).value, category: $('#cCat', el).value } });
        close(); location.hash = `#/duel?code=${r.code}`;
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = '⚔️ Buat room'; }
    };
  });
}

/* ───────── Ruang duel ───────── */
function renderRoom(app, code, wantView) {
  let st = null, offset = 0, lastKey = '', raf = 0, timer = 0, saved = false, autoJoined = false, alive = true, fails = 0;
  let engine = null, sprint = null, sprintIdx = -1, lastSent = 0, sendT = 0, lastClose = 0, essayDraft = '';
  const now = () => Date.now() + offset;
  app.innerHTML = `<div id="duelRoom" class="fade-in"><div class="skeleton" style="height:320px"></div></div>`;
  const root = $('#duelRoom');
  const sched = ms => { clearTimeout(timer); timer = setTimeout(poll, ms); };
  const stopAll = () => { alive = false; clearTimeout(timer); cancelAnimationFrame(raf); sprint?.stop(); setDuelPresence(null); };
  const onHash = () => {
    if (document.body.contains(root)) return;
    // pindah halaman setelah duel selesai = keluar room (room hilang dari daftar bila host/semua sudah keluar)
    if (st?.isMember && st.phase === 'finished') api('/duel', { method: 'POST', body: { action: 'leave', code } }).catch(() => {});
    stopAll(); removeEventListener('hashchange', onHash);
  };
  addEventListener('hashchange', onHash);
  const spec = () => !!st?.spectator;

  async function poll() {
    clearTimeout(timer);
    if (!alive || !document.body.contains(root)) return stopAll();
    let d;
    try {
      d = await api('/duel?code=' + code);
      fails = 0; $('#netWarn')?.remove();
    } catch (e) {
      // 404/403 = room memang tidak ada; selain itu (jaringan/server sibuk) → coba lagi tanpa membuang layar duel
      if (e.status === 404 || e.status === 403 || (!st && ++fails > 3)) {
        root.innerHTML = `<div class="glass card empty"><div style="font-size:40px">😕</div><p>${esc(e.message)}</p><a class="btn" href="#/duel">Kembali ke lobby</a></div>`;
        return stopAll();
      }
      fails++;
      if (st && !$('#netWarn')) root.insertAdjacentHTML('afterbegin', '<div id="netWarn" class="net-warn">📡 Koneksi tersendat, menyambung ulang…</div>');
      return sched(Math.min(6000, 1000 * fails));
    }
    offset = d.timing.serverNow - Date.now();
    if (!d.isMember && !autoJoined && d.phase === 'waiting' && !wantView) {
      autoJoined = true;
      try { await api('/duel', { method: 'POST', body: { action: 'join', code } }); return sched(300); } catch (e) { toast(e.message, 'err'); }
    }
    st = d;
    try { draw(); } catch (e) { console.error('duel draw', e); }
    setDuelPresence(d.isMember && d.phase === 'waiting' && d.visibility === 'public' ? code : null);
    const fast = ['countdown', 'question', 'reveal'].includes(st.phase);
    sched(fast ? (st.spectator ? 2000 : 1300) : st.phase === 'finished' ? 30000 : 2500);
  }

  function header() {
    const c = catByKey[st.settings.category] || {}, m = MODE_INFO[st.mode || 'pg'];
    return `
      ${spec() ? `<div class="view-banner"><span class="view-dot"></span><b>👁️ VIEW DUEL</b><span>Kamu sedang menonton — tidak ikut menjawab</span></div>` : ''}
      <div class="quiz-top">
        <button class="icon-btn" id="leaveBtn" aria-label="Keluar room">${icons.x}</button>
        <div style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.title)}</b>
          <span class="dim">${m.ico} ${m.name}${st.mode === 'psikotes' ? '' : ` · ${c.ico || ''} ${esc(c.name || '')}`} · ${diffByKey[st.settings.difficulty]?.name || ''} · ${st.settings.count} ${st.mode === 'psikotes' ? 'ronde' : 'soal'}</span></div>
        ${st.viewers ? `<span class="chip viewers" title="Penonton">👁️ ${st.viewers}</span>` : ''}
        <button class="code-tag big" id="copyCode" title="Salin kode">#${st.code} ⧉</button>
      </div>`;
  }
  const hearts = n => n == null ? '' : `<span class="dp-lives">${'❤️'.repeat(Math.max(0, n))}${'🖤'.repeat(Math.max(0, 3 - n))}</span>`;
  function playersHTML(mode) {
    const maxLive = Math.max(1, ...st.players.map(p => p.live?.right || 0));
    return `<div class="duel-players">${st.players.map(p => {
      let status = '';
      if (mode === 'question') {
        if (st.mode === 'psikotes') status = `<span class="dp-race"><i style="width:${Math.round(((p.live?.right || 0) / maxLive) * 100)}%"></i><em>${p.live?.right || 0}✓ ${p.live?.wrong || 0}✗</em></span>`;
        else if (p.lives === 0) status = '<span class="dp-ans out">💀 gugur</span>';
        else status = `<span class="dp-ans ${p.answered ? 'yes' : 'think'}">${p.answered ? '✓ sudah menjawab' : '<i class="think-dots"><b></b><b></b><b></b></i> menjawab'}</span>`;
      } else if (mode === 'reveal' || mode === 'final') {
        if (st.mode === 'psikotes' && p.last) status = `<span class="dp-pts ok">${p.last.right}✓ ${p.last.wrong}✗ · +${fmt(p.last.pts)}</span>`;
        else if (p.last) status = `<span class="dp-pts ${p.last.ok ? 'ok' : p.last.ratio > 0 ? 'mid' : 'no'}">${p.last.pts ? '+' + fmt(p.last.pts) : '✗'}${p.last.ratio != null && !p.last.ok ? ` · ${Math.round(p.last.ratio * 100)}%` : ''}</span>`;
        else if (mode === 'reveal') status = '<span class="dp-pts no">—</span>';
      }
      return `
      <div class="dp ${p.me ? 'me' : ''} ${p.left ? 'left' : ''} ${p.lives === 0 ? 'out' : ''}">
        <span class="dp-rank">${mode === 'lobby' ? (p.isHost ? '👑' : p.isBot ? '🤖' : '👤') : p.rank}</span>
        ${p.isBot ? '<span class="av md bot"><em>🤖</em></span>' : avatar(p, 'md')}
        <span class="dp-name">${esc(p.name)}${p.me ? ' (kamu)' : ''}${p.left ? ' · keluar' : ''}${mode !== 'lobby' ? hearts(p.lives) : ''}</span>
        ${status}
        ${mode === 'lobby' ? '' : `<b class="dp-score">${fmt(p.score)}</b>`}
      </div>`;
    }).join('')}</div>`;
  }

  function draw() {
    const key = [st.phase, st.question?.index, st.players.length, st.status, st.spectator].join('|');
    const sameScreen = key === lastKey;
    if (!sameScreen && sprint && (st.phase !== 'question' || st.question?.index !== sprintIdx)) finishSprint();
    lastKey = key;
    if (st.phase === 'waiting') return drawLobby(sameScreen);
    if (st.phase === 'closed') {
      const me = st.players.find(p => p.me);
      const msg = st.closedReason === 'empty' ? 'Semua peserta sudah keluar, duel dihentikan.' : !st.host.me && st.timing.startAt ? 'Host keluar dari duel — room ditutup.' : st.host.me ? 'Kamu menutup room ini.' : 'Host menutup room ini.';
      root.innerHTML = `<div class="glass card empty fade-in"><div style="font-size:44px">🚪</div><h2 class="h2" style="margin:6px 0">Room ditutup</h2><p class="muted">${msg}</p>
        ${me && me.score ? `<p class="dim">Poinmu sampai saat itu: <b>${fmt(me.score)}</b></p>` : ''}<a class="btn" href="#/duel">Kembali ke lobby</a></div>`;
      sprint?.stop(); sfx('lose'); setMood('calm');
      return stopAll();
    }
    if (st.phase === 'countdown') return drawCountdown(sameScreen);
    if (st.phase === 'question') return drawQuestion(sameScreen);
    if (st.phase === 'reveal') return drawReveal(sameScreen);
    if (st.phase === 'finished') return drawFinished(sameScreen);
  }
  function bindCommon() {
    $('#leaveBtn')?.addEventListener('click', () => {
      if (spec() || !st.isMember) { stopAll(); location.hash = '#/duel'; return; }
      if (st.phase === 'finished') { stopAll(); api('/duel', { method: 'POST', body: { action: 'leave', code } }).catch(() => {}); location.hash = '#/duel'; return; }
      sheet(`<h3 class="h2">Keluar dari room?</h3><p class="muted">${st.host.me ? (st.phase === 'waiting' ? 'Kamu host — room akan ditutup untuk semua pemain.' : 'Kamu host — duel akan <b>dihentikan untuk semua pemain</b> dan room ditutup.') : 'Skormu tetap tercatat, tapi kamu tidak bisa lanjut menjawab.'}</p>
        <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="no" style="flex:1">Batal</button><button class="btn warm" data-a="yes" style="flex:1">Keluar</button></div>`,
      (el, close) => {
        $('[data-a=no]', el).onclick = close;
        $('[data-a=yes]', el).onclick = async () => { close(); stopAll(); await api('/duel', { method: 'POST', body: { action: 'leave', code } }).catch(() => {}); location.hash = '#/duel'; };
      });
    });
    $('#copyCode')?.addEventListener('click', share);
  }
  async function share() {
    const url = `${location.origin}/#/duel?code=${code}`;
    const text = `Ayo duel soal di SiapLolos! Kode room: ${code}\n${url}`;
    try { if (navigator.share) await navigator.share({ title: 'Duel SiapLolos', text, url }); else { await navigator.clipboard.writeText(text); toast('Kode & link room disalin', 'ok'); } }
    catch { try { await navigator.clipboard.writeText(code); toast('Kode disalin', 'ok'); } catch { toast(`Kode room: ${code}`); } }
  }

  function drawLobby(same) {
    const n = st.players.length;
    const html = `${header()}
      <div class="glass card duel-wait">
        <div class="dim" style="text-align:center">Bagikan kode ini ke temanmu</div>
        <button class="room-code" id="bigCode">${code.split('').map(ch => `<span>${ch}</span>`).join('')}</button>
        <div class="row" style="justify-content:center;gap:8px"><button class="btn ghost sm" id="shareBtn">📤 Bagikan link</button></div>
        <div class="row between" style="margin-top:16px"><b>Peserta</b><span class="dim">${n}/${st.settings.maxPlayers}</span></div>
        ${playersHTML('lobby')}
        ${!st.isMember ? `<button class="btn block" id="joinNow" style="margin-top:14px">⚔️ Ikut duel ini</button>`
          : st.host.me
          ? `<button class="btn block" id="startBtn" style="margin-top:14px" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'Menunggu minimal 1 lawan…' : '⚔️ Mulai duel'}</button>`
          : `<div class="waiting-host"><span class="spinner"></span> Menunggu host memulai duel…</div>`}
        <p class="dim" style="text-align:center;margin:10px 0 0">${st.visibility === 'public' ? '🌐 Room publik — bisa ditonton lewat View duel' : '🔒 Room privat — hanya lewat kode'} · ⏱️ ${st.settings.perQ} dtk/${st.mode === 'psikotes' ? 'ronde' : 'soal'}</p>
      </div>`;
    if (same && $('.duel-wait', root)) { $('.duel-players', root).outerHTML = playersHTML('lobby'); return; }
    root.innerHTML = html; bindCommon();
    $('#bigCode').onclick = share; $('#shareBtn').onclick = share;
    $('#joinNow')?.addEventListener('click', async () => { try { await api('/duel', { method: 'POST', body: { action: 'join', code } }); wantView = false; sched(100); } catch (e) { toast(e.message, 'err'); } });
    $('#startBtn')?.addEventListener('click', async () => {
      const b = $('#startBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      try { await api('/duel', { method: 'POST', body: { action: 'start', code } }); vibrate(20); sfx('duel'); sched(200); } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = '⚔️ Mulai duel'; }
    });
  }

  function drawCountdown(same) {
    if (!same) {
      root.innerHTML = `${header()}<div class="glass card countdown-box"><div class="dim">${spec() ? 'Duel yang kamu tonton dimulai dalam' : 'Duel dimulai dalam'}</div><div class="cd-num" id="cdNum"></div>${playersHTML('lobby')}</div>`;
      bindCommon();
    }
    cancelAnimationFrame(raf);
    let last = null;
    const tick = () => {
      const s = Math.max(0, Math.ceil((st.timing.startAt - now()) / 1000));
      const el = $('#cdNum'); if (!el) return;
      if (s !== last) { el.textContent = s || '⚔️'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (s) { vibrate(10); sfx('tick'); } else sfx('go'); last = s; }
      if (s > 0) raf = requestAnimationFrame(tick); else sched(120);
    };
    tick();
  }

  function runTimer(until, total) {
    cancelAnimationFrame(raf);
    lastClose = until;
    let lastSec = null;
    const tick = () => {
      const bar = $('#tBar'); if (!bar) return;
      const left = Math.max(0, until - now());
      bar.style.width = `${(left / total) * 100}%`;
      bar.classList.toggle('low', left < total * 0.3);
      const sec = Math.ceil(left / 1000); const tl = $('#tLeft'); if (tl && sec !== lastSec) { tl.textContent = sec + ' dtk'; lastSec = sec; }
      if (left > 0) raf = requestAnimationFrame(tick);
      else { if (sprint) finishSprint(); sched(150); }
    };
    tick();
  }

  // ── kartu soal per mode ──
  function metaHTML(q) {
    return `<div class="q-meta"><span class="chip">${st.mode === 'psikotes' ? 'Ronde' : 'Soal'} ${q.index + 1}/${q.total}</span><span class="chip ${q.difficulty}">${diffByKey[q.difficulty]?.name || ''}</span>
      ${st.mode === 'interaktif' && IX_KIND[q.kind] ? `<span class="chip">${IX_KIND[q.kind].ico} ${IX_KIND[q.kind].name}</span>` : ''}<span class="t-left dim" id="tLeft"></span></div>
      <div class="duel-timer"><i id="tBar"></i></div>`;
  }
  function optsHTML(q, revealed) {
    const mine = q.mine?.c ?? null;
    return `<div class="opts">${q.options.map((o, k) => {
      let cls = mine === k ? 'sel' : '';
      if (revealed) cls = k === q.answer ? 'right' : mine === k ? 'wrong' : '';
      const gone = !revealed && q.removed?.includes(k);
      return `<button class="opt ${cls} ${gone ? 'gone' : ''}" data-k="${k}" ${mine != null || revealed || spec() || gone ? 'disabled' : ''}><span class="key">${L[k]}</span><span>${esc(o)}</span></button>`;
    }).join('')}</div>`;
  }
  const waitMsg = t => `<div class="waiting-host"><span class="spinner"></span> ${t}</div>`;
  const sentMsg = () => waitMsg('Jawaban terkirim! Begitu semua peserta selesai, soal langsung lanjut…');

  function drawQuestion(same) {
    const q = st.question;
    if (same) {
      $('.duel-players', root).outerHTML = playersHTML('question');
      if (st.timing.close !== lastClose) runTimer(st.timing.close, st.settings.perQ * 1000);   // waktu dipercepat (semua sudah menjawab)
      return;
    }
    engine = null;
    const m = st.mode || 'pg';
    let body = '';
    if (m === 'psikotes') {
      body = spec() ? `<div class="spec-note">🏃 Peserta sedang mengerjakan sprint ${st.psiType === 'cermat' ? 'kecermatan' : 'Kraepelin'} — lihat balapan poinnya di bawah.</div>`
        : `<p class="dim" style="margin:6px 0">${st.psiType === 'cermat' ? 'Pilih huruf kunci (A–E) dari karakter yang hilang. Secepat & seteliti mungkin!' : 'Jumlahkan dua angka yang menyala, ketik angka satuannya (7 + 8 → 5).'}</p><div id="sprint"></div>`;
    } else if (m === 'esai') {
      body = `<p class="q-text">${esc(q.question)}</p>` + (spec() ? '<div class="spec-note">✍️ Peserta sedang menulis jawaban esai…</div>'
        : q.mine ? sentMsg()
          : `<textarea class="input essay-in" id="essayIn" rows="6" maxlength="1500" placeholder="Tulis jawabanmu dengan kata-katamu sendiri…">${esc(essayDraft)}</textarea>
             <div class="row between" style="margin-top:8px"><span class="dim" id="essayCnt">0 kata</span><button class="btn" id="essaySend">Kirim jawaban</button></div>`);
    } else if (m === 'interaktif') {
      const k = IX_KIND[q.kind] || {};
      body = `<p class="q-text">${esc(q.question)}</p>` + (spec() ? `<div class="spec-note">${k.ico || '🧩'} Peserta sedang mengerjakan "${k.name || 'interaktif'}"…</div>`
        : q.mine ? sentMsg()
          : `<p class="dim" style="margin:6px 0 0">💡 ${k.hint || ''}</p><div id="stage" class="ix-stage"></div>
             <div class="row" style="margin-top:12px;gap:10px"><button class="btn ghost" id="ixReset">↺ Ulang</button><button class="btn" id="ixSend" style="flex:1" disabled>Kirim jawaban</button></div>`);
    } else {
      body = `${m === 'arena' && !spec() ? `<div class="arena-hud">${hearts(q.lives)}${q.streak ? `<span class="combo">🔥 Combo ×${Math.min(1.5, 1 + q.streak * 0.1).toFixed(1)}</span>` : ''}
          <button class="btn ghost sm" id="power50" ${q.powerUsed || q.mine || q.lives <= 0 ? 'disabled' : ''}>✂️ 50:50${q.powerUsed ? ' (terpakai)' : ''}</button></div>` : ''}
        <p class="q-text">${esc(q.question)}</p>${optsHTML(q, false)}`;
    }
    root.innerHTML = `${header()}<div class="glass q-card duel-q">${metaHTML(q)}${body}<div id="qStatus">${m === 'arena' && q.lives <= 0 && !spec() ? '<div class="explain bad">💀 Nyawamu habis — tonton sisa duel ya!</div>' : (m === 'pg' || m === 'arena') && q.mine ? sentMsg() : ''}</div></div>
      <div class="glass card"><div class="row between"><b>${spec() ? '👥 Peserta & poin' : 'Peserta'}</b>${spec() ? `<span class="dim">${st.mode === 'psikotes' ? 'ronde' : 'soal'} ${q.index + 1} sedang berjalan</span>` : ''}</div>${playersHTML('question')}</div>`;
    bindCommon();
    runTimer(st.timing.close, st.settings.perQ * 1000);
    if (spec()) return;
    const submit = async body => {
      try { await api('/duel', { method: 'POST', body: { action: 'answer', code, index: q.index, ...body } }); sched(350); }
      catch (e) { toast(e.message, 'err'); }
    };
    if (m === 'pg' || m === 'arena') {
      if (q.lives <= 0) return;
      $$('.opt', root).forEach(b => (b.onclick = () => {
        if (st.question.mine) return;
        const k = +b.dataset.k; st.question.mine = { c: k };
        $$('.opt', root).forEach(o => { o.disabled = true; o.classList.toggle('sel', +o.dataset.k === k); });
        $('#power50')?.setAttribute('disabled', '');
        $('#qStatus').innerHTML = sentMsg(); vibrate(12); sfx('click');
        submit({ choice: k });
      }));
      $('#power50')?.addEventListener('click', async () => {
        const b = $('#power50'); b.disabled = true;
        try { const r = await api('/duel', { method: 'POST', body: { action: 'power', code, index: q.index } }); st.question.removed = r.removed; st.question.powerUsed = true; r.removed.forEach(k => { const o = $(`.opt[data-k="${k}"]`, root); if (o) { o.classList.add('gone'); o.disabled = true; } }); b.textContent = '✂️ 50:50 (terpakai)'; sfx('pop'); }
        catch (e) { toast(e.message, 'err'); b.disabled = false; }
      });
    } else if (m === 'esai' && !q.mine) {
      const ta = $('#essayIn'), cnt = () => { essayDraft = ta.value; $('#essayCnt').textContent = (ta.value.trim().split(/\s+/).filter(Boolean).length) + ' kata'; };
      ta.oninput = cnt; cnt(); setTimeout(() => ta.focus(), 100);
      $('#essaySend').onclick = async () => {
        if (ta.value.trim().length < 3) return toast('Tulis jawabanmu dulu', 'err');
        const text = ta.value; $('#essaySend').disabled = true; st.question.mine = { text };
        $('.essay-in', root).outerHTML = `<div class="essay-sent">${esc(text)}</div>`; $('#essaySend').closest('.row').remove();
        $('#qStatus').innerHTML = sentMsg(); sfx('send'); essayDraft = '';
        submit({ text });
      };
    } else if (m === 'interaktif' && !q.mine) {
      const api_ = { setReady: ok => { const b = $('#ixSend'); if (b) b.disabled = !ok; } };
      engine = mountEngine($('#stage'), q, api_);
      $('#ixReset').onclick = () => { engine.reset(); api_.setReady(false); };
      $('#ixSend').onclick = () => {
        const res = engine.check(); st.question.mine = { ratio: res.ratio };
        $('#ixSend').closest('.row').remove();
        $('#qStatus').innerHTML = sentMsg(); sfx('click');
        submit({ ratio: res.ratio });
      };
    } else if (m === 'psikotes') {
      sprintIdx = q.index; lastSent = 0;
      sprint = mountSprint($('#sprint'), { type: st.psiType, onProgress: s => {
        if (Date.now() - lastSent > 1500) { lastSent = Date.now(); sendProgress(s); } else { clearTimeout(sendT); sendT = setTimeout(() => { lastSent = Date.now(); sendProgress(sprint?.stats() || s); }, 1600); }
      } });
    }
  }
  function sendProgress(s) {
    if (sprintIdx < 0) return;
    api('/duel', { method: 'POST', body: { action: 'answer', code, index: sprintIdx, right: s.right, wrong: s.wrong } }).catch(() => {});
  }
  function finishSprint() {
    if (!sprint) return;
    clearTimeout(sendT); const s = sprint.stats(); sprint.stop(); sprint = null;
    sendProgress(s); sprintIdx = -1;
  }

  function drawReveal(same) {
    if (same) return;
    cancelAnimationFrame(raf);
    const q = st.question, m = st.mode || 'pg', meP = st.players.find(p => p.me);
    let main = '', status = '';
    if (m === 'psikotes') {
      main = `<p class="q-text">⏱️ Waktu ronde ${q.index + 1} habis!</p>`;
      if (!spec() && meP?.last) status = `<div class="explain fade-in"><b>Kamu: ${meP.last.right} benar · ${meP.last.wrong} salah → +${fmt(meP.last.pts)} poin</b></div>`;
    } else if (m === 'esai') {
      main = `<p class="q-text">${esc(q.question)}</p>`;
      const r = q.mine?.ratio;
      status = `<div class="explain ${r >= 0.75 ? '' : 'bad'} fade-in">${spec() ? '' : `<b>${!q.mine ? '⏰ Kamu tidak menjawab' : `Nilai jawabanmu: ${Math.round(r * 100)} · +${fmt(meP?.last?.pts || 0)} poin`}</b>`}
        ${q.keyPoints?.length ? `<div style="margin-top:8px"><b>Poin kunci:</b><ul class="ix-ol">${q.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}
        ${q.modelAnswer ? `<div class="muted" style="margin-top:6px"><b>Jawaban acuan:</b> ${esc(q.modelAnswer)}</div>` : ''}</div>`;
    } else if (m === 'interaktif') {
      main = `<p class="q-text">${esc(q.question)}</p>`;
      const r = q.mine?.ratio;
      status = `<div class="explain ${r >= 0.999 ? '' : 'bad'} fade-in">${spec() ? '' : `<b>${!q.mine ? '⏰ Kamu tidak menjawab' : r >= 0.999 ? `✅ Sempurna! +${fmt(meP?.last?.pts || 0)} poin` : `◐ ${Math.round(r * 100)}% tepat · +${fmt(meP?.last?.pts || 0)} poin`}</b>`}
        ${q.explanation ? `<div class="muted" style="margin-top:6px">${esc(q.explanation)}</div>` : ''}</div>`;
    } else {
      main = `<p class="q-text">${esc(q.question)}</p>${optsHTML(q, true)}`;
      const ok = q.mine?.c === q.answer;
      status = `<div class="explain ${ok || spec() ? '' : 'bad'} fade-in"><b>${spec() ? `Jawaban benar: ${L[q.answer]}. ${esc(q.options[q.answer])}` : q.mine == null ? '⏰ Kamu tidak menjawab' : ok ? `✅ Benar! +${fmt(meP?.last?.pts || 0)} poin` : '❌ Kurang tepat'}</b>
        ${!ok && !spec() ? ` Jawaban: <b>${L[q.answer]}. ${esc(q.options[q.answer])}</b>` : ''}
        ${m === 'arena' && !spec() && !ok && meP?.lives != null ? `<div style="margin-top:4px">${meP.lives > 0 ? `💔 Nyawa tersisa ${meP.lives}` : '💀 Nyawamu habis!'}</div>` : ''}
        ${q.explanation ? `<div class="muted" style="margin-top:6px">${esc(q.explanation)}</div>` : ''}</div>`;
    }
    root.innerHTML = `${header()}<div class="glass q-card">${metaHTML(q)}${main}<div id="qStatus">${status}</div></div><div class="glass card"><b>Klasemen</b>${playersHTML('reveal')}</div>`;
    bindCommon();
    if (!spec()) {
      const good = m === 'psikotes' ? (meP?.last?.pts || 0) > 0 : m === 'pg' || m === 'arena' ? q.mine?.c === q.answer : (q.mine?.ratio || 0) >= (m === 'esai' ? 0.75 : 0.999);
      if (good) { confetti(40); vibrate(15); sfx('correct'); } else { vibrate([40, 30, 40]); sfx(q.mine == null ? 'tick' : 'wrong'); }
    }
    $('#tBar').style.width = '0%';
    runTimer(st.timing.next, st.timing.reveal * 1000);
  }

  function drawFinished(same) {
    if (same) return;
    cancelAnimationFrame(raf);
    const ps = st.players; const meP = ps.find(p => p.me);
    const pod = (p, cls) => p ? `<div class="p ${cls}">${p.isBot ? '<span class="av pod bot"><em>🤖</em></span>' : avatar(p, 'pod')}<div class="nm">${esc(p.name)}</div><div class="block">${cls === 'p1' ? '👑' : cls === 'p2' ? '🥈' : '🥉'}<br>${fmt(p.score)}</div></div>` : '<div></div>';
    const m = st.mode || 'pg';
    const reviewHTML = (st.review || []).map((r, i) => {
      if (m === 'psikotes') return `<div class="review-item"><b>Ronde ${i + 1}</b><div class="ans">${r.mine ? `${r.mine.right} benar · ${r.mine.wrong} salah · +${fmt(r.mine.pts)}` : 'Tidak mengerjakan'}</div></div>`;
      if (m === 'esai' || m === 'interaktif') return `<div class="review-item"><div class="row" style="align-items:flex-start"><span>${r.mine?.ok ? '✅' : r.mine?.ratio > 0 ? '◐' : '❌'}</span><b>${i + 1}. ${esc(r.question)}</b></div>
        <div class="ans">${r.mine ? `<span>Nilai: ${Math.round((r.mine.ratio || 0) * 100)}% · +${fmt(r.mine.pts)}</span>` : '<span style="color:var(--red)">Tidak dijawab</span>'}${r.modelAnswer ? `<span class="muted">Acuan: ${esc(r.modelAnswer)}</span>` : ''}${r.explanation ? `<span class="muted">${esc(r.explanation)}</span>` : ''}</div></div>`;
      return `<div class="review-item"><div class="row" style="align-items:flex-start"><span>${r.mine?.ok ? '✅' : '❌'}</span><b>${i + 1}. ${esc(r.question)}</b></div>
        <div class="ans">${r.mine && !r.mine.ok ? `<span style="color:var(--red)">Jawabanmu: ${L[r.mine.c]}. ${esc(r.options[r.mine.c])}</span>` : !r.mine ? '<span style="color:var(--red)">Tidak dijawab</span>' : ''}
        <span style="color:var(--green)">Jawaban benar: ${L[r.answer]}. ${esc(r.options[r.answer])}</span>${r.explanation ? `<span class="muted">${esc(r.explanation)}</span>` : ''}</div></div>`;
    }).join('');
    root.innerHTML = `${header()}
      <div class="glass result-hero">
        <h1 class="h2" style="font-size:24px">${spec() ? `🏁 Duel selesai — ${esc(ps[0]?.name || '')} juara!` : meP?.rank === 1 ? '🏆 Kamu juara!' : `Kamu peringkat ${meP?.rank ?? '-'} dari ${ps.length}`}</h1>
        <p class="muted" style="margin:6px 0 0">${!spec() && meP ? `${meP.correct}/${st.settings.count} ${m === 'psikotes' ? 'ronde dikerjakan' : 'benar'} · ${fmt(meP.score)} poin` : `${ps.length} peserta · ${st.settings.count} ${m === 'psikotes' ? 'ronde' : 'soal'}`}</p>
        <div class="podium" style="margin-top:18px">${pod(ps[1], 'p2')}${pod(ps[0], 'p1')}${pod(ps[2], 'p3')}</div>
        <p class="dim" id="saveDuel" style="margin:4px 0 0"></p>
      </div>
      <div class="glass card"><b>Hasil akhir</b>${playersHTML('final')}</div>
      <div class="row wrap"><a class="btn" href="#/duel" style="flex:1">⚔️ ${spec() ? 'Ke lobby duel' : 'Duel lagi'}</a>${spec() ? '' : '<a class="btn ghost" href="#/evaluasi" style="flex:1">📈 Evaluasi</a>'}</div>
      ${reviewHTML ? `<div class="glass card"><h2 class="h2" style="margin-bottom:10px">Pembahasan</h2>${reviewHTML}</div>` : ''}`;
    bindCommon();
    setMood(spec() || meP?.rank === 1 ? 'happy' : 'calm');
    if (spec()) { setTimeout(() => confetti(90), 300); sfx('win'); return; }
    setTimeout(() => sfx(meP?.rank === 1 ? 'win' : 'lose'), 200);
    if (meP?.rank === 1) setTimeout(() => confetti(140), 300);
    saveResult(meP);
  }

  async function saveResult(meP) {
    const k = 'sl_duel_saved_' + code;
    if (saved || !meP) return; saved = true;
    try { if (localStorage.getItem(k)) { $('#saveDuel').textContent = '✅ Hasil tersimpan ke evaluasi'; return; } } catch {}
    const total = st.settings.count;
    try {
      await api('/attempt', { method: 'POST', body: {
        mode: 'duel', category: st.settings.category, difficulty: st.settings.difficulty, total, correct: Math.min(total, meP.correct),
        score: Math.round((Math.min(total, meP.correct) / total) * 100), points: Math.round(meP.score / 20), durationSec: total * (st.settings.perQ + 4),
        details: (st.review || []).map((r, i) => ({ id: `duel-${code}-${i}`, correct: !!r.mine?.ok, category: st.settings.category })),
      } });
      try { localStorage.setItem(k, '1'); } catch {}
      $('#saveDuel').textContent = '✅ Hasil tersimpan ke evaluasi & peringkat';
    } catch (e) { $('#saveDuel').textContent = '⚠️ Gagal menyimpan hasil: ' + e.message; }
  }

  poll();
}
