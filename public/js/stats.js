import { api, session } from './api.js';
import { $, $$, esc, fmt, countUp, timeAgo } from './ui.js';
import { catByKey, modeByKey, diffByKey } from './data.js';

let chartLib;
function loadChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartLib) chartLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = () => res(window.Chart); s.onerror = rej; document.head.appendChild(s);
  });
  return chartLib;
}

function guestBlock(app, title) {
  app.innerHTML = `<div class="glass card empty fade-in"><div style="font-size:48px">📈</div><h2 class="h2">${title}</h2>
    <p class="muted">Fitur ini membutuhkan akun agar riwayat latihanmu tersimpan.</p><button class="btn" id="toLogin">Daftar / Masuk</button></div>`;
  $('#toLogin').onclick = () => { session.clear(); location.hash = '#/login'; };
}

const accColor = a => (a >= 80 ? 'linear-gradient(90deg,#34d399,#22d3ee)' : a >= 60 ? 'linear-gradient(90deg,#22d3ee,#818cf8)' : a >= 40 ? 'linear-gradient(90deg,#fbbf24,#fb923c)' : 'linear-gradient(90deg,#fb7185,#f43f5e)');

export async function renderStats(app) {
  if (!session.loggedIn) return guestBlock(app, 'Evaluasi belajar');
  app.innerHTML = `<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:260px;margin-top:14px"></div>`;
  const s = await api('/stats');
  let period = 'daily';
  const sumTile = (label, o, ico) => `
    <div class="glass card tilt">
      <div class="row between"><b>${ico} ${label}</b><span class="chip">${o.sessions} sesi</span></div>
      <div class="grid g3" style="margin-top:12px;gap:8px">
        <div><div style="font-family:var(--num);font-size:22px;font-weight:700">${fmt(o.questions)}</div><div class="dim">soal</div></div>
        <div><div style="font-family:var(--num);font-size:22px;font-weight:700">${o.accuracy}%</div><div class="dim">akurasi</div></div>
        <div><div style="font-family:var(--num);font-size:22px;font-weight:700">${o.minutes}</div><div class="dim">menit</div></div>
      </div>
    </div>`;

  app.innerHTML = `
  <section class="stack fade-in">
    <div class="row between wrap">
      <div><h1 class="h1">Evaluasi belajar</h1><p class="muted" style="margin:0">Pantau perkembanganmu per hari, minggu, dan bulan.</p></div>
      <div class="glass row" style="padding:10px 14px;border-radius:16px"><span class="flame" style="font-size:24px">🔥</span><b style="font-family:var(--num);font-size:20px">${s.streak}</b><span class="dim">hari beruntun</span></div>
      <a class="btn ghost sm" href="#/peringkat">🏆 Peringkat</a>
    </div>
    <div class="grid md-g3">${sumTile('Hari ini', s.summary.today, '☀️')}${sumTile('Minggu ini', s.summary.week, '📅')}${sumTile('Bulan ini', s.summary.month, '🗓️')}</div>

    <div class="glass card">
      <div class="row between wrap" style="margin-bottom:12px">
        <h2 class="h2">Tren latihan</h2>
        <div class="tabs" id="periodTabs"><button data-p="daily" class="on">Harian</button><button data-p="weekly">Mingguan</button><button data-p="monthly">Bulanan</button></div>
      </div>
      <div class="chart-box"><canvas id="trend"></canvas></div>
      <p class="dim" style="margin:8px 0 0">Batang = jumlah soal · Garis = akurasi (%)</p>
    </div>

    <div class="grid md-g2">
      <div class="glass card">
        <h2 class="h2" style="margin-bottom:14px">Akurasi per materi</h2>
        ${s.byCategory.length ? s.byCategory.map(c => `
          <div class="bar-row"><span>${catByKey[c.key]?.ico || ''} ${esc(c.name)}<br><span class="dim">${c.questions} soal</span></span>
          <div class="track"><i style="width:0;background:${accColor(c.accuracy)}" data-w="${c.accuracy}"></i></div><span class="pct">${c.accuracy}%</span></div>`).join('')
          : '<div class="empty">Belum ada data.</div>'}
      </div>
      <div class="glass card">
        <h2 class="h2" style="margin-bottom:10px">💡 Rekomendasi</h2>
        ${s.tips.map(t => `<div class="tip ${t.type}"><span>${t.type === 'warn' ? '⚠️' : t.type === 'good' ? '✅' : '💡'}</span><span>${esc(t.text)}
          ${t.cat ? `<br><a href="#/latihan?category=${t.cat}" style="color:var(--cyan);font-weight:700;font-size:13px">Latihan sekarang →</a>` : ''}</span></div>`).join('') || '<div class="empty">Terus latihan untuk mendapat rekomendasi.</div>'}
        <h3 class="h2" style="font-size:16px;margin:18px 0 10px">Per level</h3>
        ${s.byDifficulty.map(d => `<div class="bar-row" style="grid-template-columns:70px 1fr 44px"><span class="chip ${d.key}" style="justify-self:start">${d.name}</span>
          <div class="track"><i style="width:0;background:${accColor(d.accuracy)}" data-w="${d.questions ? d.accuracy : 0}"></i></div><span class="pct">${d.questions ? d.accuracy + '%' : '–'}</span></div>`).join('')}
        <h3 class="h2" style="font-size:16px;margin:18px 0 10px">Per mode</h3>
        <div class="grid g4" style="gap:8px">${['pg', 'game', 'essay', 'interaktif', 'duel'].map(k => { const m = s.byMode.find(x => x.key === k); return `
          <div class="glass stat" style="padding:10px"><div style="font-size:20px">${modeByKey[k].ico}</div><div style="font-family:var(--num);font-weight:700">${m ? m.sessions : 0} sesi</div><div class="dim">${m ? m.avgScore + ' rata-rata' : 'belum'}</div></div>`; }).join('')}</div>
      </div>
    </div>

    <div class="glass card">
      <h2 class="h2" style="margin-bottom:6px">Riwayat terbaru</h2>
      ${s.recent.length ? s.recent.map(a => `
        <div class="hist-row"><span style="font-size:22px">${modeByKey[a.mode]?.ico || '📝'}</span>
          <div><b>${esc(catByKey[a.category]?.name || a.category)}</b><div class="dim">${modeByKey[a.mode]?.name} · ${diffByKey[a.difficulty]?.name || 'Semua'} · ${a.correct}/${a.total} · ${timeAgo(a.createdAt)}</div></div>
          <span class="sc" style="color:${a.score >= 75 ? 'var(--green)' : a.score >= 50 ? 'var(--amber)' : 'var(--red)'}">${a.score}</span></div>`).join('')
        : '<div class="empty">Belum ada riwayat. <a href="#/latihan" style="color:var(--cyan)">Mulai latihan →</a></div>'}
    </div>
  </section>`;

  requestAnimationFrame(() => $$('.track i', app).forEach(i => (i.style.width = Math.max(2, +i.dataset.w) + '%')));

  let chart;
  const draw = async () => {
    const Chart = await loadChart().catch(() => null);
    const cv = $('#trend'); if (!Chart || !cv) return;
    const data = s[period];
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, 'rgba(34,211,238,.85)'); g.addColorStop(1, 'rgba(129,140,248,.15)');
    chart?.destroy();
    chart = new Chart(ctx, {
      data: {
        labels: data.map(d => d.label),
        datasets: [
          { type: 'bar', label: 'Soal', data: data.map(d => d.questions), backgroundColor: g, borderRadius: 8, yAxisID: 'y', maxBarThickness: 28 },
          { type: 'line', label: 'Akurasi', data: data.map(d => (d.questions ? d.accuracy : null)), borderColor: '#fbbf24', backgroundColor: '#fbbf24', tension: .35, spanGaps: true, pointRadius: 3, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#9aa5c9', boxWidth: 12 } }, tooltip: { backgroundColor: 'rgba(13,20,48,.95)', borderColor: 'rgba(148,163,255,.3)', borderWidth: 1 } },
        scales: {
          x: { ticks: { color: '#6b76a0', maxRotation: 0, autoSkip: true, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#6b76a0', precision: 0 }, grid: { color: 'rgba(148,163,255,.08)' } },
          y1: { position: 'right', min: 0, max: 100, ticks: { color: '#fbbf24', callback: v => v + '%' }, grid: { display: false } },
        },
      },
    });
  };
  $$('#periodTabs button', app).forEach(b => (b.onclick = () => {
    period = b.dataset.p; $$('#periodTabs button', app).forEach(x => x.classList.toggle('on', x === b)); draw();
  }));
  draw();
}

export async function renderLeaderboard(app) {
  let period = 'week';
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="row between wrap"><div><h1 class="h1">Papan peringkat</h1><p class="muted" style="margin:0">Poin dari semua mode latihan. Reset setiap minggu & bulan.</p></div>
    <div class="tabs" id="lbTabs"><button data-p="week" class="on">Minggu ini</button><button data-p="month">Bulan ini</button></div></div>
    <div class="glass card" id="lbBox"><div class="skeleton" style="height:260px"></div></div>
  </section>`;
  const load = async () => {
    const box = $('#lbBox'); box.innerHTML = '<div class="skeleton" style="height:260px"></div>';
    const d = await api('/leaderboard?period=' + period);
    if (!d.top.length) { box.innerHTML = '<div class="empty"><div style="font-size:44px">🏆</div>Belum ada peserta di periode ini. Jadilah yang pertama!</div>'; return; }
    const t = d.top;
    const pod = (r, cls) => r ? `<div class="p ${cls}"><div class="nm">${esc(r.name)}</div><div class="block">${cls === 'p1' ? '👑' : cls === 'p2' ? '🥈' : '🥉'}<br>${fmt(r.points)}</div></div>` : '<div></div>';
    box.innerHTML = `
      <div class="podium">${pod(t[1], 'p2')}${pod(t[0], 'p1')}${pod(t[2], 'p3')}</div>
      ${t.map(r => `<div class="lb-row ${r.me ? 'me' : ''}"><span class="rank ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank}</span>
        <div style="flex:1;min-width:0"><b>${esc(r.name)}${r.me ? ' (kamu)' : ''}</b><div class="dim">${r.questions} soal · akurasi ${r.accuracy}%</div></div>
        <b style="font-family:var(--num)">${fmt(r.points)}</b></div>`).join('')}
      ${d.mine && d.mine.rank > 20 ? `<div class="lb-row me" style="margin-top:10px"><span class="rank">${d.mine.rank}</span><b style="flex:1">Kamu</b><b>${fmt(d.mine.points)}</b></div>` : ''}
      <p class="dim" style="text-align:center;margin:14px 0 0">${d.participants} peserta aktif</p>`;
  };
  $$('#lbTabs button', app).forEach(b => (b.onclick = () => { period = b.dataset.p; $$('#lbTabs button', app).forEach(x => x.classList.toggle('on', x === b)); load(); }));
  await load();
}
