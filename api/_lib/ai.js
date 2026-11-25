// Integrasi Gemini API (REST).
// - GEMINI_MODEL: model utama (default gemini-3.6-flash)
// - GEMINI_FALLBACK_MODEL: model cadangan saat kuota model utama habis (default gemini-3.5-flash-lite)
// Catatan: model Gemini 3.x tidak lagi menerima parameter temperature/top_p/top_k.
export function aiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

export class QuotaError extends Error {
  constructor(msg) { super(msg); this.quota = true; }
}

function models() {
  const list = [process.env.GEMINI_MODEL || 'gemini-3.6-flash', process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite'];
  return [...new Set(list.filter(Boolean))];
}

async function callModel(model, prompt, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    if (!r.ok) {
      const txt = await r.text();
      const e = new Error(`Gemini ${r.status} (${model})`);
      e.status = r.status; e.detail = txt.slice(0, 300);
      throw e;
    }
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  } finally {
    clearTimeout(t);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function geminiJSON(prompt, { timeoutMs = 24000 } = {}) {
  let lastErr;
  for (const model of models()) {
    try {
      try { return await callModel(model, prompt, timeoutMs); }
      catch (e) {
        // server sibuk/timeout → tunggu sebentar lalu coba sekali lagi di model yang sama
        if (e.status === 503 || e.name === 'AbortError') { await sleep(1500); return await callModel(model, prompt, timeoutMs); }
        throw e;
      }
    } catch (e) {
      if (e.name === 'AbortError') { e.status = 503; e.message = `Gemini terlalu lama merespons (${model})`; }
      lastErr = e;
      // 429 (kuota) / 503 (sibuk) / 404 (model tidak tersedia) → coba model berikutnya
      if (![429, 503, 404].includes(e.status)) throw e;
      console.warn(`[ai] ${model} gagal (${e.status}), mencoba model cadangan…`);
    }
  }
  if (lastErr?.status === 429) throw new QuotaError('Kuota gratis Gemini sedang habis. Coba lagi beberapa menit lagi atau besok (kuota harian direset otomatis).');
  if (lastErr?.status === 503) throw new Error('Server Gemini sedang sibuk (banyak pengguna). Coba lagi beberapa menit lagi.');
  if (lastErr?.status === 404) throw new Error('Nama model Gemini tidak ditemukan. Periksa env GEMINI_MODEL di Vercel.');
  throw lastErr;
}
