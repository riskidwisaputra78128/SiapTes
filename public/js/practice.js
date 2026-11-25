import { api, session, getInfo } from './api.js';
import { $, $$, esc, toast, ring, animateRings, confetti, vibrate, sheet, icons, mmss, fmt, countUp } from './ui.js';
import { CATEGORIES, MODES, DIFFS, catByKey, modeByKey, diffByKey } from './data.js';
import { runInteractive } from './interactive.js';

export const practice = { config: null, questions: [], result: null, active: false };
const L = ['A', 'B', 'C', 'D'];

// Interval yang otomatis berhenti bila elemen sudah tidak di layar
function every(ms, el, fn) {
  const id = setInterval(() => { if (!document.body.contains(el)) return clearInterval(id); fn(); }, ms);
  return id;
}
function srcHTML(q) {
  if (!q.source) return '';
  return `<div class="q-source">📰 <span>Berdasarkan berita: <a href="${esc(q.source.link)}" target="_blank" rel="noopener">${esc(q.source.title)}</a>${q.source.publisher ? ' — ' + esc(q.source.publisher) : ''}</span></div>`;
}
function metaHTML(q, i, n) {
  return `<div class="q-meta"><span class="chip">Soal ${i + 1}/${n}</span><span class="chip">${catByKey[q.category]?.ico || ''} ${esc(catByKey[q.category]?.name || q.category)}</span>
    <span class="chip ${q.difficulty}">${diffByKey[q.difficulty]?.name || ''}</span>${q.generated ? '<span class="chip new">Terkini</span>' : ''}</div>`;
}
function confirmExit() {
  sheet(`<h3 class="h2">Keluar dari latihan?</h3><p class="muted">Jawaban yang sudah dikerjakan tidak akan disimpan.</p>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="stay" style="flex:1">Lanjutkan</button><button class="btn warm" data-a="exit" style="flex:1">Keluar</button></div>`,
  (el, close) => {
    $('[data-a=stay]', el).onclick = close;
    $('[data-a=exit]', el).onclick = () => { close(); practice.active = false; location.hash = '#/latihan'; };
  });
}

/* ───────── Pengaturan latihan ───────── */
export function renderSetup(app, params) {
  practice.active = false;
  const cfg = {
    category: catByKey[params.get('category')] ? params.get('category') : 'campuran',
    mode: modeByKey[params.get('mode')] ? params.get('mode') : 'pg',
    difficulty: diffByKey[params.get('difficulty')] ? params.get('difficulty') : 'normal',
    count: 10, fresh: params.get('fresh') === '1',
  };
  const counts = () => (cfg.mode === 'essay' ? [3, 5, 8] : cfg.mode === 'interaktif' ? [5, 8, 12] : [5, 10, 20, 30]);

  app.innerHTML = `
  <section class="fade-in">
    <h1 class="h1">Atur latihanmu</h1>
    <p class="muted" style="margin-top:0">Pilih mode, materi, dan level. Soal diacak setiap sesi.</p>

    <div class="glass setup-step" style="margin-top:14px">
      <div class="row" style="margin-bottom:12px"><span class="step-no">1</span><b>Mode latihan</b></div>
      <div class="mode-pick">${MODES.map(m => `
        <button class="mode-opt" data-mode="${m.key}"><span class="mode-icon ${m.cls}" style="width:46px;height:46px;font-size:22px">${m.ico}</span>
        <span><b>${m.name}</b><p>${m.desc}</p></span></button>`).join('')}</div>
    </div>

    <div class="glass setup-step section">
      <div class="row" style="margin-bottom:12px"><span class="step-no">2</span><b>Materi</b></div>
      <div class="cat-grid">${CATEGORIES.map(c => `
        <button class="glass cat-card tilt" data-cat="${c.key}"><span class="glow" style="background:${c.color}"></span>
        <span class="ico">${c.ico}</span><b>${c.name}</b><small>${c.tags}</small><span class="cat-count" data-count="${c.key}"></span></button>`).join('')}</div>
      <label class="row dim" style="margin-top:12px;cursor:pointer"><input type="checkbox" id="freshChk" ${cfg.fresh ? 'checked' : ''}> Prioritaskan soal dari berita terbaru</label>
    </div>

    <div class="glass setup-step section">
      <div class="row" style="margin-bottom:12px"><span class="step-no">3</span><b>Tingkat kesulitan</b></div>
      <div class="pill-group" id="diffs">${DIFFS.map(d => `<button class="pill" data-diff="${d.key}">${d.name}<span class="sub">${d.sub}</span></button>`).join('')}</div>
      <div class="row" style="margin:16px 0 10px"><span class="step-no">4</span><b>Jumlah soal</b></div>
      <div class="pill-group" id="counts"></div>
    </div>

    <div class="glass start-bar">
      <div class="sum"><b id="sumTitle"></b><span id="sumSub"></span></div>
      <button class="btn" id="startBtn">Mulai ▶</button>
    </div>
  </section>`;

  const sync = () => {
    $$('[data-mode]', app).forEach(b => b.classList.toggle('on', b.dataset.mode === cfg.mode));
    $$('[data-cat]', app).forEach(b => b.classList.toggle('on', b.dataset.cat === cfg.category));
    $$('[data-diff]', app).forEach(b => b.classList.toggle('on', b.dataset.diff === cfg.difficulty));
    if (!counts().includes(cfg.count)) cfg.count = counts()[1];
    $('#counts').innerHTML = counts().map(n => `<button class="pill ${n === cfg.count ? 'on' : ''}" data-n="${n}">${n} soal</button>`).join('');
    $$('[data-n]', app).forEach(b => (b.onclick = () => { cfg.count = +b.dataset.n; sync(); }));
    const d = diffByKey[cfg.difficulty];
    $('#sumTitle').textContent = `${modeByKey[cfg.mode].name} · ${catByKey[cfg.category].name}`;
    $('#sumSub').textContent = `${d.name} · ${cfg.count} soal · ${cfg.mode === 'game' ? d.gameSec + ' dtk/soal' : cfg.mode === 'pg' ? '±' + Math.round((cfg.count * d.sec) / 60) + ' menit' : cfg.mode === 'interaktif' ? 'santai, tanpa timer' : 'tanpa batas waktu'}`;
  };
  $$('[data-mode]', app).forEach(b => (b.onclick = () => { cfg.mode = b.dataset.mode; sync(); }));
  $$('[data-cat]', app).forEach(b => (b.onclick = () => { cfg.category = b.dataset.cat; sync(); }));
  $$('[data-diff]', app).forEach(b => (b.onclick = () => { cfg.difficulty = b.dataset.diff; sync(); }));
  getInfo().then(d => {
    if (!d.bank) return;
    $$('[data-count]', app).forEach(el => { const n = d.bank.byCategory?.[el.dataset.count]; if (n != null) el.textContent = `${fmt(n)} soal`; });
  }).catch(() => {});
  $('#freshChk').onchange = e => (cfg.fresh = e.target.checked);
  sync();

  $('#startBtn').onclick = async () => {
    const btn = $('#startBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
      const qs = new URLSearchParams({ category: cfg.category, difficulty: cfg.difficulty, mode: cfg.mode, limit: cfg.count, fresh: cfg.fresh ? '1' : '0' });
      const data = await api('/questions?' + qs);
      if (!data.questions.length) throw new Error('Soal untuk pilihan ini belum tersedia. Coba materi/level lain.');
      if (data.filled) toast(`Soal level ${diffByKey[cfg.difficulty].name} terbatas, dilengkapi dari level terdekat.`);
      practice.config = { ...cfg };
      practice.questions = data.questions;
      practice.result = null;
      practice.active = true;
      window.dispatchEvent(new Event('bg:burst'));
      location.hash = '#/quiz';
    } catch (e) {
      toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Mulai ▶';
    }
  };
}

/* ───────── Router kuis ───────── */
export function renderQuiz(app) {
  if (!practice.questions.length || !practice.config) { location.hash = '#/latihan'; return; }
  const m = practice.config.mode;
  if (m === 'game') return runGame(app);
  if (m === 'essay') return runEssay(app);
  if (m === 'interaktif') return runInteractive(app, practice, { complete, metaHTML, srcHTML, confirmExit });
  return runPG(app);
}

/* ───────── Mode 1: Pilihan Ganda ───────── */
function runPG(app) {
  const qs = practice.questions, n = qs.length;
  const st = { i: 0, ans: Array(n).fill(null), flag: new Set(), start: Date.now() };
  const limit = qs.reduce((s, q) => s + (diffByKey[q.difficulty]?.sec || 50), 0);

  app.innerHTML = `
  <div class="quiz-top">
    <button class="icon-btn" id="exitBtn" aria-label="Keluar">${icons.x}</button>
    <div class="progress"><i id="prog"></i></div>
    <div class="timer" id="timer">${mmss(limit)}</div>
    <button class="icon-btn" id="gridBtn" aria-label="Daftar soal">${icons.grid}</button>
  </div>
  <div id="qWrap"></div>`;
  $('#exitBtn').onclick = confirmExit;
  $('#gridBtn').onclick = () => openGrid();

  const timerEl = $('#timer');
  every(1000, timerEl, () => {
    const left = limit - (Date.now() - st.start) / 1000;
    timerEl.textContent = mmss(left);
    timerEl.classList.toggle('low', left < 60);
    if (left <= 0) { toast('Waktu habis! Jawaban dikumpulkan.'); finish(); }
  });

  function draw() {
    const q = qs[st.i];
    $('#prog').style.width = `${(st.ans.filter(a => a !== null).length / n) * 100}%`;
    $('#qWrap').innerHTML = `
      <div class="glass q-card fade-in">
        ${metaHTML(q, st.i, n)}
        <p class="q-text">${esc(q.question)}</p>
        ${srcHTML(q)}
        <div class="opts">${q.options.map((o, k) => `
          <button class="opt ${st.ans[st.i] === k ? 'sel' : ''}" data-k="${k}"><span class="key">${L[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      </div>
      <div class="q-nav">
        <button class="btn ghost" id="prevBtn" ${st.i === 0 ? 'disabled' : ''}>← Sebelumnya</button>
        <button class="icon-btn" id="flagBtn" aria-label="Tandai ragu" style="${st.flag.has(st.i) ? 'color:var(--amber);border-color:var(--amber)' : ''}">${icons.flag}</button>
        ${st.i === n - 1 ? '<button class="btn" id="doneBtn">Selesai ✓</button>' : '<button class="btn" id="nextBtn">Berikutnya →</button>'}
      </div>`;
    $$('.opt', app).forEach(b => (b.onclick = () => { st.ans[st.i] = +b.dataset.k; vibrate(10); draw(); }));
    $('#prevBtn').onclick = () => { st.i--; draw(); };
    $('#nextBtn') && ($('#nextBtn').onclick = () => { st.i++; draw(); });
    $('#doneBtn') && ($('#doneBtn').onclick = askFinish);
    $('#flagBtn').onclick = () => { st.flag.has(st.i) ? st.flag.delete(st.i) : st.flag.add(st.i); draw(); };
  }
  function openGrid() {
    sheet(`<div class="row between" style="margin-bottom:12px"><h3 class="h2">Navigasi soal</h3><span class="dim">${st.ans.filter(a => a !== null).length}/${n} terjawab</span></div>
      <div class="navgrid">${qs.map((_, k) => `<button class="${st.ans[k] !== null ? 'ans' : ''} ${st.flag.has(k) ? 'flag' : ''} ${k === st.i ? 'cur' : ''}" data-go="${k}">${k + 1}</button>`).join('')}</div>
      <p class="dim" style="margin:12px 0">🟪 terjawab · 🟨 garis kuning = ragu-ragu</p>
      <button class="btn block" data-fin>Kumpulkan jawaban</button>`,
    (el, close) => {
      $$('[data-go]', el).forEach(b => (b.onclick = () => { st.i = +b.dataset.go; close(); draw(); }));
      $('[data-fin]', el).onclick = () => { close(); askFinish(); };
    });
  }
  function askFinish() {
    const empty = st.ans.filter(a => a === null).length;
    if (!empty && !st.flag.size) return finish();
    sheet(`<h3 class="h2">Kumpulkan jawaban?</h3><p class="muted">${empty ? `Masih ada <b>${empty}</b> soal belum dijawab. ` : ''}${st.flag.size ? `<b>${st.flag.size}</b> soal ditandai ragu.` : ''}</p>
      <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="back" style="flex:1">Periksa lagi</button><button class="btn" data-a="go" style="flex:1">Kumpulkan</button></div>`,
    (el, close) => { $('[data-a=back]', el).onclick = close; $('[data-a=go]', el).onclick = () => { close(); finish(); }; });
  }
  let done = false;
  function finish() {
    if (done) return; done = true;
    const review = qs.map((q, k) => ({ q, chosen: st.ans[k], ok: st.ans[k] === q.answer }));
    const correct = review.filter(r => r.ok).length;
    complete({
      total: n, correct, score: Math.round((correct / n) * 100),
      points: review.reduce((s, r) => s + (r.ok ? diffByKey[r.q.difficulty]?.pts || 10 : 0), 0),
      durationSec: (Date.now() - st.start) / 1000, review,
    });
  }
  const onKey = e => {
    if (!document.body.contains($('#qWrap'))) return removeEventListener('keydown', onKey);
    if (document.querySelector('.sheet')) return;
    const k = '1234abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0) { st.ans[st.i] = k % 4; draw(); }
    if (e.key === 'ArrowRight' && st.i < n - 1) { st.i++; draw(); }
    if (e.key === 'ArrowLeft' && st.i > 0) { st.i--; draw(); }
  };
  addEventListener('keydown', onKey);
  draw();
}

/* ───────── Mode 2: Arena Game ───────── */
function runGame(app) {
  const qs = practice.questions, n = qs.length;
  const st = { i: 0, lives: 3, score: 0, combo: 0, maxCombo: 0, correct: 0, start: Date.now(), review: [], fifty: 1, freeze: 1, locked: false, left: 0, per: 0 };

  app.innerHTML = `
  <div class="quiz-top">
    <button class="icon-btn" id="exitBtn" aria-label="Keluar">${icons.x}</button>
    <div class="progress"><i id="prog"></i></div>
    <span class="chip" id="qCount"></span>
  </div>
  <div class="arena-hud">
    <div class="hearts" id="hearts"></div>
    <div class="ring-timer" id="ringT"></div>
    <div class="score-box"><div class="s" id="score">0</div><div class="c" id="combo"></div></div>
  </div>
  <div class="arena-stage" id="stage"></div>`;
  $('#exitBtn').onclick = confirmExit;

  const R = 28, C = 2 * Math.PI * R;
  function hud() {
    $('#hearts').innerHTML = [0, 1, 2].map(k => `<span class="${k < st.lives ? '' : 'lost'}">❤️</span>`).join('');
    $('#score').textContent = fmt(st.score);
    $('#combo').textContent = st.combo >= 2 ? `🔥 Combo x${st.combo}` : '';
    $('#prog').style.width = `${(st.i / n) * 100}%`;
    $('#qCount').textContent = `${Math.min(st.i + 1, n)}/${n}`;
  }
  function drawTimer() {
    const pct = st.left / st.per;
    const color = pct > 0.5 ? '#34d399' : pct > 0.25 ? '#fbbf24' : '#fb7185';
    $('#ringT').innerHTML = `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="6"/>
      <circle cx="32" cy="32" r="${R}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" style="transition:stroke-dashoffset .25s linear"/></svg>
      <div class="t" style="color:${color}">${Math.ceil(st.left)}</div>`;
  }
  let tick;
  function drawQ() {
    if (st.i >= n || st.lives <= 0) return end();
    const q = qs[st.i];
    st.locked = false; st.per = diffByKey[q.difficulty]?.gameSec || 20; st.left = st.per;
    hud(); drawTimer();
    $('#stage').innerHTML = `
      <div class="glass arena-q">
        ${metaHTML(q, st.i, n)}
        <p class="q-text">${esc(q.question)}</p>
      </div>
      <div class="tiles">${q.options.map((o, k) => `<button class="tile" data-k="${k}"><span class="k">${L[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="powerups">
        <button class="power" id="pFifty" ${st.fifty ? '' : 'disabled'}>✂️ 50:50 (${st.fifty})</button>
        <button class="power" id="pFreeze" ${st.freeze ? '' : 'disabled'}>⏸️ +10 dtk (${st.freeze})</button>
      </div>
      <div id="fb"></div>`;
    $$('.tile', app).forEach(b => (b.onclick = e => answer(+b.dataset.k, e)));
    $('#pFifty').onclick = () => {
      if (!st.fifty || st.locked) return; st.fifty--;
      const wrong = [0, 1, 2, 3].filter(k => k !== q.answer).sort(() => Math.random() - 0.5).slice(0, 2);
      wrong.forEach(k => $(`.tile[data-k="${k}"]`).classList.add('gone'));
      $('#pFifty').disabled = true;
    };
    $('#pFreeze').onclick = () => {
      if (!st.freeze || st.locked) return; st.freeze--; st.left += 10; st.per += 10; drawTimer(); $('#pFreeze').disabled = true;
    };
    clearInterval(tick);
    const el = $('#ringT');
    tick = every(250, el, () => {
      if (st.locked) return;
      st.left -= 0.25; drawTimer();
      if (st.left <= 0) answer(-1);
    });
  }
  function answer(k, ev) {
    if (st.locked) return; st.locked = true; clearInterval(tick);
    const q = qs[st.i]; const ok = k === q.answer;
    $$('.tile', app).forEach(t => {
      const tk = +t.dataset.k;
      if (tk === q.answer) t.classList.add('right');
      else if (tk === k) t.classList.add('wrong');
      else t.classList.add('dim');
    });
    let gained = 0;
    if (ok) {
      st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); st.correct++;
      const base = diffByKey[q.difficulty]?.pts || 10;
      gained = Math.round(base * (1 + 0.2 * (st.combo - 1)) + base * 0.5 * (st.left / st.per));
      st.score += gained;
      const r = ev?.currentTarget?.getBoundingClientRect?.() || $(`.tile[data-k="${q.answer}"]`).getBoundingClientRect();
      floatPts(`+${gained}`, r.left + r.width / 2, r.top);
      if (st.combo >= 3) confetti(40, { x: r.left + r.width / 2, y: r.top });
      flash('rgba(52,211,153,.5)'); vibrate(15);
      window.dispatchEvent(new Event('bg:burst'));
    } else {
      st.combo = 0; st.lives--; flash('rgba(251,113,133,.55)'); vibrate([60, 40, 60]);
    }
    st.review.push({ q, chosen: k < 0 ? null : k, ok });
    hud();
    if (ok && st.combo >= 2) { const c = $('#combo'); c.classList.remove('combo-burst'); void c.offsetWidth; c.classList.add('combo-burst'); }
    const last = st.i === n - 1 || st.lives <= 0;
    $('#fb').innerHTML = `
      <div class="explain ${ok ? '' : 'bad'} fade-in">
        <b>${ok ? `✅ Benar! +${gained} poin` : k < 0 ? '⏰ Waktu habis!' : '❌ Kurang tepat'}</b>
        ${!ok ? ` Jawaban: <b>${L[q.answer]}. ${esc(q.options[q.answer])}</b>` : ''}
        ${q.explanation ? `<div class="muted" style="margin-top:6px">${esc(q.explanation)}</div>` : ''}
        ${srcHTML(q)}
      </div>
      <button class="btn block" id="nextQ" style="margin-top:12px">${st.lives <= 0 ? '💀 Lihat hasil' : last ? '🏁 Lihat hasil' : 'Lanjut →'}</button>`;
    $('#nextQ').onclick = () => { st.i++; drawQ(); };
    $('#nextQ').focus({ preventScroll: true });
    $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function floatPts(text, x, y) {
    const el = document.createElement('div'); el.className = 'float-pts'; el.textContent = text;
    el.style.left = x - 30 + 'px'; el.style.top = y + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
  }
  function flash(color) {
    const el = document.createElement('div'); el.className = 'screen-flash'; el.style.background = `radial-gradient(circle, transparent 40%, ${color})`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 450);
  }
  let ended = false;
  function end() {
    if (ended) return; ended = true; clearInterval(tick);
    const answered = st.review.length;
    complete({
      total: answered, correct: st.correct, score: Math.round((st.correct / n) * 100), points: st.score,
      durationSec: (Date.now() - st.start) / 1000, review: st.review,
      extra: { maxCombo: st.maxCombo, livesLeft: st.lives, planned: n, gameOver: st.lives <= 0 },
    });
  }
  const onKey = e => {
    if (!document.body.contains($('#stage'))) return removeEventListener('keydown', onKey);
    const k = '1234abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0 && !st.locked) answer(k % 4);
    else if (e.key === 'Enter' && st.locked) $('#nextQ')?.click();
  };
  addEventListener('keydown', onKey);
  drawQ();
}

/* ───────── Mode 3: Esai ───────── */
function runEssay(app) {
  const qs = practice.questions, n = qs.length;
  const st = { i: 0, results: [], start: Date.now(), drafts: Array(n).fill('') };

  app.innerHTML = `
  <div class="quiz-top">
    <button class="icon-btn" id="exitBtn" aria-label="Keluar">${icons.x}</button>
    <div class="progress"><i id="prog"></i></div>
    <span class="chip" id="qCount"></span>
  </div>
  <div id="qWrap"></div>`;
  $('#exitBtn').onclick = confirmExit;

  function draw() {
    const q = qs[st.i];
    $('#prog').style.width = `${(st.results.length / n) * 100}%`;
    $('#qCount').textContent = `${st.i + 1}/${n}`;
    $('#qWrap').innerHTML = `
      <div class="glass q-card fade-in">
        ${metaHTML(q, st.i, n)}
        <p class="q-text">${esc(q.question)}</p>
        ${srcHTML(q)}
        <div class="field" style="margin-top:16px">
          <label for="essay">Jawabanmu</label>
          <textarea id="essay" class="input" placeholder="Tulis jawaban dengan kata-katamu sendiri. Tidak harus sama persis — yang dinilai adalah maksud dan poin pentingnya.">${esc(st.drafts[st.i])}</textarea>
          <div class="essay-meta"><span id="wc">0 kata</span><span>Saran: 40–150 kata</span></div>
        </div>
        <button class="btn block" id="checkBtn" style="margin-top:12px">🔍 Periksa Jawaban</button>
        <div id="gradeBox"></div>
      </div>`;
    const ta = $('#essay');
    const wc = () => { const w = ta.value.trim().split(/\s+/).filter(Boolean).length; $('#wc').textContent = `${w} kata`; st.drafts[st.i] = ta.value; };
    ta.oninput = wc; wc();
    $('#checkBtn').onclick = check;
  }
  async function check() {
    const q = qs[st.i]; const answer = $('#essay').value.trim();
    if (answer.length < 15) return toast('Tulis jawaban minimal satu kalimat lengkap.', 'err');
    const btn = $('#checkBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Mengoreksi maksud jawaban…';
    try {
      const g = await api('/grade', { method: 'POST', body: { question: q.question, answer, keyPoints: q.keyPoints, modelAnswer: q.modelAnswer } });
      st.results[st.i] = { q, answer, grade: g, ok: g.score >= 60 };
      $('#essay').readOnly = true;
      btn.remove();
      showGrade(g, q);
      if (g.score >= 75) confetti(70);
    } catch (e) {
      toast(e.message, 'err'); btn.disabled = false; btn.textContent = '🔍 Periksa Jawaban';
    }
  }
  function showGrade(g, q) {
    const color = g.score >= 75 ? '#34d399' : g.score >= 40 ? '#fbbf24' : '#fb7185';
    const last = st.i === n - 1;
    $('#gradeBox').innerHTML = `
      <div class="grade fade-in">
        <div class="grade-head">
          <div class="ring">${ring(g.score, 92, 9, color)}<div class="v">${g.score}</div></div>
          <div><span class="verdict ${g.verdict}">${g.verdict === 'benar' ? '✓ Maksud benar' : g.verdict === 'sebagian' ? '◐ Sebagian benar' : '✗ Belum tepat'}</span>
          <p style="margin:8px 0 0">${esc(g.summary)}</p>
          ${g.engine === 'keyword' ? `<p class="dim" style="margin:4px 0 0">Koreksi otomatis berbasis kata kunci${session.loggedIn ? '' : ' — masuk akun untuk koreksi AI yang memahami makna'}.</p>` : '<p class="dim" style="margin:4px 0 0">✨ Dikoreksi AI berdasarkan makna jawaban</p>'}</div>
        </div>
        ${g.covered?.length ? `<div><b>Poin yang sudah tepat</b><ul class="points-list">${g.covered.map(c => `<li><span class="ok">✓</span>${esc(c)}</li>`).join('')}</ul></div>` : ''}
        ${g.missed?.length ? `<div><b>Poin yang terlewat</b><ul class="points-list">${g.missed.map(c => `<li><span class="no">✗</span>${esc(c)}</li>`).join('')}</ul></div>` : ''}
        ${g.corrections?.length && g.engine === 'ai' ? `<div><b>Koreksi</b><div class="stack" style="gap:8px;margin-top:6px">${g.corrections.map(c => `<div class="corr"><s>${esc(c.issue)}</s><br>→ <b>${esc(c.fix)}</b></div>`).join('')}</div></div>` : ''}
        <details class="model" ${g.score < 60 ? 'open' : ''}><summary>${g.engine === 'ai' ? 'Versi jawabanmu yang diperbaiki' : 'Jawaban acuan'}</summary><p>${esc(g.improved || q.modelAnswer)}</p></details>
        ${g.engine === 'ai' && q.modelAnswer ? `<details class="model"><summary>Jawaban acuan</summary><p>${esc(q.modelAnswer)}</p></details>` : ''}
        <button class="btn block" id="nextBtn">${last ? '🏁 Lihat hasil' : 'Soal berikutnya →'}</button>
      </div>`;
    animateRings($('#gradeBox'));
    $('#nextBtn').onclick = () => { if (last) finish(); else { st.i++; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  }
  function finish() {
    const res = st.results.filter(Boolean);
    const avg = res.length ? Math.round(res.reduce((s, r) => s + r.grade.score, 0) / res.length) : 0;
    complete({
      total: res.length, correct: res.filter(r => r.ok).length, score: avg,
      points: res.reduce((s, r) => s + Math.round((r.grade.score / 100) * (diffByKey[r.q.difficulty]?.pts || 10) * 2), 0),
      durationSec: (Date.now() - st.start) / 1000, review: res,
    });
  }
  draw();
}

/* ───────── Selesai & simpan ───────── */
async function complete(r) {
  practice.active = false;
  const cfg = practice.config;
  practice.result = { ...r, mode: cfg.mode, category: cfg.category, difficulty: cfg.difficulty, saved: null };
  location.hash = '#/hasil';
  if (session.loggedIn && r.total > 0) {
    try {
      await api('/attempt', {
        method: 'POST',
        body: {
          mode: cfg.mode, category: cfg.category, difficulty: cfg.difficulty, total: r.total, correct: r.correct,
          score: r.score, points: r.points, durationSec: Math.round(r.durationSec),
          details: r.review.map(x => ({ id: x.q.id, correct: x.ok, category: x.q.category })),
        },
      });
      practice.result.saved = true;
      const s = $('#saveState'); if (s) s.textContent = '✅ Hasil tersimpan ke evaluasi';
    } catch (e) {
      practice.result.saved = false;
      const s = $('#saveState'); if (s) s.textContent = '⚠️ Gagal menyimpan: ' + e.message;
    }
  }
}

export function renderResult(app) {
  const r = practice.result;
  if (!r) { location.hash = '#/latihan'; return; }
  const grade = r.score >= 90 ? 'S' : r.score >= 75 ? 'A' : r.score >= 60 ? 'B' : r.score >= 40 ? 'C' : 'D';
  const msg = { S: 'Luar biasa! Kamu siap tempur 🔥', A: 'Hebat! Tinggal sedikit lagi menuju sempurna.', B: 'Bagus! Pelajari pembahasan untuk naik level.', C: 'Lumayan. Ulangi materi ini agar makin kuat.', D: 'Jangan menyerah — baca pembahasan lalu coba lagi.' }[grade];
  const cfg = practice.config;
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="glass result-hero">
      <div class="row between"><span class="chip">${modeByKey[r.mode].ico} ${modeByKey[r.mode].name}</span><span class="grade-letter">${grade}</span></div>
      <div class="big-ring">${ring(r.score, 170, 14)}<div class="v"><b id="scoreNum">0</b><span class="dim">${r.mode === 'essay' ? 'nilai rata-rata' : 'skor'}</span></div></div>
      <h1 class="h2" style="font-size:22px">${msg}</h1>
      <p class="muted" style="margin:6px 0 0">${esc(catByKey[r.category].name)} · ${diffByKey[r.difficulty]?.name || ''}${r.extra?.gameOver ? ' · 💀 Nyawa habis' : ''}</p>
      <p class="dim" id="saveState" style="margin:10px 0 0">${session.loggedIn ? (r.saved === null ? 'Menyimpan hasil…' : r.saved ? '✅ Hasil tersimpan ke evaluasi' : '⚠️ Gagal menyimpan') : '👤 Mode tamu — masuk akun agar hasil tersimpan'}</p>
    </div>
    <div class="grid g4">
      <div class="glass stat"><div class="v">${r.correct}/${r.total}</div><div class="l">${r.mode === 'essay' ? 'Esai lulus (≥60)' : 'Jawaban benar'}</div></div>
      <div class="glass stat"><div class="v grad-text" id="ptsNum">0</div><div class="l">Poin didapat</div></div>
      <div class="glass stat"><div class="v">${mmss(r.durationSec)}</div><div class="l">Durasi</div></div>
      <div class="glass stat"><div class="v">${r.extra ? '🔥' + r.extra.maxCombo : Math.round(r.durationSec / Math.max(1, r.total)) + 's'}</div><div class="l">${r.extra ? 'Combo tertinggi' : 'Rata-rata/soal'}</div></div>
    </div>
    <div class="row wrap">
      <a class="btn" href="#/latihan?mode=${cfg.mode}&category=${cfg.category}&difficulty=${cfg.difficulty}" style="flex:1">🔁 Ulangi</a>
      <a class="btn ghost" href="#/latihan" style="flex:1">Latihan lain</a>
      ${session.loggedIn ? '<a class="btn ghost" href="#/evaluasi" style="flex:1">📈 Evaluasi</a>' : ''}
    </div>
    <div class="glass card">
      <h2 class="h2" style="margin-bottom:12px">Pembahasan</h2>
      ${r.review.map((x, i) => reviewItem(x, i)).join('') || '<div class="empty">Tidak ada soal yang dijawab.</div>'}
    </div>
  </section>`;
  animateRings(app);
  countUp($('#scoreNum'), r.score, 1100);
  countUp($('#ptsNum'), r.points, 1100);
  if (r.score >= 75) setTimeout(() => confetti(120), 400);
}

function reviewItem(x, i) {
  const q = x.q;
  if (q.type === 'interactive') {
    const ans = q.kind === 'match' ? q.pairs.map(p => `${esc(p.a)} → ${esc(p.b)}`).join('<br>')
      : q.kind === 'sort' ? q.buckets.map(b => `<b>${esc(b.name)}:</b> ${b.items.map(esc).join(', ')}`).join('<br>')
      : q.kind === 'chart' ? q.chart.labels.map((l, k) => `${esc(l)} = ${q.chart.values[k]}`).join(' · ') + ' ' + esc(q.chart.unit || '')
      : q.kind === 'words' ? esc(q.items.join(' ')) : q.items.map((t, k) => `${k + 1}. ${esc(t)}`).join('<br>');
    return `<div class="review-item"><div class="row" style="align-items:flex-start"><span>${x.ok ? '✅' : x.ratio >= 0.5 ? '◐' : '❌'}</span><b>${i + 1}. ${esc(q.question)}</b><span class="chip" style="margin-left:auto">${Math.round(x.ratio * 100)}%</span></div>
      <div class="ans"><span style="color:var(--green)">${ans}</span>${q.explanation ? `<span class="muted">${esc(q.explanation)}</span>` : ''}</div></div>`;
  }
  if (q.type === 'essay') {
    return `<div class="review-item"><div class="row between"><b>${i + 1}. ${esc(q.question)}</b><span class="verdict ${x.grade.verdict}">${x.grade.score}</span></div>
      <div class="ans"><span class="dim">Jawabanmu:</span><span>${esc(x.answer)}</span><span class="dim" style="margin-top:6px">Acuan:</span><span class="muted">${esc(q.modelAnswer)}</span></div></div>`;
  }
  return `<div class="review-item">
    <div class="row" style="align-items:flex-start"><span>${x.ok ? '✅' : '❌'}</span><b>${i + 1}. ${esc(q.question)}</b></div>
    <div class="ans">
      ${!x.ok ? `<span style="color:var(--red)">Jawabanmu: ${x.chosen === null ? '— (tidak dijawab)' : L[x.chosen] + '. ' + esc(q.options[x.chosen])}</span>` : ''}
      <span style="color:var(--green)">Jawaban benar: ${L[q.answer]}. ${esc(q.options[q.answer])}</span>
      ${q.explanation ? `<span class="muted">${esc(q.explanation)}</span>` : ''}
      ${srcHTML(q)}
    </div></div>`;
}
