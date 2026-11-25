import { api, session } from './api.js';
import { $, $$, esc, toast, bindTilt, icons, fmt, timeAgo, countUp } from './ui.js';
import { CATEGORIES, TARGETS, catByKey } from './data.js';
import { initBackground } from './three-bg.js';
import { renderSetup, renderQuiz, renderResult, practice } from './practice.js';
import { renderStats, renderLeaderboard } from './stats.js';

const app = $('#app');
const NAV = [
  { href: '#/', key: '', label: 'Beranda', ico: icons.home },
  { href: '#/latihan', key: 'latihan', label: 'Latihan', ico: icons.play },
  { href: '#/evaluasi', key: 'evaluasi', label: 'Evaluasi', ico: icons.chart },
  { href: '#/peringkat', key: 'peringkat', label: 'Peringkat', ico: icons.trophy },
  { href: '#/profil', key: 'profil', label: 'Profil', ico: icons.user },
];

function chrome(show, active) {
  $('#topbar').hidden = !show;
  $('#bottomnav').hidden = !show;
  if (!show) return;
  const links = NAV.map(n => `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">${n.ico}<span>${n.label}</span></a>`).join('');
  $('#bottomnav').innerHTML = links;
  $('#topnav').innerHTML = NAV.map(n => `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">${n.label}</a>`).join('');
  const u = session.user;
  $('#avatarBtn').textContent = u ? (u.name || '?').trim()[0].toUpperCase() : '👤';
}

async function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(qs || '');
  const authed = session.loggedIn || session.guest;
  if (!authed && path !== 'login') { location.hash = '#/login'; return; }
  if (session.loggedIn && path === 'login') { location.hash = '#/'; return; }
  window.scrollTo(0, 0);
  const inQuiz = path === 'quiz';
  chrome(path !== 'login' && !inQuiz, path);
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
        <div class="field"><label for="fPass">Kata sandi</label><input id="fPass" class="input" type="password" autocomplete="current-password" placeholder="Minimal 6 karakter" required></div>
        <div class="field reg" hidden><label for="fTarget">Target tes</label>
          <select id="fTarget" class="input">${TARGETS.map(t => `<option>${t}</option>`).join('')}</select></div>
        <button class="btn block" id="authBtn" type="submit">Masuk</button>
        <p class="dim" style="text-align:center;margin:0">Belum mau daftar? <button type="button" class="link-btn" id="guestBtn">Coba sebagai tamu</button><br><small>(progres tamu tidak tersimpan)</small></p>
      </form>
    </div>
  </section>`;
  const setMode = m => {
    mode = m;
    $$('.tabs button', app).forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $$('.reg', app).forEach(el => (el.hidden = m !== 'register'));
    $('#authBtn').textContent = m === 'login' ? 'Masuk' : 'Buat Akun';
    $('#fPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  };
  $$('.tabs button', app).forEach(b => (b.onclick = () => setMode(b.dataset.m)));
  $('#guestBtn').onclick = () => { session.setGuest(); location.hash = '#/'; };
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
      <div class="row wrap"><a class="btn" href="#/latihan">🚀 Mulai Latihan</a><a class="btn ghost" href="#/latihan?mode=game&category=campuran&difficulty=normal">🎮 Arena Cepat</a></div>
    </div>
    <div class="glass card" id="levelCard">
      ${session.loggedIn ? '<div class="skeleton" style="height:120px"></div>' : `
        <h3 class="h2">Mode Tamu</h3><p class="muted">Daftar gratis untuk menyimpan progres, melihat evaluasi harian/mingguan/bulanan, dan masuk papan peringkat.</p>
        <button class="btn sm" id="toLogin">Daftar / Masuk</button>`}
    </div>
  </section>

  <section class="section" id="todayStats" ${session.loggedIn ? '' : 'hidden'}>
    <div class="grid g4">
      ${['Soal hari ini', 'Akurasi hari ini', 'Soal minggu ini', 'Poin bulan ini'].map(l => `<div class="glass stat"><div class="v">–</div><div class="l">${l}</div></div>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2 class="h2">Pilih mode belajar</h2></div>
    <div class="quick">
      <a class="glass mode-card tilt" href="#/latihan?mode=pg"><span class="mode-icon mi-pg">📝</span><span><b>Pilihan Ganda</b><br><span class="dim">Simulasi ujian A–D + pembahasan</span></span></a>
      <a class="glass mode-card tilt" href="#/latihan?mode=game"><span class="mode-icon mi-game">🎮</span><span><b>Arena Game</b><br><span class="dim">Nyawa, combo, power-up</span></span></a>
      <a class="glass mode-card tilt" href="#/latihan?mode=essay"><span class="mode-icon mi-essay">✍️</span><span><b>Esai + Koreksi</b><br><span class="dim">Jawab sendiri, dikoreksi maksudnya</span></span></a>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2 class="h2">Materi tes</h2><a href="#/latihan">Lihat semua →</a></div>
    <div class="cat-grid">
      ${CATEGORIES.slice(1).map(c => `
        <a class="glass cat-card tilt" href="#/latihan?category=${c.key}">
          <span class="glow" style="background:${c.color}"></span>
          <span class="ico">${c.ico}</span><b>${c.name}</b><small>${c.tags}${c.fresh ? ' · <span class="chip new" style="padding:1px 6px">BARU</span>' : ''}</small>
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
  </section>`;

  $('#toLogin')?.addEventListener('click', () => { session.clear(); location.hash = '#/login'; });

  api('/news').then(d => {
    const el = $('#newsList'); if (!el) return;
    el.innerHTML = d.items.length ? d.items.slice(0, 5).map(n => `
      <div class="news-item"><span class="dot"></span><div>
        <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <div class="dim">${esc(n.source || '')} · ${timeAgo(n.date)}</div></div></div>`).join('')
      : `<div class="empty">Berita belum tersedia. Soal isu terkini dibuat otomatis setiap pagi.</div>`;
  }).catch(() => { const el = $('#newsList'); if (el) el.innerHTML = '<div class="empty">Gagal memuat berita.</div>'; });

  api('/leaderboard?period=week').then(d => {
    const el = $('#lbMini'); if (!el) return;
    el.innerHTML = d.top.length ? d.top.slice(0, 5).map(r => `
      <div class="lb-row ${r.me ? 'me' : ''}"><span class="rank ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank}</span>
      <b style="flex:1">${esc(r.name)}</b><span class="dim">${r.accuracy}%</span><b style="font-family:var(--num)">${fmt(r.points)}</b></div>`).join('')
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
      <div class="avatar-btn" style="width:68px;height:68px;font-size:28px;margin:0">${esc(u.name[0].toUpperCase())}</div>
      <div style="min-width:0"><h1 class="h2" style="font-size:22px">${esc(u.name)}</h1><div class="dim">${esc(u.email)}</div>
      <div class="row wrap" style="margin-top:6px">${u.target ? `<span class="chip">🎯 ${esc(u.target)}</span>` : ''}${u.admin ? '<span class="chip new">Admin</span>' : ''}</div></div>
    </div>
    <div class="grid g3" id="profStats">${['Total soal', 'Akurasi', 'Total poin'].map(l => `<div class="glass stat"><div class="v">–</div><div class="l">${l}</div></div>`).join('')}</div>
    ${u.admin ? `
    <div class="glass card">
      <h2 class="h2">⚙️ Panel Admin</h2>
      <p class="muted" style="margin:6px 0 12px">Buat soal baru dari berita hari ini (Gemini). Otomatis juga berjalan setiap hari pukul 06.00 WIB.</p>
      <div id="sysStatus" class="dim">Memuat status…</div>
      <div class="row wrap" style="margin-top:12px"><button class="btn sm" id="genBtn">✨ Generate soal sekarang</button></div>
      <pre id="genOut" class="dim" style="white-space:pre-wrap;margin:12px 0 0"></pre>
    </div>` : ''}
    <div class="glass card">
      <h2 class="h2">Tentang akun</h2>
      <p class="muted" style="margin:6px 0 0">Akun tersimpan aman di Google Sheet melalui Google Apps Script (kata sandi di-hash). Riwayat latihan tersimpan di Firebase.</p>
    </div>
    <button class="btn ghost block" id="logoutBtn">Keluar</button>
  </section>`;
  $('#logoutBtn').onclick = () => { session.clear(); toast('Kamu telah keluar'); location.hash = '#/login'; };
  api('/stats').then(s => {
    const v = [s.summary.allTime.questions, s.summary.allTime.accuracy, s.summary.allTime.points];
    $$('#profStats .v').forEach((el, i) => (el.textContent = i === 1 ? v[i] + '%' : fmt(v[i])));
  }).catch(() => {});
  if (u.admin) {
    api('/news').then(d => {
      const st = d.status; const lg = st.lastGenerate;
      $('#sysStatus').innerHTML = `Firebase: <b>${st.firebase ? '✅ aktif' : '⚠️ memori'}</b> · AI: <b>${st.ai ? '✅ aktif' : '⚠️ belum diatur'}</b> · Soal hasil generate: <b>${fmt(st.generatedQuestions)}</b><br>
        Terakhir generate: ${lg ? `${new Date(lg.at).toLocaleString('id-ID')} (${lg.total} soal)` : 'belum pernah'}`;
    }).catch(() => {});
    $('#genBtn').onclick = async () => {
      const b = $('#genBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Membuat soal…';
      try {
        const r = await api('/generate', { method: 'POST' });
        $('#genOut').textContent = r.summary.map(s => `${catByKey[s.cat]?.name || s.cat}: ${s.saved} soal${s.reason ? ' — ' + s.reason : ''}`).join('\n');
        toast(`${r.total} soal baru ditambahkan`, 'ok');
      } catch (e) { toast(e.message, 'err'); }
      b.disabled = false; b.textContent = '✨ Generate soal sekarang';
    };
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('auth:expired', () => { toast('Sesi berakhir, silakan masuk lagi', 'err'); location.hash = '#/login'; });
window.addEventListener('beforeunload', e => { if (practice.active) { e.preventDefault(); e.returnValue = ''; } });

route();
initBackground($('#bg3d'));
