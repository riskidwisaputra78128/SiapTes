// Klien API + penyimpanan sesi
const KEY_T = 'sl_token', KEY_U = 'sl_user', KEY_G = 'sl_guest';

export const session = {
  get token() { return localStorage.getItem(KEY_T); },
  get user() { try { return JSON.parse(localStorage.getItem(KEY_U) || 'null'); } catch { return null; } },
  get guest() { return localStorage.getItem(KEY_G) === '1'; },
  get loggedIn() { return !!this.token && !!this.user; },
  set(token, user) { localStorage.setItem(KEY_T, token); localStorage.setItem(KEY_U, JSON.stringify(user)); localStorage.removeItem(KEY_G); },
  patch(fields) { const u = this.user; if (u) localStorage.setItem(KEY_U, JSON.stringify({ ...u, ...fields })); },
  setGuest() { localStorage.setItem(KEY_G, '1'); },
  clear() { [KEY_T, KEY_U, KEY_G].forEach(k => localStorage.removeItem(k)); },
};

// Info publik (berita + jumlah bank soal), di-cache 60 detik agar tidak dipanggil berulang
let infoCache = null;
export function getInfo(force = false) {
  if (force || !infoCache || Date.now() - infoCache.at > 60000) {
    infoCache = { at: Date.now(), p: api(force ? '/news?t=' + Date.now() : '/news').catch(e => { infoCache = null; throw e; }) };
  }
  return infoCache.p;
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers.Authorization = 'Bearer ' + session.token;
  let r;
  try {
    r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Tidak ada koneksi internet');
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (r.headers.get('X-Server-Busy') || data.serverBusy) window.dispatchEvent(new Event('server:busy'));
  else if (r.ok) window.dispatchEvent(new Event('server:ok'));
  if (r.status === 401 && session.token && path !== '/auth') {
    session.clear();
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!r.ok) throw Object.assign(new Error(data.error || `Gagal memuat (${r.status})`), { status: r.status, data });
  if (method !== 'GET' && /^\/(attempt|duel|auth)/.test(path)) dropCache();   // ada hasil latihan/duel baru → statistik & peringkat dimuat ulang
  return data;
}

// Cache ringan di browser (memori + sessionStorage) untuk data milik pengguna yang sering dibuka ulang
// (statistik, peringkat). Otomatis dibuang saat ada latihan/duel baru.
const memo = new Map();
const CK = 'sl_c:';
export function cachedApi(path, ttl = 60000) {
  const k = (session.user?.uid || 'anon') + '|' + path;
  let c = memo.get(k);
  if (!c) { try { const o = JSON.parse(sessionStorage.getItem(CK + k) || 'null'); if (o) c = { at: o.at, p: Promise.resolve(o.d) }; } catch {} }
  if (c && Date.now() - c.at < ttl) return c.p;
  const p = api(path).then(d => { try { sessionStorage.setItem(CK + k, JSON.stringify({ at: Date.now(), d })); } catch {} return d; })
    .catch(e => { memo.delete(k); throw e; });
  memo.set(k, { at: Date.now(), p });
  return p;
}
export function dropCache() {
  memo.clear();
  try { Object.keys(sessionStorage).filter(k => k.startsWith(CK)).forEach(k => sessionStorage.removeItem(k)); } catch {}
}
