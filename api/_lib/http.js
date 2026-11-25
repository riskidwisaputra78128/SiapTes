// Helper HTTP yang kompatibel dengan Vercel Node Functions & dev-server lokal
export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

function safeJSON(s) {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return safeJSON(req.body);
    if (Buffer.isBuffer(req.body)) return safeJSON(req.body.toString('utf8'));
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 200_000) throw httpError(413, 'Data terlalu besar');
    chunks.push(c);
  }
  return safeJSON(Buffer.concat(chunks).toString('utf8'));
}

export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export function handle(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) throw httpError(405, 'Metode tidak didukung');
      await fn(req, res);
    } catch (e) {
      if (!e.expose) console.error(e);
      send(res, e.status || 500, { error: e.expose ? e.message : 'Terjadi kesalahan server. Coba lagi.' });
    }
  };
}

// Waktu Indonesia Barat (UTC+7) untuk pengelompokan harian/mingguan/bulanan
export const WIB = 7 * 3600 * 1000;
export function wibDate(ms) { return new Date(ms + WIB); }
export function dayKey(ms) { return wibDate(ms).toISOString().slice(0, 10); }
export function monthKey(ms) { return wibDate(ms).toISOString().slice(0, 7); }
export function startOfDayWIB(ms) {
  const d = wibDate(ms); d.setUTCHours(0, 0, 0, 0); return d.getTime() - WIB;
}
export function startOfWeekWIB(ms) { // Senin
  const s = startOfDayWIB(ms); const dow = (wibDate(s).getUTCDay() + 6) % 7; return s - dow * 86400000;
}
export function startOfMonthWIB(ms) {
  const d = wibDate(ms); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.getTime() - WIB;
}
