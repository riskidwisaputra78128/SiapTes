// Langganan SiapLolos: Tamu · Free · Plus · Pro
// - Status langganan disimpan di meta 'subs' { uidKey: { tier, until, uid, name, email, src, at } } (until 0 = tanpa batas)
// - Pemakaian harian/mingguan (untuk batas Free/Plus) di meta 'use-<hari WIB>' & 'simuse-<awal minggu WIB>'
// - Pembayaran lewat Midtrans Snap (utama) atau Xendit Invoice (cadangan): tagihan dicatat di meta 'inv'
//   lalu dikonfirmasi notifikasi/webhook dari gateway (Midtrans: settlement · Xendit: PAID)
import { httpError, startOfDayWIB, startOfWeekWIB } from './http.js';
import { isAdmin, uidKey } from './auth.js';

export const TIERS = ['guest', 'free', 'plus', 'pro'];
export const TIER_NAME = { guest: 'Tamu', free: 'Free', plus: 'Plus', pro: 'Pro' };
export const DEFAULT_PRICES = { plus: 29000, pro: 59000 };
export const PERIOD_DAYS = 30;
export const REMIND_DAYS = 5;
export const TRIAL_DAYS = 3;
const INF = 1e9;

// Hak akses tiap paket (cerminannya ada di public/js/plan.js)
export const LIMITS = {
  guest: { practice: false, sessions: 0, maxCount: 0, levels: [], modes: [], sims: {}, tutor: 0, duelPerDay: 0, dailyMaterials: 0, essay: false },
  free: { practice: true, sessions: 3, maxCount: 10, levels: ['easy', 'normal'], modes: ['pg', 'game'], sims: { skd: 1 }, tutor: 3, duelPerDay: 3, dailyMaterials: 3, essay: false },
  plus: { practice: true, sessions: INF, maxCount: 30, levels: ['easy', 'normal', 'hard'], modes: ['pg', 'game', 'essay', 'interaktif'], sims: { skd: INF, telkom: INF, bi: 2, ojk: 2 }, tutor: 20, duelPerDay: INF, dailyMaterials: INF, essay: true },
  pro: { practice: true, sessions: INF, maxCount: 50, levels: ['easy', 'normal', 'hard', 'prof'], modes: ['pg', 'game', 'essay', 'interaktif'], sims: { skd: INF, telkom: INF, bi: INF, ojk: INF }, tutor: 60, duelPerDay: INF, dailyMaterials: INF, essay: true },
};

// ───── status langganan ─────
const subCache = globalThis.__subCache || (globalThis.__subCache = { at: 0, map: {} });
export async function subsMap(db, fresh = false) {
  if (fresh || Date.now() - subCache.at > 15000) subCache.map = (await db.getMeta('subs').catch(() => null)) || {}, subCache.at = Date.now();
  return subCache.map;
}
export function subOf(map, uid) {
  const s = map[uidKey(uid)];
  if (!s || !TIERS.includes(s.tier)) return null;
  return s;
}
/** { tier, until, src } — admin selalu Pro; langganan kedaluwarsa otomatis kembali ke Free */
export async function tierOf(db, user, fresh = false) {
  if (!user) return { tier: 'guest', until: 0 };
  if (isAdmin(user)) return { tier: 'pro', until: 0, admin: true };
  const s = subOf(await subsMap(db, fresh), user.uid);
  if (!s || s.tier === 'free') return { tier: 'free', until: 0 };
  if (s.until && s.until < Date.now()) return { tier: 'free', until: 0, expired: s.tier, expiredAt: s.until };
  return { tier: s.tier, until: s.until || 0, src: s.src || '' };
}

// ───── Free trial Plus 3 hari (sekali per akun) ─────
export async function trialUsed(db, user) {
  if (!user || isAdmin(user)) return true;
  const t = (await db.getMeta('trials').catch(() => null)) || {};
  if (t[uidKey(user.uid)]) return true;
  // akun yang pernah berlangganan/diberi paket tidak mendapat trial
  return !!subOf(await subsMap(db), user.uid);
}
// ───── Kode referal (diatur admin) — wajib untuk membuka trial ─────
const DEFAULT_REFCODES = { RISKI2026: { code: 'Riski2026', tier: 'plus', days: TRIAL_DAYS, active: true, max: 0, uses: 0, at: 0 } };
export const normCode = c => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
/** Peta kode referal. Dokumen belum pernah dibuat → kode bawaan Riski2026. */
export async function refCodes(db) {
  const m = await db.getMeta('refcodes').catch(() => null);
  if (!m || !m._init) { const o = { ...DEFAULT_REFCODES }; for (const [k, v] of Object.entries(m || {})) if (k !== '_init') o[k] = { ...(o[k] || {}), ...v }; return o; }
  const { _init, ...rest } = m; return rest;
}
async function ensureRefInit(db) {
  const m = await db.getMeta('refcodes').catch(() => null);
  if (m && m._init) return;
  for (const [k, v] of Object.entries(DEFAULT_REFCODES)) if (!m || !(k in m)) await db.setMetaField('refcodes', k, v);
  await db.setMetaField('refcodes', '_init', true);
}
export async function saveRefCode(db, { code, days, tier, active, max }) {
  const key = normCode(code);
  if (key.length < 3) throw httpError(400, 'Kode minimal 3 karakter (huruf/angka)');
  days = Math.round(Number(days)); max = Math.max(0, Math.round(Number(max) || 0));
  if (!(days >= 1 && days <= 90)) throw httpError(400, 'Durasi trial 1–90 hari');
  if (!['plus', 'pro'].includes(tier)) tier = 'plus';
  await ensureRefInit(db);
  const cur = (await refCodes(db))[key];
  const rec = { code: String(code).trim().slice(0, 32), tier, days, active: active !== false, max, uses: cur?.uses || 0, at: cur?.at || Date.now() };
  await db.setMetaField('refcodes', key, rec);
  return rec;
}
export async function deleteRefCode(db, code) {
  await ensureRefInit(db);
  await db.setMetaField('refcodes', normCode(code), null);
}
/** Cek kode tanpa memakainya. Melempar 400 bila tidak berlaku. */
export async function checkRefCode(db, code) {
  const key = normCode(code);
  if (!key) throw httpError(400, 'Masukkan kode referal');
  const r = (await refCodes(db))[key];
  if (!r || !r.active) throw httpError(400, 'Kode referal tidak valid');
  if (r.max && (r.uses || 0) >= r.max) throw httpError(400, 'Kuota kode referal ini sudah habis');
  return { key, ...r };
}
export async function startTrial(db, user, code) {
  if (!user) throw httpError(401, 'Masuk dulu untuk mencoba Plus');
  if (isAdmin(user)) throw httpError(400, 'Admin sudah memiliki akses Pro');
  const ref = await checkRefCode(db, code);
  if (await trialUsed(db, user)) throw httpError(409, 'Trial gratis hanya bisa dipakai sekali per akun');
  await db.setMetaField('trials', uidKey(user.uid), { at: Date.now(), uid: user.uid, email: String(user.email || '').toLowerCase(), code: ref.code });
  await ensureRefInit(db);
  if (db.bumpBoard) await db.bumpBoard('refcodes', ref.key, {}, { uses: 1 }).catch(() => {});
  const sub = await setSub(db, user, ref.tier || 'plus', { days: ref.days || TRIAL_DAYS, extend: false, src: 'trial', by: 'ref:' + ref.code });
  return { ...sub, days: ref.days || TRIAL_DAYS };
}
export async function setSub(db, user, tier, { days = PERIOD_DAYS, extend = true, src = 'admin', by = '' } = {}) {
  if (!['free', 'plus', 'pro'].includes(tier)) throw httpError(400, 'Paket tidak dikenal');
  const map = await subsMap(db, true);
  const cur = subOf(map, user.uid);
  const now = Date.now();
  let until = 0;
  if (tier !== 'free' && days > 0) {
    // perpanjangan: dihitung dari akhir langganan yang masih aktif dengan paket yang sama
    const base = extend && cur && cur.tier === tier && cur.until > now ? cur.until : now;
    until = base + days * 86400000;
  }
  const rec = tier === 'free' ? null : { tier, until, uid: user.uid, name: String(user.name || '').slice(0, 60), email: String(user.email || '').toLowerCase(), src, by, at: now };
  await db.setMetaField('subs', uidKey(user.uid), rec);
  subCache.at = 0;
  return rec ? { tier, until } : { tier: 'free', until: 0 };
}

// ───── pemakaian (Free/Plus) ─────
const dayKey = () => 'use-' + new Date(startOfDayWIB(Date.now()) + 7 * 3600e3).toISOString().slice(0, 10);
const weekKey = () => 'simuse-' + new Date(startOfWeekWIB(Date.now()) + 7 * 3600e3).toISOString().slice(0, 10);
async function usage(db, key, uid) { return ((await db.getMeta(key).catch(() => null)) || {})[uidKey(uid)] || {}; }
async function bump(db, key, uid, field) {
  if (db.bumpBoard) await db.bumpBoard(key, uidKey(uid), {}, { [field]: 1 }).catch(() => {});
}
const upgradeErr = (msg, need = 'plus') => Object.assign(httpError(403, msg), { extra: { upgrade: need } });

/** Validasi & catat satu sesi latihan sesuai paket. Melempar 401/403 bila tidak diizinkan. */
export async function guardPractice(db, user, { mode, difficulty, limit }) {
  const t = await tierOf(db, user), L = LIMITS[t.tier];
  if (t.tier === 'guest') throw Object.assign(httpError(401, 'Daftar atau masuk dulu untuk mulai latihan — gratis!'), { extra: { needLogin: true } });
  if (!L.modes.includes(mode)) throw upgradeErr(`Mode ini tersedia mulai paket Plus.`);
  if (difficulty === 'all' ? t.tier === 'free' : !L.levels.includes(difficulty)) throw upgradeErr(difficulty === 'prof' ? 'Level Prof khusus paket Pro.' : 'Level ini tersedia mulai paket Plus.', difficulty === 'prof' ? 'pro' : 'plus');
  if (limit > L.maxCount) throw upgradeErr(`Paket ${TIER_NAME[t.tier]} maksimal ${L.maxCount} soal per sesi.`, t.tier === 'plus' ? 'pro' : 'plus');
  if (L.sessions < INF) {
    const used = (await usage(db, dayKey(), user.uid)).s || 0;
    if (used >= L.sessions) throw upgradeErr(`Jatah ${L.sessions} sesi latihan hari ini sudah habis. Upgrade ke Plus untuk latihan tanpa batas.`);
    await bump(db, dayKey(), user.uid, 's');
  }
  return t;
}
export async function guardSim(db, user, exam) {
  const t = await tierOf(db, user), L = LIMITS[t.tier];
  if (t.tier === 'guest') throw Object.assign(httpError(401, 'Daftar atau masuk dulu untuk mengerjakan simulasi.'), { extra: { needLogin: true } });
  const quota = L.sims[exam] || 0;
  if (!quota) throw upgradeErr(exam === 'bi' || exam === 'ojk' ? 'Simulasi ini tersedia mulai paket Plus.' : 'Simulasi ini tersedia mulai paket Plus.');
  if (quota < INF) {
    const used = (await usage(db, weekKey(), user.uid))[exam] || 0;
    if (used >= quota) throw upgradeErr(`Jatah simulasi ${exam.toUpperCase()} minggu ini (${quota}x) sudah terpakai.`, t.tier === 'plus' ? 'pro' : 'plus');
    await bump(db, weekKey(), user.uid, exam);
  }
  return t;
}
export async function guardDuel(db, user) {
  const t = await tierOf(db, user), L = LIMITS[t.tier];
  if (L.duelPerDay >= INF) return t;
  const used = (await usage(db, dayKey(), user.uid)).d || 0;
  if (used >= L.duelPerDay) throw upgradeErr(`Jatah membuat ${L.duelPerDay} room duel hari ini sudah habis. Upgrade ke Plus untuk duel tanpa batas.`);
  await bump(db, dayKey(), user.uid, 'd');
  return t;
}
/** Sisa jatah hari ini & minggu ini (untuk ditampilkan) */
export async function usageSummary(db, user) {
  if (!user) return null;
  const [d, w] = await Promise.all([usage(db, dayKey(), user.uid), usage(db, weekKey(), user.uid)]);
  return { sessions: d.s || 0, duels: d.d || 0, sims: w };
}

// ───── harga (bisa diubah admin di meta 'settings'.prices) ─────
export async function pricesOf(db) {
  const s = (await db.getMeta('settings').catch(() => null)) || {};
  return { plus: Number(s.prices?.plus) || DEFAULT_PRICES.plus, pro: Number(s.prices?.pro) || DEFAULT_PRICES.pro };
}

// ───── Gateway pembayaran ─────
// Midtrans dipakai bila MIDTRANS_SERVER_KEY diisi; jika tidak, Xendit (XENDIT_SECRET_KEY); jika tidak ada keduanya → mode uji lokal.
const XENDIT = 'https://api.xendit.co/v2/invoices';
export const midtransReady = () => !!process.env.MIDTRANS_SERVER_KEY;
export const midtransProd = () => process.env.MIDTRANS_IS_PRODUCTION === 'true' && !/^SB-/.test(process.env.MIDTRANS_SERVER_KEY || '');
const midtransBase = () => (midtransProd() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com');
export const xenditReady = () => !!process.env.XENDIT_SECRET_KEY;
export const xenditTest = () => /^xnd_development_/.test(process.env.XENDIT_SECRET_KEY || '');
export const gateway = () => (midtransReady() ? 'midtrans' : xenditReady() ? 'xendit' : null);
export const gatewayTest = () => (midtransReady() ? !midtransProd() : xenditReady() ? xenditTest() : true);
export const payReady = () => !!gateway();

export async function createInvoice(db, user, plan, origin) {
  if (!['plus', 'pro'].includes(plan)) throw httpError(400, 'Paket tidak dikenal');
  if (isAdmin(user)) throw httpError(400, 'Akun admin sudah memiliki akses Pro');
  const price = (await pricesOf(db))[plan];
  const externalId = `sl-${plan}-${uidKey(user.uid)}-${Date.now().toString(36)}`;
  const rec = { uid: user.uid, name: String(user.name || '').slice(0, 60), email: String(user.email || '').toLowerCase(), plan, amount: price, status: 'PENDING', createdAt: Date.now() };
  let url, invoiceId;
  if (midtransReady()) {
    // Midtrans Snap → halaman bayar (QRIS, VA bank, GoPay, dll.)
    const r = await fetch(`${midtransBase()}/snap/v1/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(process.env.MIDTRANS_SERVER_KEY + ':').toString('base64') },
      body: JSON.stringify({
        transaction_details: { order_id: externalId, gross_amount: price },
        item_details: [{ id: plan, price, quantity: 1, name: `SiapLolos ${TIER_NAME[plan]} ${PERIOD_DAYS} hari`.slice(0, 50) }],
        customer_details: { first_name: (rec.name || 'Peserta').slice(0, 40), email: rec.email || undefined },
        callbacks: { finish: `${origin}/?midtrans=finish` },
        expiry: { unit: 'hours', duration: 24 },
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.redirect_url) { console.error('midtrans snap', r.status, d); throw httpError(502, (d.error_messages || []).join(', ') || 'Gagal membuat tagihan Midtrans'); }
    url = d.redirect_url; invoiceId = d.token;
  } else if (xenditReady()) {
    const r = await fetch(XENDIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64') },
      body: JSON.stringify({
        external_id: externalId, amount: price, currency: 'IDR', payer_email: rec.email || undefined,
        description: `Langganan SiapLolos ${TIER_NAME[plan]} — ${PERIOD_DAYS} hari`,
        invoice_duration: 86400,
        customer: { given_names: rec.name || 'Peserta', email: rec.email || undefined },
        items: [{ name: `SiapLolos ${TIER_NAME[plan]} (${PERIOD_DAYS} hari)`, quantity: 1, price }],
        success_redirect_url: `${origin}/#/langganan?bayar=sukses`,
        failure_redirect_url: `${origin}/#/langganan?bayar=gagal`,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('xendit invoice', r.status, d); throw httpError(502, d.message || 'Gagal membuat tagihan Xendit'); }
    url = d.invoice_url; invoiceId = d.id;
  } else {
    // Belum ada kunci Xendit: di produksi ditolak; di lokal pakai tagihan simulasi untuk pengujian
    if (process.env.VERCEL_ENV === 'production') throw httpError(503, 'Pembayaran online belum diaktifkan admin. Hubungi admin untuk aktivasi manual.');
    invoiceId = 'demo_' + Date.now().toString(36);
    url = `${origin}/#/langganan?demo=${encodeURIComponent(externalId)}`;
  }
  await db.setMetaField('inv', externalId, { ...rec, invoiceId, url, gateway: gateway() || 'demo' });
  return { url, externalId, amount: price, plan, gateway: gateway() || 'demo', test: gatewayTest() };
}

/** Webhook Xendit (status invoice). Mengembalikan ringkasan untuk log. */
export async function handleXenditWebhook(db, headers, body) {
  const token = process.env.XENDIT_CALLBACK_TOKEN;
  const got = headers['x-callback-token'];
  if (!token) throw httpError(503, 'XENDIT_CALLBACK_TOKEN belum diatur');
  const crypto = await import('node:crypto');
  const a = crypto.createHash('sha256').update(String(got || '')).digest(), b = crypto.createHash('sha256').update(token).digest();
  if (!got || !crypto.timingSafeEqual(a, b)) throw httpError(401, 'Token webhook tidak valid');
  return applyPayment(db, body);
}
/** Notifikasi HTTP Midtrans. Keaslian dicek dengan signature_key = SHA512(order_id + status_code + gross_amount + server key). */
export async function handleMidtransNotif(db, body) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw httpError(503, 'MIDTRANS_SERVER_KEY belum diatur');
  const crypto = await import('node:crypto');
  const expect = crypto.createHash('sha512').update(String(body.order_id || '') + String(body.status_code || '') + String(body.gross_amount || '') + key).digest('hex');
  const got = String(body.signature_key || '');
  if (got.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expect))) throw httpError(401, 'Signature Midtrans tidak valid');
  const ts = String(body.transaction_status || '');
  const paid = ts === 'settlement' || (ts === 'capture' && (body.fraud_status || 'accept') === 'accept');
  return applyPayment(db, {
    external_id: body.order_id,
    status: paid ? 'PAID' : ts.toUpperCase(),
    amount: Math.round(parseFloat(body.gross_amount || '0')),
    payment_channel: [body.payment_type, body.va_numbers?.[0]?.bank || body.issuer || body.acquirer].filter(Boolean).join(' · ').toUpperCase(),
  });
}

export async function applyPayment(db, body) {
  const ext = String(body.external_id || '');
  const inv = ((await db.getMeta('inv').catch(() => null)) || {})[ext];
  if (!inv) return { ok: true, ignored: 'tagihan tidak dikenal' };
  const status = String(body.status || '').toUpperCase();
  if (inv.status === 'PAID') return { ok: true, duplicate: true };          // webhook bisa dikirim ulang → idempoten
  if (status !== 'PAID' && status !== 'SETTLED') {
    await db.setMetaField('inv', ext, { ...inv, status: status || 'UNKNOWN', updatedAt: Date.now() });
    return { ok: true, status };
  }
  if (Number(body.amount || body.paid_amount || 0) < inv.amount) return { ok: false, error: 'Nominal pembayaran kurang' };
  const sub = await setSub(db, { uid: inv.uid, name: inv.name, email: inv.email }, inv.plan, { days: PERIOD_DAYS, src: 'xendit' });
  const paidAt = Date.now();
  await db.setMetaField('inv', ext, { ...inv, status: 'PAID', paidAt, method: body.payment_method || body.payment_channel || '', until: sub.until });
  // catatan pembayaran untuk admin (notifikasi)
  await db.setMetaField('payments', ext, { name: inv.name, email: inv.email, plan: inv.plan, amount: inv.amount, method: String(body.payment_channel || body.payment_method || ''), paidAt, until: sub.until });
  return { ok: true, paid: true, plan: inv.plan, until: sub.until };
}
export async function listPayments(db, limit = 50) {
  const m = (await db.getMeta('payments').catch(() => null)) || {};
  return Object.entries(m).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.paidAt - a.paidAt).slice(0, limit);
}
