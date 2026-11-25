// Status online: heartbeat berkala + widget "sedang online"
import { api, session } from './api.js';
import { $, $$, esc, sheet, timeAgo } from './ui.js';

const HIDE_KEY = 'sl_hide_online';
const BEAT_MS = 45000;
const ACTIVITY = {
  beranda: '🏠 Di beranda', latihan: '🎯 Memilih latihan', quiz: '✏️ Sedang mengerjakan soal', hasil: '📊 Melihat hasil',
  materi: '📖 Membaca materi', duel: '⚔️ Di Arena Duel', evaluasi: '📈 Melihat evaluasi', peringkat: '🏆 Melihat peringkat',
  profil: '👤 Di profil', teknologi: '⚙️ Melihat teknologi',
};
export const presence = { count: 0, users: [], duelCode: null, ready: false };
let timer = null, since = Date.now(), lastPage = '';

export const isHidden = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const pageNow = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'beranda');

async function beat(force = false) {
  if (!session.loggedIn) return;
  if (document.hidden && !force) return;
  try {
    const d = await api('/presence', { method: 'POST', body: { page: pageNow(), duel: presence.duelCode, since, hidden: isHidden() } });
    Object.assign(presence, { count: d.count, users: d.users, ready: true });
    window.dispatchEvent(new Event('presence:update'));
  } catch {}
}

export function startPresence() {
  if (timer) return;
  const loop = () => { beat(); timer = setTimeout(loop, BEAT_MS); };
  loop();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(true); });
  window.addEventListener('hashchange', () => {
    const p = pageNow();
    if (p !== lastPage) { lastPage = p; clearTimeout(window.__beatDeb); window.__beatDeb = setTimeout(() => beat(true), 1500); }
  });
}
export function setDuelPresence(code) { if (presence.duelCode !== code) { presence.duelCode = code; beat(true); } }
export function setHidden(v) { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch {} beat(true); }
export function refreshPresence() { return beat(true); }

const initials = n => esc(String(n || '?').trim()[0]?.toUpperCase() || '?');
const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export function avatarStack(users, max = 5) {
  return `<div class="av-stack">${users.slice(0, max).map(u => `<span class="av" style="--h:${hue(u.name)}" title="${esc(u.name)}">${initials(u.name)}</span>`).join('')}
    ${users.length > max ? `<span class="av more">+${users.length - max}</span>` : ''}</div>`;
}

export function onlineWidget(el) {
  if (!el) return;
  const draw = () => {
    if (!document.body.contains(el)) { window.removeEventListener('presence:update', draw); return; }
    if (!session.loggedIn) { el.hidden = true; return; }
    const { count, users, ready } = presence;
    el.hidden = false;
    el.innerHTML = !ready ? '<div class="skeleton" style="height:44px"></div>' : `
      <button class="online-bar" id="onlineOpen">
        <span class="live-dot on"></span>
        <b>${count} orang sedang online</b>
        ${avatarStack(users)}
        <span class="grad-text" style="margin-left:auto;font-weight:800">Lihat →</span>
      </button>
      <a class="btn ghost sm block" href="#/kantor" style="margin-top:8px">🏢 Lihat di Kantor Live 3D</a>`;
    $('#onlineOpen', el)?.addEventListener('click', openOnlineList);
  };
  draw();
  window.addEventListener('presence:update', draw);
}

export function openOnlineList() {
  refreshPresence();
  const body = () => {
    const { users } = presence;
    return users.length ? users.map(u => `
      <div class="ol-row ${u.me ? 'me' : ''}">
        <span class="av lg" style="--h:${hue(u.name)}">${initials(u.name)}<i class="live-dot on"></i></span>
        <div style="flex:1;min-width:0">
          <b>${esc(u.name)}${u.me ? ' (kamu)' : ''}</b>
          <div class="dim">${ACTIVITY[u.page] || '🟢 Online'}${u.target ? ` · 🎯 ${esc(u.target)}` : ''}</div>
          <div class="dim" style="font-size:11px">${timeAgo(u.since) === 'baru saja' ? 'Baru saja online' : `Online sejak ${timeAgo(u.since)}`}</div>
        </div>
        ${u.duel && !u.me ? `<a class="btn sm" href="#/duel?code=${u.duel}">⚔️ Gabung</a>` : ''}
      </div>`).join('') : '<div class="empty">Belum ada yang online.</div>';
  };
  sheet(`
    <div class="row between"><h3 class="h2">🟢 Sedang online</h3><span class="dim" id="olCount">${presence.count} orang</span></div>
    <p class="dim" style="margin:4px 0 10px">Diperbarui otomatis. Status online bisa disembunyikan di menu Profil.</p>
    <div class="ol-list" id="olList">${body()}</div>`,
  (el, close) => {
    const upd = () => { if (!document.body.contains(el)) return window.removeEventListener('presence:update', upd); $('#olList', el).innerHTML = body(); $('#olCount', el).textContent = `${presence.count} orang`; $$('a', el).forEach(a => a.addEventListener('click', close)); };
    window.addEventListener('presence:update', upd);
    $$('a', el).forEach(a => a.addEventListener('click', close));
  });
}
