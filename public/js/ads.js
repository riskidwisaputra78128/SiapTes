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
  const draw = () => {
    const a = ads[i];
    seen.add(a.id);
    el.innerHTML = `<a class="glass ad-card fade-in" href="${esc(a.link)}" target="_blank" rel="noopener sponsored" data-ad="${esc(a.id)}">
      ${a.img ? `<img src="${esc(a.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '<span class="ad-ico">📢</span>'}
      <span class="ad-body"><small class="ad-label">Promosi</small><b>${esc(a.title)}</b>${a.text ? `<span class="dim">${esc(a.text)}</span>` : ''}</span>
      <span class="btn sm ad-cta">${esc(a.cta || 'Lihat promo')}</span></a>
      ${ads.length > 1 ? `<div class="ad-dots">${ads.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
    $('[data-ad]', el).addEventListener('click', () => track({ c: [a.id] }));
  };
  draw();
  if (ads.length > 1) {
    const t = setInterval(() => { if (!document.body.contains(el)) return clearInterval(t); i = (i + 1) % ads.length; draw(); }, 7000);
  }
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

function editAd(a, onDone) {
  const t = new Set(a?.tiers || ['guest', 'free', 'plus']);
  sheet(`<h3 class="h2">${a ? '✏️ Ubah iklan' : '＋ Iklan baru'}</h3>
    <div class="field"><label>Judul</label><input class="input" id="aTitle" maxlength="80" placeholder="Contoh: Diskon bimbel CPNS 50%" value="${esc(a?.title || '')}"></div>
    <div class="field"><label>Deskripsi singkat (opsional)</label><input class="input" id="aText" maxlength="200" placeholder="Kalimat ajakan singkat" value="${esc(a?.text || '')}"></div>
    <div class="field"><label>Link promosi (https://…)</label><input class="input" id="aLink" type="url" placeholder="https://contoh.com/promo" value="${esc(a?.link || '')}"></div>
    <div class="field"><label>Link gambar banner (opsional, https://…)</label><input class="input" id="aImg" type="url" placeholder="https://…/banner.jpg" value="${esc(a?.img || '')}"></div>
    <div class="field"><label>Teks tombol</label><input class="input" id="aCta" maxlength="24" value="${esc(a?.cta || 'Lihat promo')}"></div>
    <div class="row wrap" style="gap:10px"><div class="field" style="flex:1"><label>Mulai tayang</label><input class="input" id="aStart" type="date" value="${toInput(a?.start)}"></div>
      <div class="field" style="flex:1"><label>Selesai tayang</label><input class="input" id="aEnd" type="date" value="${toInput(a?.end)}"></div></div>
    <label class="dim">Tampilkan untuk</label>
    <div class="seg" id="aTiers" style="margin:6px 0 14px">${TIERS.map(([k, l]) => `<button data-v="${k}" class="${t.has(k) ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn block" id="aSave">Simpan iklan</button>`,
  (el, close) => {
    $$('#aTiers button', el).forEach(b => (b.onclick = () => { t.has(b.dataset.v) ? t.delete(b.dataset.v) : t.add(b.dataset.v); b.classList.toggle('on'); }));
    $('#aSave', el).onclick = async () => {
      const btn = $('#aSave', el); btn.disabled = true;
      try {
        await api('/presence?op=ads', { method: 'POST', body: { action: 'save', id: a?.id, active: a ? a.active : true, title: $('#aTitle', el).value, text: $('#aText', el).value, link: $('#aLink', el).value, img: $('#aImg', el).value, cta: $('#aCta', el).value, start: fromInput($('#aStart', el).value), end: fromInput($('#aEnd', el).value, true), tiers: [...t] } });
        close(); toast('Iklan disimpan — tampil di beranda dalam ±1 menit', 'ok'); onDone?.();
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    };
  });
}
