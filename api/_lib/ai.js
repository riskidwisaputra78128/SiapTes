// Integrasi Gemini API (REST).
// - GEMINI_MODEL: model utama (default gemini-3.6-flash)
// - GEMINI_FALLBACK_MODEL: model cadangan saat model utama sibuk/kuota habis (default gemini-3.5-flash-lite)
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  } catch (e) {
    // Error bawaan (AbortError/DOMException) tidak boleh diubah → bungkus jadi Error baru
    if (e?.name === 'AbortError') { const te = new Error(`Gemini terlalu lama merespons (${model})`); te.status = 504; throw te; }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Panggil Gemini & kembalikan JSON.
 * deadline: batas waktu absolut (ms epoch) agar tidak melewati batas durasi fungsi Vercel.
 */
export async function geminiJSON(prompt, { deadline = Date.now() + 45000 } = {}) {
  let lastErr;
  const list = models();
  for (let i = 0; i < list.length; i++) {
    const model = list[i];
    const left = deadline - Date.now() - 1000;
    if (left < 8000) break;                                   // waktu tidak cukup untuk percobaan lagi
    // model utama boleh memakai sebagian besar waktu, sisakan ±15 dtk untuk model cadangan
    const budget = i < list.length - 1 ? Math.min(left - 15000, 40000) : left;
    try {
      return await callModel(model, prompt, Math.max(8000, budget));
    } catch (e) {
      lastErr = e;
      if (e.status === 503 && deadline - Date.now() > 20000) {   // sibuk sesaat → coba sekali lagi
        await sleep(1500);
        try { return await callModel(model, prompt, Math.min(20000, deadline - Date.now() - 1000)); } catch (e2) { lastErr = e2; }
      }
      if (![429, 503, 504, 404].includes(lastErr.status)) throw lastErr;
      console.warn(`[ai] ${model} gagal (${lastErr.status}), mencoba model cadangan…`);
    }
  }
  if (lastErr?.status === 429) throw new QuotaError('Kuota gratis Gemini sedang habis. Coba lagi beberapa menit lagi atau besok (kuota harian direset otomatis).');
  if (lastErr?.status === 503 || lastErr?.status === 504 || !lastErr) throw new Error('Server Gemini sedang sibuk/lambat (banyak pengguna). Coba lagi beberapa menit lagi.');
  if (lastErr?.status === 404) throw new Error('Nama model Gemini tidak ditemukan. Periksa env GEMINI_MODEL di Vercel.');
  throw lastErr;
}
