// Tombol melayang: 🎵 musik belajar & 💬 kritik-saran (+ bubble pengingat)
import { api, session } from './api.js';
import { $, $$, esc, toast, sheet } from './ui.js';
import { sound, sfx } from './sound.js';

const K_REM = 'sl_fb_rem', K_SENT = 'sl_fb_sent', K_USE = 'sl_use_ms';
const get = k => +(localStorage.getItem(k) || 0);

export function mountDock() {
  if ($('#dock')) return;
  const d = document.createElement('div');
  d.id = 'dock'; d.className = 'dock';
  d.innerHTML = `
    <div class="dock-bubble" id="fbBubble" hidden><button class="db-x" aria-label="Tutup">×</button>
      <b>Ada kritik & saran? 💬</b><span>Ceritain ke admin biar SiapLolos makin mantap!</span><button class="btn sm" id="fbBubbleGo">Tulis sekarang</button></div>
    <div class="dock-bar" id="dockBar">
      <button class="dock-btn" id="musicBtn" aria-label="Musik & suara" title="Musik & suara"><span class="eq"><i></i><i></i><i></i></span><span class="ic">🎵</span></button>
      <span class="dock-sep"></span>
      <button class="dock-btn" id="fbBtn" aria-label="Kritik & saran" title="Kritik & saran">💬</button>
    </div>`;
  document.body.appendChild(d);
  const paint = () => d.classList.toggle('playing', sound.music);
  paint(); window.addEventListener('sound:change', paint);
  $('#musicBtn').onclick = openSoundPanel;
  $('#fbBtn').onclick = () => { hideBubble(); openFeedback(); };
  $('.db-x', d).onclick = () => { hideBubble(); localStorage.setItem(K_REM, Date.now()); };
  $('#fbBubbleGo').onclick = () => { hideBubble(); openFeedback(); };
  // pengingat: setelah ±4 menit belajar, maks sekali per 3 hari, tidak muncul lagi 14 hari setelah mengirim
  let last = Date.now();
  setInterval(() => {
    if (document.hidden) { last = Date.now(); return; }
    const used = get(K_USE) + (Date.now() - last); last = Date.now(); localStorage.setItem(K_USE, used);
    if (used > 4 * 60e3 && Date.now() - get(K_REM) > 3 * 86400e3 && Date.now() - get(K_SENT) > 14 * 86400e3
      && !document.body.classList.contains('no-dock') && $('#fbBubble').hidden) {
      localStorage.setItem(K_REM, Date.now()); localStorage.setItem(K_USE, 0);
      $('#fbBubble').hidden = false; sfx('send');
    }
  }, 15000);
}
function hideBubble() { const b = $('#fbBubble'); if (b) b.hidden = true; }
// tombol tambahan kontekstual (mis. 🤖 Tanya AI di halaman materi) — otomatis hilang saat pindah halaman
export function addDockAction(id, html, onClick, title = '') {
  const bar = $('#dockBar'); if (!bar) return null;
  $('#' + id)?.remove(); $('#' + id + 'Sep')?.remove();
  bar.insertAdjacentHTML('afterbegin', `<button class="dock-btn ai" id="${id}" title="${esc(title)}" aria-label="${esc(title)}">${html}</button><span class="dock-sep" id="${id}Sep"></span>`);
  const b = $('#' + id); b.onclick = onClick;
  const off = () => { b.remove(); $('#' + id + 'Sep')?.remove(); removeEventListener('hashchange', off); };
  addEventListener('hashchange', off);
  return b;
}
export function setDockVisible(v) { document.body.classList.toggle('no-dock', !v); }

export function openSoundPanel() {
  sheet(`
    <h3 class="h2">🎧 Suara</h3>
    <p class="dim" style="margin:4px 0 12px">Musik otomatis berganti mengikuti halaman: tenang di Profil & Materi, menegangkan saat mengerjakan soal & duel, gembira di Peringkat, dan santai di Beranda. Dibuat langsung di browser, tanpa iklan.</p>
    <label class="glass card row snd-row"><span style="font-size:24px">🎵</span><div style="flex:1"><b>Musik belajar</b><div class="dim">Suasana sekarang: <span id="sMood">${({calm:'😌 Tenang',normal:'🎧 Santai',tense:'⏱️ Menegangkan',happy:'🎉 Gembira'})[sound.mood]}</span></div></div>
      <input type="checkbox" class="switch" id="sMusic" ${sound.music ? 'checked' : ''}></label>
    <label class="glass card row snd-row"><span style="font-size:24px">🔔</span><div style="flex:1"><b>Efek suara</b><div class="dim">Klik menu, benar/salah, menang, kalah, duel, notifikasi</div></div>
      <input type="checkbox" class="switch" id="sSfx" ${sound.sfx ? 'checked' : ''}></label>
    <div class="glass card snd-row"><div class="row between"><b>🔊 Volume</b><span class="dim" id="sVolT">${Math.round(sound.vol * 100)}%</span></div>
      <input type="range" id="sVol" min="0" max="1" step="0.05" value="${sound.vol}" style="width:100%;accent-color:var(--cyan)"></div>
    <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn ghost sm" data-t="correct">✅ Benar</button><button class="btn ghost sm" data-t="wrong">❌ Salah</button>
      <button class="btn ghost sm" data-t="win">🏆 Menang</button><button class="btn ghost sm" data-t="lose">😢 Kalah</button><button class="btn ghost sm" data-t="duel">⚔️ Duel</button><button class="btn ghost sm" data-t="notify">🔔 Notifikasi</button><button class="btn ghost sm" data-t="levelup">⭐ Naik level</button></div>`,
  el => {
    $('#sMusic', el).onchange = e => sound.toggleMusic(e.target.checked);
    $('#sSfx', el).onchange = e => sound.toggleSfx(e.target.checked);
    $('#sVol', el).oninput = e => { sound.setVol(+e.target.value); $('#sVolT', el).textContent = Math.round(e.target.value * 100) + '%'; };
    $$('[data-t]', el).forEach(b => (b.onclick = () => { const was = sound.sfx; if (!was) sound.toggleSfx(true); sfx(b.dataset.t); }));
  });
}

export function openFeedback() {
  let type = 'saran', rating = 0;
  sheet(`
    <h3 class="h2">💬 Kritik & Saran</h3>
    <p class="dim" style="margin:4px 0 12px">Pesanmu langsung masuk ke admin. ${session.loggedIn ? `Dikirim sebagai <b>${esc(session.user.name)}</b>.` : 'Kamu sedang mode tamu (anonim).'}</p>
    <div class="pill-group" id="fbType">${[['saran', '💡 Saran'], ['kritik', '🗣️ Kritik'], ['bug', '🐞 Lapor bug'], ['pujian', '💖 Pujian']].map(([k, l]) => `<button class="pill ${k === type ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="fb-stars" id="fbStars" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" aria-label="${n} bintang">★</button>`).join('')}<span class="dim" id="fbStarT">Beri rating (opsional)</span></div>
    <textarea id="fbMsg" class="input" rows="5" maxlength="1500" placeholder="Tulis kritik, saran, atau masalah yang kamu temui…" style="width:100%;margin-top:10px"></textarea>
    <div class="row between" style="margin-top:6px"><span class="dim" id="fbCount">0/1500</span></div>
    <button class="btn block" id="fbSend" style="margin-top:10px">📨 Kirim ke admin</button>`,
  (el, close) => {
    const RT = ['', 'Kurang 😕', 'Lumayan 🙂', 'Bagus 😊', 'Keren 😃', 'Mantap banget 🤩'];
    $$('#fbType .pill', el).forEach(b => (b.onclick = () => { type = b.dataset.k; $$('#fbType .pill', el).forEach(x => x.classList.toggle('on', x === b)); }));
    $$('#fbStars button', el).forEach(b => (b.onclick = () => { rating = +b.dataset.n; $$('#fbStars button', el).forEach(x => x.classList.toggle('on', +x.dataset.n <= rating)); $('#fbStarT', el).textContent = RT[rating]; sfx('click'); }));
    const msg = $('#fbMsg', el); msg.oninput = () => ($('#fbCount', el).textContent = `${msg.value.length}/1500`); setTimeout(() => msg.focus(), 150);
    $('#fbSend', el).onclick = async () => {
      const b = $('#fbSend', el);
      if (msg.value.trim().length < 5) return toast('Tulis pesan minimal 5 karakter', 'err');
      b.disabled = true; b.innerHTML = '<span class="spinner"></span> Mengirim…';
      try {
        await api('/presence?op=feedback', { method: 'POST', body: { type, rating, message: msg.value, page: (location.hash.split('?')[0].replace('#/', '') || 'beranda') } });
        localStorage.setItem(K_SENT, Date.now()); sfx('send'); close();
        toast('Terima kasih! Pesanmu sudah diterima admin 🙏', 'ok');
      } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = '📨 Kirim ke admin'; }
    };
  });
}
