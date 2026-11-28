// 🎬 Animasi intro di halaman masuk: memperkenalkan fitur unggulan SiapLolos, mengikuti warna tema aktif
import { $, $$, esc, fmt } from './ui.js';
import { getInfo } from './api.js';

const SLIDES = [
  { ico: '🚀', tag: 'Selamat datang', title: 'Latihan cerdas,<br><span class="grad-text">lolos seleksi impian.</span>', text: 'Satu tempat untuk persiapan CPNS, BUMN, OJK, Bank Indonesia, dan Telkom.', art: 'logo' },
  { ico: '🏛️', tag: 'Simulasi seleksi', title: 'Rasakan ujian aslinya', text: 'Simulasi SKD CAT 2026 (110 soal · 100 menit), PCPM BI, PCAM OJK, dan tes online Telkom — lengkap dengan status lolos ambang batas.', art: 'sim' },
  { ico: '📘', tag: 'Materi interaktif', title: '33 materi inti + update harian', text: 'Misi belajar, kartu hafalan, susun alur, Benar/Salah, dan cocokkan istilah — belajar jadi seru.', art: 'mat' },
  { ico: '⚔️', tag: 'Duel & Arena', title: 'Adu cepat bareng teman', text: 'Duel real-time sampai 8 pemain, arena game dengan nyawa & combo, plus papan peringkat mingguan.', art: 'duel' },
  { ico: '🤖', tag: 'Mentor AI & evaluasi', title: 'Tahu persis di mana lemahmu', text: 'Tanya Mentor AI di setiap materi, esai dikoreksi maksudnya, dan evaluasi harian–bulanan per topik.', art: 'ai' },
  { ico: '💎', tag: 'Mulai gratis', title: 'Daftar gratis, upgrade kapan saja', text: 'Paket Free untuk mulai latihan setiap hari. Plus & Pro untuk latihan tanpa batas dan semua simulasi.', art: 'plans' },
];

const ART = {
  logo: () => `<div class="ia-logo"><span class="brand-gem big"></span><i></i><i></i><i></i></div>`,
  sim: () => `<div class="ia-sim"><div class="ia-ring"><b data-cnt="550">0</b><small>/ 550</small></div>
    <div class="ia-bars">${[['TWK', 78, 65], ['TIU', 86, 80], ['TKP', 92, 74]].map(([n, w, p], i) => `<div><span>${n}</span><em><i style="--w:${w}%;--d:${i * .15}s"></i><u style="left:${p}%"></u></em></div>`).join('')}</div>
    <span class="ia-pass">✅ LOLOS AMBANG BATAS</span></div>`,
  mat: () => `<div class="ia-mat">${['📖 Pahami bagian', '🃏 Kartu hafalan', '🔗 Susun alur', '⚖️ Benar/Salah', '🧩 Cocokkan'].map((t, i) => `<span style="--d:${i * .12}s">✅ ${t.slice(2)}</span>`).join('')}<div class="ia-prog"><i></i></div></div>`,
  duel: () => `<div class="ia-duel">${[['🦊', 'Rani', 920], ['🐯', 'Bima', 860], ['🐼', 'Kamu', 1010]].map(([a, n, s], i) => `<div style="--d:${i * .15}s"><span class="ia-av">${a}</span><b>${n}</b><em data-cnt="${s}">0</em></div>`).join('')}<span class="ia-vs">⚡ COMBO ×3</span></div>`,
  ai: () => `<div class="ia-ai"><div class="ia-msg me">Apa beda BI-Rate dan inflasi inti?</div><div class="ia-msg bot"><span class="ia-typing"><i></i><i></i><i></i></span><span class="ia-ans">BI-Rate adalah suku bunga kebijakan BI, sedangkan inflasi inti…</span></div></div>`,
  plans: () => `<div class="ia-plans">${[['🌱', 'Free', 'Mulai gratis'], ['⭐', 'Plus', 'Tanpa batas'], ['👑', 'Pro', 'Semua fitur']].map(([i, n, d], k) => `<div style="--d:${k * .15}s" class="${k === 1 ? 'hot' : ''}"><span>${i}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div>`,
};

const SEEN = 'sl_intro_seen';
export const introSeen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } };

/** Intro layar penuh. onDone dipanggil saat selesai / dilewati. */
export function renderIntro(onDone) {
  const ov = document.createElement('div');
  ov.className = 'intro-ov';
  ov.innerHTML = `<div class="intro-bg"><i></i><i></i><i></i></div>
    <button class="intro-skip" id="inSkip">Lewati ›</button>
    <div class="intro-stage" id="inStage"></div>
    <div class="intro-foot"><div class="intro-dots">${SLIDES.map((_, i) => `<button data-i="${i}" aria-label="Slide ${i + 1}"><i></i></button>`).join('')}</div>
      <button class="btn" id="inNext">Lanjut ›</button></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('intro-open');
  let i = 0, timer;
  const DUR = 4200;
  const show = k => {
    i = k; clearTimeout(timer);
    const s = SLIDES[i];
    $('#inStage', ov).innerHTML = `<div class="intro-slide" key="${i}">
      <div class="intro-art">${ART[s.art]()}</div>
      <div class="intro-txt"><span class="intro-tag">${s.ico} ${esc(s.tag)}</span><h1>${s.title}</h1><p>${esc(s.text)}</p>
      ${i === 0 ? '<p class="intro-bank" id="inBank"></p>' : ''}</div></div>`;
    $$('.intro-dots button', ov).forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); });
    $('#inNext', ov).textContent = i === SLIDES.length - 1 ? 'Masuk ke SiapLolos →' : 'Lanjut ›';
    // animasi angka
    $$('[data-cnt]', ov).forEach(el => { const to = +el.dataset.cnt, t0 = performance.now(); const step = t => { const p = Math.min(1, (t - t0) / 1100); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1 && document.body.contains(el)) requestAnimationFrame(step); }; requestAnimationFrame(step); });
    if (i === 0) getInfo().then(d => { const el = $('#inBank', ov); if (el && d?.bank?.total) el.innerHTML = `📚 <b>${fmt(d.bank.total)}</b> soal siap dikerjakan`; }).catch(() => {});
    if (i < SLIDES.length - 1) timer = setTimeout(() => show(i + 1), DUR);
  };
  const finish = () => {
    clearTimeout(timer);
    try { localStorage.setItem(SEEN, '1'); } catch {}
    ov.classList.add('out');
    setTimeout(() => { ov.remove(); document.body.classList.remove('intro-open'); onDone?.(); }, 650);
  };
  $('#inSkip', ov).onclick = finish;
  $('#inNext', ov).onclick = () => (i === SLIDES.length - 1 ? finish() : show(i + 1));
  $$('.intro-dots button', ov).forEach(b => (b.onclick = () => show(+b.dataset.i)));
  let x0 = null;
  ov.addEventListener('touchstart', e => (x0 = e.touches[0].clientX), { passive: true });
  ov.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(Math.max(0, Math.min(SLIDES.length - 1, i + (dx < 0 ? 1 : -1)))); x0 = null; });
  show(0);
}

/** Panel fitur berputar di sisi kiri halaman masuk (versi ringkas intro). */
export function introCarousel(el) {
  if (!el) return;
  let i = 1;
  const draw = () => {
    const s = SLIDES[i];
    el.innerHTML = `<div class="ic-slide fade-in"><div class="intro-art sm">${ART[s.art]()}</div><div><span class="intro-tag">${s.ico} ${esc(s.tag)}</span><b>${s.title.replace(/<br>/g, ' ')}</b><p class="dim">${esc(s.text)}</p></div></div>
      <div class="intro-dots sm">${SLIDES.slice(1).map((_, k) => `<i class="${k + 1 === i ? 'on' : ''}"></i>`).join('')}</div>`;
    $$('[data-cnt]', el).forEach(n => (n.textContent = fmt(+n.dataset.cnt)));
  };
  draw();
  const t = setInterval(() => { if (!document.body.contains(el)) return clearInterval(t); i = i >= SLIDES.length - 1 ? 1 : i + 1; draw(); }, 5000);
}
