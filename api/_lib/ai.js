// Integrasi Gemini API (REST) dengan beberapa model bergiliran.
// - GEMINI_MODELS: daftar model dipisah koma, urut prioritas (opsional)
//   contoh: gemini-3.6-flash,gemini-4-hydrogen,gemini-3.5-flash-lite
// - GEMINI_MODEL / GEMINI_FALLBACK_MODEL tetap didukung (dipakai bila GEMINI_MODELS kosong)
// ID model dicocokkan otomatis dengan daftar model resmi (ListModels), jadi "Gemini 4 Hydrogen",
// "gemini-4-hydrogen", atau "models/gemini-4-hydrogen" sama-sama dikenali.
// Model yang kena batas (429) diistirahatkan sementara, permintaan berikutnya pindah ke model lain.
export function aiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

export class QuotaError extends Error {
  constructor(msg) { super(msg); this.quota = true; }
}

const DEFAULTS = ['gemini-3.6-flash', 'gemini-4-hydrogen', 'gemini-3.5-flash-lite'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().replace(/^models\//, '').replace(/[^a-z0-9]/g, '');
const API = 'https://generativelanguage.googleapis.com/v1beta';

function wanted() {
  const env = (process.env.GEMINI_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const list = env.length ? env : [process.env.GEMINI_MODEL, ...DEFAULTS, process.env.GEMINI_FALLBACK_MODEL];
  const seen = new Set();
  return list.filter(Boolean).filter(m => (seen.has(norm(m)) ? false : seen.add(norm(m))));
}

// Cocokkan nama yang ditulis dengan ID resmi dari ListModels (di-cache 6 jam)
let catalog = null;
async function resolveModels() {
  const want = wanted();
  if (!catalog || Date.now() - catalog.at > 6 * 3600e3) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`${API}/models?pageSize=200`, { signal: ctrl.signal, headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
      clearTimeout(t);
      if (r.ok) {
        const j = await r.json();
        const items = (j.models || []).filter(m => (m.supportedGenerationMethods || ['generateContent']).includes('generateContent'));
        catalog = { at: Date.now(), items: items.map(m => ({ id: m.name.replace(/^models\//, ''), keys: [norm(m.name), norm(m.displayName), norm(m.baseModelId)] })) };
      }
    } catch { /* gagal ambil katalog → pakai nama apa adanya */ }
    if (!catalog) catalog = { at: Date.now() - 6 * 3600e3 + 60e3, items: [] }; // coba lagi 1 menit lagi
  }
  if (!catalog.items.length) return want.map(m => m.replace(/^models\//, ''));
  const out = [];
  for (const w of want) {
    const k = norm(w);
    const hit = catalog.items.find(m => m.keys[0] === k) || catalog.items.find(m => m.keys.includes(k));
    if (hit && !out.includes(hit.id)) out.push(hit.id);
    else if (!hit) console.warn(`[ai] model "${w}" tidak ada di daftar model API key ini, dilewati`);
  }
  return out.length ? out : want.map(m => m.replace(/^models\//, ''));
}

// Istirahatkan model yang kena batas: per-menit → 65 dtk, harian → sampai reset (≈ 15.00 WIB)
const cool = new Map();
function untilDailyReset() {
  const d = new Date(); const pt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(pt); next.setHours(24, 2, 0, 0);
  return Date.now() + (next - pt);
}
let rr = 0;

async function callModel(model, prompt, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    if (!r.ok) {
      const txt = await r.text();
      const e = new Error(`Gemini ${r.status} (${model})`);
      e.status = r.status; e.detail = txt.slice(0, 600);
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
export async function geminiJSON(prompt, { deadline = Date.now() + 45000, prefer } = {}) {
  const all = await resolveModels();
  // giliran bergantian: permintaan paralel tersebar ke model berbeda (hemat batas per menit)
  const start = rr++ % all.length;
  let order = [...all.slice(start), ...all.slice(0, start)];
  // prefer 'lite': tugas ringan (Mentor AI) memakai model ringan dulu (kuotanya paling longgar),
  // model lain hanya cadangan bila model ringan sedang kena batas
  if (prefer === 'lite') { const lite = all.filter(m => /lite/i.test(m)); order = [...lite, ...order.filter(m => !lite.includes(m))]; }
  const ready = order.filter(m => (cool.get(m) || 0) < Date.now());
  const list = ready.length ? ready : order;
  let lastErr, sawDaily = false, sawMinute = false;
  for (let i = 0; i < list.length; i++) {
    const model = list[i];
    const left = deadline - Date.now() - 1000;
    if (left < 8000) break;
    const budget = i < list.length - 1 ? Math.min(left - 12000, 40000) : left;
    try {
      return await callModel(model, prompt, Math.max(8000, budget));
    } catch (e) {
      lastErr = e;
      if (e.status === 429) {
        const daily = /PerDay|per day|daily/i.test(e.detail || '');
        cool.set(model, daily ? untilDailyReset() : Date.now() + 65000);
        daily ? (sawDaily = true) : (sawMinute = true);
      } else if (e.status === 404) cool.set(model, Date.now() + 6 * 3600e3);
      else if (e.status === 503) cool.set(model, Date.now() + 20000);
      if (![429, 503, 504, 404, 400].includes(e.status) || (e.status === 400 && !/model/i.test(e.detail || ''))) throw e;
      console.warn(`[ai] ${model} gagal (${e.status}), pindah ke model berikutnya…`);
      if (i < list.length - 1) await sleep(300);
    }
  }
  if (lastErr?.status === 429) throw new QuotaError(sawMinute && !sawDaily
    ? 'Batas per menit Gemini tercapai di semua model. Tunggu ±1 menit lalu coba lagi.'
    : 'Kuota harian gratis Gemini habis di semua model. Direset otomatis sekitar pukul 15.00 WIB.');
  if (lastErr?.status === 503 || lastErr?.status === 504 || !lastErr) throw new Error('Server Gemini sedang sibuk/lambat (banyak pengguna). Coba lagi beberapa menit lagi.');
  if (lastErr?.status === 404) throw new Error('Nama model Gemini tidak ditemukan. Periksa env GEMINI_MODELS / GEMINI_MODEL di Vercel.');
  throw lastErr;
}

// Info untuk panel admin
export async function aiModelsInfo() {
  const all = await resolveModels().catch(() => wanted());
  return all.map(m => ({ id: m, restUntil: (cool.get(m) || 0) > Date.now() ? cool.get(m) : null }));
}
