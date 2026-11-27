// 🏛️ Simulasi SKD CAT CPNS 2026 — mengikuti Kepmen PANRB Nomor 674 Tahun 2026
// 110 soal (TWK 30 · TIU 35 · TKP 45), 100 menit, TWK/TIU benar 5 salah/kosong 0,
// TKP tiap pilihan bernilai 1–5 (kosong 0), maksimal 550, nilai ambang batas umum 65 / 80 / 166.
import { api } from './api.js';
import { $, $$, esc, toast, sheet, icons, mmss, vibrate, ring, animateRings, countUp, confetti } from './ui.js';
import { sfx } from './sound.js';

export const SKD = {
  minutes: 100,
  parts: [
    { key: 'twk', name: 'TWK', full: 'Tes Wawasan Kebangsaan', n: 30, max: 150, pass: 65 },
    { key: 'tiu', name: 'TIU', full: 'Tes Intelegensia Umum', n: 35, max: 175, pass: 80 },
    { key: 'tkp', name: 'TKP', full: 'Tes Karakteristik Pribadi', n: 45, max: 225, pass: 166 },
  ],
  khusus: [
    { name: 'Cum laude & diaspora', total: 311, tiu: 85 },
    { name: 'Penyandang disabilitas & putra/putri Papua', total: 286, tiu: 60 },
  ],
};
const L = ['A', 'B', 'C', 'D', 'E'];
const partOf = key => SKD.parts.find(p => p.key === key);

export function skdBanner() {
  return `<button type="button" class="glass skd-banner tilt" id="skdOpen"><span class="skd-ico">🏛️</span>
    <span style="flex:1;text-align:left"><small>CPNS 2026 · KEPMEN PANRB 674/2026</small><b>Simulasi SKD CAT 2026</b>
    <span class="dim">110 soal · 100 menit · nilai maks 550 · cek lolos ambang batas 65 / 80 / 166</span></span><span class="skd-go">Mulai →</span></button>`;
}

// Lembar aturan sebelum mulai
export function openSkdIntro({ seenKeys, rememberSeen, practice }) {
  sheet(`
    <div class="row" style="gap:12px;align-items:center"><span class="skd-ico" style="width:46px;height:46px;font-size:22px">🏛️</span>
      <div><h3 class="h2" style="margin:0">Simulasi SKD CAT 2026</h3><span class="dim">Sesuai Kepmen PANRB Nomor 674 Tahun 2026</span></div></div>
    <div class="skd-rules">
      ${SKD.parts.map(p => `<div class="skd-rule"><b>${p.name}</b><span>${p.n} soal</span><span class="dim">maks ${p.max} · lolos ≥ ${p.pass}</span></div>`).join('')}
    </div>
    <ul class="skd-list">
      <li>⏱️ Waktu <b>100 menit</b> untuk 110 soal. Bebas berpindah soal dan subtes.</li>
      <li>✅ TWK & TIU: benar <b>5</b>, salah atau kosong <b>0</b> — tidak ada pengurangan, jadi isi semua.</li>
      <li>🧭 TKP: setiap pilihan bernilai <b>1–5</b>, tidak menjawab bernilai 0.</li>
      <li>🎯 Lolos jika <b>ketiga</b> subtes memenuhi ambang batas, bukan hanya total.</li>
      <li>📖 Pembahasan dan skor tiap pilihan TKP muncul setelah selesai.</li>
    </ul>
    <button class="btn block" id="skdGo">Mulai simulasi ▶</button>`,
  (el, close) => {
    $('#skdGo', el).onclick = async () => {
      const b = $('#skdGo', el); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Menyiapkan 110 soal…';
      try {
        const d = await api('/questions?sim=skd&seen=' + encodeURIComponent(seenKeys().slice(-300).join(',')));
        if ((d.questions || []).length < 100) throw new Error('Bank soal SKD belum cukup. Coba lagi nanti.');
        rememberSeen(d.questions);
        Object.assign(practice, { config: { mode: 'skd', category: 'campuran', difficulty: 'all', count: d.questions.length }, questions: d.questions, result: null, active: true });
        close();
        window.dispatchEvent(new Event('bg:burst'));
        location.hash = '#/quiz';
      } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Mulai simulasi ▶'; }
    };
  });
}

// Skor satu soal sesuai aturan CAT BKN
function pointOf(q, chosen) {
  if (chosen === null || chosen === undefined) return 0;
  if (q.section === 'tkp' && Array.isArray(q.scores)) return q.scores[chosen] || 0;
  return chosen === q.answer ? 5 : 0;
}

export function runSKD(app, practice, { complete, confirmExit }) {
  const qs = practice.questions, n = qs.length;
  const st = { i: 0, ans: Array(n).fill(null), flag: new Set(), start: Date.now() };
  const limit = SKD.minutes * 60;
  const firstOf = key => qs.findIndex(q => q.section === key);

  app.innerHTML = `
  <div class="quiz-top">
    <button class="icon-btn" id="exitBtn" aria-label="Keluar">${icons.x}</button>
    <div class="progress"><i id="prog"></i></div>
    <div class="timer" id="timer">${mmss(limit)}</div>
    <button class="icon-btn" id="gridBtn" aria-label="Daftar soal">${icons.grid}</button>
  </div>
  <div class="skd-tabs" id="skdTabs">${SKD.parts.map(p => `<button data-sec="${p.key}"><b>${p.name}</b><span data-cnt="${p.key}"></span></button>`).join('')}</div>
  <div id="qWrap"></div>`;
  $('#exitBtn').onclick = confirmExit;
  $('#gridBtn').onclick = () => openGrid();
  $$('[data-sec]', app).forEach(b => (b.onclick = () => { const k = firstOf(b.dataset.sec); if (k >= 0) { st.i = k; draw(); } }));

  const timerEl = $('#timer');
  const tick = setInterval(() => {
    if (!document.body.contains(timerEl)) return clearInterval(tick);
    const left = limit - (Date.now() - st.start) / 1000;
    timerEl.textContent = mmss(left);
    timerEl.classList.toggle('low', left < 300);
    if (left <= 0) { clearInterval(tick); toast('⏰ Waktu 100 menit habis! Jawaban dikumpulkan.'); finish(); }
  }, 1000);

  function counts() {
    SKD.parts.forEach(p => {
      const idx = qs.map((q, k) => (q.section === p.key ? k : -1)).filter(k => k >= 0);
      const done = idx.filter(k => st.ans[k] !== null).length;
      const el = $(`[data-cnt="${p.key}"]`); if (el) el.textContent = `${done}/${idx.length}`;
    });
    $$('[data-sec]', app).forEach(b => b.classList.toggle('on', b.dataset.sec === qs[st.i].section));
  }
  function draw() {
    const q = qs[st.i], p = partOf(q.section);
    const no = st.i - firstOf(q.section) + 1;
    $('#prog').style.width = `${(st.ans.filter(a => a !== null).length / n) * 100}%`;
    counts();
    $('#qWrap').innerHTML = `
      <div class="glass q-card fade-in">
        <div class="q-meta"><span class="chip skd-chip ${q.section}">${p.name} · ${no}/${p.n}</span><span class="chip">Soal ${st.i + 1}/${n}</span>
          <span class="dim" style="margin-left:auto;font-size:12px">${esc(p.full)}</span></div>
        <p class="q-text">${esc(q.question)}</p>
        <div class="opts">${q.options.map((o, k) => `
          <button class="opt ${st.ans[st.i] === k ? 'sel' : ''}" data-k="${k}"><span class="key">${L[k]}</span><span class="${/^[^a-z0-9]{1,8}$/i.test(o) ? 'opt-sym' : ''}">${esc(o)}</span></button>`).join('')}</div>
      </div>
      <div class="q-nav">
        <button class="btn ghost" id="prevBtn" ${st.i === 0 ? 'disabled' : ''}>← Sebelumnya</button>
        <button class="icon-btn" id="flagBtn" aria-label="Tandai ragu" style="${st.flag.has(st.i) ? 'color:var(--amber);border-color:var(--amber)' : ''}">${icons.flag}</button>
        ${st.i === n - 1 ? '<button class="btn" id="doneBtn">Selesai ✓</button>' : '<button class="btn" id="nextBtn">Berikutnya →</button>'}
      </div>`;
    $$('.opt', app).forEach(b => (b.onclick = () => { st.ans[st.i] = +b.dataset.k; vibrate(10); sfx('click'); draw(); }));
    $('#prevBtn').onclick = () => { st.i--; draw(); };
    $('#nextBtn') && ($('#nextBtn').onclick = () => { st.i++; draw(); });
    $('#doneBtn') && ($('#doneBtn').onclick = askFinish);
    $('#flagBtn').onclick = () => { st.flag.has(st.i) ? st.flag.delete(st.i) : st.flag.add(st.i); draw(); };
  }
  function openGrid() {
    sheet(`<div class="row between" style="margin-bottom:10px"><h3 class="h2">Navigasi soal</h3><span class="dim">${st.ans.filter(a => a !== null).length}/${n} terjawab</span></div>
      ${SKD.parts.map(p => `<div class="skd-grid-h"><b>${p.name}</b><span class="dim">${esc(p.full)}</span></div>
        <div class="navgrid">${qs.map((q, k) => (q.section !== p.key ? '' : `<button class="${st.ans[k] !== null ? 'ans' : ''} ${st.flag.has(k) ? 'flag' : ''} ${k === st.i ? 'cur' : ''}" data-go="${k}">${k + 1}</button>`)).join('')}</div>`).join('')}
      <p class="dim" style="margin:12px 0">🟪 terjawab · garis kuning = ragu-ragu</p>
      <button class="btn block" data-fin>Kumpulkan jawaban</button>`,
    (el, close) => {
      $$('[data-go]', el).forEach(b => (b.onclick = () => { st.i = +b.dataset.go; close(); draw(); }));
      $('[data-fin]', el).onclick = () => { close(); askFinish(); };
    });
  }
  function askFinish() {
    const empty = st.ans.filter(a => a === null).length;
    const left = Math.max(0, limit - (Date.now() - st.start) / 1000);
    sheet(`<h3 class="h2">Akhiri simulasi?</h3>
      <p class="muted">${empty ? `Masih ada <b>${empty}</b> soal kosong (bernilai 0). ` : 'Semua soal sudah dijawab. '}${st.flag.size ? `<b>${st.flag.size}</b> soal ditandai ragu. ` : ''}Sisa waktu <b>${mmss(left)}</b>.</p>
      <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="back" style="flex:1">Periksa lagi</button><button class="btn" data-a="go" style="flex:1">Akhiri & lihat nilai</button></div>`,
    (el, close) => { $('[data-a=back]', el).onclick = close; $('[data-a=go]', el).onclick = () => { close(); finish(); }; });
  }
  let done = false;
  function finish() {
    if (done) return; done = true; clearInterval(tick);
    const review = qs.map((q, k) => {
      const pts = pointOf(q, st.ans[k]);
      return { q, chosen: st.ans[k], pts, ok: q.section === 'tkp' ? pts === 5 : pts === 5 };
    });
    const sec = Object.fromEntries(SKD.parts.map(p => [p.key, review.filter(r => r.q.section === p.key).reduce((s, r) => s + r.pts, 0)]));
    const total = sec.twk + sec.tiu + sec.tkp;
    const passEach = Object.fromEntries(SKD.parts.map(p => [p.key, sec[p.key] >= p.pass]));
    const pass = Object.values(passEach).every(Boolean);
    complete({
      total: n, correct: review.filter(r => r.ok).length,
      score: Math.round((total / 550) * 100),
      points: total * 2,
      durationSec: (Date.now() - st.start) / 1000, review,
      skd: { ...sec, total, pass, passEach, answered: st.ans.filter(a => a !== null).length },
    });
  }
  const onKey = e => {
    if (!document.body.contains($('#qWrap'))) return removeEventListener('keydown', onKey);
    if (document.querySelector('.sheet')) return;
    const k = '12345abcde'.indexOf(e.key.toLowerCase()) % 5;
    if (k >= 0 && k < qs[st.i].options.length) { st.ans[st.i] = k; draw(); }
    if (e.key === 'ArrowRight' && st.i < n - 1) { st.i++; draw(); }
    if (e.key === 'ArrowLeft' && st.i > 0) { st.i--; draw(); }
  };
  addEventListener('keydown', onKey);
  draw();
}

// Halaman hasil simulasi
export function renderSkdResult(app, r, { session }) {
  const s = r.skd;
  const khusus = SKD.khusus.map(k => ({ ...k, ok: s.total >= k.total && s.tiu >= k.tiu }));
  const tkpReview = x => {
    const q = x.q;
    const best = q.scores ? q.scores.indexOf(5) : q.answer;
    return `<div class="review-item">
      <div class="row" style="align-items:flex-start"><span class="skd-pts p${x.pts}">${x.pts}</span><b>${esc(q.question)}</b></div>
      <div class="ans">
        ${x.chosen === null ? '<span style="color:var(--red)">Tidak dijawab (0)</span>' : `<span>Pilihanmu: ${L[x.chosen]}. ${esc(q.options[x.chosen])} <b>(skor ${x.pts})</b></span>`}
        ${x.pts < 5 ? `<span style="color:var(--green)">Skor 5: ${L[best]}. ${esc(q.options[best])}</span>` : ''}
        ${q.scores ? `<span class="dim" style="font-size:12px">Skor tiap pilihan: ${q.options.map((_, k) => `${L[k]}=${q.scores[k]}`).join(' · ')}</span>` : ''}
        ${q.explanation ? `<span class="muted">${esc(q.explanation)}</span>` : ''}
      </div></div>`;
  };
  const pgReview = x => {
    const q = x.q;
    return `<div class="review-item">
      <div class="row" style="align-items:flex-start"><span>${x.ok ? '✅' : '❌'}</span><b>${esc(q.question)}</b></div>
      <div class="ans">
        ${!x.ok ? `<span style="color:var(--red)">Jawabanmu: ${x.chosen === null ? '— (tidak dijawab)' : L[x.chosen] + '. ' + esc(q.options[x.chosen])}</span>` : ''}
        <span style="color:var(--green)">Jawaban benar: ${L[q.answer]}. ${esc(q.options[q.answer])}</span>
        ${q.explanation ? `<span class="muted">${esc(q.explanation)}</span>` : ''}
      </div></div>`;
  };
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="glass result-hero skd-hero ${s.pass ? 'pass' : 'fail'}">
      <div class="row between"><span class="chip">🏛️ Simulasi SKD CAT 2026</span><span class="skd-verdict">${s.pass ? '✅ LOLOS AMBANG BATAS' : '❌ BELUM LOLOS'}</span></div>
      <div class="big-ring">${ring(Math.round((s.total / 550) * 100), 170, 14)}<div class="v"><b id="skdTotal">0</b><span class="dim">dari 550</span></div></div>
      <h1 class="h2" style="font-size:21px">${s.pass ? 'Selamat! Ketiga subtes memenuhi nilai ambang batas kebutuhan umum.' : 'Belum lolos — perhatikan subtes yang masih di bawah ambang batas.'}</h1>
      <p class="muted" style="margin:6px 0 0">${s.answered}/${r.total} soal dijawab · durasi ${mmss(r.durationSec)} dari 100:00</p>
      <p class="dim" id="saveState" style="margin:10px 0 0">${session.loggedIn ? (r.saved === null ? 'Menyimpan hasil…' : r.saved ? '✅ Hasil tersimpan ke evaluasi' : '⚠️ Gagal menyimpan') : '👤 Mode tamu — masuk akun agar hasil tersimpan'}</p>
    </div>
    <div class="grid g3">${SKD.parts.map(p => {
      const v = s[p.key], ok = s.passEach[p.key];
      return `<div class="glass skd-score ${ok ? 'ok' : 'no'}"><div class="row between"><b>${p.name}</b><span>${ok ? '✅' : '❌'}</span></div>
        <div class="skd-val"><b>${v}</b><span class="dim">/ ${p.max}</span></div>
        <div class="skd-bar"><i style="width:${Math.min(100, (v / p.max) * 100)}%"></i><em style="left:${(p.pass / p.max) * 100}%" title="Ambang batas ${p.pass}"></em></div>
        <span class="dim" style="font-size:12px">Ambang batas ${p.pass} · ${ok ? `lebih ${v - p.pass}` : `kurang ${p.pass - v}`}</span></div>`;
    }).join('')}</div>
    <div class="glass card">
      <h2 class="h2" style="margin-bottom:8px">Kebutuhan khusus</h2>
      ${khusus.map(k => `<div class="row between skd-kh"><span>${esc(k.name)}<br><small class="dim">total ≥ ${k.total} & TIU ≥ ${k.tiu}</small></span><b>${k.ok ? '✅ Memenuhi' : '❌ Belum'}</b></div>`).join('')}
      <p class="dim" style="margin:10px 0 0;font-size:12.5px">Acuan: Keputusan Menteri PANRB Nomor 674 Tahun 2026, Lampiran II. Nilai ini hasil simulasi, bukan nilai resmi.</p>
    </div>
    <div class="row wrap">
      <a class="btn" href="#/latihan?sim=skd" style="flex:1">🔁 Simulasi lagi</a>
      <a class="btn ghost" href="#/materi?id=core-twk-skd2026" style="flex:1">📘 Kisi-kisi SKD 2026</a>
      ${session.loggedIn ? '<a class="btn ghost" href="#/evaluasi" style="flex:1">📈 Evaluasi</a>' : ''}
    </div>
    ${SKD.parts.map(p => {
      const list = r.review.filter(x => x.q.section === p.key);
      return `<details class="glass card skd-rev"><summary><h2 class="h2" style="display:inline">Pembahasan ${p.name}</h2> <span class="dim">· ${s[p.key]} poin</span></summary>
        ${list.map(x => (p.key === 'tkp' ? tkpReview(x) : pgReview(x))).join('')}</details>`;
    }).join('')}
  </section>`;
  animateRings(app);
  countUp($('#skdTotal'), s.total, 1300);
  setTimeout(() => sfx(s.pass ? 'win' : 'lose'), 250);
  if (s.pass) setTimeout(() => confetti(140), 400);
}
