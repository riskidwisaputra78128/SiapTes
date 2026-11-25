import { $$, sheet, toast } from './ui.js';

export const THEMES = [
  { key: 'dark', name: 'Gelap', ico: '🌙', desc: 'Default, nyaman malam hari', meta: '#070b1a',
    prev: { bg: 'linear-gradient(135deg,#070b1a,#1e1b4b)', card: 'rgba(255,255,255,.08)', a: '#22d3ee', b: '#a78bfa' } },
  { key: 'light', name: 'Terang', ico: '☀️', desc: 'Bersih & cerah untuk siang', meta: '#eef2fb',
    prev: { bg: 'linear-gradient(135deg,#eef2fb,#e0e7ff)', card: '#ffffff', a: '#06b6d4', b: '#6366f1' } },
  { key: 'dongeng', name: 'Negeri Dongeng', ico: '🏰', desc: 'Pastel ajaib penuh kilau', meta: '#fdf2fb',
    prev: { bg: 'linear-gradient(135deg,#fce7f3,#e0e7ff,#dbeafe)', card: 'rgba(255,255,255,.8)', a: '#f472b6', b: '#a78bfa' } },
  { key: 'modern', name: 'Modern', ico: '⚡', desc: 'Hitam pekat, aksen neon lime', meta: '#09090b',
    prev: { bg: '#09090b', card: '#18181b', a: '#a3e635', b: '#22d3ee' } },
  { key: 'pro', name: 'Profesional', ico: '💼', desc: 'Navy elegan ala korporat', meta: '#f5f6f8',
    prev: { bg: '#f5f6f8', card: '#ffffff', a: '#1e3a8a', b: '#b7791f' } },
];
const KEY = 'sl_theme';

export function currentTheme() {
  try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; }
}

export function applyTheme(key, { save = true } = {}) {
  const t = THEMES.find(x => x.key === key) || THEMES[0];
  if (t.key === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t.key);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.meta);
  if (save) { try { localStorage.setItem(KEY, t.key); } catch {} }
  window.dispatchEvent(new CustomEvent('theme:change', { detail: t.key }));
  return t;
}

export function openThemePicker() {
  const cur = currentTheme();
  sheet(`
    <div class="row between"><h3 class="h2">🎨 Pilih tema</h3><span class="dim">tersimpan di perangkat ini</span></div>
    <div class="theme-grid">${THEMES.map(t => `
      <button class="theme-opt ${t.key === cur ? 'on' : ''}" data-theme-key="${t.key}">
        <div class="theme-prev" style="background:${t.prev.bg}">
          <span class="card-mini" style="background:${t.prev.card};box-shadow:0 2px 8px rgba(0,0,0,.15)"></span>
          <i style="width:40%;background:${t.prev.a}"></i><i style="width:25%;background:${t.prev.b}"></i>
        </div>
        <div class="theme-meta"><b>${t.ico} ${t.name}</b><span>${t.desc}</span></div>
      </button>`).join('')}
    </div>`,
  (el, close) => {
    $$('[data-theme-key]', el).forEach(b => (b.onclick = () => {
      const t = applyTheme(b.dataset.themeKey);
      $$('[data-theme-key]', el).forEach(x => x.classList.toggle('on', x === b));
      toast(`Tema ${t.name} aktif ${t.ico}`, 'ok');
      setTimeout(close, 350);
    }));
  });
}
