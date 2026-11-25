// Integrasi Gemini API (REST). Model bisa diganti lewat env GEMINI_MODEL.
// Catatan: model Gemini 3.x tidak lagi menerima parameter temperature/top_p/top_k.
export function aiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

export async function geminiJSON(prompt, { timeoutMs = 45000 } = {}) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Gemini ${r.status}: ${txt.slice(0, 300)}`);
    }
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  } finally {
    clearTimeout(t);
  }
}
