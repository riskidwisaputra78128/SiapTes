// Kirim aksi ke Google Apps Script (GAS_URL + GAS_API_KEY)
export async function gasCall(payload, ms = 8000) {
  if (!process.env.GAS_URL) return null;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(process.env.GAS_URL, { method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, apiKey: process.env.GAS_API_KEY }) });
    return JSON.parse(await r.text());
  } catch { return null; } finally { clearTimeout(t); }
}
