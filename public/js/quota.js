// 📊 Kartu admin: pengguna aktif hari ini, sisa kuota Firebase, pemakaian Gemini per model & fitur
import { api } from './api.js';
import { $, $$, esc, toast, fmt } from './ui.js';

const FEAT = { 'mentor-ai': '🤖 Mentor AI', 'nilai-esai': '✍️ Penilaian esai', 'materi-harian': '📰 Materi harian', 'soal-harian': '📝 Soal harian', 'materi-dasar': '📚 Materi dasar', 'soal-admin': '🧪 Generate soal (admin)', 'materi-admin': '📖 Generate materi (admin)', 'samarkan-opsi': '🎭 Samarkan opsi', lain: '• Lainnya' };
const time = ms => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
const tone = p => (p >= 85 ? '#f87171' : p >= 60 ? '#fbbf24' : '#34d399');
const bar = (label, used, limit) => {
  const p = Math.min(100, Math.round((used / limit) * 100));
  return `<div class="q-bar"><div class="row between"><span>${label}</span><span class="dim"><b style="color:var(--text)">${fmt(used)}</b> / ${fmt(limit)} · sisa ${fmt(Math.max(0, limit - used))}</span></div>
    <div class="track"><i style="width:${p}%;background:${tone(p)}"></i></div></div>`;
};

export function quotaCard() {
  return `<div class="glass card" id="quotaCard"><div class="row between wrap" style="gap:8px"><h2 class="h2" style="margin:0">📊 Kuota & kapasitas hari ini</h2><button class="btn sm ghost" id="qRefresh">↻ Muat ulang</button></div>
    <div id="quotaBody" style="margin-top:12px"><div class="skel" style="height:140px"></div></div></div>`;
}

export async function bindQuotaCard() {
  const box = $('#quotaBody'); if (!box) return;
  $('#qRefresh').onclick = () => { box.innerHTML = '<div class="skel" style="height:140px"></div>'; bindQuotaCard(); };
  let d;
  try { d = await api('/presence?op=quota'); } catch (e) { box.innerHTML = `<p class="dim">${esc(e.message)}</p>`; return; }
  const f = d.firestore;
  const status = f.moreUsers > 150 ? ['🟢', 'Aman'] : f.moreUsers > 40 ? ['🟡', 'Mulai menipis'] : ['🔴', 'Hampir penuh'];
  const src = f.source === 'monitoring'
    ? '✅ Angka resmi Google Cloud (tertunda ±5 menit, termasuk akses dari Firebase Console).'
    : `ℹ️ Perkiraan dari server SiapLolos (belum termasuk akses dari Firebase Console).${f.monErr === 'izin' ? ' Untuk angka resmi: beri service account peran <b>Monitoring Viewer</b> di Google Cloud IAM.' : ''}`;
  const models = d.ai.models.filter(m => m.ok || m.hit || m.restUntil || m.limit);
  const allModels = d.ai.models;
  box.innerHTML = `
    <div class="q-stats">
      <div class="q-stat"><b>${fmt(d.active)}</b><span>pengguna aktif hari ini</span></div>
      <div class="q-stat"><b>${fmt(d.onlineNow)}</b><span>sedang online</span></div>
      <div class="q-stat"><b>±${fmt(f.moreUsers)}</b><span>${status[0]} pengguna lagi masih muat</span></div>
    </div>
    <h3 class="q-h">🔥 Firebase Firestore <span class="chip">${status[1]}</span></h3>
    ${bar('📖 Baca', f.used.r, f.limits.r)}
    ${bar('✏️ Tulis', f.used.w, f.limits.w)}
    ${f.used.d ? bar('🗑️ Hapus', f.used.d, f.limits.d) : ''}
    <p class="dim q-note">Rata-rata per pengguna hari ini: ±${fmt(f.perUser.r)} baca · ±${fmt(f.perUser.w)} tulis. Kuota direset pukul <b>${time(d.resetAt)} WIB</b>. ${src}</p>
    <h3 class="q-h">✨ Gemini AI <span class="chip">${fmt(d.ai.total)} panggilan</span></h3>
    ${models.length ? models.map(m => m.limit ? bar(`<code>${esc(m.id)}</code>${m.restUntil ? ' ⏸️' : ''}`, m.ok, m.limit)
      : `<div class="q-bar"><div class="row between"><span><code>${esc(m.id)}</code>${m.restUntil ? ' ⏸️' : ''}</span><span class="dim"><b style="color:var(--text)">${fmt(m.ok)}</b> panggilan${m.hit ? ` · ${m.hit}× kena batas` : ''}</span></div></div>`).join('')
      : '<p class="dim" style="margin:0">Belum ada panggilan Gemini sejak reset.</p>'}
    ${allModels.some(m => m.restUntil) ? `<p class="dim q-note">⏸️ = model sedang istirahat karena kena batas (pindah otomatis ke model lain), aktif lagi sekitar ${allModels.filter(m => m.restUntil).map(m => `${esc(m.id)} ${time(m.restUntil)}`).join(', ')} WIB.</p>` : ''}
    ${Object.keys(d.ai.features).length ? `<div class="q-feats">${Object.entries(d.ai.features).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="chip">${FEAT[k] || esc(k)} · ${fmt(n)}</span>`).join('')}</div>` : ''}
    <details class="q-lim"><summary class="dim">⚙️ Atur batas harian Gemini per model (opsional)</summary>
      <p class="dim q-note">Lihat angka batas harian (RPD) tiap model di Google AI Studio → Usage/Rate limit, lalu isi di sini agar sisa kuota tampil. 0 = tidak ditampilkan.</p>
      ${allModels.map(m => `<label class="q-limrow"><code>${esc(m.id)}</code><input class="input" type="number" min="0" data-lim="${esc(m.id)}" value="${m.limit || ''}" placeholder="0"></label>`).join('')}
      <button class="btn sm" id="qLimSave" style="margin-top:8px">Simpan batas</button></details>`;
  const save = $('#qLimSave');
  if (save) save.onclick = async () => {
    const aiLimits = {}; $$('[data-lim]', box).forEach(i => { if (+i.value > 0) aiLimits[i.dataset.lim] = +i.value; });
    try { await api('/presence?op=quota', { method: 'POST', body: { aiLimits } }); toast('Batas Gemini disimpan', 'ok'); bindQuotaCard(); }
    catch (e) { toast(e.message, 'err'); }
  };
}
