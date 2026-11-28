// 📊 Pemantau kuota untuk panel admin: Firestore (baca/tulis), pengguna aktif harian, pemakaian Gemini.
// Kuota gratis Firestore & Gemini direset tengah malam waktu Pasifik (± pukul 14.00/15.00 WIB),
// jadi semua hitungan di sini memakai "hari kuota" itu.
import { uidKey } from './auth.js';

export const FS_LIMITS = { r: 50000, w: 20000, d: 20000 };

// ───── hari kuota (Pasifik) ─────
const ptParts = ms => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
export function qDay(ms = Date.now()) { const p = ptParts(ms); return `${p.year}-${p.month}-${p.day}`; }
/** Waktu (ms) reset kuota terakhir & berikutnya */
export function quotaWindow(now = Date.now()) {
  const p = ptParts(now);
  const sinceMidnight = ((+p.hour * 60 + +p.minute) * 60 + +p.second) * 1000 + (now % 1000);
  const start = now - sinceMidnight;
  return { start, next: start + 86400000 };
}

// ───── penghitung operasi Firestore (perkiraan, dari kode server sendiri) ─────
const ops = globalThis.__fsOps || (globalThis.__fsOps = { r: 0, w: 0, d: 0, last: Date.now(), flushing: false });
const FLUSH_MS = 5 * 60 * 1000;
const READ_RE = /^(get|list|count)/, DEL_RE = /^(delete|prune)/, WRITE_RE = /^(add|set|update|bump|create)/;

/** Bungkus backend database agar setiap operasi ikut terhitung. */
export function countOps(be) {
  if (be.kind === 'memory' && !process.env.QUOTA_COUNT_MEMORY) return be;
  for (const [k, fn] of Object.entries(be)) {
    if (typeof fn !== 'function') continue;
    be[k] = async (...a) => {
      const r = await fn.apply(be, a);
      if (READ_RE.test(k)) ops.r += Array.isArray(r) ? Math.max(1, r.length) : k === 'countQuestions' ? 1 : 1;
      else if (DEL_RE.test(k)) ops.d += typeof r === 'number' ? Math.max(1, r) : Array.isArray(a[0]) ? a[0].length : 1;
      else if (k === 'createRoom' || k === 'updateRoom') { ops.r += 1; ops.w += 1; }
      else if (WRITE_RE.test(k)) ops.w += Array.isArray(a[0]) ? Math.max(1, a[0].length) : 1;
      if (!ops.flushing && Date.now() - ops.last > FLUSH_MS) flushOps(be);
      return r;
    };
  }
  return be;
}
async function flushOps(be) {
  const delta = { r: ops.r, w: ops.w + 1, d: ops.d };
  if (!delta.r && delta.w <= 1 && !delta.d) { ops.last = Date.now(); return; }
  ops.flushing = true; ops.r = ops.w = ops.d = 0; ops.last = Date.now();
  try { await be.bumpBoard('fsops-' + qDay(), 'all', {}, delta); }
  catch { ops.r += delta.r; ops.w += delta.w - 1; ops.d += delta.d; }
  finally { ops.flushing = false; }
}
export const pendingOps = () => ({ r: ops.r, w: ops.w, d: ops.d });

// ───── pengguna aktif per hari kuota ─────
const dauSeen = globalThis.__dauSeen || (globalThis.__dauSeen = { day: '', set: new Set() });
export async function recordActive(db, uid) {
  const day = qDay();
  if (dauSeen.day !== day) Object.assign(dauSeen, { day, set: new Set() });
  const k = uidKey(uid);
  if (dauSeen.set.has(k)) return;
  dauSeen.set.add(k);
  await db.setMetaField('dau-' + day, k, 1).catch(() => dauSeen.set.delete(k));
}

// ───── pemakaian Gemini ─────
const safe = s => String(s || 'lain').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
export function recordAI(model, feature, kind) {
  import('./db.js').then(m => m.getDB()).then(db => db.bumpBoard && db.bumpBoard('aiuse-' + qDay(), 'm_' + safe(model), {}, { [kind]: 1, ...(kind === 'ok' ? { ['f_' + safe(feature)]: 1 } : {}) })).catch(() => {});
}

// ───── data resmi Google Cloud Monitoring (bila service account diberi peran "Monitoring Viewer") ─────
const monCache = globalThis.__monCache || (globalThis.__monCache = { at: 0, v: null, err: '' });
async function monitoringCounts(start, end) {
  if (Date.now() - monCache.at < 5 * 60000) return monCache;
  monCache.at = Date.now();
  try {
    const { getApps } = await import('firebase-admin/app');
    const app = getApps()[0];
    if (!app) throw new Error('memory');
    const tok = (await app.options.credential.getAccessToken()).access_token;
    const pid = app.options.credential.projectId || JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim().startsWith('{') ? process.env.FIREBASE_SERVICE_ACCOUNT : Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')).project_id;
    const one = async metric => {
      const q = new URLSearchParams({
        filter: `metric.type="firestore.googleapis.com/document/${metric}"`,
        'interval.startTime': new Date(start).toISOString(), 'interval.endTime': new Date(end).toISOString(),
        'aggregation.alignmentPeriod': '3600s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM',
      });
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${pid}/timeSeries?${q}`, { headers: { authorization: 'Bearer ' + tok }, signal: ctrl.signal });
        if (!r.ok) throw Object.assign(new Error('mon ' + r.status), { status: r.status });
        const j = await r.json();
        return (j.timeSeries || []).reduce((s, ts) => s + (ts.points || []).reduce((a, p) => a + Number(p.value?.int64Value || 0), 0), 0);
      } finally { clearTimeout(t); }
    };
    const [r, w, d] = await Promise.all([one('read_count'), one('write_count'), one('delete_count')]);
    monCache.v = { r, w, d }; monCache.err = '';
  } catch (e) {
    monCache.v = null;
    monCache.err = e.message === 'memory' ? 'memory' : e.status === 403 ? 'izin' : 'gagal';
  }
  return monCache;
}

/** Laporan lengkap untuk kartu admin. */
export async function quotaReport(db, { onlineNow = 0, aiModels = [] } = {}) {
  const now = Date.now();
  const { start, next } = quotaWindow(now);
  const day = qDay(now);
  const [counted, dau, ai, settings, mon] = await Promise.all([
    db.getMeta('fsops-' + day).catch(() => null),
    db.getMeta('dau-' + day).catch(() => null),
    db.getMeta('aiuse-' + day).catch(() => null),
    db.getMeta('settings').catch(() => null),
    monitoringCounts(start, now),
  ]);
  const p = pendingOps(), c = counted?.all || {};
  const est = { r: (c.r || 0) + p.r, w: (c.w || 0) + p.w, d: (c.d || 0) + p.d };
  const used = mon.v ? { ...mon.v } : est;
  const active = Math.max(Object.keys(dau || {}).length, onlineNow);
  // biaya per pengguna: dari pemakaian hari ini (min. angka wajar supaya tidak terlalu optimistis di awal hari)
  const per = { r: Math.max(active ? used.r / active : 0, 150), w: Math.max(active ? used.w / active : 0, 50) };
  const left = { r: Math.max(0, FS_LIMITS.r - used.r), w: Math.max(0, FS_LIMITS.w - used.w), d: Math.max(0, FS_LIMITS.d - used.d) };
  const more = Math.floor(Math.min(left.r / per.r, left.w / per.w));
  // Gemini
  const limits = settings?.aiLimits || {};
  const models = new Map();
  for (const m of aiModels) models.set(safe(m.id), { id: m.id, ok: 0, limit: 0, restUntil: m.restUntil });
  const features = {};
  for (const [k, v] of Object.entries(ai || {})) {
    if (!k.startsWith('m_')) continue;
    const id = k.slice(2);
    const row = models.get(id) || { id, ok: 0, limit: 0, restUntil: null };
    row.ok += v.ok || 0; row.hit = (row.hit || 0) + (v.limit || 0);
    for (const [f, n] of Object.entries(v)) if (f.startsWith('f_')) features[f.slice(2)] = (features[f.slice(2)] || 0) + n;
    models.set(id, row);
  }
  const modelRows = [...models.values()].map(m => ({ ...m, limit: Number(limits[m.id]) || 0 }));
  return {
    day, resetAt: next, since: start,
    active, onlineNow,
    firestore: { used, limits: FS_LIMITS, left, source: mon.v ? 'monitoring' : 'estimate', monErr: mon.err, perUser: { r: Math.round(per.r), w: Math.round(per.w) }, moreUsers: more,
      pct: { r: Math.round((used.r / FS_LIMITS.r) * 100), w: Math.round((used.w / FS_LIMITS.w) * 100) } },
    ai: { models: modelRows, features, total: modelRows.reduce((s, m) => s + m.ok, 0) },
  };
}
