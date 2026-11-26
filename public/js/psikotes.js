// Latihan Khusus Tes Psikologi: simulasi Kraepelin/Pauli & tes kecermatan (huruf/simbol hilang)
import { $, $$, esc, toast } from './ui.js';
import { sfx, setMood } from './sound.js';

const BEST = 'sl_psi_best';
const best = () => { try { return JSON.parse(localStorage.getItem(BEST) || '{}'); } catch { return {}; } };
const saveBest = (k, v) => { const b = best(); if (!b[k] || v > b[k]) { b[k] = v; try { localStorage.setItem(BEST, JSON.stringify(b)); } catch {} return true; } return false; };
const vibrate = p => { try { navigator.vibrate?.(p); } catch {} };
let stopActive = null;
addEventListener('hashchange', () => { stopActive?.(); stopActive = null; });

export function renderPsikotes(app, params) {
  stopActive?.(); stopActive = null;
  setMood('calm');
  const b = best();
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="glass psi-hero">
      <span class="chip" style="background:rgba(245,158,11,.15);color:#fbbf24">🧩 Latihan Khusus</span>
      <h1 class="h1" style="margin:10px 0 4px">Tes Psikologi</h1>
      <p class="muted" style="margin:0;max-width:640px">Simulasi psikotes yang sering dipakai rekrutmen BUMN, perbankan, dan CPNS. Latih ketahanan kerja dengan Kraepelin, ketelitian dengan tes kecermatan, lalu kuasai teori & soal psikotes.</p>
    </div>
    <div class="psi-grid">
      <button class="glass psi-card tilt" data-go="kraepelin"><span class="psi-ico">🔢</span><b>Simulasi Kraepelin / Pauli</b>
        <p>Jumlahkan dua angka berdekatan, tulis angka satuannya. Pindah kolom tiap aba-aba. Hasil: grafik kecepatan, ketelitian, keajegan & ketahanan.</p>
        ${b.kraepelin ? `<small class="psi-best">🏅 Rekor: ${b.kraepelin} jawaban benar</small>` : ''}</button>
      <button class="glass psi-card tilt" data-go="cermat"><span class="psi-ico">🔍</span><b>Tes Kecermatan</b>
        <p>Diberi 5 karakter kunci, lalu 4 karakter acak — tebak cepat karakter mana yang hilang. Melatih fokus dan kecepatan visual.</p>
        ${b.cermat ? `<small class="psi-best">🏅 Rekor: ${b.cermat} benar</small>` : ''}</button>
      <a class="glass psi-card tilt" href="#/latihan?category=psikologi&mode=pg"><span class="psi-ico">🧠</span><b>Soal Psikotes</b>
        <p>Deret angka, analogi, silogisme, spasial, dan pengetahuan jenis-jenis psikotes (Wartegg, DAP, BAUM, EPPS, PAPI, DISC).</p></a>
      <a class="glass psi-card tilt" href="#/materi?id=core-psikologi"><span class="psi-ico">📚</span><b>Materi Psikotes</b>
        <p>Pahami jenis tes, apa yang dinilai, dan strategi menghadapinya. Bisa tanya Mentor AI langsung di materinya.</p></a>
    </div>
    <div id="psiStage"></div>
  </section>`;
  $$('[data-go]', app).forEach(el => (el.onclick = () => (el.dataset.go === 'kraepelin' ? setupKraepelin(app) : setupCermat(app))));
  if (params?.get('t') === 'kraepelin') setupKraepelin(app);
  if (params?.get('t') === 'cermat') setupCermat(app);
}

/* ───────── Kraepelin ───────── */
function setupKraepelin(app) {
  const st = $('#psiStage', app);
  const cfg = { cols: 10, sec: 15 };
  const paint = () => {
    st.innerHTML = `<div class="glass card psi-setup fade-in">
      <h2 class="h2">🔢 Atur simulasi Kraepelin</h2>
      <p class="dim" style="margin-top:4px">Kerjakan dari bawah ke atas. Jumlahkan angka yang disorot dan ketik <b>angka satuannya</b> (7 + 8 = 15 → ketik <b>5</b>). Saat waktu kolom habis, otomatis pindah ke kolom baru.</p>
      <div class="row wrap" style="gap:18px;margin-top:10px">
        <div><div class="dim psi-lbl">Jumlah kolom</div><div class="pill-group">${[5, 10, 20, 30].map(n => `<button class="pill ${cfg.cols === n ? 'on' : ''}" data-cols="${n}">${n}</button>`).join('')}</div></div>
        <div><div class="dim psi-lbl">Waktu per kolom</div><div class="pill-group">${[10, 15, 20, 30].map(n => `<button class="pill ${cfg.sec === n ? 'on' : ''}" data-sec="${n}">${n} dtk</button>`).join('')}</div></div>
      </div>
      <p class="dim" style="font-size:13px">Total ±${Math.round(cfg.cols * cfg.sec / 60 * 10) / 10} menit. Tes asli biasanya 40–50 kolom × 15–30 detik.</p>
      <button class="btn" id="kStart">Mulai simulasi ▶</button></div>`;
    $$('[data-cols]', st).forEach(b => (b.onclick = () => { cfg.cols = +b.dataset.cols; paint(); }));
    $$('[data-sec]', st).forEach(b => (b.onclick = () => { cfg.sec = +b.dataset.sec; paint(); }));
    $('#kStart', st).onclick = () => runKraepelin(cfg);
  };
  paint();
  st.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function runKraepelin(cfg) {
  setMood('tense');
  const LEN = 60;
  const cols = Array.from({ length: cfg.cols }, () => Array.from({ length: LEN }, () => 1 + Math.floor(Math.random() * 9)));
  const stats = cols.map(() => ({ right: 0, wrong: 0 }));
  let c = 0, pos = 0, left = cfg.sec, done = false;
  const ov = document.createElement('div');
  ov.className = 'psi-run';
  ov.innerHTML = `
    <div class="psi-top"><button class="psi-quit" aria-label="Keluar">✕</button>
      <div class="psi-meta"><b id="kCol"></b><span class="dim" id="kCount"></span></div>
      <div class="psi-timer"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" class="bg"/><circle cx="18" cy="18" r="16" class="fg" id="kRing"/></svg><b id="kSec"></b></div></div>
    <div class="psi-colwrap"><div class="psi-col" id="kColEl"></div></div>
    <div class="psi-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => `<button data-k="${n}">${n}</button>`).join('')}</div>
    <p class="dim psi-hint">Bisa juga pakai tombol angka di keyboard</p>`;
  document.body.appendChild(ov);
  document.body.classList.add('psi-lock');
  const colEl = $('#kColEl', ov);
  const draw = () => {
    const d = cols[c];
    const from = Math.max(0, pos - 3), to = Math.min(LEN, pos + 9);
    let h = '';
    for (let i = to - 1; i >= from; i--) {
      const act = i === pos || i === pos + 1;
      h += `<div class="psi-n ${act ? 'act' : ''} ${i < pos ? 'past' : ''}">${d[i]}</div>`;
      if (i === pos + 1) h += `<div class="psi-ans">?</div>`;
    }
    colEl.innerHTML = h;
    $('#kCol', ov).textContent = `Kolom ${c + 1} / ${cfg.cols}`;
    $('#kCount', ov).textContent = `${stats[c].right + stats[c].wrong} dijawab`;
  };
  const tickUI = () => { $('#kSec', ov).textContent = left; $('#kRing', ov).style.strokeDashoffset = 100.5 * (1 - left / cfg.sec); };
  const nextCol = () => {
    if (++c >= cfg.cols) return finish();
    pos = 0; left = cfg.sec; sfx('go'); vibrate(30);
    colEl.classList.remove('swap'); void colEl.offsetWidth; colEl.classList.add('swap');
    draw(); tickUI();
  };
  const timer = setInterval(() => {
    if (done) return;
    left--; if (left <= 3 && left > 0) sfx('tick');
    if (left <= 0) nextCol(); else tickUI();
  }, 1000);
  const answer = k => {
    if (done) return;
    const d = cols[c]; if (pos >= LEN - 1) return;
    const ok = (d[pos] + d[pos + 1]) % 10 === k;
    stats[c][ok ? 'right' : 'wrong']++;
    if (!ok) { vibrate(25); colEl.classList.remove('bad'); void colEl.offsetWidth; colEl.classList.add('bad'); }
    else sfx('nav');
    pos++; draw();
  };
  const onKey = e => { if (/^[0-9]$/.test(e.key)) { e.preventDefault(); answer(+e.key); const b = $(`[data-k="${e.key}"]`, ov); b?.classList.add('hit'); setTimeout(() => b?.classList.remove('hit'), 120); } else if (e.key === 'Escape') quit(); };
  addEventListener('keydown', onKey);
  $$('[data-k]', ov).forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); answer(+b.dataset.k); }));
  const cleanup = () => { done = true; clearInterval(timer); removeEventListener('keydown', onKey); ov.remove(); document.body.classList.remove('psi-lock'); };
  const quit = () => { cleanup(); stopActive = null; setMood('calm'); };
  $('.psi-quit', ov).onclick = () => { if (confirmQuit()) quit(); };
  function finish() { cleanup(); stopActive = null; showKraepelinResult(cfg, stats); }
  stopActive = cleanup;
  draw(); tickUI(); sfx('go');
}
const confirmQuit = () => { const b = document.querySelector('.psi-quit'); if (b?.dataset.sure) return true; if (b) { b.dataset.sure = 1; b.textContent = 'Keluar?'; b.classList.add('sure'); setTimeout(() => { if (b) { delete b.dataset.sure; b.textContent = '✕'; b.classList.remove('sure'); } }, 2500); } return false; };

function lineChart(vals, vals2) {
  const W = 900, H = 230, P = 26, max = Math.max(4, ...vals) * 1.15, n = vals.length;
  const x = i => P + (n === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (n - 1)), y = v => H - P - (v / max) * (H - 2 * P);
  const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  return `<svg viewBox="0 0 ${W} ${H}" class="psi-chart" role="img" aria-label="Grafik jumlah jawaban per kolom">
    <line x1="${P}" x2="${W - P}" y1="${y(avg)}" y2="${y(avg)}" class="avg"/><text x="${W - P}" y="${y(avg) - 5}" text-anchor="end" class="lbl">rata-rata ${avg.toFixed(1)}</text>
    <path d="${path(vals)} L${x(n - 1)},${H - P} L${x(0)},${H - P}Z" class="area"/>
    <path d="${path(vals)}" class="ln"/>${vals2 ? `<path d="${path(vals2)}" class="ln2"/>` : ''}
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" class="pt"/>`).join('')}
    <text x="${P}" y="${H - 6}" class="lbl">kolom 1</text><text x="${W - P}" y="${H - 6}" text-anchor="end" class="lbl">kolom ${n}</text></svg>`;
}

function showKraepelinResult(cfg, stats) {
  setMood('calm');
  const st = $('#psiStage'); if (!st) return;
  const per = stats.map(s => s.right + s.wrong), right = stats.reduce((a, s) => a + s.right, 0), wrong = stats.reduce((a, s) => a + s.wrong, 0);
  const n = per.length, panker = per.reduce((a, b) => a + b, 0) / n;
  const acc = right + wrong ? (right / (right + wrong)) * 100 : 0;
  const diffs = per.slice(1).map((v, i) => Math.abs(v - per[i]));
  const janker = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const third = Math.max(1, Math.floor(n / 3));
  const first = per.slice(0, third).reduce((a, b) => a + b, 0) / third, last = per.slice(-third).reduce((a, b) => a + b, 0) / third;
  const hanker = last - first;
  const perMin = panker * (60 / cfg.sec);
  const rate = (v, a, b) => (v >= b ? ['Baik', 'ok'] : v >= a ? ['Cukup', 'mid'] : ['Perlu latihan', 'low']);
  const speed = rate(perMin, 40, 60), tel = rate(acc, 85, 95);
  const aj = janker <= Math.max(2, panker * 0.15) ? ['Stabil', 'ok'] : janker <= Math.max(4, panker * 0.3) ? ['Cukup stabil', 'mid'] : ['Naik-turun', 'low'];
  const ta = hanker >= -Math.max(1, first * 0.08) ? ['Terjaga', 'ok'] : hanker >= -Math.max(2, first * 0.2) ? ['Sedikit menurun', 'mid'] : ['Menurun', 'low'];
  const rec = saveBest('kraepelin', right);
  if (rec) sfx('levelup'); else sfx(acc >= 90 ? 'win' : 'notify');
  const tips = [];
  if (speed[1] !== 'ok') tips.push('Latih penjumlahan satu digit 10 menit sehari sampai hasilnya keluar otomatis tanpa berpikir.');
  if (tel[1] !== 'ok') tips.push('Kurangi tebakan: lebih baik sedikit lebih lambat tapi benar, karena salah menurunkan nilai ketelitian.');
  if (aj[1] !== 'ok') tips.push('Jaga ritme yang sama di setiap kolom — jangan terlalu ngebut di awal lalu melambat.');
  if (ta[1] !== 'ok') tips.push('Latih durasi lebih panjang (20–30 kolom) untuk membangun stamina fokus.');
  if (!tips.length) tips.push('Hasilmu sudah bagus! Coba tingkatkan jumlah kolom atau persingkat waktu per kolom.');
  st.innerHTML = `<div class="glass card fade-in psi-result">
    <div class="row between wrap"><h2 class="h2" style="margin:0">📊 Hasil Kraepelin</h2>${rec ? '<span class="chip" style="background:rgba(250,204,21,.18);color:#facc15">🏅 Rekor baru!</span>' : ''}</div>
    <p class="dim" style="margin:4px 0 12px">${cfg.cols} kolom × ${cfg.sec} detik · ${right} benar · ${wrong} salah</p>
    ${lineChart(per, stats.map(s => s.wrong))}
    <div class="psi-legend dim"><span><i class="l1"></i>Jumlah dijawab per kolom</span><span><i class="l2"></i>Salah</span></div>
    <div class="psi-scores">
      <div class="glass"><span>⚡ Kecepatan (Panker)</span><b>${panker.toFixed(1)}<small>/kolom</small></b><em class="${speed[1]}">${speed[0]}</em></div>
      <div class="glass"><span>🎯 Ketelitian (Tianker)</span><b>${acc.toFixed(0)}<small>%</small></b><em class="${tel[1]}">${tel[0]}</em></div>
      <div class="glass"><span>📈 Keajegan (Janker)</span><b>±${janker.toFixed(1)}</b><em class="${aj[1]}">${aj[0]}</em></div>
      <div class="glass"><span>🔋 Ketahanan (Hanker)</span><b>${hanker >= 0 ? '+' : ''}${hanker.toFixed(1)}</b><em class="${ta[1]}">${ta[0]}</em></div>
    </div>
    <div class="psi-tips"><b>💡 Saran latihan</b><ul>${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <p class="dim" style="font-size:12px">Penilaian ini adalah perkiraan untuk latihan, bukan skor resmi psikolog.</p>
    <div class="row wrap" style="gap:8px"><button class="btn" id="kAgain">🔁 Ulangi</button><button class="btn ghost" id="kSet">⚙️ Ubah pengaturan</button></div></div>`;
  $('#kAgain', st).onclick = () => runKraepelin(cfg);
  $('#kSet', st).onclick = () => setupKraepelin(st.closest('section').parentElement);
  st.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ───────── Tes kecermatan ───────── */
const SETS = {
  huruf: 'FGHJKLMNPQRSTUVWXYZ'.split(''),   // tanpa A–E agar tidak tertukar dengan label jawaban
  angka: '0123456789'.split(''),
  simbol: ['★', '♦', '●', '▲', '■', '♣', '♥', '✚', '◆', '☾', '✿', '⬟'],
};
function setupCermat(app) {
  const st = $('#psiStage', app);
  const cfg = { set: 'huruf', cols: 5, sec: 45 };
  const paint = () => {
    st.innerHTML = `<div class="glass card psi-setup fade-in">
      <h2 class="h2">🔍 Atur tes kecermatan</h2>
      <p class="dim" style="margin-top:4px">Setiap kolom punya 5 karakter kunci (A–E). Lalu muncul 4 karakter teracak — pilih huruf kunci (A–E) dari karakter yang <b>hilang</b>. Kunci berganti setiap kolom.</p>
      <div class="row wrap" style="gap:18px;margin-top:10px">
        <div><div class="dim psi-lbl">Jenis karakter</div><div class="pill-group">${[['huruf', 'Huruf'], ['angka', 'Angka'], ['simbol', 'Simbol']].map(([k, l]) => `<button class="pill ${cfg.set === k ? 'on' : ''}" data-set="${k}">${l}</button>`).join('')}</div></div>
        <div><div class="dim psi-lbl">Jumlah kolom</div><div class="pill-group">${[3, 5, 10].map(n => `<button class="pill ${cfg.cols === n ? 'on' : ''}" data-cols="${n}">${n}</button>`).join('')}</div></div>
        <div><div class="dim psi-lbl">Waktu per kolom</div><div class="pill-group">${[30, 45, 60].map(n => `<button class="pill ${cfg.sec === n ? 'on' : ''}" data-sec="${n}">${n} dtk</button>`).join('')}</div></div>
      </div>
      <button class="btn" id="cStart" style="margin-top:14px">Mulai tes ▶</button></div>`;
    $$('[data-set]', st).forEach(b => (b.onclick = () => { cfg.set = b.dataset.set; paint(); }));
    $$('[data-cols]', st).forEach(b => (b.onclick = () => { cfg.cols = +b.dataset.cols; paint(); }));
    $$('[data-sec]', st).forEach(b => (b.onclick = () => { cfg.sec = +b.dataset.sec; paint(); }));
    $('#cStart', st).onclick = () => runCermat(cfg);
  };
  paint();
  st.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function runCermat(cfg) {
  setMood('tense');
  const L = 'ABCDE';
  const stats = Array.from({ length: cfg.cols }, () => ({ right: 0, wrong: 0 }));
  let c = 0, key = [], q = null, left = cfg.sec, done = false;
  const ov = document.createElement('div');
  ov.className = 'psi-run';
  ov.innerHTML = `
    <div class="psi-top"><button class="psi-quit" aria-label="Keluar">✕</button>
      <div class="psi-meta"><b id="cCol"></b><span class="dim" id="cCount"></span></div>
      <div class="psi-timer"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" class="bg"/><circle cx="18" cy="18" r="16" class="fg" id="cRing"/></svg><b id="cSec"></b></div></div>
    <div class="cm-key" id="cKey"></div>
    <div class="cm-q" id="cQ"></div>
    <div class="psi-pad cm-pad">${[...L].map(l => `<button data-a="${l}">${l}</button>`).join('')}</div>
    <p class="dim psi-hint">Keyboard: tekan A–E</p>`;
  document.body.appendChild(ov);
  document.body.classList.add('psi-lock');
  const newKey = () => { key = shuffle(SETS[cfg.set]).slice(0, 5); $('#cKey', ov).innerHTML = key.map((k, i) => `<div><b>${esc(k)}</b><span>${L[i]}</span></div>`).join(''); };
  const newQ = () => {
    const miss = Math.floor(Math.random() * 5);
    q = { miss, show: shuffle(key.filter((_, i) => i !== miss)) };
    const el = $('#cQ', ov); el.innerHTML = q.show.map(k => `<span>${esc(k)}</span>`).join('');
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    $('#cCol', ov).textContent = `Kolom ${c + 1} / ${cfg.cols}`;
    $('#cCount', ov).textContent = `${stats[c].right} benar · ${stats[c].wrong} salah`;
  };
  const tickUI = () => { $('#cSec', ov).textContent = left; $('#cRing', ov).style.strokeDashoffset = 100.5 * (1 - left / cfg.sec); };
  const nextCol = () => { if (++c >= cfg.cols) return finish(); left = cfg.sec; sfx('go'); vibrate(30); newKey(); newQ(); tickUI(); };
  const timer = setInterval(() => { if (done) return; left--; if (left <= 3 && left > 0) sfx('tick'); if (left <= 0) nextCol(); else tickUI(); }, 1000);
  const answer = l => {
    if (done || !q) return;
    const ok = L.indexOf(l) === q.miss;
    stats[c][ok ? 'right' : 'wrong']++;
    const b = $(`[data-a="${l}"]`, ov); b?.classList.add(ok ? 'good' : 'badk'); setTimeout(() => b?.classList.remove('good', 'badk'), 160);
    if (ok) sfx('nav'); else vibrate(25);
    newQ();
  };
  const onKey = e => { const k = e.key.toUpperCase(); if (L.includes(k) && k.length === 1) { e.preventDefault(); answer(k); } else if (e.key === 'Escape') quit(); };
  addEventListener('keydown', onKey);
  $$('[data-a]', ov).forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); answer(b.dataset.a); }));
  const cleanup = () => { done = true; clearInterval(timer); removeEventListener('keydown', onKey); ov.remove(); document.body.classList.remove('psi-lock'); };
  const quit = () => { cleanup(); stopActive = null; setMood('calm'); };
  $('.psi-quit', ov).onclick = () => { if (confirmQuit()) quit(); };
  function finish() {
    cleanup(); stopActive = null; setMood('calm');
    const st = $('#psiStage'); if (!st) return;
    const right = stats.reduce((a, s) => a + s.right, 0), wrong = stats.reduce((a, s) => a + s.wrong, 0);
    const acc = right + wrong ? (right / (right + wrong)) * 100 : 0, perMin = right / (cfg.cols * cfg.sec / 60);
    const rec = saveBest('cermat', right);
    sfx(rec ? 'levelup' : acc >= 90 ? 'win' : 'notify');
    st.innerHTML = `<div class="glass card fade-in psi-result">
      <div class="row between wrap"><h2 class="h2" style="margin:0">📊 Hasil Tes Kecermatan</h2>${rec ? '<span class="chip" style="background:rgba(250,204,21,.18);color:#facc15">🏅 Rekor baru!</span>' : ''}</div>
      <p class="dim" style="margin:4px 0 12px">${cfg.cols} kolom × ${cfg.sec} detik · ${cfg.set}</p>
      ${lineChart(stats.map(s => s.right), stats.map(s => s.wrong))}
      <div class="psi-legend dim"><span><i class="l1"></i>Benar per kolom</span><span><i class="l2"></i>Salah</span></div>
      <div class="psi-scores">
        <div class="glass"><span>✅ Total benar</span><b>${right}</b><em class="${perMin >= 30 ? 'ok' : perMin >= 18 ? 'mid' : 'low'}">${perMin.toFixed(1)}/menit</em></div>
        <div class="glass"><span>🎯 Ketelitian</span><b>${acc.toFixed(0)}<small>%</small></b><em class="${acc >= 95 ? 'ok' : acc >= 85 ? 'mid' : 'low'}">${acc >= 95 ? 'Sangat teliti' : acc >= 85 ? 'Cukup' : 'Perlu latihan'}</em></div>
      </div>
      <div class="psi-tips"><b>💡 Tips</b><ul><li>Hafalkan posisi kunci (A–E) di awal kolom, jangan bolak-balik melihat kunci.</li><li>Pindai 4 karakter sekaligus, cari yang tidak ada — bukan mengecek satu per satu.</li></ul></div>
      <div class="row wrap" style="gap:8px"><button class="btn" id="cAgain">🔁 Ulangi</button><button class="btn ghost" id="cSet">⚙️ Ubah pengaturan</button></div></div>`;
    $('#cAgain', st).onclick = () => runCermat(cfg);
    $('#cSet', st).onclick = () => setupCermat(st.closest('section').parentElement);
    st.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  stopActive = cleanup;
  newKey(); newQ(); tickUI(); sfx('go');
}
