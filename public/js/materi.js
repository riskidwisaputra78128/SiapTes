import { api, session } from './api.js';
import { $, $$, esc, toast, timeAgo, confetti, countUp } from './ui.js';
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

function card(m, read) {
  const c = catByKey[m.category] || {};
  const isNew = m.day === todayKey();
  return `
    <a class="glass mat-card has-cover tilt ${read.has(m.id) ? 'read' : ''}" href="#/materi?id=${encodeURIComponent(m.id)}">
      <span class="mat-cover">${coverImg(m)}${m.extras ? '<span class="mat-badge">✨ Interaktif</span>' : ''}</span>
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
    <a href="#/materi?tab=${m.core ? 'inti' : m.day === todayKey() ? 'hari' : 'arsip'}" class="link-btn" style="font-size:14px">← Kembali ke materi</a>
    <header class="glass mat-hero">
      <div class="mat-hero-img">${coverImg(m)}</div>
      <div class="mat-hero-body">
        <div class="row wrap" style="gap:6px">
          <span class="chip">${c.ico || '📘'} ${esc(c.name || m.category)}</span>
          <span class="chip">${m.core ? '📚 Materi Inti' : `🗞️ ${esc(dayLabel(m.day))}`}</span>
          <span class="chip">⏱️ ${m.readMin} menit</span>
        </div>
        <h1 class="h1" style="margin-top:12px">${esc(m.title)}</h1>
        <p class="muted" style="margin:0;font-size:16px">${esc(m.summary)}</p>
      </div>
    </header>

    ${m.stats?.length ? `<div class="stat-strip">${m.stats.map(st => {
      const n = parseFloat(String(st.value).replace(/\./g, '').replace(',', '.'));
      return `<div class="glass mstat"><span class="mstat-ico">${esc(st.icon || '📊')}</span>
        <div class="mstat-v"><b data-n="${isFinite(n) && /^[\d.,]+$/.test(st.value) ? n : ''}" data-raw="${esc(st.value)}">${esc(st.value)}</b><small>${esc(st.unit || '')}</small></div>
        <div class="mstat-l">${esc(st.label)}</div></div>`; }).join('')}</div>` : ''}

    ${m.keyPoints?.length ? `<div class="glass card"><h2 class="h2">🎯 Poin kunci</h2>
      <div class="kp-cards">${m.keyPoints.map((k, i) => `<div class="kp-card" style="--d:${i * .07}s"><span class="kp-n">${i + 1}</span><span>${esc(k)}</span></div>`).join('')}</div></div>` : ''}

    ${m.flow?.length ? `<div class="glass card"><h2 class="h2">🔗 Alur sebab–akibat <span class="dim" style="font-weight:600">· ketuk tiap langkah</span></h2>
      <div class="flow">${m.flow.map((f, i) => `<button class="flow-step ${i === 0 ? 'on' : ''}" data-i="${i}"><span class="flow-ico">${esc(f.icon || '➡️')}</span><b>${esc(f.title)}</b></button>${i < m.flow.length - 1 ? '<span class="flow-arrow">➜</span>' : ''}`).join('')}</div>
      <div class="flow-desc" id="flowDesc">${esc(m.flow[0].desc || '')}</div></div>` : ''}

    ${m.sections.map((s, i) => { const im = imgs[i]; return `
      <section class="glass card mat-sec ${im ? 'with-img' : ''}" style="animation-delay:${i * 0.06}s">
        ${im ? `<a class="sec-img" href="${esc(im.link || '#')}" target="_blank" rel="noopener"><img src="${esc(im.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.mat-sec').classList.remove('with-img');this.parentNode.remove()"><span>📷 ${esc(im.source || 'Sumber')}</span></a>` : ''}
        <div class="sec-txt"><h2 class="h2"><span class="sec-no">${s.icon ? esc(s.icon) : i + 1}</span>${esc(s.heading)}</h2>
        ${s.body.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      </section>`; }).join('')}

    ${m.glossary?.length ? `<div class="glass card"><h2 class="h2" style="margin-bottom:12px">📒 Istilah penting <span class="dim" style="font-weight:600">· ketuk kartu</span></h2>
      <div class="gloss-grid">${m.glossary.map(g => `
        <button class="gloss" aria-label="${esc(g.term)}"><span class="gloss-in"><span class="gloss-f">${esc(g.term)}</span><span class="gloss-b">${esc(g.def)}</span></span></button>`).join('')}</div></div>` : ''}

    ${quiz.length ? `<div class="glass card" id="mq"><div class="row between"><h2 class="h2">🧠 Cek pemahaman</h2><span class="chip" id="mqScore">0/${quiz.length}</span></div>
      ${quiz.map((q, i) => `<div class="mq" data-i="${i}"><b class="mq-q">${i + 1}. ${esc(q.q)}</b>
        <div class="mq-opts">${q.options.map((o, j) => `<button class="mq-opt" data-j="${j}"><span class="mq-l">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="mq-why" hidden></div></div>`).join('')}</div>` : ''}

    ${m.tips?.length ? `<div class="glass card"><h2 class="h2">💡 Tips menjawab soal</h2>
      <div class="stack" style="gap:8px;margin-top:10px">${m.tips.map(t => `<div class="tip good"><span>✔️</span><span>${esc(t)}</span></div>`).join('')}</div></div>` : ''}

    ${m.sources?.length ? `<div class="glass card"><h2 class="h2">📰 Sumber berita</h2>
      ${m.sources.map(s => `<a class="news-item" href="${esc(s.link)}" target="_blank" rel="noopener">${srcThumb(s)}<div style="min-width:0"><span class="nt">${esc(s.title)}</span>
        <div class="dim">${esc(s.publisher || '')}${s.date ? ' · ' + timeAgo(s.date) : ''}</div></div></a>`).join('')}
      <p class="dim" style="margin:10px 0 0">Materi dirangkum otomatis oleh AI dari judul berita. Selalu cek detail di sumber aslinya.</p></div>` : ''}

    <div class="glass start-bar">
      <button class="btn ghost" id="readBtn" ${read ? 'disabled' : ''}>${read ? '✓ Sudah dibaca' : '✓ Tandai dibaca'}</button>
      <a class="btn" style="flex:1" href="#/latihan?category=${m.category}${m.core ? '' : '&fresh=1'}">🎯 Latihan soal topik ini</a>
    </div>
  </article>`;

  $$('.gloss', app).forEach(g => (g.onclick = () => g.classList.toggle('flip')));
  // angka penting: animasi hitung saat terlihat
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const b = e.target; const n = parseFloat(b.dataset.n);
    if (!isFinite(n) || n % 1) return;
    countUp(b, n); setTimeout(() => (b.textContent = b.dataset.raw), 1000);
  }), { threshold: .4 });
  $$('.mstat-v b[data-n]', app).forEach(b => b.dataset.n && io.observe(b));
  // alur
  $$('.flow-step', app).forEach(b => (b.onclick = () => {
    $$('.flow-step', app).forEach(x => x.classList.toggle('on', x === b));
    const d = $('#flowDesc'); d.classList.remove('pop'); void d.offsetWidth; d.textContent = m.flow[+b.dataset.i].desc || ''; d.classList.add('pop');
  }));
  // kuis
  let score = 0, answered = 0;
  $$('.mq', app).forEach(box => {
    const q = quiz[+box.dataset.i];
    $$('.mq-opt', box).forEach(o => (o.onclick = () => {
      if (box.dataset.done) return; box.dataset.done = '1'; answered++;
      const j = +o.dataset.j, ok = j === q.answer;
      if (ok) score++;
      $$('.mq-opt', box).forEach((x, k) => { x.disabled = true; if (k === q.answer) x.classList.add('ok'); else if (x === o) x.classList.add('no'); });
      const w = $('.mq-why', box); w.hidden = false; w.className = 'mq-why ' + (ok ? 'ok' : 'no');
      w.textContent = (ok ? '✅ Benar! ' : '❌ Kurang tepat. ') + (q.why || '');
      $('#mqScore').textContent = `${score}/${quiz.length}`;
      if (answered === quiz.length) { if (score === quiz.length) { confetti(70); toast('Sempurna! Kamu paham materi ini 🎉', 'ok'); } else toast(`Skor ${score}/${quiz.length}. Baca ulang bagian yang salah ya 💪`); }
    }));
  });
  // progres baca
  const prog = () => {
    const el = $('#readProg'); if (!el) return removeEventListener('scroll', prog);
    const h = document.documentElement.scrollHeight - innerHeight;
    el.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 100) + '%';
  };
  addEventListener('scroll', prog, { passive: true }); prog();
  $('#readBtn').onclick = () => {
    markRead(m.id); confetti(50);
    $('#readBtn').disabled = true; $('#readBtn').textContent = '✓ Sudah dibaca';
    toast(session.loggedIn ? 'Mantap! Lanjutkan dengan latihan soalnya 💪' : 'Tersimpan di perangkat ini', 'ok');
  };
}
