import { api, session } from './api.js';
import { $, $$, esc, toast, timeAgo, confetti } from './ui.js';
import { catByKey } from './data.js';

const READ_KEY = 'sl_read';
const readSet = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); } };
const markRead = id => { try { const s = readSet(); s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-500))); } catch {} };

const todayKey = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
function dayLabel(day) {
  if (!day) return '';
  const t = todayKey();
  const y = new Date(Date.parse(t) - 86400e3).toISOString().slice(0, 10);
  if (day === t) return 'Hari ini';
  if (day === y) return 'Kemarin';
  return new Date(day + 'T00:00:00+07:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

let listCache = null;
export async function getMaterials(force = false) {
  if (!listCache || force || Date.now() - listCache.at > 20000) listCache = { at: Date.now(), p: api('/materials' + (force ? '?t=' + Date.now() : '')).catch(e => { listCache = null; throw e; }) };
  return listCache.p;
}

function card(m, read) {
  const c = catByKey[m.category] || {};
  const isNew = m.day === todayKey();
  return `
    <a class="glass mat-card tilt ${read.has(m.id) ? 'read' : ''}" href="#/materi?id=${encodeURIComponent(m.id)}">
      <span class="glow" style="background:${c.color || '#818cf8'}"></span>
      <div class="row wrap" style="gap:6px">
        <span class="chip">${c.ico || '📘'} ${esc(c.name || m.category)}</span>
        ${isNew ? '<span class="chip new">BARU</span>' : ''}
        ${read.has(m.id) ? '<span class="chip" style="color:var(--green)">✓ Dibaca</span>' : ''}
      </div>
      <b class="mat-title">${esc(m.title)}</b>
      <p class="mat-sum">${esc(m.summary)}</p>
      <div class="dim">⏱️ ${m.readMin} menit baca${m.sourcesCount ? ` · 📰 ${m.sourcesCount} sumber` : ''}</div>
    </a>`;
}

export async function renderMateri(app, params) {
  const id = params.get('id');
  if (id) return renderDetail(app, id);
  let tab = ['hari', 'arsip', 'inti'].includes(params.get('tab')) ? params.get('tab') : 'hari';
  let filter = 'all';
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="row between wrap">
      <div><h1 class="h1">📖 Materi belajar</h1><p class="muted" style="margin:0">Rangkuman berita terbaru setiap pagi, tersimpan di arsip + materi inti setiap tes.</p></div>
      <div class="row" style="gap:8px"><div class="tabs" id="matTabs"><button data-t="hari">🗞️ Hari Ini</button><button data-t="arsip">📚 Semua Berita</button><button data-t="inti">📘 Inti</button></div>
      <button class="icon-btn" id="matRefresh" title="Muat ulang" aria-label="Muat ulang">🔄</button></div>
    </div>
    <div id="matBody"><div class="skeleton" style="height:240px"></div></div>
  </section>`;
  const data = await getMaterials(params.get('r') === '1');
  const read = readSet();
  const today = todayKey();
  const grid = list => `<div class="mat-grid">${list.map(m => card(m, read)).join('')}</div>`;
  const draw = () => {
    $$('#matTabs button', app).forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const body = $('#matBody');
    const todays = data.daily.filter(m => m.day === today);
    if (tab === 'inti') { body.innerHTML = grid(data.core); return; }
    if (tab === 'hari') {
      const unread = todays.filter(m => !read.has(m.id)).length;
      body.innerHTML = todays.length ? `
        ${unread ? `<div class="glass bank-card row" style="gap:12px"><span style="font-size:28px">🔔</span><div><b>${unread} materi baru hari ini belum kamu baca</b><div class="dim">Baca 5 menit, lalu langsung latihan soal topiknya.</div></div></div>` : ''}
        <h2 class="h2 mat-day">${esc(dayLabel(today))} <span class="dim" style="font-weight:600">· ${todays.length} materi</span></h2>${grid(todays)}
        ${data.daily.length > todays.length ? `<button class="btn ghost block" id="toArsip" style="margin-top:14px">📚 Lihat ${data.daily.length - todays.length} materi hari sebelumnya</button>` : ''}`
        : `<div class="glass card empty"><div style="font-size:44px">🗞️</div><h2 class="h2">Materi hari ini belum tersedia</h2>
          <p class="muted">Materi baru dibuat otomatis setiap pukul 06.00 WIB dari berita terbaru.${data.daily.length ? ' Sambil menunggu, buka arsip berita sebelumnya.' : ''}</p>
          <div class="row wrap" style="justify-content:center">${data.daily.length ? '<button class="btn sm" id="toArsip">📚 Semua Berita</button>' : ''}<button class="btn ghost sm" id="toInti">📘 Materi Inti</button></div></div>`;
      $('#toArsip')?.addEventListener('click', () => { tab = 'arsip'; draw(); });
      $('#toInti')?.addEventListener('click', () => { tab = 'inti'; draw(); });
      return;
    }
    // Arsip semua berita
    const cats = [...new Set(data.daily.map(m => m.category))];
    const list = data.daily.filter(m => filter === 'all' || m.category === filter);
    const groups = new Map();
    for (const m of list) { const k = m.day || 'lain'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    const max = data.max || 50;
    body.innerHTML = !data.daily.length
      ? `<div class="glass card empty"><div style="font-size:44px">📚</div>Arsip masih kosong. Materi harian akan menumpuk di sini setiap hari.</div>`
      : `<div class="glass card arsip-head">
          <div class="row between wrap" style="gap:10px"><div><b>📚 Arsip berita</b><div class="dim">${data.daily.length} dari maksimal ${max} materi tersimpan · materi terlama terhapus otomatis</div></div>
            <div class="arsip-meter"><i style="width:${Math.min(100, (data.daily.length / max) * 100)}%"></i></div></div>
          <div class="pill-group" style="margin-top:12px" id="catFilter">
            <button class="pill ${filter === 'all' ? 'on' : ''}" data-f="all">Semua</button>
            ${cats.map(c => `<button class="pill ${filter === c ? 'on' : ''}" data-f="${c}">${catByKey[c]?.ico || ''} ${esc(catByKey[c]?.name || c)}</button>`).join('')}
          </div></div>
        ${[...groups.entries()].map(([day, l]) => `<h2 class="h2 mat-day">${esc(dayLabel(day))} <span class="dim" style="font-weight:600">· ${l.length} materi</span></h2>${grid(l)}`).join('') || '<div class="empty">Tidak ada materi untuk topik ini.</div>'}`;
    $$('#catFilter [data-f]', body).forEach(b => (b.onclick = () => { filter = b.dataset.f; draw(); }));
  };
  $$('#matTabs button', app).forEach(b => (b.onclick = () => { tab = b.dataset.t; draw(); history.replaceState(null, '', `#/materi?tab=${tab}`); }));
  $('#matRefresh').onclick = async () => {
    const btn = $('#matRefresh'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span>';
    try { const d = await getMaterials(true); Object.assign(data, d); draw(); toast(`${d.daily.length} materi harian dimuat`, 'ok'); } catch (e) { toast(e.message, 'err'); }
    btn.disabled = false; btn.textContent = '🔄';
  };
  draw();
}

async function renderDetail(app, id) {
  app.innerHTML = '<div class="skeleton" style="height:420px"></div>';
  const { material: m } = await api('/materials?id=' + encodeURIComponent(id));
  const c = catByKey[m.category] || {};
  const read = readSet().has(m.id);
  app.innerHTML = `
  <article class="stack fade-in mat-article">
    <a href="#/materi?tab=${m.core ? 'inti' : m.day === todayKey() ? 'hari' : 'arsip'}" class="link-btn" style="font-size:14px">← Kembali ke materi</a>
    <header class="glass hero-card">
      <div class="row wrap" style="gap:6px">
        <span class="chip">${c.ico || '📘'} ${esc(c.name || m.category)}</span>
        <span class="chip">${m.core ? '📚 Materi Inti' : `🗞️ ${esc(dayLabel(m.day))}`}</span>
        <span class="chip">⏱️ ${m.readMin} menit</span>
      </div>
      <h1 class="h1" style="margin-top:12px">${esc(m.title)}</h1>
      <p class="muted" style="margin:0;font-size:16px">${esc(m.summary)}</p>
    </header>

    ${m.keyPoints?.length ? `<div class="glass card"><h2 class="h2">🎯 Poin kunci</h2>
      <ul class="kp-list">${m.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}

    ${m.sections.map((s, i) => `
      <section class="glass card mat-sec" style="animation-delay:${i * 0.06}s">
        <h2 class="h2"><span class="sec-no">${i + 1}</span>${esc(s.heading)}</h2>
        ${s.body.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}
      </section>`).join('')}

    ${m.glossary?.length ? `<div class="glass card"><h2 class="h2" style="margin-bottom:12px">📒 Istilah penting <span class="dim" style="font-weight:600">· ketuk kartu</span></h2>
      <div class="gloss-grid">${m.glossary.map(g => `
        <button class="gloss" aria-label="${esc(g.term)}"><span class="gloss-in"><span class="gloss-f">${esc(g.term)}</span><span class="gloss-b">${esc(g.def)}</span></span></button>`).join('')}</div></div>` : ''}

    ${m.tips?.length ? `<div class="glass card"><h2 class="h2">💡 Tips menjawab soal</h2>
      <div class="stack" style="gap:8px;margin-top:10px">${m.tips.map(t => `<div class="tip good"><span>✔️</span><span>${esc(t)}</span></div>`).join('')}</div></div>` : ''}

    ${m.sources?.length ? `<div class="glass card"><h2 class="h2">📰 Sumber berita</h2>
      ${m.sources.map(s => `<div class="news-item"><span class="dot"></span><div><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a>
        <div class="dim">${esc(s.publisher || '')}${s.date ? ' · ' + timeAgo(s.date) : ''}</div></div></div>`).join('')}
      <p class="dim" style="margin:10px 0 0">Materi dirangkum otomatis oleh AI dari judul berita. Selalu cek detail di sumber aslinya.</p></div>` : ''}

    <div class="glass start-bar">
      <button class="btn ghost" id="readBtn" ${read ? 'disabled' : ''}>${read ? '✓ Sudah dibaca' : '✓ Tandai dibaca'}</button>
      <a class="btn" style="flex:1" href="#/latihan?category=${m.category}${m.core ? '' : '&fresh=1'}">🎯 Latihan soal topik ini</a>
    </div>
  </article>`;
  $$('.gloss', app).forEach(g => (g.onclick = () => g.classList.toggle('flip')));
  $('#readBtn').onclick = () => {
    markRead(m.id); confetti(50);
    $('#readBtn').disabled = true; $('#readBtn').textContent = '✓ Sudah dibaca';
    toast(session.loggedIn ? 'Mantap! Lanjutkan dengan latihan soalnya 💪' : 'Tersimpan di perangkat ini', 'ok');
  };
}
