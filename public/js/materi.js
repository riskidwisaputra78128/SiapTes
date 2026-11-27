import { api, session, getInfo } from './api.js';
import { $, $$, esc, toast, timeAgo, confetti, countUp, sheet } from './ui.js';
import { addDockAction } from './dock.js';
import { sfx } from './sound.js';
import { catByKey } from './data.js';

const READ_KEY = 'sl_read';
const readSet = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); } };
const markRead = id => { try { const s = readSet(); s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-500))); } catch {} };

// Misi belajar interaktif per materi (disimpan di perangkat)
const MIS_KEY = 'sl_mis:';
const misLoad = id => { try { return JSON.parse(localStorage.getItem(MIS_KEY + id) || '{}'); } catch { return {}; } };
const misSave = (id, o) => { try { localStorage.setItem(MIS_KEY + id, JSON.stringify(o)); } catch {} };

const todayKey = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
function dayLabel(day) {
  if (!day) return '';
  const t = todayKey();
  const y = new Date(Date.parse(t) - 86400e3).toISOString().slice(0, 10);
  if (day === t) return 'Hari ini';
  if (day === y) return 'Kemarin';
  return new Date(day + 'T00:00:00+07:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

// isi materi yang sudah pernah dibuka disimpan di perangkat (12 jam) → dibuka lagi tanpa minta ke server
const MAT_KEY = 'sl_mat2:', MAT_TTL = 12 * 3600e3;
async function materialById(id) {
  try { const o = JSON.parse(localStorage.getItem(MAT_KEY + id) || 'null'); if (o && Date.now() - o.at < MAT_TTL && o.d?.material) return o.d; } catch {}
  const d = await api('/materials?id=' + encodeURIComponent(id));
  try {
    localStorage.setItem(MAT_KEY + id, JSON.stringify({ at: Date.now(), d }));
    const keys = Object.keys(localStorage).filter(k => k.startsWith(MAT_KEY));
    if (keys.length > 40) keys.map(k => [k, JSON.parse(localStorage.getItem(k) || '{}').at || 0]).sort((a, b) => a[1] - b[1]).slice(0, keys.length - 40).forEach(([k]) => localStorage.removeItem(k));
  } catch {}
  return d;
}
const dropMat = id => { try { localStorage.removeItem(MAT_KEY + id); } catch {} };

let listCache = null;
export async function getMaterials(force = false) {
  if (!listCache || force || Date.now() - listCache.at > 60000) listCache = { at: Date.now(), p: api('/materials' + (force ? '?t=' + Date.now() : '')).catch(e => { listCache = null; throw e; }) };
  return listCache.p;
}

const catArt = cat => `/img/cat/${catByKey[cat] ? cat : 'isu'}.svg`;
function coverImg(m) {
  const fb = catArt(m.category);
  return m.cover
    ? `<img src="${esc(m.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fb}'">`
    : `<img src="${fb}" alt="" loading="lazy">`;
}
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Kuis cek pemahaman: dari AI bila ada, kalau tidak dibuat dari daftar istilah
function quizOf(m) {
  if (m.quiz?.length) return m.quiz;
  const g = (m.glossary || []).filter(x => x.term && x.def);
  if (g.length < 3) return [];
  return shuffle(g).slice(0, 3).map(t => {
    const opts = shuffle([t, ...shuffle(g.filter(x => x !== t)).slice(0, 3)]);
    return { q: `Apa yang dimaksud dengan “${t.term}”?`, options: opts.map(x => x.def), answer: opts.indexOf(t), why: `${t.term}: ${t.def}` };
  });
}

const isAdminUser = () => !!session.user?.admin;

/* ───── AI pendamping materi ───── */
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-•]\s+(.*)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, x => `<ul>${x}</ul>`).replace(/\n/g, '<br>').replace(/<\/li><br>/g, '</li>').replace(/<\/ul><br>/g, '</ul>');
const STARTERS = ['Jelaskan materi ini dengan sederhana', 'Apa jebakan soal yang sering muncul?', 'Beri aku 1 contoh soal latihan', 'Ringkas jadi 3 poin penting'];
function openTutor(m) {
  if ($('#tutor')) { $('#tutor').classList.add('open'); $('#tutorIn')?.focus(); return; }
  const key = 'sl_tutor_' + m.id;
  let hist = []; try { hist = JSON.parse(sessionStorage.getItem(key) || '[]'); } catch {}
  const el = document.createElement('aside');
  el.id = 'tutor'; el.className = 'tutor glass';
  el.innerHTML = `
    <header class="tutor-head"><span class="tutor-av">🤖</span><div style="flex:1;min-width:0"><b>Mentor AI</b><div class="dim tutor-sub">${esc(m.title)}</div><div class="tutor-left" id="tutorLeft"></div></div>
      <button class="tutor-x" aria-label="Tutup">✕</button></header>
    <div class="tutor-log" id="tutorLog"></div>
    <div class="tutor-sug" id="tutorSug"></div>
    <form class="tutor-form" id="tutorForm"><input id="tutorIn" maxlength="600" placeholder="${session.loggedIn ? 'Tanya apa saja tentang materi ini…' : 'Masuk akun untuk bertanya ke AI'}" ${session.loggedIn ? '' : 'disabled'} autocomplete="off">
      <button class="btn sm" id="tutorSend" ${session.loggedIn ? '' : 'disabled'} aria-label="Kirim">➤</button></form>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const log = $('#tutorLog', el), sug = $('#tutorSug', el), input = $('#tutorIn', el);
  const bubble = (role, html) => { const d = document.createElement('div'); d.className = 'tmsg ' + role; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  const chips = list => { sug.innerHTML = list.map(t => `<button class="pill sm" data-q="${esc(t)}">${esc(t)}</button>`).join(''); $$('[data-q]', sug).forEach(b => (b.onclick = () => ask(b.dataset.q))); };
  bubble('ai', `Hai${session.user?.name ? ' ' + esc(session.user.name.split(' ')[0]) : ''}! 👋 Aku mentor AI untuk materi <b>${esc(m.title)}</b>. Tanyakan apa saja yang belum jelas, minta contoh soal, atau minta penjelasan yang lebih sederhana.`);
  hist.forEach(h => bubble(h.role, h.role === 'ai' ? md(h.text) : esc(h.text)));
  chips(session.loggedIn ? STARTERS : []);
  if (!session.loggedIn) bubble('ai', '🔒 Fitur ini khusus pengguna yang sudah masuk akun. <a href="#/login">Masuk sekarang</a>');
  let busy = false;
  async function ask(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    busy = true; input.value = ''; sug.innerHTML = '';
    bubble('me', esc(text)); const wait = bubble('ai typing', '<span></span><span></span><span></span>');
    try {
      const r = await api('/grade', { method: 'POST', body: { action: 'tutor', materialId: m.id, message: text, history: hist } });
      wait.remove(); bubble('ai', md(r.answer) + (r.cached ? '<small class="tmsg-tag">⚡ jawaban tersimpan · tidak mengurangi jatah</small>' : ''));
      if (r.left != null) $('#tutorLeft', el).textContent = `Sisa ${r.left} pertanyaan hari ini`;
      hist.push({ role: 'me', text }, { role: 'ai', text: r.answer }); hist = hist.slice(-12);
      try { sessionStorage.setItem(key, JSON.stringify(hist)); } catch {}
      chips(r.followups?.length ? r.followups : STARTERS.slice(0, 2));
      sfx('send');
    } catch (e) { wait.remove(); bubble('ai err', '⚠️ ' + esc(e.message)); chips(STARTERS.slice(0, 2)); }
    busy = false; input.focus();
  }
  $('#tutorForm', el).onsubmit = e => { e.preventDefault(); ask(input.value); };
  $('.tutor-x', el).onclick = () => el.classList.remove('open');
  const cleanup = () => { if (!location.hash.includes('id=' + encodeURIComponent(m.id))) { el.remove(); removeEventListener('hashchange', cleanup); } };
  addEventListener('hashchange', cleanup);
  setTimeout(() => input.focus(), 250);
}
// konfirmasi lalu hapus (khusus admin)
function askDelete(m, onDone) {
  sheet(`<h3 class="h2">🗑️ Hapus materi?</h3>
    <p class="muted" style="margin:6px 0 4px"><b>${esc(m.title)}</b></p>
    <p class="dim" style="margin:0 0 14px">Materi akan dihapus permanen dari arsip untuk semua pengguna dan tidak bisa dikembalikan.</p>
    <div class="row" style="gap:8px"><button class="btn ghost" id="dNo" style="flex:1">Batal</button><button class="btn danger" id="dYes" style="flex:1">Hapus permanen</button></div>`,
  (el, close) => {
    $('#dNo', el).onclick = close;
    $('#dYes', el).onclick = async () => {
      const b = $('#dYes', el); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Menghapus…';
      try { await api('/materials?id=' + encodeURIComponent(m.id), { method: 'DELETE' }); listCache = null; dropMat(m.id); close(); toast('Materi dihapus', 'ok'); onDone?.(); }
      catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Hapus permanen'; }
    };
  });
}

function card(m, read) {
  const c = catByKey[m.category] || {};
  const isNew = m.day === todayKey();
  return `
    <a class="glass mat-card has-cover tilt ${read.has(m.id) ? 'read' : ''}" href="#/materi?id=${encodeURIComponent(m.id)}">
      <span class="mat-cover">${coverImg(m)}${m.extras ? '<span class="mat-badge">✨ Interaktif</span>' : ''}${isAdminUser() && !m.core ? `<button class="mat-del" data-del="${esc(m.id)}" title="Hapus materi" aria-label="Hapus materi">🗑️</button>` : ''}</span>
      <div class="row wrap" style="gap:6px">
        <span class="chip">${c.ico || '📘'} ${esc(c.name || m.category)}</span>
        ${m.basis === 'dasar' ? '<span class="chip basis-d">📚 Dasar</span>' : m.basis === 'terkini' ? '<span class="chip basis-t">🗞️ Terkini</span>' : ''}
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
  let filter = 'all', bfilter = 'all';
  app.innerHTML = `
  <section class="stack fade-in">
    <div class="row between wrap">
      <div><h1 class="h1">📖 Materi belajar</h1><p class="muted" style="margin:0">Modul pengetahuan dasar & rangkuman update terkini, tersimpan di arsip + materi inti setiap tes.</p></div>
      <div class="row" style="gap:8px"><div class="tabs" id="matTabs"><button data-t="hari">🗞️ Hari Ini</button><button data-t="arsip">🗂️ Semua Materi</button><button data-t="inti">📘 Inti</button></div>
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
    const list = data.daily.filter(m => (filter === 'all' || m.category === filter) && (bfilter === 'all' || m.basis === bfilter));
    const groups = new Map();
    for (const m of list) { const k = m.day || 'lain'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    const max = data.max || 50;
    body.innerHTML = !data.daily.length
      ? `<div class="glass card empty"><div style="font-size:44px">📚</div>Arsip masih kosong. Materi harian akan menumpuk di sini setiap hari.</div>`
      : `<div class="glass card arsip-head">
          <div class="row between wrap" style="gap:10px"><div><b>🗂️ Arsip materi</b><div class="dim">${data.daily.length} dari maksimal ${max} materi tersimpan · materi terlama terhapus otomatis</div></div>
            <div class="arsip-meter"><i style="width:${Math.min(100, (data.daily.length / max) * 100)}%"></i></div></div>
          <div class="pill-group" style="margin-top:12px" id="basisFilter">
            ${[['all', 'Semua jenis'], ['dasar', '📚 Pengetahuan dasar'], ['terkini', '🗞️ Update terkini']].map(([k, l]) => `<button class="pill ${bfilter === k ? 'on' : ''}" data-b="${k}">${l}</button>`).join('')}
          </div>
          <div class="pill-group" style="margin-top:8px" id="catFilter">
            <button class="pill ${filter === 'all' ? 'on' : ''}" data-f="all">Semua</button>
            ${cats.map(c => `<button class="pill ${filter === c ? 'on' : ''}" data-f="${c}">${catByKey[c]?.ico || ''} ${esc(catByKey[c]?.name || c)}</button>`).join('')}
          </div></div>
        ${[...groups.entries()].map(([day, l]) => `<h2 class="h2 mat-day">${esc(dayLabel(day))} <span class="dim" style="font-weight:600">· ${l.length} materi</span></h2>${grid(l)}`).join('') || '<div class="empty">Tidak ada materi untuk topik ini.</div>'}`;
    $$('#catFilter [data-f]', body).forEach(b => (b.onclick = () => { filter = b.dataset.f; draw(); }));
    $$('#basisFilter [data-b]', body).forEach(b => (b.onclick = () => { bfilter = b.dataset.b; draw(); }));
  };
  $$('#matTabs button', app).forEach(b => (b.onclick = () => { tab = b.dataset.t; draw(); history.replaceState(null, '', `#/materi?tab=${tab}`); }));
  $('#matBody').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const m = [...data.daily].find(x => x.id === b.dataset.del); if (!m) return;
    askDelete(m, async () => { const d = await getMaterials(true); Object.assign(data, d); draw(); });
  });
  $('#matRefresh').onclick = async () => {
    const btn = $('#matRefresh'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span>';
    try { const d = await getMaterials(true); Object.assign(data, d); draw(); toast(`${d.daily.length} materi harian dimuat`, 'ok'); } catch (e) { toast(e.message, 'err'); }
    btn.disabled = false; btn.textContent = '🔄';
  };
  draw();
}

async function renderDetail(app, id) {
  app.innerHTML = '<div class="skeleton" style="height:420px"></div>';
  const { material: m } = await materialById(id);
  const c = catByKey[m.category] || {};
  const read = readSet().has(m.id);
  const imgs = (m.images || []).filter(x => x.url !== m.cover);
  const quiz = quizOf(m);
  const fig = (im, i) => `<figure class="glass mat-fig" style="animation-delay:${i * .05}s">
      <img src="${esc(im.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">
      <figcaption><span>📷 ${esc(im.title)}</span>${im.link ? `<a href="${esc(im.link)}" target="_blank" rel="noopener">${esc(im.source || 'Sumber')} ↗</a>` : ''}</figcaption></figure>`;
  const srcThumb = s => {
    const im = s.image || (m.images || []).find(x => x.link === s.link)?.url;
    return `<span class="news-thumb">${im ? `<img src="${esc(im)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${catArt(m.category)}'">` : `<img src="${catArt(m.category)}" alt="">`}</span>`;
  };
  app.innerHTML = `
  <div class="read-progress"><i id="readProg"></i></div>
  <article class="stack fade-in mat-article">
    <div class="row between"><a href="#/materi?tab=${m.core ? 'inti' : m.day === todayKey() ? 'hari' : 'arsip'}" class="link-btn" style="font-size:14px">← Kembali ke materi</a>
      ${isAdminUser() && !m.core ? '<button class="btn ghost sm" id="delMat">🗑️ Hapus materi</button>' : ''}</div>
    <header class="glass mat-hero">
      <div class="mat-hero-img">${coverImg(m)}</div>
      <div class="mat-hero-body">
        <div class="row wrap" style="gap:6px">
          <span class="chip">${c.ico || '📘'} ${esc(c.name || m.category)}</span>
          <span class="chip">${m.core ? '📘 Materi Inti' : m.basis === 'dasar' ? `📚 Pengetahuan dasar · ${esc(dayLabel(m.day))}` : `🗞️ Update terkini · ${esc(dayLabel(m.day))}`}</span>
          <span class="chip">⏱️ ${m.readMin} menit</span>
        </div>
        <h1 class="h1" style="margin-top:12px">${esc(m.title)}</h1>
        <p class="muted" style="margin:0;font-size:16px">${esc(m.summary)}</p>
        <button class="btn sm tutor-cta" id="tutorBtn" style="margin-top:14px" hidden>🤖 Tanya Mentor AI tentang materi ini</button>
      </div>
    </header>

    <div class="glass mission" id="mission"></div>

    ${m.sections.length > 1 ? `<nav class="sec-nav" id="secNav">${m.sections.map((s, i) => `<button data-go="${i}"><span>${i + 1}</span>${esc(s.heading)}</button>`).join('')}</nav>` : ''}

    ${m.stats?.length ? `<div class="glass card"><h2 class="h2">🔢 Angka penting <span class="dim" style="font-weight:600">· tebak dulu, lalu ketuk untuk membuka</span></h2>
      <div class="stat-strip">${m.stats.map((st, i) => {
      const n = parseFloat(String(st.value).replace(/\./g, '').replace(',', '.'));
      return `<button class="glass mstat hid" data-st="${i}"><span class="mstat-ico">${esc(st.icon || '📊')}</span>
        <div class="mstat-v"><b data-n="${isFinite(n) && /^[\d.,]+$/.test(st.value) ? n : ''}" data-raw="${esc(st.value)}">${esc(st.value)}</b><small>${esc(st.unit || '')}</small><em class="mstat-q">❓ ketuk</em></div>
        <div class="mstat-l">${esc(st.label)}</div></button>`; }).join('')}</div></div>` : ''}

    ${m.keyPoints?.length ? `<div class="glass card" id="kpBox"><div class="row between wrap"><h2 class="h2">🎯 Poin kunci <span class="dim" style="font-weight:600">· kartu hafalan</span></h2>
        <button class="link-btn" id="kpAll" style="font-size:13px">Lihat semua</button></div>
      <div class="kp-deck" id="kpDeck"></div>
      <div class="kp-cards" id="kpList" hidden>${m.keyPoints.map((k, i) => `<div class="kp-card" style="--d:${i * .07}s"><span class="kp-n">${i + 1}</span><span>${esc(k)}</span></div>`).join('')}</div></div>` : ''}

    ${m.flow?.length ? `<div class="glass card" id="flowBox"><div class="row between wrap"><h2 class="h2">🔗 Alur / urutan <span class="dim" style="font-weight:600" id="flowHint">· susun urutan yang benar</span></h2>
        <button class="link-btn" id="flowSkip" style="font-size:13px">Lewati</button></div>
      <div id="flowGame"><div class="flow-slots" id="flowSlots">${m.flow.map((_, i) => `<span class="flow-slot">${i + 1}</span>`).join('')}</div>
        <div class="flow-pool" id="flowPool"></div></div>
      <div id="flowView" hidden><div class="flow">${m.flow.map((f, i) => `<button class="flow-step ${i === 0 ? 'on' : ''}" data-i="${i}"><span class="flow-ico">${esc(f.icon || '➡️')}</span><b>${esc(f.title)}</b></button>${i < m.flow.length - 1 ? '<span class="flow-arrow">➜</span>' : ''}`).join('')}</div>
      <div class="flow-desc" id="flowDesc">${esc(m.flow[0].desc || '')}</div></div></div>` : ''}

    ${m.sections.map((s, i) => { const im = imgs[i]; return `
      <section class="glass card mat-sec ${im ? 'with-img' : ''}" id="sec${i}" data-sec="${i}" style="animation-delay:${i * 0.06}s">
        ${im ? `<a class="sec-img" href="${esc(im.link || '#')}" target="_blank" rel="noopener"><img src="${esc(im.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.mat-sec').classList.remove('with-img');this.parentNode.remove()"><span>📷 ${esc(im.source || 'Sumber')}</span></a>` : ''}
        <div class="sec-txt"><h2 class="h2"><span class="sec-no">${s.icon ? esc(s.icon) : i + 1}</span>${esc(s.heading)}</h2>
        ${s.body.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}
        <button class="sec-ok" data-ok="${i}">✓ Saya paham bagian ini</button></div>
      </section>`; }).join('')}

    ${m.tf?.length ? `<div class="glass card" id="tfBox"><div class="row between"><h2 class="h2">⚖️ Benar atau Salah?</h2><span class="chip" id="tfScore">0/${m.tf.length}</span></div>
      ${m.tf.map((t, i) => `<div class="tf-row" data-i="${i}"><p>${esc(t.s)}</p>
        <div class="tf-btns"><button data-v="1">✅ Benar</button><button data-v="0">❌ Salah</button></div><div class="tf-why" hidden></div></div>`).join('')}</div>` : ''}

    ${m.glossary?.length ? `<div class="glass card" id="glBox"><div class="row between wrap" style="margin-bottom:12px"><h2 class="h2">📒 Istilah penting</h2>
        ${m.glossary.length >= 3 ? '<div class="seg" id="glSeg"><button class="on" data-v="cards">Kartu</button><button data-v="match">🧩 Cocokkan</button></div>' : ''}</div>
      <div class="gl-match" id="glMatch" hidden></div>
      <div class="gloss-grid" id="glCards">${m.glossary.map(g => `
        <button class="gloss" aria-label="${esc(g.term)}"><span class="gloss-in"><span class="gloss-f">${esc(g.term)}</span><span class="gloss-b">${esc(g.def)}</span></span></button>`).join('')}</div></div>` : ''}

    ${quiz.length ? `<div class="glass card" id="mq"><div class="row between"><h2 class="h2">🧠 Cek pemahaman</h2><span class="row" style="gap:6px"><button class="link-btn" id="mqRetry" hidden style="font-size:13px">↺ Ulangi</button><span class="chip" id="mqScore">0/${quiz.length}</span></span></div>
      ${quiz.map((q, i) => `<div class="mq" data-i="${i}"><b class="mq-q">${i + 1}. ${esc(q.q)}</b>
        <div class="mq-opts">${q.options.map((o, j) => `<button class="mq-opt" data-j="${j}"><span class="mq-l">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="mq-why" hidden></div></div>`).join('')}</div>` : ''}

    ${m.tips?.length ? `<div class="glass card"><h2 class="h2">💡 Tips menjawab soal</h2>
      <div class="stack" style="gap:8px;margin-top:10px">${m.tips.map(t => `<div class="tip good"><span>✔️</span><span>${esc(t)}</span></div>`).join('')}</div></div>` : ''}

    ${m.refs?.length ? `<div class="glass card"><h2 class="h2">📚 Rujukan untuk dipelajari</h2>
      <ul class="refs">${m.refs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="dim" style="margin:8px 0 0">Modul disusun AI dari pengetahuan dasar yang mapan. Cek kembali detailnya di rujukan resmi.</p></div>` : ''}
    ${m.sources?.length ? `<div class="glass card"><h2 class="h2">📰 Sumber berita</h2>
      ${m.sources.map(s => `<a class="news-item" href="${esc(s.link)}" target="_blank" rel="noopener">${srcThumb(s)}<div style="min-width:0"><span class="nt">${esc(s.title)}</span>
        <div class="dim">${esc(s.publisher || '')}${s.date ? ' · ' + timeAgo(s.date) : ''}</div></div></a>`).join('')}
      <p class="dim" style="margin:10px 0 0">Materi dirangkum otomatis oleh AI dari judul berita. Selalu cek detail di sumber aslinya.</p></div>` : ''}

    <div class="glass start-bar">
      <button class="btn ghost" id="readBtn" ${read ? 'disabled' : ''}>${read ? '✓ Sudah dibaca' : '✓ Tandai dibaca'}</button>
      <a class="btn" style="flex:1" href="#/latihan?category=${m.category}${m.core ? '' : '&fresh=1'}">🎯 Latihan soal topik ini</a>
    </div>
  </article>`;

  // ───── Misi belajar: progres aktivitas interaktif ─────
  const mis = misLoad(m.id);
  mis.sec = mis.sec || [];
  const acts = [
    { k: 'sec', ico: '📖', name: 'Pahami tiap bagian', n: m.sections.length, go: '#sec0' },
    m.stats?.length && { k: 'stats', ico: '🔢', name: 'Tebak angka penting', go: '.stat-strip' },
    m.keyPoints?.length && { k: 'kp', ico: '🃏', name: 'Kartu poin kunci', go: '#kpBox' },
    m.flow?.length && { k: 'flow', ico: '🔗', name: 'Susun alur', go: '#flowBox' },
    m.tf?.length && { k: 'tf', ico: '⚖️', name: 'Benar atau Salah', go: '#tfBox' },
    m.glossary?.length >= 3 && { k: 'gl', ico: '🧩', name: 'Cocokkan istilah', go: '#glBox' },
    quiz.length && { k: 'quiz', ico: '🧠', name: 'Cek pemahaman', go: '#mq' },
  ].filter(Boolean);
  const isDone = a => (a.k === 'sec' ? mis.sec.length >= a.n : !!mis[a.k]);
  function paintMission() {
    const el = $('#mission'); if (!el) return;
    const done = acts.filter(isDone).length, pct = Math.round((done / acts.length) * 100);
    el.innerHTML = `<div class="row between wrap" style="gap:8px"><b>🚀 Misi belajar</b><span class="dim">${done}/${acts.length} selesai · ${pct}%</span></div>
      <div class="mis-bar"><i style="width:${pct}%"></i></div>
      <div class="mis-list">${acts.map(a => `<button class="mis-item ${isDone(a) ? 'ok' : ''}" data-go="${a.go}"><span>${isDone(a) ? '✅' : a.ico}</span>${a.name}${a.k === 'sec' ? ` <small>${Math.min(mis.sec.length, a.n)}/${a.n}</small>` : ''}</button>`).join('')}</div>`;
    $$('.mis-item', el).forEach(b => (b.onclick = () => document.querySelector(b.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  }
  function complete(k, val = true) {
    if (k !== 'sec') { if (mis[k]) return; mis[k] = val; }
    misSave(m.id, mis); paintMission();
    if (acts.every(isDone) && !mis.allDone) {
      mis.allDone = true; misSave(m.id, mis);
      markRead(m.id); confetti(120); setTimeout(() => sfx('win'), 200);
      toast('🏆 Misi belajar selesai! Materi otomatis ditandai dibaca.', 'ok');
      const rb = $('#readBtn'); if (rb) { rb.disabled = true; rb.textContent = '✓ Sudah dibaca'; }
    }
  }
  paintMission();

  // bagian: tombol paham + navigasi
  const paintSec = () => $$('.mat-sec', app).forEach(sec => {
    const i = +sec.dataset.sec, ok = mis.sec.includes(i);
    sec.classList.toggle('done', ok);
    const b = $('.sec-ok', sec); if (b) b.textContent = ok ? '✅ Sudah paham' : '✓ Saya paham bagian ini';
    $(`#secNav [data-go="${i}"]`)?.classList.toggle('ok', ok);
  });
  $$('.sec-ok', app).forEach(b => (b.onclick = () => {
    const i = +b.dataset.ok;
    if (!mis.sec.includes(i)) { mis.sec.push(i); sfx('pop'); }
    paintSec(); complete('sec');
    const next = $(`#sec${i + 1}`); if (next) setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  }));
  $$('#secNav button', app).forEach(b => (b.onclick = () => $(`#sec${b.dataset.go}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
  paintSec();

  // angka penting: tebak lalu buka
  const revealStat = el => {
    if (!el.classList.contains('hid')) return;
    el.classList.remove('hid'); sfx('pop');
    const b = $('.mstat-v b', el), n = parseFloat(b.dataset.n);
    if (isFinite(n) && !(n % 1)) { countUp(b, n); setTimeout(() => (b.textContent = b.dataset.raw), 1000); }
    if (!$$('.mstat.hid', app).length) complete('stats');
  };
  $$('.mstat', app).forEach(el => (el.onclick = () => revealStat(el)));
  if (mis.stats) $$('.mstat', app).forEach(el => el.classList.remove('hid'));

  // poin kunci: kartu hafalan
  if (m.keyPoints?.length) {
    let ki = 0; const known = new Set();
    const deck = $('#kpDeck');
    const drawKp = () => {
      if (ki >= m.keyPoints.length) {
        deck.innerHTML = `<div class="kp-done"><b>🎉 Semua kartu sudah dilihat</b><span class="dim">${known.size}/${m.keyPoints.length} ditandai hafal</span><button class="btn ghost sm" id="kpAgain">↺ Ulangi kartu</button></div>`;
        $('#kpAgain').onclick = () => { ki = 0; known.clear(); drawKp(); };
        complete('kp'); return;
      }
      deck.innerHTML = `<div class="kp-flash" id="kpCard"><span class="kp-n">${ki + 1}/${m.keyPoints.length}</span>
          <div class="kp-front">🤔 Coba ingat poin kunci #${ki + 1}…<small>ketuk kartu untuk membuka</small></div>
          <div class="kp-back">${esc(m.keyPoints[ki])}</div></div>
        <div class="kp-acts" hidden><button class="btn ghost sm" data-k="0">Belum hafal</button><button class="btn sm" data-k="1">Sudah hafal ✓</button></div>`;
      const card = $('#kpCard');
      card.onclick = () => { card.classList.add('open'); $('.kp-acts', deck).hidden = false; sfx('pop'); };
      $$('.kp-acts button', deck).forEach(b => (b.onclick = () => { if (b.dataset.k === '1') known.add(ki); ki++; drawKp(); }));
    };
    drawKp();
    $('#kpAll').onclick = () => { const l = $('#kpList'); l.hidden = !l.hidden; $('#kpAll').textContent = l.hidden ? 'Lihat semua' : 'Sembunyikan'; };
  }

  // alur: susun urutan yang benar
  if (m.flow?.length) {
    const showFlowView = () => { $('#flowGame').hidden = true; $('#flowView').hidden = false; $('#flowSkip').hidden = true; $('#flowHint').textContent = '· ketuk tiap langkah'; };
    let need = 0;
    const order = shuffle(m.flow.map((_, i) => i));
    $('#flowPool').innerHTML = order.map(i => `<button class="flow-chip" data-i="${i}">${esc(m.flow[i].icon || '➡️')} ${esc(m.flow[i].title)}</button>`).join('');
    $$('.flow-chip', app).forEach(b => (b.onclick = () => {
      const i = +b.dataset.i;
      if (i !== need) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); sfx('wrong'); return; }
      const slot = $$('.flow-slot', app)[need]; slot.innerHTML = `${esc(m.flow[i].icon || '➡️')} ${esc(m.flow[i].title)}`; slot.classList.add('ok');
      b.remove(); sfx('correct'); need++;
      if (need === m.flow.length) { setTimeout(showFlowView, 650); toast('🔗 Urutan tepat!', 'ok'); complete('flow'); }
    }));
    $('#flowSkip').onclick = () => { showFlowView(); };
    if (mis.flow) showFlowView();
    $$('.flow-step', app).forEach(b => (b.onclick = () => {
      $$('.flow-step', app).forEach(x => x.classList.toggle('on', x === b));
      const d = $('#flowDesc'); d.classList.remove('pop'); void d.offsetWidth; d.textContent = m.flow[+b.dataset.i].desc || ''; d.classList.add('pop');
    }));
  }

  // benar atau salah
  if (m.tf?.length) {
    let tfOk = 0, tfDone = 0;
    $$('.tf-row', app).forEach(row => {
      const t = m.tf[+row.dataset.i];
      $$('.tf-btns button', row).forEach(b => (b.onclick = () => {
        if (row.dataset.done) return; row.dataset.done = '1'; tfDone++;
        const ok = (b.dataset.v === '1') === !!t.ok; if (ok) tfOk++;
        sfx(ok ? 'correct' : 'wrong');
        $$('.tf-btns button', row).forEach(x => { x.disabled = true; if ((x.dataset.v === '1') === !!t.ok) x.classList.add('ok'); else if (x === b) x.classList.add('no'); });
        const w = $('.tf-why', row); w.hidden = false; w.className = 'tf-why ' + (ok ? 'ok' : 'no');
        w.textContent = `${ok ? '✅ Tepat!' : '❌ Kurang tepat.'} Pernyataan ini ${t.ok ? 'BENAR' : 'SALAH'}. ${t.why || ''}`;
        $('#tfScore').textContent = `${tfOk}/${m.tf.length}`;
        if (tfDone === m.tf.length) complete('tf');
      }));
    });
  }

  // istilah: kartu balik + permainan cocokkan
  $$('.gloss', app).forEach(g => (g.onclick = () => g.classList.toggle('flip')));
  if (m.glossary?.length >= 3) {
    const pairs = shuffle(m.glossary).slice(0, 5);
    const buildMatch = () => {
      const defs = shuffle(pairs.map((_, i) => i));
      $('#glMatch').innerHTML = `<p class="dim" style="margin:0 0 10px">Ketuk satu istilah, lalu ketuk definisinya.</p>
        <div class="glm-cols"><div>${pairs.map((g, i) => `<button class="glm t" data-i="${i}">${esc(g.term)}</button>`).join('')}</div>
        <div>${defs.map(i => `<button class="glm d" data-i="${i}">${esc(pairs[i].def)}</button>`).join('')}</div></div>`;
      let pick = null, got = 0;
      $$('.glm.t', app).forEach(b => (b.onclick = () => { if (b.classList.contains('ok')) return; $$('.glm.t', app).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); pick = b; sfx('click'); }));
      $$('.glm.d', app).forEach(b => (b.onclick = () => {
        if (!pick || b.classList.contains('ok')) return;
        if (b.dataset.i === pick.dataset.i) {
          b.classList.add('ok'); pick.classList.add('ok'); pick.classList.remove('sel'); pick = null; got++; sfx('correct');
          if (got === pairs.length) { toast('🧩 Semua istilah cocok!', 'ok'); complete('gl'); }
        } else { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); sfx('wrong'); }
      }));
    };
    $$('#glSeg button', app).forEach(b => (b.onclick = () => {
      $$('#glSeg button', app).forEach(x => x.classList.toggle('on', x === b));
      const match = b.dataset.v === 'match';
      $('#glCards').hidden = match; $('#glMatch').hidden = !match;
      if (match && !$('#glMatch').innerHTML) buildMatch();
    }));
  }

  // kuis
  let score = 0, answered = 0;
  $('#mqRetry')?.addEventListener('click', () => renderDetail(app, id).then(() => $('#mq')?.scrollIntoView({ block: 'center' })));
  $$('.mq', app).forEach(box => {
    const q = quiz[+box.dataset.i];
    $$('.mq-opt', box).forEach(o => (o.onclick = () => {
      if (box.dataset.done) return; box.dataset.done = '1'; answered++;
      const j = +o.dataset.j, ok = j === q.answer;
      if (ok) score++;
      sfx(ok ? 'correct' : 'wrong');
      $$('.mq-opt', box).forEach((x, k) => { x.disabled = true; if (k === q.answer) x.classList.add('ok'); else if (x === o) x.classList.add('no'); });
      const w = $('.mq-why', box); w.hidden = false; w.className = 'mq-why ' + (ok ? 'ok' : 'no');
      w.textContent = (ok ? '✅ Benar! ' : '❌ Kurang tepat. ') + (q.why || '');
      $('#mqScore').textContent = `${score}/${quiz.length}`;
      if (answered === quiz.length) { complete('quiz', score); $('#mqRetry').hidden = false; if (score === quiz.length) { confetti(70); setTimeout(() => sfx('win'), 300); toast('Sempurna! Kamu paham materi ini 🎉', 'ok'); } else toast(`Skor ${score}/${quiz.length}. Baca ulang bagian yang salah ya 💪`); }
    }));
  });
  // progres baca
  const prog = () => {
    const el = $('#readProg'); if (!el) return removeEventListener('scroll', prog);
    const h = document.documentElement.scrollHeight - innerHeight;
    el.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 100) + '%';
  };
  addEventListener('scroll', prog, { passive: true }); prog();
  // tombol Mentor AI hanya tampil bila diaktifkan admin
  getInfo().then(d => {
    if (d?.settings?.tutorEnabled === false || !document.body.contains($('#tutorBtn'))) return;
    $('#tutorBtn').hidden = false; $('#tutorBtn').onclick = () => openTutor(m);
    addDockAction('tutorFab', '🤖<span>Tanya AI</span>', () => openTutor(m), 'Tanya Mentor AI tentang materi ini');
  }).catch(() => {});
  $('#delMat')?.addEventListener('click', () => askDelete(m, () => { location.hash = '#/materi?tab=arsip&r=1'; }));
  $('#readBtn').onclick = () => {
    markRead(m.id); confetti(50);
    $('#readBtn').disabled = true; $('#readBtn').textContent = '✓ Sudah dibaca';
    toast(session.loggedIn ? 'Mantap! Lanjutkan dengan latihan soalnya 💪' : 'Tersimpan di perangkat ini', 'ok');
  };
}
