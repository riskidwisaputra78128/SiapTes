// Arena Duel: lobby (buat/gabung/daftar room aktif) + ruang duel real-time (polling)
import { api, session } from './api.js';
import { $, $$, esc, toast, sheet, confetti, vibrate, fmt, icons, avatar } from './ui.js';
import { sfx } from './sound.js';
import { CATEGORIES, DIFFS, catByKey, diffByKey } from './data.js';
import { setDuelPresence, onlineWidget } from './presence.js';

const L = ['A', 'B', 'C', 'D'];
const BOT_INFO = {
  easy: { ico: '🐣', name: 'Pemula', desc: '±45% benar' },
  normal: { ico: '🤖', name: 'Cerdas', desc: '±65% benar' },
  hard: { ico: '🧠', name: 'Jenius', desc: '±80% benar, cepat' },
  prof: { ico: '🎓', name: 'Profesor', desc: '±92% benar, sangat cepat' },
};
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
  if (code) return renderRoom(app, code);
  return renderLobby(app);
}

/* ───────── Lobby ───────── */
function roomCard(r, mine) {
  const c = catByKey[r.category] || {};
  const canJoin = r.phase === 'waiting' && r.players < r.maxPlayers;
  return `
    <div class="glass duel-card tilt">
      <div class="row between" style="gap:8px">
        <span class="chip ${r.phase === 'waiting' ? 'live' : ''}">${phaseLabel[r.phase] || r.phase}</span>
        <span class="code-tag">#${r.code}</span>
      </div>
      <b class="duel-title">${esc(r.title)}</b>
      <div class="row wrap" style="gap:6px">
        <span class="chip">${c.ico || ''} ${esc(c.name || r.category)}</span>
        <span class="chip ${r.difficulty}">${diffByKey[r.difficulty]?.name || ''}</span>
        <span class="chip">${r.count} soal</span>
        ${r.bot ? `<span class="chip">${BOT_INFO[r.bot].ico} Bot ${BOT_INFO[r.bot].name}</span>` : ''}
      </div>
      <div class="row between">
        <span class="dim">👑 ${esc(r.host)} · 👥 ${r.players}/${r.maxPlayers}</span>
        ${mine ? `<a class="btn sm" href="#/duel?code=${r.code}">Masuk</a>`
          : canJoin ? `<button class="btn sm" data-join="${r.code}">Gabung</button>`
            : `<span class="dim">${r.phase === 'waiting' ? 'Penuh' : 'Berlangsung'}</span>`}
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
      <p class="muted" style="margin:0 0 14px">Adu cepat & tepat menjawab soal yang sama, di waktu yang sama. Ajak teman lewat kode atau tantang bot.</p>
      <form class="join-row" id="joinForm">
        <input id="joinCode" class="input code-input" maxlength="6" placeholder="KODE ROOM" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="btn" type="submit">Gabung</button>
      </form>
      <button class="btn warm block" id="createBtn" style="margin-top:12px">＋ Buat room duel</button>
    </div>
    <div id="onlineDuel" hidden></div>
    <div id="mineBox"></div>
    <div>
      <div class="section-head"><h2 class="h2">🟢 Room aktif</h2><span class="dim" id="lobbyUpd"></span></div>
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
  const loop = async () => { if (await load()) setTimeout(() => !document.hidden ? loop() : setTimeout(loop, 5000), 5000); };
  loop();
}

function openCreate() {
  const cfg = { title: '', category: 'campuran', difficulty: 'normal', count: 10, bot: null, maxPlayers: 4, visibility: 'public' };
  sheet(`
    <h3 class="h2">＋ Buat room duel</h3>
    <div class="stack" style="gap:14px;margin-top:12px">
      <div class="field"><label>Nama room (opsional)</label><input class="input" id="cTitle" maxlength="40" placeholder="Contoh: Latihan OJK bareng"></div>
      <div class="field"><label>Materi</label><select class="input" id="cCat">${CATEGORIES.map(c => `<option value="${c.key}">${c.ico} ${c.name}</option>`).join('')}</select></div>
      <div class="field"><label>Level</label><div class="pill-group" id="cDiff">${DIFFS.map(d => `<button class="pill" data-v="${d.key}">${d.name}</button>`).join('')}</div></div>
      <div class="field"><label>Jumlah soal</label><div class="pill-group" id="cCount">${[5, 10, 15].map(n => `<button class="pill" data-v="${n}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Lawan bot</label><div class="pill-group" id="cBot">
        <button class="pill" data-v="">Tanpa bot</button>
        ${Object.entries(BOT_INFO).map(([k, b]) => `<button class="pill" data-v="${k}">${b.ico} ${b.name}<span class="sub">${b.desc}</span></button>`).join('')}</div></div>
      <div class="row between">
        <div class="field"><label>Maks. peserta</label>
          <div class="row" style="gap:8px"><button class="icon-btn" id="mMinus">−</button><b id="mVal" style="font-family:var(--num);font-size:20px;min-width:24px;text-align:center"></b><button class="icon-btn" id="mPlus">+</button></div></div>
        <div class="field"><label>Visibilitas</label><div class="tabs" id="cVis"><button data-v="public">🌐 Publik</button><button data-v="private">🔒 Privat</button></div></div>
      </div>
      <p class="dim" style="margin:-4px 0 0">Room publik tampil di daftar Room aktif. Room privat hanya bisa dimasuki lewat kode.</p>
      <button class="btn block" id="cGo">⚔️ Buat room</button>
    </div>`,
  (el, close) => {
    const sync = () => {
      $$('#cDiff .pill', el).forEach(b => b.classList.toggle('on', b.dataset.v === cfg.difficulty));
      $$('#cCount .pill', el).forEach(b => b.classList.toggle('on', +b.dataset.v === cfg.count));
      $$('#cBot .pill', el).forEach(b => b.classList.toggle('on', (b.dataset.v || null) === cfg.bot));
      $$('#cVis button', el).forEach(b => b.classList.toggle('on', b.dataset.v === cfg.visibility));
      $('#mVal', el).textContent = cfg.maxPlayers;
    };
    $$('#cDiff .pill', el).forEach(b => (b.onclick = () => { cfg.difficulty = b.dataset.v; sync(); }));
    $$('#cCount .pill', el).forEach(b => (b.onclick = () => { cfg.count = +b.dataset.v; sync(); }));
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
function renderRoom(app, code) {
  let st = null, offset = 0, lastKey = '', raf = 0, saved = false, autoJoined = false, alive = true;
  const now = () => Date.now() + offset;
  app.innerHTML = `<div id="duelRoom" class="fade-in"><div class="skeleton" style="height:320px"></div></div>`;
  const root = $('#duelRoom');

  async function poll() {
    if (!alive || !document.body.contains(root)) { alive = false; cancelAnimationFrame(raf); setDuelPresence(null); return; }
    try {
      const d = await api('/duel?code=' + code);
      offset = d.timing.serverNow - Date.now();
      if (!d.isMember && !autoJoined && d.phase === 'waiting') {
        autoJoined = true;
        try { await api('/duel', { method: 'POST', body: { action: 'join', code } }); return setTimeout(poll, 300); } catch (e) { toast(e.message, 'err'); }
      }
      st = d; draw();
      setDuelPresence(d.phase === 'waiting' && d.visibility === 'public' ? code : null);
    } catch (e) {
      root.innerHTML = `<div class="glass card empty"><div style="font-size:40px">😕</div><p>${esc(e.message)}</p><a class="btn" href="#/duel">Kembali ke lobby</a></div>`;
      alive = false; return;
    }
    const fast = st && ['countdown', 'question', 'reveal'].includes(st.phase);
    setTimeout(poll, fast ? 1200 : st?.phase === 'finished' ? 15000 : 2000);
  }

  function header() {
    const c = catByKey[st.settings.category] || {};
    return `
      <div class="quiz-top">
        <button class="icon-btn" id="leaveBtn" aria-label="Keluar room">${icons.x}</button>
        <div style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.title)}</b>
          <span class="dim">${c.ico || ''} ${esc(c.name || '')} · ${diffByKey[st.settings.difficulty]?.name || ''} · ${st.settings.count} soal</span></div>
        <button class="code-tag big" id="copyCode" title="Salin kode">#${st.code} ⧉</button>
      </div>`;
  }
  function playersHTML(mode) {
    return `<div class="duel-players">${st.players.map(p => `
      <div class="dp ${p.me ? 'me' : ''} ${p.left ? 'left' : ''}">
        <span class="dp-rank">${mode === 'lobby' ? (p.isHost ? '👑' : p.isBot ? '🤖' : '👤') : p.rank}</span>
        ${p.isBot ? '<span class="av md bot"><em>🤖</em></span>' : avatar(p, 'md')}
        <span class="dp-name">${esc(p.name)}${p.me ? ' (kamu)' : ''}${p.left ? ' · keluar' : ''}</span>
        ${mode === 'lobby' ? '' : mode === 'question'
          ? `<span class="dp-ans ${p.answered ? 'yes' : ''}">${p.answered ? '✓ menjawab' : '…'}</span>`
          : `${p.last ? `<span class="dp-pts ${p.last.ok ? 'ok' : 'no'}">${p.last.ok ? '+' + fmt(p.last.pts) : '✗'}</span>` : mode === 'reveal' ? '<span class="dp-pts no">—</span>' : ''}`}
        ${mode === 'lobby' ? '' : `<b class="dp-score">${fmt(p.score)}</b>`}
      </div>`).join('')}</div>`;
  }

  function draw() {
    const key = [st.phase, st.question?.index, st.players.length, st.status].join('|');
    const sameScreen = key === lastKey;
    lastKey = key;
    if (st.phase === 'waiting') return drawLobby(sameScreen);
    if (st.phase === 'closed') { root.innerHTML = `<div class="glass card empty"><div style="font-size:40px">🚪</div><p>Host menutup room ini.</p><a class="btn" href="#/duel">Kembali ke lobby</a></div>`; alive = false; return; }
    if (st.phase === 'countdown') return drawCountdown(sameScreen);
    if (st.phase === 'question') return drawQuestion(sameScreen);
    if (st.phase === 'reveal') return drawReveal(sameScreen);
    if (st.phase === 'finished') return drawFinished(sameScreen);
  }
  function bindCommon() {
    $('#leaveBtn')?.addEventListener('click', () => {
      sheet(`<h3 class="h2">Keluar dari room?</h3><p class="muted">${st.host.me && st.phase === 'waiting' ? 'Kamu host — room akan ditutup untuk semua pemain.' : st.phase === 'finished' ? 'Kembali ke lobby duel.' : 'Skormu tetap tercatat, tapi kamu tidak bisa lanjut menjawab.'}</p>
        <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="no" style="flex:1">Batal</button><button class="btn warm" data-a="yes" style="flex:1">Keluar</button></div>`,
      (el, close) => {
        $('[data-a=no]', el).onclick = close;
        $('[data-a=yes]', el).onclick = async () => { close(); alive = false; if (st.phase !== 'finished') await api('/duel', { method: 'POST', body: { action: 'leave', code } }).catch(() => {}); location.hash = '#/duel'; };
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
        ${st.host.me
          ? `<button class="btn block" id="startBtn" style="margin-top:14px" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'Menunggu minimal 1 lawan…' : '⚔️ Mulai duel'}</button>`
          : `<div class="waiting-host"><span class="spinner"></span> Menunggu host memulai duel…</div>`}
        <p class="dim" style="text-align:center;margin:10px 0 0">${st.visibility === 'public' ? '🌐 Room publik — tampil di daftar Room aktif' : '🔒 Room privat — hanya lewat kode'} · ⏱️ ${st.settings.perQ} dtk/soal</p>
      </div>`;
    if (same && $('.duel-wait', root)) { $('.duel-players', root).outerHTML = playersHTML('lobby'); return; }
    root.innerHTML = html; bindCommon();
    $('#bigCode').onclick = share; $('#shareBtn').onclick = share;
    $('#startBtn')?.addEventListener('click', async () => {
      const b = $('#startBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      try { await api('/duel', { method: 'POST', body: { action: 'start', code } }); vibrate(20); sfx('duel'); } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = '⚔️ Mulai duel'; }
    });
  }

  function drawCountdown(same) {
    if (!same) {
      root.innerHTML = `${header()}<div class="glass card countdown-box"><div class="dim">Duel dimulai dalam</div><div class="cd-num" id="cdNum"></div>${playersHTML('lobby')}</div>`;
      bindCommon();
    }
    cancelAnimationFrame(raf);
    let last = null;
    const tick = () => {
      const s = Math.max(0, Math.ceil((st.timing.startAt - now()) / 1000));
      const el = $('#cdNum'); if (!el) return;
      if (s !== last) { el.textContent = s || '⚔️'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (s) { vibrate(10); sfx('tick'); } else sfx('go'); last = s; }
      if (s > 0) raf = requestAnimationFrame(tick); else poll();
    };
    tick();
  }

  function qBlock(q, revealed) {
    return `
      <div class="glass q-card">
        <div class="q-meta"><span class="chip">Soal ${q.index + 1}/${q.total}</span><span class="chip ${q.difficulty}">${diffByKey[q.difficulty]?.name || ''}</span></div>
        <div class="duel-timer"><i id="tBar"></i></div>
        <p class="q-text">${esc(q.question)}</p>
        <div class="opts">${q.options.map((o, k) => {
          let cls = q.myChoice === k ? 'sel' : '';
          if (revealed) cls = k === q.answer ? 'right' : q.myChoice === k ? 'wrong' : '';
          return `<button class="opt ${cls}" data-k="${k}" ${q.myChoice != null || revealed ? 'disabled' : ''}><span class="key">${L[k]}</span><span>${esc(o)}</span></button>`;
        }).join('')}</div>
        <div id="qStatus"></div>
      </div>`;
  }
  function runTimer(until, total) {
    cancelAnimationFrame(raf);
    const tick = () => {
      const bar = $('#tBar'); if (!bar) return;
      const left = Math.max(0, until - now());
      bar.style.width = `${(left / total) * 100}%`;
      bar.classList.toggle('low', left < total * 0.3);
      if (left > 0) raf = requestAnimationFrame(tick); else setTimeout(poll, 150);
    };
    tick();
  }

  function drawQuestion(same) {
    const q = st.question;
    if (!same) {
      root.innerHTML = `${header()}${qBlock(q, false)}<div class="glass card"><b>Peserta</b>${playersHTML('question')}</div>`;
      bindCommon();
      $$('.opt', root).forEach(b => (b.onclick = async () => {
        if (st.question.myChoice != null) return;
        const k = +b.dataset.k; st.question.myChoice = k;
        $$('.opt', root).forEach(o => { o.disabled = true; o.classList.toggle('sel', +o.dataset.k === k); });
        $('#qStatus').innerHTML = '<div class="waiting-host"><span class="spinner"></span> Jawaban terkirim! Menunggu waktu habis…</div>';
        vibrate(12); sfx('click');
        try { await api('/duel', { method: 'POST', body: { action: 'answer', code, index: q.index, choice: k } }); }
        catch (e) { toast(e.message, 'err'); }
      }));
      if (q.myChoice != null) $('#qStatus').innerHTML = '<div class="waiting-host"><span class="spinner"></span> Jawaban terkirim! Menunggu waktu habis…</div>';
      runTimer(st.timing.close, st.settings.perQ * 1000);
    } else {
      $('.duel-players', root).outerHTML = playersHTML('question');
    }
  }

  function drawReveal(same) {
    if (same) return;
    const q = st.question; const meP = st.players.find(p => p.me);
    root.innerHTML = `${header()}${qBlock(q, true)}<div class="glass card"><b>Klasemen</b>${playersHTML('reveal')}</div>`;
    bindCommon();
    const ok = q.myChoice === q.answer;
    $('#qStatus').innerHTML = `<div class="explain ${ok ? '' : 'bad'} fade-in"><b>${q.myChoice == null ? '⏰ Kamu tidak menjawab' : ok ? `✅ Benar! +${fmt(meP?.last?.pts || 0)} poin` : '❌ Kurang tepat'}</b>
      ${!ok ? ` Jawaban: <b>${L[q.answer]}. ${esc(q.options[q.answer])}</b>` : ''}
      ${q.explanation ? `<div class="muted" style="margin-top:6px">${esc(q.explanation)}</div>` : ''}</div>`;
    if (ok) { confetti(40); vibrate(15); sfx('correct'); } else { vibrate([40, 30, 40]); sfx(q.myChoice == null ? 'tick' : 'wrong'); }
    $('#tBar').style.width = '0%';
    runTimer(st.timing.next, st.timing.reveal * 1000);
  }

  function drawFinished(same) {
    if (same) return;
    cancelAnimationFrame(raf);
    const ps = st.players; const meP = ps.find(p => p.me);
    const pod = (p, cls) => p ? `<div class="p ${cls}">${p.isBot ? '<span class="av pod bot"><em>🤖</em></span>' : avatar(p, 'pod')}<div class="nm">${esc(p.name)}</div><div class="block">${cls === 'p1' ? '👑' : cls === 'p2' ? '🥈' : '🥉'}<br>${fmt(p.score)}</div></div>` : '<div></div>';
    root.innerHTML = `${header()}
      <div class="glass result-hero">
        <h1 class="h2" style="font-size:24px">${meP?.rank === 1 ? '🏆 Kamu juara!' : `Kamu peringkat ${meP?.rank ?? '-'} dari ${ps.length}`}</h1>
        <p class="muted" style="margin:6px 0 0">${meP ? `${meP.correct}/${st.settings.count} benar · ${fmt(meP.score)} poin` : ''}</p>
        <div class="podium" style="margin-top:18px">${pod(ps[1], 'p2')}${pod(ps[0], 'p1')}${pod(ps[2], 'p3')}</div>
        <p class="dim" id="saveDuel" style="margin:4px 0 0"></p>
      </div>
      <div class="glass card"><b>Hasil akhir</b>${playersHTML('final')}</div>
      <div class="row wrap"><a class="btn" href="#/duel" style="flex:1">⚔️ Duel lagi</a><a class="btn ghost" href="#/evaluasi" style="flex:1">📈 Evaluasi</a></div>
      <div class="glass card"><h2 class="h2" style="margin-bottom:10px">Pembahasan</h2>
        ${(st.review || []).map((r, i) => `<div class="review-item"><div class="row" style="align-items:flex-start"><span>${r.mine?.ok ? '✅' : '❌'}</span><b>${i + 1}. ${esc(r.question)}</b></div>
          <div class="ans">${r.mine && !r.mine.ok ? `<span style="color:var(--red)">Jawabanmu: ${L[r.mine.c]}. ${esc(r.options[r.mine.c])}</span>` : !r.mine ? '<span style="color:var(--red)">Tidak dijawab</span>' : ''}
          <span style="color:var(--green)">Jawaban benar: ${L[r.answer]}. ${esc(r.options[r.answer])}</span>${r.explanation ? `<span class="muted">${esc(r.explanation)}</span>` : ''}</div></div>`).join('')}
      </div>`;
    bindCommon();
    setTimeout(() => sfx(meP?.rank === 1 ? 'win' : 'lose'), 200);
    import('./sound.js').then(m => m.setMood(meP?.rank === 1 ? 'happy' : 'calm')).catch(() => {});
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
        mode: 'duel', category: st.settings.category, difficulty: st.settings.difficulty, total, correct: meP.correct,
        score: Math.round((meP.correct / total) * 100), points: Math.round(meP.score / 20), durationSec: total * (st.settings.perQ + 4),
        details: (st.review || []).map((r, i) => ({ id: `duel-${code}-${i}`, correct: !!r.mine?.ok, category: st.settings.category })),
      } });
      try { localStorage.setItem(k, '1'); } catch {}
      $('#saveDuel').textContent = '✅ Hasil tersimpan ke evaluasi & peringkat';
    } catch (e) { $('#saveDuel').textContent = '⚠️ Gagal menyimpan hasil: ' + e.message; }
  }

  poll();
}
