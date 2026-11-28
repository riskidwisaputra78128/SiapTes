// 💎 Langganan SiapLolos (sisi tampilan): Tamu · Free · Plus · Pro
// Batas yang sebenarnya ditegakkan di server (api/_lib/plan.js); di sini untuk mengunci tombol & menampilkan ajakan upgrade.
import { api, session } from './api.js';
import { $, $$, esc, toast, sheet, fmt, confetti } from './ui.js';

export const TIER_NAME = { guest: 'Tamu', free: 'Free', plus: 'Plus', pro: 'Pro' };
export const TIER_ICO = { guest: '👀', free: '🌱', plus: '⭐', pro: '👑' };
const INF = 1e9;
export const LIMITS = {
  guest: { practice: false, sessions: 0, maxCount: 0, levels: [], modes: [], sims: {}, tutor: 0, duelPerDay: 0, dailyMaterials: 0, interactive: false, psikotes: false, evalDetail: false, ads: 'full' },
  free: { practice: true, sessions: 3, maxCount: 10, levels: ['easy', 'normal'], modes: ['pg', 'game'], sims: { skd: 1 }, tutor: 3, duelPerDay: 3, dailyMaterials: 3, interactive: false, psikotes: 'lite', evalDetail: false, ads: 'full' },
  plus: { practice: true, sessions: INF, maxCount: 30, levels: ['easy', 'normal', 'hard'], modes: ['pg', 'game', 'essay', 'interaktif'], sims: { skd: INF, telkom: INF, bi: 2, ojk: 2 }, tutor: 20, duelPerDay: INF, dailyMaterials: INF, interactive: true, psikotes: 'full', evalDetail: true, ads: 'less' },
  pro: { practice: true, sessions: INF, maxCount: 50, levels: ['easy', 'normal', 'hard', 'prof'], modes: ['pg', 'game', 'essay', 'interaktif'], sims: { skd: INF, telkom: INF, bi: INF, ojk: INF }, tutor: 60, duelPerDay: INF, dailyMaterials: INF, interactive: true, psikotes: 'full', evalDetail: true, ads: 'none' },
};
const RANK = { guest: 0, free: 1, plus: 2, pro: 3 };

export function tierNow() {
  if (!session.loggedIn) return 'guest';
  const u = session.user;
  if (u?.admin) return 'pro';
  if (u?.tier && u.tier !== 'free' && u.until && u.until < Date.now()) return 'free';
  return u?.tier || 'free';
}
export const limits = () => LIMITS[tierNow()];
export const atLeast = t => RANK[tierNow()] >= RANK[t];
export const lockIco = need => (need === 'login' ? '🔒' : need === 'pro' ? '👑' : '⭐');

let meCache = null;
export async function refreshMe(force = false) {
  if (!session.loggedIn) return null;
  if (!force && meCache && Date.now() - meCache.at < 30000) return meCache.d;
  const d = await api('/auth', { method: 'POST', body: { action: 'me' } });
  meCache = { at: Date.now(), d };
  const u = session.user;
  if (u && (u.tier !== d.tier || u.until !== d.until)) { session.patch({ tier: d.tier, until: d.until, trial: !!d.trial }); window.dispatchEvent(new Event('tier:change')); }
  return d;
}
// dipanggil dari detak online: perbarui paket bila berubah (dibayar / diberi admin / kedaluwarsa)
export function syncTier(tier, until, trial) {
  const u = session.user;
  if (!u || !tier) return;
  if (u.tier !== tier || (u.until || 0) !== (until || 0)) {
    const up = RANK[tier] > RANK[u.tier || 'free'];
    const endedTrial = u.trial && tier === 'free';
    session.patch({ tier, until: until || 0, trial: !!trial }); meCache = null;
    if (endedTrial) toast('⏰ Masa trial sudah berakhir. Akunmu kembali ke paket Free.', 'info');
    window.dispatchEvent(new Event('tier:change'));
    if (up) { toast(`${TIER_ICO[tier]} Paket ${TIER_NAME[tier]} kamu sudah aktif!`, 'ok'); confetti(120); }
  }
}

const rp = n => 'Rp' + fmt(n);
const daysLeft = until => Math.ceil((until - Date.now()) / 86400000);
export const untilText = until => (until ? new Date(until).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }) : 'tanpa batas waktu');

const FEATURES = [
  ['📘 Materi inti (33)', 'Pratinjau', 'Baca semua', 'Semua + interaktif', 'Semua + interaktif'],
  ['📰 Materi harian AI', '—', '3 terbaru', 'Semua + arsip', 'Semua + arsip'],
  ['📝 Latihan PG & Arena', '—', '10 soal · 3 sesi/hari', 'Tanpa batas', 'Tanpa batas'],
  ['🔥 Level', '—', 'Easy–Normal', 's.d. Hard', 'Semua (Prof)'],
  ['✍️ Esai & Interaktif', '—', '—', '✓', '✓'],
  ['🎯 Simulasi seleksi', '—', 'CPNS 1×/minggu', 'CPNS & Telkom ∞ · BI/OJK 2×/mgg', 'Semua tanpa batas'],
  ['🧠 Tes Psikologi', '—', 'Versi singkat', 'Lengkap', 'Lengkap'],
  ['⚔️ Duel', 'Menonton', '3 room/hari', 'Tanpa batas', 'Tanpa batas'],
  ['🤖 Mentor AI', '—', '3/hari', '20/hari', '60/hari'],
  ['📈 Evaluasi', '—', 'Ringkasan', 'Detail per topik', 'Detail + rekomendasi'],
  ['📢 Iklan', 'Tampil', 'Tampil', 'Lebih sedikit', 'Tanpa iklan'],
];
export function compareTable(cur = tierNow()) {
  return `<div class="plan-table"><table><thead><tr><th></th>${['guest', 'free', 'plus', 'pro'].map(t => `<th class="${t === cur ? 'cur' : ''}">${TIER_ICO[t]} ${TIER_NAME[t]}</th>`).join('')}</tr></thead>
    <tbody>${FEATURES.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map((v, i) => `<td class="${['guest', 'free', 'plus', 'pro'][i] === cur ? 'cur' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Ajakan daftar / upgrade
export function upgradeSheet({ reason = '', need = 'plus' } = {}) {
  if (!session.loggedIn) {
    return sheet(`<div class="gate-ico">🔒</div><h3 class="h2" style="text-align:center">Daftar dulu, gratis!</h3>
      <p class="muted" style="text-align:center">${esc(reason || 'Fitur ini hanya untuk pengguna terdaftar.')}</p>
      <ul class="gate-list"><li>📝 Latihan soal setiap hari</li><li>📘 33 materi inti lengkap</li><li>🎯 Simulasi SKD CPNS 2026</li><li>📈 Progres & peringkat tersimpan</li></ul>
      <a class="btn block" href="#/login?daftar=1" data-close>Daftar gratis</a>
      <a class="btn ghost block" href="#/login" data-close style="margin-top:8px">Sudah punya akun? Masuk</a>`,
    (el, close) => $$('[data-close]', el).forEach(a => a.addEventListener('click', () => { session.clear(); close(); })));
  }
  location.hash = `#/langganan?need=${need}${reason ? '&why=' + encodeURIComponent(reason) : ''}`;
}
/** Tangani galat API yang meminta login / upgrade. true bila sudah ditangani. */
export function handleGate(e) {
  if (e?.data?.needLogin || (e?.status === 401 && !session.loggedIn)) { upgradeSheet({ reason: e.message }); return true; }
  if (e?.data?.upgrade) { upgradeSheet({ reason: e.message, need: e.data.upgrade }); return true; }
  return false;
}

async function checkout(plan, btn) {
  const label = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Membuat tagihan…';
  try {
    const d = await api('/auth', { method: 'POST', body: { action: 'sub-checkout', plan } });
    try { localStorage.setItem('sl_pending_pay', JSON.stringify({ ext: d.externalId, plan, at: Date.now() })); } catch {}
    location.href = d.url;
  } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = label; }
}

// Banner pengingat langganan (≤ 5 hari lagi / baru kedaluwarsa)
export function subBanner() {
  const u = session.user;
  if (!session.loggedIn || !u || u.admin || !u.until || !u.tier || u.tier === 'free') return '';
  const d = daysLeft(u.until);
  if (d <= 0) return '';
  if (u.trial) {
    const h = Math.max(1, Math.ceil((u.until - Date.now()) / 3600000));
    const left = h <= 24 ? `${h} jam lagi` : `${d} hari lagi`;
    return `<a class="glass sub-banner trial" href="#/langganan"><span>🎁</span><span><b>Trial ${TIER_NAME[u.tier]} gratis · berakhir ${left}</b> (${untilText(u.until)}). Setelah itu aksesnya terkunci. Langganan agar tetap bisa latihan tanpa batas.</span><b class="grad-text">Lanjut Plus →</b></a>`;
  }
  if (d > 5) return '';
  return `<a class="glass sub-banner" href="#/langganan"><span>⏰</span><span><b>Langganan ${TIER_NAME[u.tier]} berakhir ${d === 1 ? 'besok' : `${d} hari lagi`}</b> (${untilText(u.until)}). Perpanjang sekarang agar akses tidak terputus.</span><b class="grad-text">Perpanjang →</b></a>`;
}

// Halaman #/langganan
export async function renderLangganan(app, params) {
  const t = tierNow(), u = session.user;
  app.innerHTML = `<section class="stack fade-in"><div class="glass card"><div class="skel" style="height:120px"></div></div></section>`;
  let me = null;
  try { me = session.loggedIn ? await refreshMe(true) : null; } catch (e) { toast(e.message, 'err'); }
  const prices = me?.prices || { plus: 29000, pro: 59000 };
  const cur = session.loggedIn ? (me?.tier || t) : 'guest';
  const until = me?.until ?? u?.until ?? 0;
  const why = params.get('why');
  const need = params.get('need');
  const paid = params.get('bayar');
  const demo = params.get('demo');
  const card = (plan, tag) => `
    <div class="glass plan-card ${plan} ${cur === plan ? 'cur' : ''} ${need === plan ? 'want' : ''}">
      ${tag ? `<span class="plan-tag">${tag}</span>` : ''}
      <div class="plan-ico">${TIER_ICO[plan]}</div><h3>${TIER_NAME[plan]}</h3>
      <div class="plan-price"><b>${rp(prices[plan])}</b><span>/ 30 hari</span></div>
      <ul>${plan === 'plus'
        ? '<li>Latihan tanpa batas (s.d. Hard)</li><li>Esai & 8 permainan interaktif</li><li>Simulasi CPNS & Telkom tanpa batas</li><li>BI/OJK 2×/minggu · Mentor AI 20/hari</li><li>Materi interaktif & evaluasi detail</li>'
        : '<li>Semua fitur Plus</li><li>Level Prof & 50 soal/sesi</li><li>Semua simulasi tanpa batas (BI & OJK)</li><li>Mentor AI 60/hari</li><li>Tanpa iklan · lencana 👑</li>'}</ul>
      ${!session.loggedIn ? '<a class="btn block" href="#/login?daftar=1">Daftar dulu</a>'
        : u?.admin ? '<button class="btn ghost block" disabled>Admin = akses Pro</button>'
        : `<button class="btn block" data-buy="${plan}">${cur === plan ? (me?.trial ? 'Langganan Plus 30 hari' : 'Perpanjang 30 hari') : RANK[cur] > RANK[plan] ? `Beli ${TIER_NAME[plan]}` : `Upgrade ke ${TIER_NAME[plan]}`}</button>`}
    </div>`;
  app.innerHTML = `
  <section class="stack fade-in">
    ${paid === 'sukses' ? '<div class="glass card pay-wait" id="payWait"><span class="spinner"></span> <b>Pembayaran berhasil.</b> Menunggu konfirmasi… paketmu akan aktif otomatis dalam beberapa detik.</div>' : ''}
    ${paid === 'gagal' ? '<div class="glass card" style="border-color:rgba(248,113,113,.5)!important">❌ Pembayaran dibatalkan atau gagal. Silakan coba lagi.</div>' : ''}
    ${paid === 'pending' ? '<div class="glass card pay-wait block" id="payWait">⏳ <b>Menunggu pembayaran.</b> Selesaikan pembayaran (QRIS / Virtual Account / GoPay) sesuai instruksi Midtrans — paketmu aktif otomatis begitu pembayaran diterima, kamu tidak perlu kembali ke halaman ini.</div>' : ''}
    ${demo ? `<div class="glass card"><b>🧪 Tagihan simulasi (mode uji)</b><p class="muted" style="margin:6px 0 10px">Kunci payment gateway belum diatur, jadi ini halaman bayar tiruan untuk menguji alur.</p><button class="btn" id="demoPay">Bayar (simulasi)</button></div>` : ''}
    <div class="glass card plan-hero">
      <span class="chip">💎 Langganan</span>
      <h1 class="h1" style="margin:8px 0 4px">${session.loggedIn ? `Paketmu: ${TIER_ICO[cur]} ${TIER_NAME[cur]}` : 'Pilih paket belajarmu'}</h1>
      <p class="muted" style="margin:0">${!session.loggedIn ? 'Mode tamu hanya bisa melihat-lihat. Daftar gratis untuk mulai latihan.'
        : cur === 'free' ? (me?.expired ? `Langganan ${TIER_NAME[me.expired]} kamu sudah berakhir. Perpanjang untuk membuka lagi semua fitur.` : 'Kamu memakai paket Free. Upgrade untuk latihan tanpa batas dan semua simulasi.')
        : u?.admin ? 'Akun admin memiliki akses penuh.' : me?.trial ? `🎁 <b>Trial ${TIER_NAME[cur]} gratis</b> aktif sampai <b>${untilText(until)}</b> · sisa ${Math.max(0, daysLeft(until))} hari. Setelah trial habis, akun kembali ke Free — beli Plus agar akses tidak terputus (sisa trial tetap terhitung).` : `Aktif sampai <b>${untilText(until)}</b>${until ? ` · sisa ${Math.max(0, daysLeft(until))} hari` : ''}.`}</p>
      ${why ? `<p class="gate-why">🔒 ${esc(why)}</p>` : ''}
      ${me?.usage && cur === 'free' ? `<p class="dim" style="margin:8px 0 0;font-size:13px">Hari ini: ${me.usage.sessions}/3 sesi latihan · ${me.usage.duels}/3 room duel · Simulasi CPNS minggu ini: ${me.usage.sims?.skd || 0}/1</p>` : ''}
    </div>
    ${me?.trialAvailable && cur === 'free' ? `<div class="glass card trial-card"><div class="trial-ico">🎁</div><div><b>Punya kode referal? Coba Plus gratis</b><p class="muted" style="margin:4px 0 0">Masukkan kode referal untuk membuka trial Plus ${me.trialDays || 3} hari tanpa bayar. Setelah habis, akun otomatis kembali ke Free. Hanya sekali per akun.</p></div><div class="trial-form"><input class="input" id="trialCode" maxlength="32" placeholder="Kode referal" autocomplete="off"><button class="btn" id="trialBtn">Pakai kode</button></div></div>` : ''}
    <div class="plan-grid">${card('plus', 'Paling populer')}${card('pro', 'Terlengkap')}</div>
    <p class="dim pay-note">💳 Pembayaran aman lewat Midtrans: QRIS, Virtual Account bank, dan GoPay. Paket aktif otomatis setelah pembayaran berhasil dan berlaku 30 hari. Kami mengingatkanmu 5 hari sebelum masa langganan berakhir — tidak ada penagihan otomatis.</p>
    <div class="glass card"><h2 class="h2" style="margin-bottom:10px">Bandingkan paket</h2>${compareTable(cur)}</div>
  </section>`;
  $$('[data-buy]', app).forEach(b => (b.onclick = () => checkout(b.dataset.buy, b)));
  const tb = $('#trialBtn');
  if (tb) tb.onclick = async () => {
    tb.disabled = true; tb.innerHTML = '<span class="spinner"></span>';
    try {
      const code = $('#trialCode').value.trim();
      if (!code) throw new Error('Masukkan kode referal dulu');
      const r = await api('/auth', { method: 'POST', body: { action: 'sub-trial', code } });
      session.patch({ tier: r.tier, until: r.until, trial: true }); meCache = null;
      window.dispatchEvent(new Event('tier:change'));
      toast(`🎁 Kode benar! Trial ${TIER_NAME[r.tier]} ${r.days} hari aktif. Selamat belajar.`, 'ok'); confetti(140);
      renderLangganan(app, new URLSearchParams());
    } catch (e) { toast(e.message, 'err'); tb.disabled = false; tb.textContent = 'Pakai kode'; }
  };
  if (demo) $('#demoPay').onclick = async () => {
    try { await api('/auth', { method: 'POST', body: { action: 'sub-demo-pay', externalId: demo } }); await refreshMe(true); toast('✅ Pembayaran simulasi berhasil', 'ok'); confetti(120); location.hash = '#/langganan'; }
    catch (e) { toast(e.message, 'err'); }
  };
  if (paid === 'sukses' || paid === 'pending') {
    // tunggu notifikasi payment gateway mengaktifkan paket
    let n = 0;
    const tick = async () => {
      if (!document.body.contains($('#payWait'))) return;
      try { const d = await refreshMe(true); if (d && d.tier !== 'free' && d.tier !== cur) { toast(`${TIER_ICO[d.tier]} Paket ${TIER_NAME[d.tier]} aktif!`, 'ok'); confetti(140); return renderLangganan(app, new URLSearchParams()); } } catch {}
      if (++n < (paid === 'pending' ? 100 : 20)) setTimeout(tick, paid === 'pending' ? 6000 : 3000);
      else $('#payWait').innerHTML = '⏳ Konfirmasi pembayaran belum masuk. Jika sudah membayar, paket aktif otomatis begitu payment gateway mengonfirmasi — atau hubungi admin.';
    };
    setTimeout(tick, 2000);
  }
}

// ───── Admin ─────
export function adminSubSheet(u, onDone) {
  const cur = u.sub?.tier || 'free';
  sheet(`<h3 class="h2">💎 Atur langganan</h3><p class="muted" style="margin:4px 0 12px">${esc(u.name)} · ${esc(u.email)}<br>Saat ini: <b>${TIER_ICO[cur]} ${TIER_NAME[cur]}</b>${u.sub?.until ? ` · sampai ${untilText(u.sub.until)}` : ''}</p>
    <label class="dim">Paket</label>
    <div class="seg" id="asTier" style="margin:6px 0 12px">${['free', 'plus', 'pro'].map(t => `<button data-v="${t}" class="${t === cur ? 'on' : ''}">${TIER_ICO[t]} ${TIER_NAME[t]}</button>`).join('')}</div>
    <label class="dim">Durasi</label>
    <div class="seg" id="asDays" style="margin:6px 0 14px;flex-wrap:wrap">${[[30, '30 hari'], [90, '90 hari'], [365, '1 tahun'], [0, 'Tanpa batas']].map(([v, l], i) => `<button data-v="${v}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn block" id="asSave">Simpan</button>
    <p class="dim" style="margin:8px 0 0;font-size:12.5px">Durasi dihitung mulai hari ini. Memilih Free = mencabut langganan.</p>`,
  (el, close) => {
    let tier = cur, days = 30;
    $$('#asTier button', el).forEach(b => (b.onclick = () => { tier = b.dataset.v; $$('#asTier button', el).forEach(x => x.classList.toggle('on', x === b)); }));
    $$('#asDays button', el).forEach(b => (b.onclick = () => { days = +b.dataset.v; $$('#asDays button', el).forEach(x => x.classList.toggle('on', x === b)); }));
    $('#asSave', el).onclick = async () => {
      const btn = $('#asSave', el); btn.disabled = true;
      try {
        const r = await api('/auth', { method: 'POST', body: { action: 'admin-sub', uid: u.uid, email: u.email, name: u.name, tier, days } });
        u.sub = r.sub; close(); onDone?.();
        toast(tier === 'free' ? `Langganan ${u.name} dicabut` : `${TIER_ICO[tier]} ${u.name} kini ${TIER_NAME[tier]}${r.sub.until ? ' sampai ' + untilText(r.sub.until) : ' tanpa batas'}`, 'ok');
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    };
  });
}
export function adminPayCard() {
  return `<div class="glass card" id="payCard"><div class="row between wrap" style="gap:8px"><h2 class="h2">💰 Langganan & pembayaran</h2><span class="chip" id="payStatus">…</span></div>
    <div class="row wrap" style="gap:8px;margin:10px 0">
      <label class="pay-price">⭐ Plus <input class="input" id="prPlus" type="number" min="1000" step="1000"></label>
      <label class="pay-price">👑 Pro <input class="input" id="prPro" type="number" min="1000" step="1000"></label>
      <button class="btn sm" id="prSave">Simpan harga</button></div>
    <div id="payList" class="pay-list"><div class="skel" style="height:60px"></div></div>
    <div class="ref-admin"><div class="row between wrap" style="gap:8px"><h3 class="h3" style="margin:0">🎟️ Kode referal trial</h3><button class="btn sm ghost" id="refNew">+ Kode baru</button></div>
      <p class="dim" style="margin:4px 0 10px;font-size:12.5px">Pengguna wajib memasukkan kode yang aktif untuk membuka trial (sekali per akun).</p>
      <div id="refList"><div class="skel" style="height:48px"></div></div></div></div>`;
}
function refSheet(c, reload) {
  const isNew = !c;
  c = c || { code: '', tier: 'plus', days: 3, active: true, max: 0 };
  sheet(`<h3 class="h2">🎟️ ${isNew ? 'Kode referal baru' : 'Ubah kode ' + esc(c.code)}</h3>
    <label class="dim" for="rfCode">Kode</label><input id="rfCode" class="input" style="margin:4px 0 10px" maxlength="32" value="${esc(c.code)}" ${isNew ? '' : 'readonly'} placeholder="misal PROMO2026">
    <label class="dim">Paket trial</label>
    <div class="seg" id="rfTier" style="margin:6px 0 10px">${['plus', 'pro'].map(t => `<button data-v="${t}" class="${t === c.tier ? 'on' : ''}">${TIER_ICO[t]} ${TIER_NAME[t]}</button>`).join('')}</div>
    <div class="row" style="gap:10px"><label class="dim" style="flex:1">Durasi (hari)<input id="rfDays" class="input" type="number" min="1" max="90" value="${c.days}"></label>
      <label class="dim" style="flex:1">Kuota pemakaian<input id="rfMax" class="input" type="number" min="0" value="${c.max || 0}" placeholder="0 = tanpa batas"></label></div>
    <p class="dim" style="margin:4px 0 10px;font-size:12px">Kuota 0 = tanpa batas.</p>
    <label class="row" style="gap:8px;margin-bottom:14px"><input type="checkbox" id="rfActive" ${c.active !== false ? 'checked' : ''}> Aktif</label>
    <button class="btn block" id="rfSave">Simpan</button>
    ${isNew ? '' : '<button class="btn ghost block" id="rfDel" style="margin-top:8px;color:#f87171">Hapus kode</button>'}`,
  (el, close) => {
    let tier = c.tier;
    $$('#rfTier button', el).forEach(b => (b.onclick = () => { tier = b.dataset.v; $$('#rfTier button', el).forEach(x => x.classList.toggle('on', x === b)); }));
    $('#rfSave', el).onclick = async () => {
      try {
        await api('/auth', { method: 'POST', body: { action: 'admin-refcode-save', code: $('#rfCode', el).value, tier, days: +$('#rfDays', el).value, max: +$('#rfMax', el).value, active: $('#rfActive', el).checked } });
        toast('Kode referal disimpan', 'ok'); close(); reload();
      } catch (e) { toast(e.message, 'err'); }
    };
    const del = $('#rfDel', el);
    if (del) del.onclick = async () => {
      if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Klik lagi untuk menghapus'; return; }
      try { await api('/auth', { method: 'POST', body: { action: 'admin-refcode-delete', code: c.code } }); toast('Kode dihapus', 'ok'); close(); reload(); }
      catch (e) { toast(e.message, 'err'); }
    };
  });
}
async function bindRefCodes() {
  const box = $('#refList'); if (!box) return;
  const reload = () => bindRefCodes();
  $('#refNew').onclick = () => refSheet(null, reload);
  try {
    const d = await api('/auth', { method: 'POST', body: { action: 'admin-refcodes' } });
    box.innerHTML = (d.codes.length ? d.codes.map((c, i) => `<button class="ref-row" data-i="${i}"><b class="ref-code">${esc(c.code)}</b>
      <span class="dim">${TIER_ICO[c.tier] || '⭐'} ${TIER_NAME[c.tier] || 'Plus'} ${c.days} hari · dipakai ${c.uses || 0}${c.max ? '/' + c.max : '×'}</span>
      <span class="chip ${c.active ? 'ok' : ''}">${c.active ? 'Aktif' : 'Nonaktif'}</span></button>`).join('') : '<p class="dim" style="margin:0">Belum ada kode. Tanpa kode aktif, tidak ada yang bisa membuka trial.</p>')
      + `<p class="dim" style="margin:8px 0 0;font-size:12px">Total akun yang sudah memakai trial: ${d.trials}</p>`;
    $$('.ref-row', box).forEach(b => (b.onclick = () => refSheet(d.codes[+b.dataset.i], reload)));
  } catch (e) { box.innerHTML = `<p class="dim">${esc(e.message)}</p>`; }
}
export async function bindAdminPayCard() {
  const box = $('#payCard'); if (!box) return;
  try {
    const d = await api('/auth', { method: 'POST', body: { action: 'admin-payments' } });
    const gw = { midtrans: 'Midtrans', xendit: 'Xendit' }[d.gateway];
    $('#payStatus').textContent = gw ? (d.test ? `🧪 ${gw} mode Sandbox/test` : `✅ ${gw} live`) : '⚠️ Payment gateway belum diatur';
    $('#prPlus').value = d.prices.plus; $('#prPro').value = d.prices.pro;
    const total = d.payments.reduce((s, p) => s + (p.amount || 0), 0);
    $('#payList').innerHTML = d.payments.length ? `<p class="dim" style="margin:0 0 8px">${d.payments.length} pembayaran terakhir · total ${rp(total)}</p>` + d.payments.map(p => `
      <div class="pay-row"><span class="pay-ico">${TIER_ICO[p.plan] || '💎'}</span><div style="min-width:0;flex:1"><b>${esc(p.name || p.email)}</b> <span class="dim">· ${TIER_NAME[p.plan] || p.plan}</span>
        <div class="dim" style="font-size:12px">${new Date(p.paidAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB · ${esc(p.method || '-')} · aktif s.d. ${untilText(p.until)}</div></div><b>${rp(p.amount)}</b></div>`).join('')
      : '<p class="dim" style="margin:0">Belum ada pembayaran.</p>';
    try { if (d.payments[0]) localStorage.setItem('sl_pay_seen', String(d.payments[0].paidAt)); } catch {}
  } catch (e) { $('#payList').innerHTML = `<p class="dim">${esc(e.message)}</p>`; }
  $('#prSave').onclick = async () => {
    try { await api('/auth', { method: 'POST', body: { action: 'admin-prices', plus: +$('#prPlus').value, pro: +$('#prPro').value } }); toast('Harga langganan disimpan', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  };
  bindRefCodes();
}
// notifikasi admin dari detak online
export function notifyAdminPay(lastPay) {
  if (!lastPay || !session.user?.admin) return;
  let seen = 0; try { seen = +localStorage.getItem('sl_pay_seen') || 0; } catch {}
  if (lastPay.paidAt > seen) {
    try { localStorage.setItem('sl_pay_seen', String(lastPay.paidAt)); } catch {}
    if (seen) {   // jangan bunyi untuk pembayaran lama saat pertama kali
      toast(`💰 Pembayaran masuk: ${lastPay.name || lastPay.email} — ${TIER_NAME[lastPay.plan]} ${rp(lastPay.amount)}`, 'ok');
      import('./sound.js').then(m => m.sfx('notify')).catch(() => {});
    }
  }
}
