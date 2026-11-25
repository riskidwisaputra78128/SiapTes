// Klien API + penyimpanan sesi
const KEY_T = 'sl_token', KEY_U = 'sl_user', KEY_G = 'sl_guest';

export const session = {
  get token() { return localStorage.getItem(KEY_T); },
  get user() { try { return JSON.parse(localStorage.getItem(KEY_U) || 'null'); } catch { return null; } },
  get guest() { return localStorage.getItem(KEY_G) === '1'; },
  get loggedIn() { return !!this.token && !!this.user; },
  set(token, user) { localStorage.setItem(KEY_T, token); localStorage.setItem(KEY_U, JSON.stringify(user)); localStorage.removeItem(KEY_G); },
  setGuest() { localStorage.setItem(KEY_G, '1'); },
  clear() { [KEY_T, KEY_U, KEY_G].forEach(k => localStorage.removeItem(k)); },
};

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
  if (r.status === 401 && session.token && path !== '/auth') {
    session.clear();
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!r.ok) throw new Error(data.error || `Gagal memuat (${r.status})`);
  return data;
}
