import { getInfo, session } from './api.js';
import { $, $$, esc, fmt } from './ui.js';

const STACK = [
  {
    group: 'Hosting & Kode', items: [
      { ico: '▲', color: '#e5e7eb', name: 'Vercel', role: 'Hosting & Serverless API',
        desc: 'Menayangkan website ke internet dan menjalankan API (login, ambil soal, simpan hasil, evaluasi) tanpa perlu server sendiri. Juga menjalankan jadwal otomatis setiap pagi.',
        url: 'https://vercel.com' },
      { ico: '🐙', color: '#a78bfa', name: 'GitHub', role: 'Penyimpanan kode',
        desc: 'Seluruh kode website disimpan di GitHub. Setiap ada perubahan kode, Vercel otomatis memperbarui website dalam hitungan detik.',
        url: 'https://github.com' },
    ],
  },
  {
    group: 'Data & Akun', items: [
      { ico: '🔥', color: '#fb923c', name: 'Firebase Firestore', role: 'Database',
        desc: 'Menyimpan riwayat latihan, data evaluasi harian/mingguan/bulanan, papan peringkat, dan soal-soal baru hasil generate dari berita.',
        url: 'https://firebase.google.com', status: 'firebase' },
      { ico: '📜', color: '#fbbf24', name: 'Google Apps Script', role: 'Server akun',
        desc: 'Memproses pendaftaran, login, dan lupa kata sandi (kode via email). Kata sandi di-hash sehingga tidak bisa dibaca siapa pun.',
        url: 'https://developers.google.com/apps-script' },
      { ico: '📊', color: '#34d399', name: 'Google Sheets', role: 'Data akun',
        desc: 'Tempat tersimpannya daftar akun pengguna (nama, email, target tes, riwayat login) yang dikelola lewat Apps Script.',
        url: 'https://sheets.google.com' },
    ],
  },
  {
    group: 'Kecerdasan Buatan & Konten', items: [
      { ico: '✨', color: '#818cf8', name: 'Google Gemini', role: 'AI pembuat & pengoreksi soal',
        desc: 'Setiap pagi menyusun soal pilihan ganda & esai dari berita terbaru, serta mengoreksi jawaban esai berdasarkan maksudnya — lengkap dengan poin yang terlewat dan perbaikannya.',
        url: 'https://ai.google.dev', status: 'ai' },
      { ico: '📰', color: '#22d3ee', name: 'Google News RSS', role: 'Sumber berita terkini',
        desc: 'Judul berita ekonomi, perbankan, BUMN, dan kebijakan terbaru diambil otomatis sebagai bahan soal Isu Terkini — setiap soal menampilkan link sumbernya.',
        url: 'https://news.google.com' },
    ],
  },
  {
    group: 'Tampilan', items: [
      { ico: '🧊', color: '#38bdf8', name: 'Three.js', role: 'Grafis 3D',
        desc: 'Menghasilkan latar 3D yang bergerak mengikuti kursor/kemiringan HP, dioptimalkan agar tetap ringan di ponsel.',
        url: 'https://threejs.org' },
      { ico: '📈', color: '#f472b6', name: 'Chart.js', role: 'Grafik evaluasi',
        desc: 'Menampilkan grafik tren latihan harian, mingguan, dan bulanan di menu Evaluasi.',
        url: 'https://www.chartjs.org' },
      { ico: '🧩', color: '#c084fc', name: 'HTML, CSS & JavaScript', role: 'Fondasi website',
        desc: 'Dibangun tanpa framework berat agar cepat dibuka, dengan desain mobile-first, efek kaca, dan animasi 3D CSS.',
        url: 'https://developer.mozilla.org' },
      { ico: '🟢', color: '#4ade80', name: 'Node.js', role: 'Bahasa server',
        desc: 'Bahasa yang menjalankan seluruh API di Vercel, termasuk tanda tangan token login yang aman.',
        url: 'https://nodejs.org' },
    ],
  },
];

const FLOW = [
  { ico: '📱', t: 'Kamu', s: 'buka website di HP/laptop' },
  { ico: '▲', t: 'Vercel', s: 'tampilkan halaman & API' },
  { ico: '📜', t: 'Apps Script', s: 'cek akun di Google Sheets' },
  { ico: '🔥', t: 'Firebase', s: 'ambil soal & simpan hasil' },
  { ico: '✨', t: 'Gemini', s: 'buat soal & koreksi esai' },
];

export function renderTech(app) {
  app.innerHTML = `
  <section class="stack fade-in">
    ${!session.loggedIn && !session.guest ? '<a href="#/login" class="link-btn" style="font-size:14px">← Kembali ke halaman masuk</a>' : ''}
    <div class="glass hero-card tilt">
      <span class="hero-tag">⚙️ Di balik layar</span>
      <h1 class="h1" style="margin-top:12px">Teknologi yang dipakai <span class="grad-text">SiapLolos</span></h1>
      <p class="muted" style="margin:0">Website ini dirangkai dari layanan modern yang andal, aman, dan sebagian besar gratis — supaya kamu bisa fokus latihan.</p>
    </div>

    <div class="glass card">
      <h2 class="h2" style="margin-bottom:14px">Alur kerjanya</h2>
      <div class="flow">${FLOW.map((f, i) => `
        <div class="flow-step" style="animation-delay:${i * 0.08}s"><span class="flow-ico">${f.ico}</span><b>${f.t}</b><span class="dim">${f.s}</span></div>
        ${i < FLOW.length - 1 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}`).join('')}
      </div>
      <div id="sysLive" class="row wrap" style="margin-top:14px;gap:8px"></div>
    </div>

    ${STACK.map(g => `
      <div>
        <h2 class="h2" style="margin:6px 0 10px">${g.group}</h2>
        <div class="tech-grid">${g.items.map(t => `
          <a class="glass tech-card tilt" href="${t.url}" target="_blank" rel="noopener">
            <span class="tech-glow" style="background:${t.color}"></span>
            <div class="row" style="gap:12px">
              <span class="tech-ico" style="box-shadow:0 0 0 1px ${t.color}55, 0 10px 24px -10px ${t.color}">${t.ico}</span>
              <div style="min-width:0"><b>${t.name}</b><div class="dim">${t.role}</div></div>
              ${t.status ? `<span class="live-dot" data-status="${t.status}" title="Status"></span>` : ''}
            </div>
            <p>${t.desc}</p>
            <span class="tech-link">Kunjungi situs ↗</span>
          </a>`).join('')}
        </div>
      </div>`).join('')}

    <div class="glass card">
      <h2 class="h2" style="margin-bottom:10px">🔒 Keamanan data</h2>
      <div class="sec-list">
        <div><span>🔑</span><span>Kata sandi disimpan dalam bentuk <b>hash</b> (diacak satu arah) — admin pun tidak bisa melihat kata sandimu.</span></div>
        <div><span>🛡️</span><span>Sesi login memakai <b>token bertanda tangan digital</b> yang berlaku 14 hari.</span></div>
        <div><span>🚫</span><span>Database Firebase <b>terkunci</b> dari akses langsung; semua data hanya lewat server resmi.</span></div>
        <div><span>⏱️</span><span>Login dan reset kata sandi dibatasi percobaannya untuk mencegah tebak-tebakan.</span></div>
      </div>
    </div>
  </section>`;

  getInfo().then(d => {
    const st = d.status || {}, bank = d.bank;
    $$('.live-dot', app).forEach(el => {
      const on = !!st[el.dataset.status];
      el.classList.toggle('on', on);
      el.title = on ? 'Aktif' : 'Belum aktif';
    });
    const box = $('#sysLive'); if (!box) return;
    box.innerHTML = `
      <span class="chip"><span class="live-dot on"></span> Website online</span>
      <span class="chip"><span class="live-dot ${st.firebase ? 'on' : ''}"></span> Database ${st.firebase ? 'aktif' : 'mode sementara'}</span>
      <span class="chip"><span class="live-dot ${st.ai ? 'on' : ''}"></span> AI ${st.ai ? 'aktif' : 'belum aktif'}</span>
      ${bank ? `<span class="chip">📚 ${fmt(bank.total)} soal</span>` : ''}
      ${st.lastGenerate ? `<span class="chip">🕒 Soal terakhir dibuat ${esc(new Date(st.lastGenerate.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}</span>` : ''}`;
  }).catch(() => {});
}
