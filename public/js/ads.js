// 📢 Iklan beranda + halaman kelola iklan (admin)
import { api, session, getInfo } from './api.js';
import { $, $$, esc, toast, sheet, fmt } from './ui.js';
import { tierNow } from './plan.js';

const TIERS = [['guest', '👀 Tamu'], ['free', '🌱 Free'], ['plus', '⭐ Plus']];

// ───── tampil di beranda ─────
export function adSlot(place = 'home') { return tierNow() === 'pro' ? '' : `<section class="section ad-slot" id="adSlot-${place}" hidden></section>`; }

export async function bindAdSlots() {
  const el = $('#adSlot-home'); if (!el) return;
  let ads = [];
  try { ads = ((await getInfo())?.ads || []).filter(a => a.tiers.includes(tierNow())); } catch { return; }
  if (!ads.length || !document.body.contains(el)) return;
  el.hidden = false;
  let i = 0;
  const seen = new Set();
  const card = a => `<a class="glass ad-card ${a.img && a.wide ? 'wide' : ''}" href="${esc(a.link)}" target="_blank" rel="noopener sponsored" data-ad="${esc(a.id)}" draggable="false">
      ${a.img ? `<img class="${a.wide ? 'ad-banner' : ''}" src="${esc(a.img)}" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer" onerror="this.remove()">` : '<span class="ad-ico">📢</span>'}
      <span class="ad-body"><small class="ad-label">Promosi</small><b>${esc(a.title)}</b>${a.text ? `<span class="dim">${esc(a.text)}</span>` : ''}</span>
      <span class="btn sm ad-cta">${esc(a.cta || 'Lihat promo')}</span></a>`;
  const many = ads.length > 1;
  el.innerHTML = `<div class="ad-viewport fade-in"><div class="ad-track">${ads.map(a => `<div class="ad-slide">${card(a)}</div>`).join('')}</div>
    ${many ? '<button class="ad-nav prev" aria-label="Iklan sebelumnya">‹</button><button class="ad-nav next" aria-label="Iklan berikutnya">›</button>' : ''}</div>
    ${many ? `<div class="ad-dots">${ads.map((_, k) => `<button data-dot="${k}" aria-label="Iklan ${k + 1}"></button>`).join('')}</div>` : ''}`;
  const vp = $('.ad-viewport', el), rail = $('.ad-track', el);
  const go = (k, anim = true) => {
    i = (k + ads.length) % ads.length; seen.add(ads[i].id);
    rail.style.transition = anim ? 'transform .35s cubic-bezier(.2,.8,.2,1)' : 'none';
    rail.style.transform = `translateX(${-i * 100}%)`;
    $$('[data-dot]', el).forEach((d, n) => d.classList.toggle('on', n === i));
  };
  go(0, false);
  // klik iklan (bukan saat sedang menggeser) → hitung klik
  let dragged = false;
  $$('[data-ad]', el).forEach(link => {
    link.addEventListener('click', e => { if (dragged) { e.preventDefault(); return; } track_({ c: [link.dataset.ad] }); });
  });
  if (many) {
    let timer = null;
    const auto = () => { clearInterval(timer); timer = setInterval(() => { if (!document.body.contains(el)) return clearInterval(timer); go(i + 1); }, 7000); };
    auto();
    $('.ad-nav.prev', el).onclick = () => { go(i - 1); auto(); };
    $('.ad-nav.next', el).onclick = () => { go(i + 1); auto(); };
    $$('[data-dot]', el).forEach(d => (d.onclick = () => { go(+d.dataset.dot); auto(); }));
    // geser dengan jari / mouse
    let sx = 0, sy = 0, dx = 0, active = false, horiz = null;
    vp.addEventListener('pointerdown', e => { if (e.button > 0 || e.target.closest('.ad-nav')) return; active = true; horiz = null; dragged = false; sx = e.clientX; sy = e.clientY; dx = 0; clearInterval(timer); });
    vp.addEventListener('pointermove', e => {
      if (!active) return;
      dx = e.clientX - sx; const dy = e.clientY - sy;
      if (horiz === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) { horiz = Math.abs(dx) > Math.abs(dy); if (horiz) vp.setPointerCapture(e.pointerId); }
      if (!horiz) return;
      dragged = Math.abs(dx) > 6;
      rail.style.transition = 'none';
      rail.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`;
    });
    const end = () => {
      if (!active) return; active = false;
      if (horiz) { const w = vp.clientWidth || 1; go(dx < -w * 0.18 ? i + 1 : dx > w * 0.18 ? i - 1 : i); }
      setTimeout(() => (dragged = false), 0);
      auto();
    };
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end); vp.addEventListener('pointerleave', e => { if (active && e.pointerType === 'mouse') end(); });
  }
  const track_ = b => track(b);
  // tayangan dikirim sekali per kunjungan beranda (dikumpulkan)
  setTimeout(() => { if (document.body.contains(el)) track({ v: [...seen] }); }, 2500);
  const stop = () => { const rest = [...seen].filter(id => !sent.has(id)); if (rest.length) track({ v: rest }); };
  const sent = new Set();
  function track(body) {
    (body.v || []).forEach(id => sent.add(id));
    const json = JSON.stringify(body);
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/presence?op=ads&t=1', new Blob([json], { type: 'application/json' }))) return; } catch {}
    fetch('/api/presence?op=ads&t=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
  }
  addEventListener('hashchange', stop, { once: true });
}

// ───── halaman admin #/iklan ─────
const fmtDate = ms => (ms ? new Date(ms).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }) : '');
const toInput = ms => (ms ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : '');
const fromInput = (v, end) => (v ? Date.parse(v + (end ? 'T23:59:59+07:00' : 'T00:00:00+07:00')) : 0);

export async function renderAds(app) {
  app.innerHTML = `<section class="stack fade-in">
    <div class="row between wrap" style="gap:10px"><div><h1 class="h1" style="margin:0">📢 Iklan & Promosi</h1>
      <p class="muted" style="margin:4px 0 0">Banner promosi tampil di beranda pengguna sesuai paket yang dipilih. Paket Pro selalu tanpa iklan.</p></div>
      <button class="btn" id="adNew">＋ Iklan baru</button></div>
    <div class="grid g3" id="adSum">${['Iklan aktif', 'Total tayang', 'Total klik'].map(l => `<div class="glass stat"><div class="v">–</div><div class="l">${l}</div></div>`).join('')}</div>
    <div id="adList" class="stack"><div class="skeleton" style="height:120px"></div></div>
    <p class="dim" style="font-size:12.5px">Tayang dihitung sekali per kunjungan beranda; klik dihitung saat tombol iklan ditekan. Angka disimpan berkala (±30 detik), jadi bisa sedikit tertunda.</p>
  </section>`;
  $('#adNew').onclick = () => editAd(null, load);
  async function load() {
    try {
      const { ads } = await api('/presence?op=ads');
      const act = ads.filter(a => a.active), tv = ads.reduce((s, a) => s + a.views, 0), tc = ads.reduce((s, a) => s + a.clicks, 0);
      $$('#adSum .v').forEach((el, k) => (el.textContent = fmt([act.length, tv, tc][k])));
      $('#adList').innerHTML = ads.length ? ads.map(a => {
        const now = Date.now(), live = a.active && (!a.start || a.start <= now) && (!a.end || a.end >= now);
        const ctr = a.views ? ((a.clicks / a.views) * 100).toFixed(1) : '0.0';
        return `<div class="glass card ad-row">
          <div class="ad-thumb">${a.img ? `<img src="${esc(a.img)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('📢'))">` : '📢'}</div>
          <div class="ad-info"><div class="row wrap" style="gap:6px"><b>${esc(a.title)}</b><span class="chip sm ${live ? 'ok' : ''}">${live ? '🟢 Tayang' : a.active ? '⏳ Terjadwal/selesai' : '⏸️ Nonaktif'}</span></div>
            ${a.text ? `<div class="dim">${esc(a.text)}</div>` : ''}
            <a class="dim ad-link" href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.link)}</a>
            <div class="dim" style="font-size:12px">Untuk: ${a.tiers.map(t => TIERS.find(x => x[0] === t)?.[1] || t).join(', ')}${a.start || a.end ? ` · ${fmtDate(a.start) || '…'} – ${fmtDate(a.end) || '…'}` : ''}</div></div>
          <div class="ad-stats"><div><b>${fmt(a.views)}</b><span>tayang</span></div><div><b>${fmt(a.clicks)}</b><span>klik</span></div><div><b>${ctr}%</b><span>CTR</span></div></div>
          <div class="ad-acts"><button class="btn ghost sm" data-tog="${a.id}">${a.active ? '⏸️ Nonaktifkan' : '▶️ Aktifkan'}</button><button class="btn ghost sm" data-ed="${a.id}">✏️ Ubah</button><button class="btn ghost sm acc-del" data-del="${a.id}">🗑️</button></div>
        </div>`;
      }).join('') : '<div class="glass card empty">Belum ada iklan. Tekan “＋ Iklan baru” untuk memasang promosi pertama.</div>';
      $$('[data-ed]').forEach(b => (b.onclick = () => editAd(ads.find(a => a.id === b.dataset.ed), load)));
      $$('[data-tog]').forEach(b => (b.onclick = async () => { const a = ads.find(x => x.id === b.dataset.tog); try { await api('/presence?op=ads', { method: 'POST', body: { action: 'save', ...a, active: !a.active } }); load(); } catch (e) { toast(e.message, 'err'); } }));
      $$('[data-del]').forEach(b => (b.onclick = () => sheet(`<h3 class="h2">Hapus iklan?</h3><p class="muted">Iklan dan statistiknya akan dihapus permanen.</p><div class="row" style="margin-top:12px"><button class="btn ghost" data-a="n" style="flex:1">Batal</button><button class="btn" data-a="y" style="flex:1">Hapus</button></div>`,
        (el, close) => { $('[data-a=n]', el).onclick = close; $('[data-a=y]', el).onclick = async () => { try { await api('/presence?op=ads', { method: 'POST', body: { action: 'delete', id: b.dataset.del } }); close(); toast('Iklan dihapus', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } }; })));
    } catch (e) { $('#adList').innerHTML = `<div class="glass card empty">${esc(e.message)}</div>`; }
  }
  load();
}

// ✂️ Alat potong gambar: geser (drag), perbesar (slider / scroll / cubit), pilih rasio → kanvas WebP terkompres
function openCrop(el, file, done) {
  const box = $('#aCrop', el), frame = $('#aFrame', el), im = $('#aCropImg', el), zoomEl = $('#aZoom', el);
  const url = URL.createObjectURL(file);
  let ratio = 3, z = 1, x = 0, y = 0, base = 1;   // x,y = geser (px layar) dari tengah
  const fw = () => frame.clientWidth, fh = () => frame.clientHeight;
  const clamp = () => {
    const w = im.naturalWidth * base * z, h = im.naturalHeight * base * z;
    const mx = Math.max(0, (w - fw()) / 2), my = Math.max(0, (h - fh()) / 2);
    x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
  };
  const paint = () => {
    clamp();
    im.style.width = im.naturalWidth * base * z + 'px';
    im.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    $('#aZoomTxt', el).textContent = Math.round(z * 100) + '%';
  };
  const fit = () => { frame.style.aspectRatio = String(ratio); requestAnimationFrame(() => { base = Math.max(fw() / im.naturalWidth, fh() / im.naturalHeight); paint(); }); };
  im.onload = () => { box.hidden = false; $('#aPrev', el).hidden = true; fit(); };
  im.onerror = () => { toast('Gambar tidak bisa dibaca', 'err'); close(); };
  im.src = url;
  $$('#aRatio button', el).forEach(b => (b.onclick = () => { ratio = +b.dataset.r; $$('#aRatio button', el).forEach(o => o.classList.toggle('on', o === b)); x = y = 0; fit(); }));
  zoomEl.value = 1; zoomEl.oninput = () => { z = +zoomEl.value; paint(); };
  frame.onwheel = e => { e.preventDefault(); z = Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 0.93))); zoomEl.value = z; paint(); };
  // geser & cubit (pointer events)
  const pts = new Map(); let pinch = 0;
  frame.onpointerdown = e => { frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]) / z; } };
  frame.onpointermove = e => {
    if (!pts.has(e.pointerId)) return;
    const [px, py] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; z = Math.min(4, Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch)); zoomEl.value = z; }
    else { x += e.clientX - px; y += e.clientY - py; }
    paint();
  };
  frame.onpointerup = frame.onpointercancel = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  function close() { URL.revokeObjectURL(url); box.hidden = true; $('#aPrev', el).hidden = false; }
  $('#aCropCancel', el).onclick = close;
  $('#aCropOk', el).onclick = () => {
    const s = base * z;                                   // skala gambar asli → layar
    const sw = fw() / s, sh = fh() / s;                   // area potong dalam piksel asli
    const sx = (im.naturalWidth - sw) / 2 - x / s, sy = (im.naturalHeight - sh) / 2 - y / s;
    const outW = ratio >= 2 ? 1200 : 800, outH = Math.round(outW / ratio);
    const c = document.createElement('canvas'); c.width = outW; c.height = outH;
    c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, outW, outH);
    let data = '';
    for (const q of [0.85, 0.72, 0.58, 0.45]) {
      data = c.toDataURL('image/webp', q);
      if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', q);
      if (data.length < 850000) break;
    }
    close(); done(data, ratio >= 2);
  };
}

function editAd(a, onDone) {
  const t = new Set(a?.tiers || ['guest', 'free', 'plus']);
  sheet(`<h3 class="h2">${a ? '✏️ Ubah iklan' : '＋ Iklan baru'}</h3>
    <div class="field"><label>Judul</label><input class="input" id="aTitle" maxlength="80" placeholder="Contoh: Diskon bimbel CPNS 50%" value="${esc(a?.title || '')}"></div>
    <div class="field"><label>Deskripsi singkat (opsional)</label><input class="input" id="aText" maxlength="200" placeholder="Kalimat ajakan singkat" value="${esc(a?.text || '')}"></div>
    <div class="field"><label>Link promosi (https://…)</label><input class="input" id="aLink" type="url" placeholder="https://contoh.com/promo" value="${esc(a?.link || '')}"></div>
    <div class="field"><label>Gambar banner (opsional)</label>
      <div class="ad-img-pick">
        <div class="ad-img-prev ${a?.wide ? 'wide' : 'box'}" id="aPrev">${a?.img ? `<img src="${esc(a.img)}" alt="">` : '<span>Belum ada gambar</span>'}</div>
        <div class="ad-crop" id="aCrop" hidden>
          <div class="seg ad-crop-ratio" id="aRatio"><button data-r="3" class="on">▭ Banner lebar 3:1</button><button data-r="1.333">▢ Kotak 4:3</button><button data-r="1">◻ Persegi 1:1</button></div>
          <div class="ad-crop-frame" id="aFrame"><img id="aCropImg" alt="" draggable="false"></div>
          <div class="row" style="gap:10px;align-items:center"><span>🔍</span><input type="range" id="aZoom" min="1" max="4" step="0.01" value="1" style="flex:1"><span class="dim" id="aZoomTxt">100%</span></div>
          <p class="dim" style="margin:0;font-size:12px">Geser gambar untuk mengatur posisi · scroll / cubit / slider untuk memperbesar.</p>
          <div class="row" style="gap:8px"><button type="button" class="btn sm ghost" id="aCropCancel" style="flex:1">Batal</button><button type="button" class="btn sm" id="aCropOk" style="flex:2">✂️ Pakai potongan ini</button></div>
        </div>
        <div class="row wrap" style="gap:8px"><label class="btn sm ghost" style="cursor:pointer">📤 Upload gambar<input type="file" id="aFile" accept="image/jpeg,image/png,image/webp" hidden></label>
          <button type="button" class="btn sm ghost" id="aImgClear" ${a?.img ? '' : 'hidden'}>🗑️ Hapus gambar</button></div>
        <input class="input" id="aImg" type="url" placeholder="…atau tempel link gambar https://…/banner.jpg" value="${esc(a?.img && !a.img.startsWith('/api/') ? a.img : '')}">
        <small class="dim" id="aImgInfo">JPG/PNG/WebP. Setelah memilih gambar, atur potongannya: banner lebar (tampil penuh di atas iklan) atau kotak (thumbnail kecil).</small>
      </div></div>
    <div class="field"><label>Teks tombol</label><input class="input" id="aCta" maxlength="24" value="${esc(a?.cta || 'Lihat promo')}"></div>
    <div class="row wrap" style="gap:10px"><div class="field" style="flex:1"><label>Mulai tayang</label><input class="input" id="aStart" type="date" value="${toInput(a?.start)}"></div>
      <div class="field" style="flex:1"><label>Selesai tayang</label><input class="input" id="aEnd" type="date" value="${toInput(a?.end)}"></div></div>
    <label class="dim">Tampilkan untuk</label>
    <div class="seg" id="aTiers" style="margin:6px 0 14px">${TIERS.map(([k, l]) => `<button data-v="${k}" class="${t.has(k) ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn block" id="aSave">Simpan iklan</button>`,
  (el, close) => {
    $$('#aTiers button', el).forEach(b => (b.onclick = () => { t.has(b.dataset.v) ? t.delete(b.dataset.v) : t.add(b.dataset.v); b.classList.toggle('on'); }));
    // gambar: imgData = hasil upload baru; keep = URL gambar upload lama (dipakai bila tidak diganti)
    let imgData = '', keep = a?.img && a.img.startsWith('/api/') ? a.img : '';
    const prev = src => { $('#aPrev', el).innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<span>Belum ada gambar</span>'; $('#aImgClear', el).hidden = !src; };
    let wide = !!a?.wide;
    $('#aFile', el).onchange = e => {
      const f = e.target.files?.[0]; if (!f) return;
      if (f.size > 15 * 1024 * 1024) return toast('File terlalu besar (maks. 15 MB)', 'err');
      openCrop(el, f, (data, isWide) => {
        imgData = data; wide = isWide; keep = ''; $('#aImg', el).value = '';
        $('#aPrev', el).className = 'ad-img-prev ' + (wide ? 'wide' : 'box'); prev(imgData);
        $('#aImgInfo', el).textContent = `✅ Siap di-upload (${Math.round(imgData.length * 0.75 / 1024)} KB) · tampil sebagai ${wide ? 'banner lebar' : 'thumbnail kotak'}`;
      });
      e.target.value = '';
    };
    $('#aImg', el).oninput = () => { const v = $('#aImg', el).value.trim(); if (v) { imgData = ''; keep = ''; } prev(v || imgData || keep); };
    $('#aImgClear', el).onclick = () => { imgData = ''; keep = ''; $('#aImg', el).value = ''; $('#aFile', el).value = ''; prev(''); };
    $('#aSave', el).onclick = async () => {
      const btn = $('#aSave', el); btn.disabled = true;
      try {
        await api('/presence?op=ads', { method: 'POST', body: { action: 'save', id: a?.id, active: a ? a.active : true, title: $('#aTitle', el).value, text: $('#aText', el).value, link: $('#aLink', el).value, img: $('#aImg', el).value.trim() || keep, imgData, wide: $('#aImg', el).value.trim() ? false : wide, cta: $('#aCta', el).value, start: fromInput($('#aStart', el).value), end: fromInput($('#aEnd', el).value, true), tiers: [...t] } });
        close(); toast('Iklan disimpan — tampil di beranda dalam ±1 menit', 'ok'); onDone?.();
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    };
  });
}
