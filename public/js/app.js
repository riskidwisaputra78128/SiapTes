import { api, session, getInfo } from './api.js';
import { $, $$, esc, toast, bindTilt, icons, fmt, timeAgo, countUp, avatar, sheet } from './ui.js';
import { CATEGORIES, TARGETS, catByKey } from './data.js';
import { initBackground } from './three-bg.js';
import { renderSetup, renderQuiz, renderResult, practice } from './practice.js';
import { renderStats, renderLeaderboard } from './stats.js';
import { renderTech } from './tech.js';
import { renderMateri, getMaterials } from './materi.js';
import { renderDuel } from './duel.js';
import { renderAdminLive } from './admin-live.js';
import { startPresence, onlineWidget, isHidden, setHidden, presence, refreshPresence } from './presence.js';
import { applyTheme, currentTheme, openThemePicker, THEMES } from './theme.js';
import { mountDock, setDockVisible } from './dock.js';

const app = $('#app');
const NAV = [
  { href: '#/', key: '', label: 'Beranda', ico: icons.home },
  { href: '#/latihan', key: 'latihan', label: 'Latihan', ico: icons.play },
  { href: '#/materi', key: 'materi', label: 'Materi', ico: icons.book },
  { href: '#/duel', key: 'duel', label: 'Duel', ico: icons.swords },
  { href: '#/kantor', key: 'kantor', label: 'Kantor', ico: icons.building, desktopOnly: true },
  { href: '#/evaluasi', key: 'evaluasi', label: 'Evaluasi', ico: icons.chart },
  { href: '#/peringkat', key: 'peringkat', label: 'Peringkat', ico: icons.trophy, desktopOnly: true },
  { href: '#/teknologi', key: 'teknologi', label: 'Teknologi', ico: icons.chip, desktopOnly: true },
  { href: '#/profil', key: 'profil', label: 'Profil', ico: icons.user },
];

function chrome(show, active) {
  $('#topbar').hidden = !show;
  $('#bottomnav').hidden = !show;
  if (!show) return;
  const links = NAV.filter(n => !n.desktopOnly).map(n => `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">${n.ico}<span>${n.label}</span></a>`).join('');
  $('#bottomnav').innerHTML = links;
  $('#topnav').innerHTML = NAV.map(n => `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">${n.label}</a>`).join('');
  const u = session.user;
  paintAvatarBtn();
}
function paintAvatarBtn() {
  const u = session.user, b = $('#avatarBtn');
  if (!b) return;
  b.classList.toggle('has-photo', !!u?.avatar);
  b.innerHTML = u?.avatar ? `<img src="${esc(u.avatar)}" alt="Profil" onerror="this.parentNode.classList.remove('has-photo');this.replaceWith(document.createTextNode('${esc((u.name || '?').trim()[0].toUpperCase())}'))">`
    : esc(u ? (u.name || '?').trim()[0].toUpperCase() : '👤');
}

async function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(qs || '');
  const authed = session.loggedIn || session.guest;
  if (!authed && path !== 'login' && path !== 'teknologi') { location.hash = '#/login'; return; }
  if (session.loggedIn && path === 'login') { location.hash = '#/'; return; }
  window.scrollTo(0, 0);
  const inQuiz = path === 'quiz';
  setDockVisible(path !== 'login' && !inQuiz);
  chrome(path !== 'login' && !inQuiz && (authed || path !== 'teknologi'), path);
  app.innerHTML = '';
  try {
    switch (path) {
      case 'login': renderAuth(); break;
      case 'latihan': renderSetup(app, params); break;
      case 'quiz': renderQuiz(app); break;
      case 'hasil': renderResult(app); break;
      case 'evaluasi': await renderStats(app); break;
      case 'peringkat': await renderLeaderboard(app); break;
      case 'profil': renderProfile(); break;
      case 'teknologi': renderTech(app); break;
      case 'materi': await renderMateri(app, params); break;
      case 'duel': await renderDuel(app, params); break;
      case 'command': case 'kantor': await renderAdminLive(app); break;
      default: await renderHome();
    }
  } catch (e) {
    app.innerHTML = `<div class="glass card empty fade-in"><p>⚠️ ${esc(e.message)}</p><button class="btn sm" onclick="location.reload()">Muat ulang</button></div>`;
  }
  bindTilt(app);
  app.focus({ preventScroll: true });
}

/* ───────── Auth ───────── */
function renderAuth() {
  let mode = 'login';
  app.innerHTML = `
  <section class="auth">
    <div class="fade-in">
      <div class="row" style="gap:10px;margin-bottom:6px"><span class="brand-gem"></span><b style="font-size:20px">Siap<span class="grad-text">Lolos</span></b></div>
      <span class="hero-tag">⚡ Soal diperbarui otomatis dari berita terkini</span>
      <h1 class="hero-title">Latihan cerdas,<br><span class="grad-text">lolos seleksi impian.</span></h1>
      <p class="muted" style="max-width:520px">Satu tempat untuk persiapan tes OJK, Bank Indonesia, Telkom, CPNS, BUMN, dan TKD. Pilih gaya belajarmu: ujian klasik, arena game, atau esai yang dikoreksi.</p>
      <div class="exam-badges"><span>CPNS SKD</span><span>BUMN</span><span>OJK</span><span>Bank Indonesia</span><span>Telkom</span><span>TKD</span></div>
      <div class="bank-pill" id="bankPill" hidden></div>
      <div class="feature-list">
        <div><i>📝</i><span><b style="color:var(--text)">3 mode latihan</b> — Pilihan Ganda, Arena Game, dan Esai dengan koreksi maksud jawaban.</span></div>
        <div><i>📈</i><span><b style="color:var(--text)">Evaluasi harian, mingguan, bulanan</b> lengkap dengan rekomendasi belajar.</span></div>
        <div><i>🔥</i><span><b style="color:var(--text)">4 level</b> — Easy, Normal, Hard, Prof.</span></div>
      </div>
    </div>
    <div class="glass auth-card tilt fade-in" style="animation-delay:.1s">
      <div class="tabs" role="tablist"><button data-m="login" class="on">Masuk</button><button data-m="register">Daftar</button></div>
      <form id="authForm" novalidate>
        <div class="field reg" hidden><label for="fName">Nama lengkap</label><input id="fName" class="input" autocomplete="name" placeholder="Nama kamu"></div>
        <div class="field"><label for="fEmail">Email</label><input id="fEmail" class="input" type="email" autocomplete="email" inputmode="email" placeholder="nama@email.com" required></div>
        <div class="field"><div class="row between"><label for="fPass">Kata sandi</label><button type="button" class="link-btn dim log" id="forgotBtn" style="font-size:13px">Lupa kata sandi?</button></div>
          ${pwInput('fPass', 'Minimal 6 karakter', 'current-password')}</div>
        <div class="field reg" hidden><label for="fTarget">Target tes</label>
          <select id="fTarget" class="input">${TARGETS.map(t => `<option>${t}</option>`).join('')}</select></div>
        <button class="btn block" id="authBtn" type="submit">Masuk</button>
        <p class="dim" style="text-align:center;margin:0">Belum mau daftar? <button type="button" class="link-btn" id="guestBtn">Coba sebagai tamu</button><br><small>(progres tamu tidak tersimpan)</small><br><a href="#/teknologi" class="link-btn" style="font-size:13px">⚙️ Teknologi di balik SiapLolos</a> · <button type="button" class="link-btn" id="authTheme" style="font-size:13px">🎨 Ganti tema</button></p>
      </form>
    </div>
  </section>`;
  const setMode = m => {
    mode = m;
    $$('.tabs button', app).forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $$('.reg', app).forEach(el => (el.hidden = m !== 'register'));
    $$('.log', app).forEach(el => (el.hidden = m !== 'login'));
    $('#authBtn').textContent = m === 'login' ? 'Masuk' : 'Buat Akun';
    $('#fPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  };
  $$('.tabs button', app).forEach(b => (b.onclick = () => setMode(b.dataset.m)));
  $('#guestBtn').onclick = () => { session.setGuest(); location.hash = '#/'; };
  $('#authTheme').onclick = openThemePicker;
  $('#forgotBtn').onclick = () => renderForgot($('.auth-card'), $('#fEmail').value);
  bindPwToggles(app);
  getInfo().then(d => {
    const el = $('#bankPill'); if (!el || !d.bank) return;
    el.hidden = false;
    el.innerHTML = `📚 <b>${fmt(d.bank.total)}</b> soal tersedia${d.bank.today ? ` · ✨ <b>${fmt(d.bank.today)}</b> baru hari ini` : ''}`;
  }).catch(() => {});
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#authBtn'); btn.disabled = true; const label = btn.textContent; btn.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await api('/auth', {
        method: 'POST',
        body: { action: mode, name: $('#fName').value, email: $('#fEmail').value, password: $('#fPass').value, target: $('#fTarget').value },
      });
      session.set(data.token, data.user);
      toast(mode === 'login' ? `Selamat datang kembali, ${data.user.name}!` : 'Akun berhasil dibuat 🎉', 'ok');
      window.dispatchEvent(new Event('bg:burst'));
      location.hash = '#/';
    } catch (err) {
      toast(err.message, 'err');
    } finally { btn.disabled = false; btn.textContent = label; }
  };
}

/* ───────── Input kata sandi dengan tombol lihat/sembunyikan ───────── */
function pwInput(id, placeholder, ac) {
  return `<div class="pw-wrap"><input id="${id}" class="input" type="password" autocomplete="${ac}" placeholder="${placeholder}" required>
    <button type="button" class="pw-eye" data-for="${id}" aria-label="Tampilkan kata sandi">👁️</button></div>`;
}
function bindPwToggles(root) {
  $$('.pw-eye', root).forEach(b => (b.onclick = () => {
    const inp = $('#' + b.dataset.for); const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.textContent = show ? '🙈' : '👁️';
    b.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  }));
}

/* ───────── Lupa kata sandi ───────── */
function renderForgot(card, prefill = '') {
  let email = prefill;
  const back = () => renderAuth();
  const step1 = () => {
    card.innerHTML = `
      <button class="link-btn" id="backBtn" style="font-size:13px">← Kembali ke Masuk</button>
      <h2 class="h2" style="margin-top:12px">Lupa kata sandi?</h2>
      <p class="muted" style="margin:6px 0 0">Masukkan email akunmu. Kami akan mengirim kode 6 digit untuk membuat kata sandi baru.</p>
      <form id="fgForm" novalidate>
        <div class="field"><label for="fgEmail">Email</label><input id="fgEmail" class="input" type="email" inputmode="email" autocomplete="email" value="${esc(email)}" placeholder="nama@email.com"></div>
        <button class="btn block" id="fgBtn" type="submit">Kirim kode</button>
      </form>`;
    $('#backBtn').onclick = back;
    $('#fgForm').onsubmit = async e => {
      e.preventDefault();
      email = $('#fgEmail').value.trim();
      const btn = $('#fgBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const r = await api('/auth', { method: 'POST', body: { action: 'forgot', email } });
        toast(r.message, 'ok');
        step2(r.devCode);
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Kirim kode'; }
    };
  };
  const step2 = devCode => {
    card.innerHTML = `
      <button class="link-btn" id="backBtn" style="font-size:13px">← Kembali ke Masuk</button>
      <h2 class="h2" style="margin-top:12px">Buat kata sandi baru</h2>
      <p class="muted" style="margin:6px 0 0">Kode dikirim ke <b style="color:var(--text)">${esc(email)}</b>. Berlaku 15 menit — cek juga folder Spam.</p>
      ${devCode ? `<p class="dim">Mode dev: kode = <b>${devCode}</b></p>` : ''}
      <form id="rsForm" novalidate>
        <div class="field"><label for="rsCode">Kode 6 digit</label>
          <input id="rsCode" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" style="letter-spacing:10px;font-family:var(--num);font-size:22px;text-align:center"></div>
        <div class="field"><label for="rsPass">Kata sandi baru</label>${pwInput('rsPass', 'Minimal 6 karakter', 'new-password')}</div>
        <div class="field"><label for="rsPass2">Ulangi kata sandi baru</label>${pwInput('rsPass2', 'Ketik ulang', 'new-password')}</div>
        <button class="btn block" id="rsBtn" type="submit">Simpan & Masuk</button>
        <p class="dim" style="text-align:center;margin:0">Tidak menerima kode? <button type="button" class="link-btn" id="resendBtn">Kirim ulang</button></p>
      </form>`;
    bindPwToggles(card);
    $('#backBtn').onclick = back;
    $('#resendBtn').onclick = step1;
    $('#rsCode').oninput = e => (e.target.value = e.target.value.replace(/\D/g, ''));
    $('#rsForm').onsubmit = async e => {
      e.preventDefault();
      const code = $('#rsCode').value, p1 = $('#rsPass').value, p2 = $('#rsPass2').value;
      if (code.length !== 6) return toast('Kode harus 6 digit', 'err');
      if (p1.length < 6) return toast('Kata sandi minimal 6 karakter', 'err');
      if (p1 !== p2) return toast('Kedua kata sandi tidak sama', 'err');
      const btn = $('#rsBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const data = await api('/auth', { method: 'POST', body: { action: 'reset', email, code, password: p1 } });
        session.set(data.token, data.user);
        toast('Kata sandi berhasil diganti. Selamat datang kembali!', 'ok');
        location.hash = '#/';
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Simpan & Masuk'; }
    };
  };
  step1();
}

/* ───────── Jumlah bank soal (publik) ───────── */
function renderBank(bank) {
  const el = $('#bankCard'); if (!el || !bank) return;
  el.innerHTML = `
    <div class="bank-row">
      <div class="bank-big"><span class="bank-ico">📚</span><div><div class="bank-num" id="bankNum">0</div><div class="dim">soal tersedia untuk semua pengguna</div></div></div>
      <div class="bank-stats">
        <div><b>${fmt(bank.seed)}</b><span class="dim">bank inti</span></div>
        <div><b class="grad-text">${fmt(bank.generated)}</b><span class="dim">dari berita</span></div>
        <div><b style="color:var(--green)">+${fmt(bank.today)}</b><span class="dim">baru hari ini</span></div>
      </div>
    </div>`;
  countUp($('#bankNum'), bank.total, 1000);
  $$('[data-count]').forEach(c => { const n = bank.byCategory?.[c.dataset.count]; if (n != null) c.textContent = `${fmt(n)} soal`; });
}

/* ───────── Beranda ───────── */
async function renderHome() {
  const u = session.user;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
  app.innerHTML = `
  <section class="hello fade-in">
    <div class="glass hero-card tilt">
      <p class="dim" style="margin:0">${greet} 👋</p>
      <h1 class="h1">${u ? esc(u.name.split(' ')[0]) : 'Tamu'}, siap latihan hari ini?</h1>
      <p class="muted" style="margin:0 0 16px">${u?.target ? `Target: <b style="color:var(--text)">${esc(u.target)}</b> · ` : ''}Konsisten 15 menit sehari lebih baik dari 3 jam sekali seminggu.</p>
      <div class="row wrap"><a class="btn" href="#/latihan">🚀 Mulai Latihan</a><a class="btn ghost" href="#/latihan?mode=game&category=campuran&difficulty=normal">🎮 Arena Cepat</a><a class="btn ghost" href="#/duel">⚔️ Duel</a></div>
    </div>
    <div class="glass card" id="levelCard">
      ${session.loggedIn ? '<div class="skeleton" style="height:120px"></div>' : `
        <h3 class="h2">Mode Tamu</h3><p class="muted">Daftar gratis untuk menyimpan progres, melihat evaluasi harian/mingguan/bulanan, dan masuk papan peringkat.</p>
        <button class="btn sm" id="toLogin">Daftar / Masuk</button>`}
    </div>
  </section>

  <section class="section" id="onlineBox" hidden></section>

  <section class="section" id="todayStats" ${session.loggedIn ? '' : 'hidden'}>
    <div class="grid g4">
      ${['Soal hari ini', 'Akurasi hari ini', 'Soal minggu ini', 'Poin bulan ini'].map(l => `<div class="glass stat"><div class="v">–</div><div class="l">${l}</div></div>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2 class="h2">📖 Materi terbaru</h2><a href="#/materi">Semua materi →</a></div>
    <div class="mat-strip" id="matStrip"><div class="skeleton" style="height:120px"></div></div>
  </section>

  <section class="section">
    <div class="section-head"><h2 class="h2">Pilih mode belajar</h2></div>
    <div class="quick">
      <a class="glass mode-card tilt" href="#/latihan?mode=pg"><span class="mode-icon mi-pg">📝</span><span><b>Pilihan Ganda</b><br><span class="dim">Simulasi ujian A–D + pembahasan</span></span></a>
      <a class="glass mode-card tilt" href="#/latihan?mode=game"><span class="mode-icon mi-game">🎮</span><span><b>Arena Game</b><br><span class="dim">Nyawa, combo, power-up</span></span></a>
      <a class="glass mode-card tilt" href="#/latihan?mode=essay"><span class="mode-icon mi-essay">✍️</span><span><b>Esai + Koreksi</b><br><span class="dim">Jawab sendiri, dikoreksi maksudnya</span></span></a>
      <a class="glass mode-card tilt" href="#/latihan?mode=interaktif"><span class="mode-icon mi-visual">🧩</span><span><b>Interaktif Visual</b><br><span class="dim">Susun, cocokkan, bangun grafik</span></span></a>
    </div>
  </section>

  <section class="section"><div class="glass bank-card" id="bankCard"><div class="skeleton" style="height:56px"></div></div></section>

  <section class="section">
    <div class="section-head"><h2 class="h2">Materi tes</h2><a href="#/latihan">Lihat semua →</a></div>
    <div class="cat-grid">
      ${CATEGORIES.slice(1).map(c => `
        <a class="glass cat-card has-img tilt" href="#/latihan?category=${c.key}">
          <span class="cat-img"><img src="/img/cat/${c.key}.svg" alt="" loading="lazy"></span>
          <b>${c.name}</b><small>${c.tags}${c.fresh ? ' · <span class="chip new" style="padding:1px 6px">BARU</span>' : ''}</small>
          <span class="cat-count" data-count="${c.key}"></span>
        </a>`).join('')}
    </div>
  </section>

  <section class="section grid md-g2">
    <div class="glass card">
      <div class="section-head"><h2 class="h2">📰 Isu terkini</h2><a href="#/latihan?category=isu&fresh=1">Latihan isu →</a></div>
      <div id="newsList"><div class="skeleton" style="height:160px"></div></div>
    </div>
    <div class="glass card">
      <div class="section-head"><h2 class="h2">🏆 Top minggu ini</h2><a href="#/peringkat">Semua →</a></div>
      <div id="lbMini"><div class="skeleton" style="height:160px"></div></div>
    </div>
  </section>

  <section class="section"><a class="glass card row tilt office-card" href="#/kantor" style="gap:14px"><span style="font-size:34px">🏢</span>
    <div style="flex:1"><b>Kantor Live SiapLolos</b><div class="dim">Lihat kantor 3D: siapa yang sedang latihan, duel, membaca, atau rehat ngopi</div></div><span class="grad-text" style="font-weight:800">Masuk →</span></a></section>

  <section class="section"><a class="glass card row tilt" href="#/teknologi" style="gap:14px"><span style="font-size:30px">⚙️</span>
    <div style="flex:1"><b>Teknologi di balik SiapLolos</b><div class="dim">Vercel, GitHub, Firebase, Apps Script, Gemini, dan lainnya</div></div><span class="grad-text" style="font-weight:800">→</span></a></section>`;

  $('#toLogin')?.addEventListener('click', () => { session.clear(); location.hash = '#/login'; });
  onlineWidget($('#onlineBox'));

  getMaterials().then(d => {
    const el = $('#matStrip'); if (!el) return;
    const list = (d.daily.length ? d.daily : d.core).slice(0, 6);
    const isDaily = d.daily.length > 0;
    el.innerHTML = list.map(m => {
      const c = catByKey[m.category] || {};
      const fb = `/img/cat/${catByKey[m.category] ? m.category : 'isu'}.svg`;
      const isToday = isDaily && m.day === new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      return `<a class="glass mat-mini has-img" href="#/materi?id=${encodeURIComponent(m.id)}">
        <span class="mm-img"><img src="${esc(m.cover || fb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fb}'">
          <span class="mm-cat">${c.ico || '📘'} ${esc(c.name || '')}</span>${isToday ? '<span class="mm-new">BARU</span>' : ''}</span>
        <span class="mm-body"><b>${esc(m.title)}</b>${m.highlight ? `<span class="mm-hl">✨ ${esc(m.highlight)}</span>` : ''}</span></a>`;
    }).join('') + (isDaily ? '' : '<div class="dim" style="align-self:center;padding:0 8px">Materi harian dari berita muncul setiap pagi 06.00 WIB</div>');
  }).catch(() => { const el = $('#matStrip'); if (el) el.innerHTML = ''; });

  getInfo().then(d => {
    renderBank(d.bank);
    const el = $('#newsList'); if (!el) return;
    el.innerHTML = d.items.length ? d.items.slice(0, 5).map(n => `
      <a class="news-item" href="${esc(n.link)}" target="_blank" rel="noopener">${newsThumb(n)}<div style="min-width:0">
        <span class="nt">${esc(n.title)}</span>
        <div class="dim">${esc(n.source || '')} · ${timeAgo(n.date)}</div></div></a>`).join('')
      : `<div class="empty">Berita belum tersedia. Soal isu terkini dibuat otomatis setiap pagi.</div>`;
  }).catch(() => { const el = $('#newsList'); if (el) el.innerHTML = '<div class="empty">Gagal memuat berita.</div>'; });

  api('/leaderboard?period=week').then(d => {
    const el = $('#lbMini'); if (!el) return;
    el.innerHTML = d.top.length ? d.top.slice(0, 5).map(r => `
      <div class="lb-row ${r.me ? 'me' : ''}"><span class="rank ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank}</span>${avatar(r, 'md')}
      <b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</b><span class="dim">${r.accuracy}%</span><b style="font-family:var(--num)">${fmt(r.points)}</b></div>`).join('')
      : '<div class="empty">Belum ada peserta minggu ini. Jadilah yang pertama! 🚀</div>';
  }).catch(() => {});

  if (session.loggedIn) {
    api('/stats').then(s => {
      const lc = $('#levelCard'); if (!lc) return;
      lc.innerHTML = `
        <div class="row between"><div class="streak"><span class="flame">🔥</span><div><div style="font-family:var(--num);font-size:28px;font-weight:700;line-height:1">${s.streak}</div><div class="dim">hari beruntun</div></div></div>
        <div style="text-align:right"><div class="dim">Level</div><div class="grad-text" style="font-family:var(--num);font-size:30px;font-weight:700;line-height:1">${s.level.level}</div></div></div>
        <div style="margin-top:16px" class="row between dim"><span>${fmt(s.level.points)} poin</span><span>${fmt(s.level.next)} untuk level ${s.level.level + 1}</span></div>
        <div class="xp-bar" style="margin-top:6px"><i style="width:0"></i></div>
        ${s.tips[0] ? `<p class="dim" style="margin:12px 0 0">💡 ${esc(s.tips[0].text)}</p>` : ''}`;
      requestAnimationFrame(() => { const b = $('.xp-bar i', lc); if (b) b.style.width = Math.max(3, s.level.progress) + '%'; });
      const vals = [s.summary.today.questions, s.summary.today.accuracy, s.summary.week.questions, s.summary.month.points];
      $$('#todayStats .v').forEach((el, i) => { countUp(el, vals[i]); if (i === 1) setTimeout(() => (el.textContent = vals[i] + '%'), 950); });
    }).catch(() => {});
  }
}

/* Thumbnail berita: foto dari sumber bila ada, kalau tidak ilustrasi topik + logo media */
function newsThumb(n) {
  const cat = catByKey[n.cat] ? n.cat : 'isu';
  const fav = n.site ? `<img class="fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(n.site)}&sz=64" alt="" loading="lazy" onerror="this.remove()">` : '';
  const fb = `<img src="/img/cat/${cat}.svg" alt="" loading="lazy">${fav}`;
  return `<span class="news-thumb">${n.image
    ? `<img src="${esc(n.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.innerHTML='<img src=&quot;/img/cat/${cat}.svg&quot; alt=&quot;&quot;>'">`
    : fb}</span>`;
}

/* ───────── Foto profil ───────── */
function loadImage(file) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('File bukan gambar yang didukung. Coba JPG atau PNG.')); };
    img.src = url;
  });
}
// Editor foto: geser untuk memposisikan, zoom pakai slider / scroll / cubit 2 jari
function openCropper(img) {
  return new Promise(resolve => {
    const S = 280, OUT = 256;
    let done = false;
    const closeSheet = sheet(`
      <div class="row between"><h3 class="h2">✂️ Atur foto profil</h3><span class="dim">Geser & zoom</span></div>
      <div class="crop-stage" id="cropStage"><canvas id="cropCv" width="${S * 2}" height="${S * 2}"></canvas><div class="crop-mask"></div></div>
      <div class="crop-ctl">
        <button class="btn ghost sm" id="czOut" aria-label="Perkecil">−</button>
        <input type="range" id="cropZoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
        <button class="btn ghost sm" id="czIn" aria-label="Perbesar">+</button>
        <button class="btn ghost sm" id="cRot" aria-label="Putar">⟳</button>
      </div>
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost" id="cCancel" style="flex:1">Batal</button><button class="btn" id="cSave" style="flex:2">💾 Simpan foto</button></div>`,
    (el, close) => {
      const cv = $('#cropCv', el), ctx = cv.getContext('2d'), stage = $('#cropStage', el), zoom = $('#cropZoom', el);
      let rot = 0, z = 1, ox = 0, oy = 0;
      const dims = () => rot % 180 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight];
      const base = () => { const [w, h] = dims(); return S / Math.min(w, h); };
      const clamp = () => {
        const [w, h] = dims(), k = base() * z;
        const mx = Math.max(0, (w * k - S) / 2), my = Math.max(0, (h * k - S) / 2);
        ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy));
      };
      const paint = (c, size) => {
        const f = size / S, k = base() * z * f;
        c.save(); c.fillStyle = '#fff'; c.fillRect(0, 0, size, size);
        c.translate(size / 2 + ox * f, size / 2 + oy * f); c.rotate(rot * Math.PI / 180);
        c.drawImage(img, -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k);
        c.restore();
      };
      const draw = () => { clamp(); paint(ctx, S * 2); };
      const setZ = (v, keep = true) => { const nz = Math.max(1, Math.min(4, v)); if (keep) { ox *= nz / z; oy *= nz / z; } z = nz; zoom.value = z; draw(); };
      draw();
      zoom.oninput = () => setZ(+zoom.value);
      $('#czIn', el).onclick = () => setZ(z + 0.25);
      $('#czOut', el).onclick = () => setZ(z - 0.25);
      $('#cRot', el).onclick = () => { rot = (rot + 90) % 360; ox = oy = 0; draw(); };
      stage.addEventListener('wheel', e => { e.preventDefault(); setZ(z * (e.deltaY < 0 ? 1.08 : 0.93)); }, { passive: false });
      const pts = new Map(); let pinch = null;
      stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
      stage.addEventListener('pointermove', e => {
        const prev = pts.get(e.pointerId); if (!prev) return;
        const cur = { x: e.clientX, y: e.clientY }; pts.set(e.pointerId, cur);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) setZ(z * d / pinch); pinch = d;
        } else { const r = stage.getBoundingClientRect().width / S; ox += (cur.x - prev.x) / r; oy += (cur.y - prev.y) / r; draw(); }
      });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      const finish = v => { if (done) return; done = true; close(); resolve(v); };
      $('#cCancel', el).onclick = () => finish(null);
      $('#cSave', el).onclick = () => {
        const out = document.createElement('canvas'); out.width = out.height = OUT;
        paint(out.getContext('2d'), OUT);
        let d = null; for (const q of [0.88, 0.78, 0.62, 0.45, 0.35]) { d = out.toDataURL('image/jpeg', q); if (d.length < 120000) break; }
        finish(d);
      };
    });
    // tutup lewat klik latar = batal
    const bd = document.querySelector('.sheet-backdrop:last-of-type');
    if (bd) bd.addEventListener('click', () => { if (!done) { done = true; resolve(null); } });
    void closeSheet;
  });
}
function bindPhoto() {
  const file = $('#pfFile'); if (!file) return;
  const pick = () => file.click();
  $('#pfPick').onclick = pick; $('#pfUp').onclick = pick;
  file.onchange = async () => {
    const f = file.files[0]; file.value = ''; if (!f) return;
    let img;
    try {
      if (f.size > 15 * 1024 * 1024) throw new Error('Foto terlalu besar (maks 15 MB)');
      img = await loadImage(f);
    } catch (e) { return toast(e.message, 'err'); }
    const image = await openCropper(img);
    if (!image) return;
    const btn = $('#pfUp'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Mengunggah…';
    try {
      const r = await api('/presence?op=avatar', { method: 'POST', body: { image } });
      session.patch({ avatar: r.avatar });
      toast('Foto profil diperbarui 🎉', 'ok');
      paintAvatarBtn(); renderProfile(); refreshPresence();
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = '📷 Coba lagi'; }
  };
  const del = $('#pfDel');
  if (del) del.onclick = async () => {
    if (!confirmDelete()) return;
    del.disabled = true;
    try { await api('/presence?op=avatar', { method: 'DELETE' }); session.patch({ avatar: null }); toast('Foto profil dihapus'); paintAvatarBtn(); renderProfile(); }
    catch (e) { toast(e.message, 'err'); del.disabled = false; }
  };
}
function confirmDelete() {
  const b = $('#pfDel');
  if (b.dataset.sure) return true;
  b.dataset.sure = '1'; b.textContent = 'Yakin hapus?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Hapus'; } }, 3000);
  return false;
}
// sinkronkan foto dari server (mis. diganti di perangkat lain)
function syncAvatar() {
  if (!session.loggedIn) return;
  api('/presence?op=avatar&me=1').then(r => { if ((r.avatar || null) !== (session.user?.avatar || null)) { session.patch({ avatar: r.avatar }); paintAvatarBtn(); } }).catch(() => {});
}

/* ───────── Profil ───────── */
function renderProfile() {
  const u = session.user;
  if (!u) {
    app.innerHTML = `<div class="glass card empty fade-in"><div style="font-size:48px">👤</div><h2 class="h2">Kamu sedang dalam Mode Tamu</h2>
      <p class="muted">Progres latihan tidak disimpan. Buat akun gratis untuk evaluasi & peringkat.</p>
      <button class="btn" id="toLogin">Daftar / Masuk</button></div>`;
    $('#toLogin').onclick = () => { session.clear(); location.hash = '#/login'; };
    return;
  }
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="glass card tilt row" style="gap:16px">
      <div class="prof-photo">
        <button class="prof-av" id="pfPick" aria-label="Ganti foto profil">${avatar(u, 'xl')}<span class="prof-cam">📷</span></button>
        <input type="file" id="pfFile" accept="image/jpeg,image/png,image/webp,image/heic,image/*" hidden>
      </div>
      <div style="min-width:0"><h1 class="h2" style="font-size:22px">${esc(u.name)}</h1><div class="dim">${esc(u.email)}</div>
      <div class="row wrap" style="margin-top:6px">${u.target ? `<span class="chip">🎯 ${esc(u.target)}</span>` : ''}${u.admin ? '<span class="chip new">Admin</span>' : ''}</div>
      <div class="row wrap" style="margin-top:10px;gap:6px"><button class="btn sm" id="pfUp">📷 ${u.avatar ? 'Ganti foto' : 'Pasang foto'}</button>${u.avatar ? '<button class="btn ghost sm" id="pfDel">Hapus</button>' : ''}</div></div>
    </div>
    <div class="grid g3" id="profStats">${['Total soal', 'Akurasi', 'Total poin'].map(l => `<div class="glass stat"><div class="v">–</div><div class="l">${l}</div></div>`).join('')}</div>
    ${u.admin ? `
    <div class="glass card">
      <h2 class="h2">⚙️ Panel Admin</h2>
      <a class="glass card row tilt" href="#/command" style="gap:14px;margin:12px 0"><span style="font-size:30px">🏢</span>
        <div style="flex:1"><b>Kantor Live / Command Center</b><div class="dim">Kini bisa dibuka semua pengguna lewat menu 🏢 Kantor</div></div><span class="grad-text" style="font-weight:800">Buka →</span></a>
      <p class="muted" style="margin:6px 0 12px">Buat soal & materi baru dari berita hari ini (Gemini). Keduanya juga berjalan otomatis setiap hari pukul 06.00 WIB.</p>
      <div id="sysStatus" class="dim">Memuat status…</div>
      <div class="gen-grid">
        <button class="gen-btn" data-gen="soal"><span class="gi">📝</span><span><b>Generate Soal</b><small>10 soal × 4 topik (PG, esai, interaktif)</small></span></button>
        <button class="gen-btn" data-gen="materi"><span class="gi">📖</span><span><b>Generate Materi</b><small>1 materi bacaan × 4 topik</small></span></button>
      </div>
      <p class="dim" style="margin:8px 0 0">💡 Jalankan satu per satu, beri jeda ±1 menit agar kuota Gemini tidak cepat habis.</p>
      <pre id="genOut" class="dim" style="white-space:pre-wrap;margin:12px 0 0"></pre><div id="genLinks"></div>
    </div>
    <div class="glass card"><div class="row between"><h2 class="h2">💬 Kritik & Saran</h2><span class="chip" id="fbUnread">…</span></div>
      <p class="dim" style="margin:4px 0 10px">Pesan dari pengguna. Salinannya juga masuk ke Google Sheet, tab "Kritik &amp; Saran".</p>
      <div id="fbList"><div class="skeleton" style="height:80px"></div></div></div>` : ''}
    <div class="glass card">
      <h2 class="h2">Tentang akun</h2>
      <p class="muted" style="margin:6px 0 0">Akun tersimpan aman di Google Sheet melalui Google Apps Script (kata sandi di-hash). Riwayat latihan tersimpan di Firebase.</p>
    </div>
    <button class="glass card row tilt" id="profTheme" style="gap:14px;text-align:left;width:100%"><span style="font-size:28px">🎨</span>
      <div style="flex:1"><b>Tema tampilan</b><div class="dim" id="profThemeName"></div></div><span class="grad-text" style="font-weight:800">Ganti →</span></button>
    <label class="glass card row" style="gap:14px;cursor:pointer"><span style="font-size:26px">🟢</span>
      <div style="flex:1"><b>Tampilkan saya di daftar online</b><div class="dim">Matikan jika ingin belajar tanpa terlihat orang lain</div></div>
      <input type="checkbox" id="onlineToggle" class="switch" ${isHidden() ? '' : 'checked'}></label>
    <a class="btn ghost block" href="#/kantor">🏢 Kantor Live</a>
    <a class="btn ghost block" href="#/peringkat">🏆 Papan peringkat</a>
    <a class="btn ghost block" href="#/teknologi">⚙️ Teknologi di balik SiapLolos</a>
    <button class="btn ghost block" id="logoutBtn">Keluar</button>
  </section>`;
  const tn = () => { const t = THEMES.find(x => x.key === currentTheme()); $('#profThemeName') && ($('#profThemeName').textContent = `${t.ico} ${t.name} — ${t.desc}`); };
  $('#onlineToggle').onchange = e => { setHidden(!e.target.checked); toast(e.target.checked ? 'Kamu terlihat online' : 'Status online disembunyikan', 'ok'); };
  tn(); $('#profTheme').onclick = openThemePicker; window.addEventListener('theme:change', tn);
  bindPhoto();
  $('#logoutBtn').onclick = () => { session.clear(); toast('Kamu telah keluar'); location.hash = '#/login'; };
  api('/stats').then(s => {
    const v = [s.summary.allTime.questions, s.summary.allTime.accuracy, s.summary.allTime.points];
    $$('#profStats .v').forEach((el, i) => (el.textContent = i === 1 ? v[i] + '%' : fmt(v[i])));
  }).catch(() => {});
  if (u.admin) {
    const loadStatus = () => api('/news?fresh=' + Date.now()).then(d => {
      const st = d.status; const lg = st.lastGenerate;
      $('#sysStatus').innerHTML = `Firebase: <b>${st.firebase ? '✅ aktif' : '⚠️ memori'}</b> · AI: <b>${st.ai ? '✅ aktif' : '⚠️ belum diatur'}</b> · Soal hasil generate: <b>${fmt(st.generatedQuestions)}</b><br>
        Terakhir generate${lg?.type && lg.type !== 'all' ? ' ' + lg.type : ''}: ${lg ? `${new Date(lg.at).toLocaleString('id-ID')} (${lg.total} soal, ${lg.materials || 0} materi)` : 'belum pernah'}`;
    }).catch(() => {});
    loadStatus();
    const TY = { saran: '💡 Saran', kritik: '🗣️ Kritik', bug: '🐞 Bug', pujian: '💖 Pujian' };
    const loadFb = () => api('/presence?op=feedback').then(d => {
      $('#fbUnread').textContent = `${d.unread} baru`;
      $('#fbList').innerHTML = d.items.length ? d.items.map(f => `
        <div class="fb-item ${f.done ? 'done' : ''}"><div class="row between wrap" style="gap:6px"><span class="row" style="gap:6px"><span class="chip">${TY[f.type] || f.type}</span>${f.rating ? `<span class="fb-rt">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>` : ''}</span>
          <span class="dim">${esc(f.name)} · ${timeAgo(f.createdAt)}${f.page ? ' · ' + esc(f.page) : ''}</span></div>
          <p>${esc(f.message)}</p>
          <button class="btn ghost sm" data-fb="${esc(f.id)}" data-done="${f.done ? 0 : 1}">${f.done ? '↩️ Tandai belum dibaca' : '✓ Tandai sudah dibaca'}</button></div>`).join('')
        : '<div class="empty">Belum ada pesan masuk.</div>';
      $$('[data-fb]').forEach(b => (b.onclick = async () => { b.disabled = true; await api('/presence?op=feedback', { method: 'POST', body: { action: 'done', id: b.dataset.fb, done: b.dataset.done === '1' } }).catch(e => toast(e.message, 'err')); loadFb(); }));
    }).catch(e => { $('#fbList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
    loadFb();
    const genBtns = $$('[data-gen]');
    genBtns.forEach(b => (b.onclick = async () => {
      const type = b.dataset.gen, label = b.innerHTML;
      genBtns.forEach(x => (x.disabled = true));
      b.innerHTML = `<span class="spinner"></span><span><b>${type === 'soal' ? 'Membuat soal…' : 'Membuat materi…'}</b><small>bisa sampai ±1 menit</small></span>`;
      $('#genLinks').innerHTML = '';
      try {
        const r = await api('/generate?type=' + type, { method: 'POST' });
        $('#genOut').textContent = r.summary.map(s => `${catByKey[s.cat]?.name || s.cat}: ${type === 'soal' ? `${s.saved} soal` : `${s.material || 0} materi`}${s.reason ? ' — ' + s.reason : ''}`).join('\n');
        if (r.message) { toast(r.message, 'err'); $('#genOut').textContent = '⚠️ ' + r.message + '\n\n' + $('#genOut').textContent; }
        else if (type === 'soal') { toast(`${r.total} soal baru ditambahkan`, 'ok'); if (r.total) $('#genLinks').innerHTML = '<a class="btn ghost sm" href="#/latihan?fresh=1&category=isu" style="margin-top:10px">🎯 Coba soal terbaru</a>'; }
        else { toast(`${r.materials} materi baru ditambahkan`, 'ok'); if (r.materials) $('#genLinks').innerHTML = '<a class="btn ghost sm" href="#/materi?r=1" style="margin-top:10px">📖 Lihat materi terbaru</a>'; }
      } catch (e) { toast(e.message, 'err'); }
      genBtns.forEach(x => (x.disabled = false)); b.innerHTML = label; loadStatus();
    }));
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('auth:expired', () => { toast('Sesi berakhir, silakan masuk lagi', 'err'); location.hash = '#/login'; });
window.addEventListener('beforeunload', e => { if (practice.active) { e.preventDefault(); e.returnValue = ''; } });

applyTheme(currentTheme(), { save: false });
mountDock();
if (session.loggedIn) { startPresence(); syncAvatar(); }
window.addEventListener('hashchange', () => { if (session.loggedIn) startPresence(); });
$('#themeBtn').onclick = openThemePicker;
route();
initBackground($('#bg3d'));
