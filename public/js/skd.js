// 🎯 Simulasi seleksi: SKD CPNS 2026, PCPM Bank Indonesia, PCAM OJK, dan Tes Online Telkom (pola RBB)
//
// • SKD CPNS 2026 — Kepmen PANRB Nomor 674 Tahun 2026: 110 soal (TWK 30 · TIU 35 · TKP 45), 100 menit,
//   TWK/TIU benar 5 salah/kosong 0, TKP tiap pilihan 1–5, maks 550, ambang batas umum 65 / 80 / 166.
// • Telkom — tes online pola Rekrutmen Bersama BUMN (FHCI): ambang batas TKD 58, AKHLAK 65, TWK 50 (skala 0–100).
// • BI & OJK — tahapan resmi diikuti, tetapi BI/OJK TIDAK mengumumkan passing grade (seleksi berbasis peringkat,
//   keputusan panitia final). Karena itu angka lolos di simulasi ini adalah TARGET LATIHAN, bukan ketentuan resmi.
import { api } from './api.js';
import { $, $$, esc, toast, sheet, icons, mmss, vibrate, ring, animateRings, countUp, confetti } from './ui.js';
import { sfx } from './sound.js';

const L = ['A', 'B', 'C', 'D', 'E'];

export const EXAMS = {
  skd: {
    key: 'skd', mode: 'skd', ico: '🏛️', grad: 'linear-gradient(135deg,#ef4444,#38bdf8)',
    tag: 'CPNS 2026 · KEPMEN PANRB 674/2026', name: 'Simulasi SKD CAT 2026', short: 'CPNS (SKD)',
    minutes: 100, scoring: 'cat', max: 550, official: true,
    parts: [
      { key: 'twk', name: 'TWK', full: 'Tes Wawasan Kebangsaan', n: 30, max: 150, pass: 65 },
      { key: 'tiu', name: 'TIU', full: 'Tes Intelegensia Umum', n: 35, max: 175, pass: 80 },
      { key: 'tkp', name: 'TKP', full: 'Tes Karakteristik Pribadi', n: 45, max: 225, pass: 166, tkp: true },
    ],
    khusus: [
      { name: 'Cum laude & diaspora', total: 311, tiu: 85 },
      { name: 'Penyandang disabilitas & putra/putri Papua', total: 286, tiu: 60 },
    ],
    rules: [
      '⏱️ Waktu <b>100 menit</b> untuk 110 soal. Bebas berpindah soal dan subtes.',
      '✅ TWK & TIU: benar <b>5</b>, salah atau kosong <b>0</b> — tidak ada pengurangan, jadi isi semua.',
      '🧭 TKP: setiap pilihan bernilai <b>1–5</b>, tidak menjawab bernilai 0.',
      '🎯 Lolos jika <b>ketiga</b> subtes memenuhi ambang batas, bukan hanya total.',
    ],
    basis: 'Keputusan Menteri PANRB Nomor 674 Tahun 2026, Lampiran II (nilai ambang batas resmi).',
    material: 'core-twk-skd2026',
  },
  bi: {
    key: 'bi', mode: 'sim', ico: '💱', grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
    tag: 'BANK INDONESIA · POLA PCPM', name: 'Simulasi Seleksi PCPM BI', short: 'Bank Indonesia',
    minutes: 90, scoring: 'pct', official: false,
    parts: [
      { key: 'tpd', name: 'Potensi Dasar', full: 'Seleksi Potensi Dasar (verbal, numerik, logika)', n: 30, pass: 70 },
      { key: 'bank', name: 'Kebanksentralan', full: 'Pengetahuan Teknis: kebanksentralan, moneter, sistem pembayaran', n: 25, pass: 70 },
      { key: 'umum', name: 'Pengetahuan Umum', full: 'Pengetahuan Teknis: pengetahuan umum & ekonomi', n: 15, pass: 70 },
      { key: 'eng', name: 'B. Inggris', full: 'Pengetahuan Teknis: Bahasa Inggris', n: 20, pass: 70 },
    ],
    rules: [
      '🧭 Mengikuti urutan tahapan PCPM: <b>Seleksi Potensi Dasar</b> lalu <b>Seleksi Pengetahuan Teknis</b> (pengetahuan umum, kebanksentralan, bahasa Inggris).',
      '⏱️ 90 soal dalam <b>90 menit</b> (durasi simulasi).',
      '🎯 Target lolos simulasi: <b>≥ 70</b> di setiap bagian.',
      '⚠️ BI <b>tidak mengumumkan passing grade</b>. Setiap tahap bersifat gugur berdasarkan peringkat dan keputusan panitia final, jadi target ini hanya patokan latihan.',
    ],
    basis: 'Tahapan seleksi PCPM BI Angkatan 41 (2026): administrasi → potensi dasar → pengetahuan teknis → psikologi → kesehatan & psikiatri → wawancara → tahap akhir. Passing grade tidak dipublikasikan; target 70 adalah patokan latihan SiapLolos.',
    stages: ['Administrasi', 'Potensi Dasar', 'Pengetahuan Teknis', 'Psikologi', 'Kesehatan & Psikiatri', 'Wawancara Pra Tahap Akhir', 'Tahap Akhir'],
    material: 'core-bi',
  },
  ojk: {
    key: 'ojk', mode: 'sim', ico: '🏛️', grad: 'linear-gradient(135deg,#f59e0b,#ef4444)',
    tag: 'OJK · POLA PCAM (d/h PCS)', name: 'Simulasi Seleksi PCAM OJK', short: 'OJK',
    minutes: 85, scoring: 'pct', official: false,
    parts: [
      { key: 'tpd', name: 'Potensi Dasar', full: 'Tes Potensi Dasar (verbal, numerik, logika)', n: 30, pass: 70 },
      { key: 'sjk', name: 'Jasa Keuangan', full: 'Tes Kemampuan Umum: OJK, perbankan & sektor jasa keuangan', n: 30, pass: 70 },
      { key: 'eng', name: 'B. Inggris', full: 'Tes Kemampuan Umum: Bahasa Inggris', n: 15, pass: 70 },
      { key: 'isu', name: 'Isu Terkini', full: 'Tes Kemampuan Umum: wawasan & isu terkini', n: 10, pass: 70 },
    ],
    rules: [
      '🧭 Mengikuti tahapan rekrutmen OJK: <b>Tes Potensi Dasar</b> lalu <b>Tes Kemampuan Umum</b>, sebelum tes kepribadian, wawancara psikolog, kesehatan, dan wawancara panel.',
      '⏱️ 85 soal dalam <b>85 menit</b> (durasi simulasi).',
      '🎯 Target lolos simulasi: <b>≥ 70</b> di setiap bagian.',
      '⚠️ OJK <b>tidak mengumumkan passing grade</b>. Kandidat terbaik dipilih bertahap, jadi target ini hanya patokan latihan.',
    ],
    basis: 'Pola tahapan rekrutmen PCS/PCAM OJK: administrasi → Tes Potensi Dasar → Tes Kemampuan Umum → kepribadian & wawancara psikolog → kesehatan → wawancara panel → penetapan. Passing grade tidak dipublikasikan; target 70 adalah patokan latihan SiapLolos.',
    stages: ['Administrasi', 'Tes Potensi Dasar', 'Tes Kemampuan Umum', 'Kepribadian & Wawancara Psikolog', 'Kesehatan', 'Wawancara Panel'],
    material: 'core-ojk',
  },
  telkom: {
    key: 'telkom', mode: 'sim', ico: '📡', grad: 'linear-gradient(135deg,#ef4444,#f472b6)',
    tag: 'TELKOM · POLA REKRUTMEN BERSAMA BUMN', name: 'Simulasi Tes Online Telkom', short: 'Telkom',
    minutes: 75, scoring: 'pct', official: 'partial',
    parts: [
      { key: 'tkd', name: 'TKD', full: 'Tes Kemampuan Dasar (verbal, numerik, figural)', n: 40, pass: 58, src: 'RBB' },
      { key: 'akhlak', name: 'AKHLAK', full: 'Tes Core Values BUMN AKHLAK', n: 30, pass: 65, src: 'RBB' },
      { key: 'twk', name: 'TWK', full: 'Tes Wawasan Kebangsaan', n: 10, pass: 50, src: 'RBB' },
      { key: 'bidang', name: 'Bidang Digital', full: 'Pengetahuan bidang: telekomunikasi, IT & digital', n: 20, pass: 60 },
      { key: 'eng', name: 'B. Inggris', full: 'English test', n: 10, pass: 60 },
    ],
    rules: [
      '🧭 Materi tes online Telkom: kemampuan dasar, bahasa Inggris, BUMN value (AKHLAK), wawasan kebangsaan, dan pengetahuan bidang.',
      '⏱️ 110 soal dalam <b>75 menit</b> (durasi simulasi).',
      '🎯 Ambang batas TKD <b>58</b>, AKHLAK <b>65</b>, TWK <b>50</b> mengikuti ketentuan Rekrutmen Bersama BUMN (FHCI). Bidang & bahasa Inggris: target latihan <b>60</b>.',
      '⚠️ Lolos ambang batas belum menjamin lanjut: peserta tetap diperingkat dan dipilih sesuai kebutuhan perusahaan.',
    ],
    basis: 'Ambang batas TKD 58 · AKHLAK 65 · TWK 50 mengacu ketentuan Rekrutmen Bersama BUMN (FHCI) 2024–2025, jalur yang juga dipakai Telkom. Bagian bidang & bahasa Inggris memakai target latihan SiapLolos.',
    stages: ['Administrasi', 'Tes Online', 'Tes Bidang / Assessment', 'Wawancara', 'MCU'],
    material: 'core-telkom',
  },
};
const examOf = key => EXAMS[key] || EXAMS.skd;
const partsOf = ex => ex.parts;

// Kartu simulasi di halaman Latihan (grid ringkas)
export function simBanner() {
  return `<div class="sim-head"><b>🎯 Simulasi seleksi</b><span class="dim">ujian lengkap + status lolos / belum</span></div>
  <div class="sim-grid">${Object.values(EXAMS).map(ex => `
    <button type="button" class="glass sim-card tilt" data-sim="${ex.key}">
      <span class="sim-ico" style="background:${ex.grad}">${ex.ico}</span>
      <span class="sim-txt"><b>${esc(ex.short)}</b><small>${ex.parts.reduce((s, p) => s + p.n, 0)} soal · ${ex.minutes} mnt</small></span>
      ${ex.official === true ? '<span class="sim-tag ok">Resmi</span>' : ex.official === 'partial' ? '<span class="sim-tag">Pola RBB</span>' : '<span class="sim-tag">Target</span>'}
    </button>`).join('')}</div>`;
}

// Lembar aturan sebelum mulai
export function openSimIntro(key, { seenKeys, rememberSeen, practice }) {
  const ex = examOf(key);
  const total = ex.parts.reduce((s, p) => s + p.n, 0);
  sheet(`
    <div class="row" style="gap:12px;align-items:center"><span class="skd-ico" style="width:46px;height:46px;font-size:22px;background:${ex.grad}">${ex.ico}</span>
      <div><h3 class="h2" style="margin:0">${esc(ex.name)}</h3><span class="dim">${esc(ex.tag)}</span></div></div>
    <div class="skd-rules" style="grid-template-columns:repeat(${Math.min(ex.parts.length, 3)},minmax(0,1fr))">
      ${ex.parts.map(p => `<div class="skd-rule"><b>${esc(p.name)}</b><span>${p.n} soal</span><span class="dim">${ex.scoring === 'cat' ? `maks ${p.max} · ` : ''}${ex.official === true || p.src ? 'lolos' : 'target'} ≥ ${p.pass}</span></div>`).join('')}
    </div>
    ${ex.stages ? `<div class="sim-stages">${ex.stages.map((s, i) => `<span class="${i === 1 || (ex.key !== 'telkom' && i === 2) ? 'on' : ''}">${esc(s)}</span>`).join('<i>›</i>')}</div>` : ''}
    <ul class="skd-list">${ex.rules.map(r => `<li>${r}</li>`).join('')}<li>📖 Pembahasan muncul setelah selesai.</li></ul>
    <button class="btn block" id="simGo">Mulai simulasi (${total} soal) ▶</button>`,
  (el, close) => {
    $('#simGo', el).onclick = async () => {
      const b = $('#simGo', el); b.disabled = true; b.innerHTML = `<span class="spinner"></span> Menyiapkan ${total} soal…`;
      try {
        const d = await api(`/questions?sim=${ex.key}&seen=` + encodeURIComponent(seenKeys().slice(-300).join(',')));
        if ((d.questions || []).length < total * 0.9) throw new Error('Bank soal belum cukup. Coba lagi nanti.');
        rememberSeen(d.questions);
        Object.assign(practice, { config: { mode: ex.mode, exam: ex.key, category: ex.key === 'skd' ? 'campuran' : ex.key, difficulty: 'all', count: d.questions.length }, questions: d.questions, result: null, active: true });
        close();
        window.dispatchEvent(new Event('bg:burst'));
        location.hash = '#/quiz';
      } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Mulai simulasi ▶'; }
    };
  });
}

// Skor satu soal
function pointOf(ex, q, chosen) {
  if (chosen === null || chosen === undefined) return 0;
  if (ex.scoring === 'cat' && q.section === 'tkp' && Array.isArray(q.scores)) return q.scores[chosen] || 0;
  return chosen === q.answer ? (ex.scoring === 'cat' ? 5 : 1) : 0;
}

export function runSim(app, practice, { complete, confirmExit }) {
  const ex = examOf(practice.config.exam || 'skd');
  const parts = partsOf(ex);
  const qs = practice.questions, n = qs.length;
  const st = { i: 0, ans: Array(n).fill(null), flag: new Set(), start: Date.now() };
  const limit = ex.minutes * 60;
  const firstOf = key => qs.findIndex(q => q.section === key);
  const partOf = key => parts.find(p => p.key === key) || parts[0];

  app.innerHTML = `
  <div class="quiz-top">
    <button class="icon-btn" id="exitBtn" aria-label="Keluar">${icons.x}</button>
    <div class="progress"><i id="prog"></i></div>
    <div class="timer" id="timer">${mmss(limit)}</div>
    <button class="icon-btn" id="gridBtn" aria-label="Daftar soal">${icons.grid}</button>
  </div>
  <div class="skd-tabs" style="grid-template-columns:repeat(${parts.length},minmax(0,1fr))">${parts.map(p => `<button data-sec="${p.key}"><b>${esc(p.name)}</b><span data-cnt="${p.key}"></span></button>`).join('')}</div>
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
    if (left <= 0) { clearInterval(tick); toast(`⏰ Waktu ${ex.minutes} menit habis! Jawaban dikumpulkan.`); finish(); }
  }, 1000);

  function counts() {
    parts.forEach(p => {
      const idx = qs.map((q, k) => (q.section === p.key ? k : -1)).filter(k => k >= 0);
      const el = $(`[data-cnt="${p.key}"]`); if (el) el.textContent = `${idx.filter(k => st.ans[k] !== null).length}/${idx.length}`;
    });
    $$('[data-sec]', app).forEach(b => b.classList.toggle('on', b.dataset.sec === qs[st.i].section));
  }
  function draw() {
    const q = qs[st.i], p = partOf(q.section);
    const no = st.i - firstOf(q.section) + 1, of = qs.filter(x => x.section === q.section).length;
    $('#prog').style.width = `${(st.ans.filter(a => a !== null).length / n) * 100}%`;
    counts();
    $('#qWrap').innerHTML = `
      <div class="glass q-card fade-in">
        <div class="q-meta"><span class="chip skd-chip s${parts.indexOf(p)}">${esc(p.name)} · ${no}/${of}</span><span class="chip">Soal ${st.i + 1}/${n}</span>
          <span class="dim q-full">${esc(p.full)}</span></div>
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
      ${parts.map(p => `<div class="skd-grid-h"><b>${esc(p.name)}</b><span class="dim">${esc(p.full)}</span></div>
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
      const pts = pointOf(ex, q, st.ans[k]);
      const ok = ex.scoring === 'cat' ? pts === 5 : pts === 1;
      return { q, chosen: st.ans[k], pts, ok };
    });
    const sec = {};
    parts.forEach(p => {
      const list = review.filter(r => r.q.section === p.key);
      const raw = list.reduce((s, r) => s + r.pts, 0);
      sec[p.key] = ex.scoring === 'cat' ? raw : Math.round((raw / Math.max(1, list.length)) * 100);
    });
    const passEach = Object.fromEntries(parts.map(p => [p.key, sec[p.key] >= p.pass]));
    const pass = Object.values(passEach).every(Boolean);
    const total = ex.scoring === 'cat' ? parts.reduce((s, p) => s + sec[p.key], 0)
      : Math.round(parts.reduce((s, p) => s + sec[p.key] * p.n, 0) / parts.reduce((s, p) => s + p.n, 0));
    complete({
      total: n, correct: review.filter(r => r.ok).length,
      score: ex.scoring === 'cat' ? Math.round((total / ex.max) * 100) : total,
      points: ex.scoring === 'cat' ? total * 2 : review.filter(r => r.ok).length * 10,
      durationSec: (Date.now() - st.start) / 1000, review,
      sim: { exam: ex.key, sec, total, pass, passEach, answered: st.ans.filter(a => a !== null).length },
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
export function renderSimResult(app, r, { session }) {
  const s = r.sim, ex = examOf(s.exam), parts = partsOf(ex);
  const cat = ex.scoring === 'cat';
  const khusus = (ex.khusus || []).map(k => ({ ...k, ok: s.total >= k.total && (s.sec.tiu || 0) >= k.tiu }));
  const passWord = p => (ex.official === true || p.src ? 'Ambang batas' : 'Target');
  const tkpReview = x => {
    const q = x.q, best = q.scores ? q.scores.indexOf(5) : q.answer;
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
  const verdict = s.pass ? (ex.official === true ? '✅ LOLOS AMBANG BATAS' : '✅ LOLOS TARGET SIMULASI') : '❌ BELUM LOLOS';
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="glass result-hero skd-hero ${s.pass ? 'pass' : 'fail'}">
      <div class="row between wrap" style="gap:8px"><span class="chip">${ex.ico} ${esc(ex.name)}</span><span class="skd-verdict">${verdict}</span></div>
      <div class="big-ring">${ring(cat ? Math.round((s.total / ex.max) * 100) : s.total, 170, 14)}<div class="v"><b id="simTotal">0</b><span class="dim">${cat ? `dari ${ex.max}` : 'nilai rata-rata'}</span></div></div>
      <h1 class="h2" style="font-size:21px">${s.pass ? (ex.official === true ? 'Selamat! Semua subtes memenuhi nilai ambang batas.' : 'Mantap! Semua bagian memenuhi target simulasi.') : 'Belum lolos — fokuskan latihan pada bagian yang masih di bawah batas.'}</h1>
      <p class="muted" style="margin:6px 0 0">${s.answered}/${r.total} soal dijawab · durasi ${mmss(r.durationSec)} dari ${ex.minutes}:00</p>
      <p class="dim" id="saveState" style="margin:10px 0 0">${session.loggedIn ? (r.saved === null ? 'Menyimpan hasil…' : r.saved ? '✅ Hasil tersimpan ke evaluasi' : '⚠️ Gagal menyimpan') : '👤 Mode tamu — masuk akun agar hasil tersimpan'}</p>
    </div>
    <div class="sim-scores">${parts.map(p => {
      const v = s.sec[p.key], ok = s.passEach[p.key], max = cat ? p.max : 100;
      return `<div class="glass skd-score ${ok ? 'ok' : 'no'}"><div class="row between"><b>${esc(p.name)}</b><span>${ok ? '✅' : '❌'}</span></div>
        <div class="skd-val"><b>${v}</b><span class="dim">/ ${max}</span></div>
        <div class="skd-bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i><em style="left:${(p.pass / max) * 100}%" title="${passWord(p)} ${p.pass}"></em></div>
        <span class="dim" style="font-size:12px">${passWord(p)} ${p.pass} · ${ok ? `lebih ${v - p.pass}` : `kurang ${p.pass - v}`}</span></div>`;
    }).join('')}</div>
    ${khusus.length ? `<div class="glass card">
      <h2 class="h2" style="margin-bottom:8px">Kebutuhan khusus</h2>
      ${khusus.map(k => `<div class="row between skd-kh"><span>${esc(k.name)}<br><small class="dim">total ≥ ${k.total} & TIU ≥ ${k.tiu}</small></span><b>${k.ok ? '✅ Memenuhi' : '❌ Belum'}</b></div>`).join('')}
    </div>` : ''}
    ${ex.stages ? `<div class="glass card"><h2 class="h2" style="margin-bottom:10px">Tahapan seleksi</h2>
      <div class="sim-stages big">${ex.stages.map((st, i) => `<span class="${i === 0 || (i === 1) || (ex.key !== 'telkom' && i === 2) ? 'on' : ''}">${esc(st)}</span>`).join('<i>›</i>')}</div>
      <p class="dim" style="margin:10px 0 0;font-size:12.5px">Yang disorot adalah tahap yang disimulasikan di sini. Tahap psikologi bisa dilatih di menu Tes Psikologi.</p></div>` : ''}
    <p class="dim sim-basis">ℹ️ ${esc(ex.basis)} Nilai ini hasil simulasi, bukan nilai resmi.</p>
    <div class="row wrap">
      <a class="btn" href="#/latihan?sim=${ex.key}" style="flex:1">🔁 Simulasi lagi</a>
      <a class="btn ghost" href="#/materi?id=${ex.material}" style="flex:1">📘 Pelajari materinya</a>
      ${session.loggedIn ? '<a class="btn ghost" href="#/evaluasi" style="flex:1">📈 Evaluasi</a>' : ''}
    </div>
    ${parts.map(p => {
      const list = r.review.filter(x => x.q.section === p.key);
      return `<details class="glass card skd-rev"><summary><h2 class="h2" style="display:inline">Pembahasan ${esc(p.name)}</h2> <span class="dim">· ${s.sec[p.key]}${cat ? ' poin' : '/100'}</span></summary>
        ${list.map(x => (p.tkp ? tkpReview(x) : pgReview(x))).join('')}</details>`;
    }).join('')}
  </section>`;
  animateRings(app);
  countUp($('#simTotal'), s.total, 1300);
  setTimeout(() => sfx(s.pass ? 'win' : 'lose'), 250);
  if (s.pass) setTimeout(() => confetti(140), 400);
}
