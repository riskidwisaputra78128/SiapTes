// Lapisan database: Firestore (production) atau memori (dev lokal tanpa Firebase)
let backendPromise;

export function getDB() {
  if (!backendPromise) backendPromise = init();
  return backendPromise;
}

export function firebaseEnabled() {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

async function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    if (process.env.VERCEL_ENV === 'production') {
      console.warn('[db] FIREBASE_SERVICE_ACCOUNT kosong — data TIDAK tersimpan permanen!');
    }
    return memoryBackend();
  }
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  let sa;
  try {
    const txt = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    sa = JSON.parse(txt);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT tidak valid (harus JSON service account atau base64-nya)');
  }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  const app = getApps()[0] || initializeApp({ credential: cert(sa) });
  const fs = getFirestore(app);
  // Firestore menolak nilai `undefined` — abaikan saja field yang kosong
  try { fs.settings({ ignoreUndefinedProperties: true }); } catch {}
  return firestoreBackend(fs);
}

function firestoreBackend(fs) {
  const Q = fs.collection('questions');
  const A = fs.collection('attempts');
  const M = fs.collection('meta');
  const MT = fs.collection('materials');
  const RM = fs.collection('rooms');
  const PR = fs.collection('presence');
  return {
    kind: 'firestore',
    async addQuestions(list) {
      let n = 0;
      for (let i = 0; i < list.length; i += 400) {
        const batch = fs.batch();
        for (const q of list.slice(i, i + 400)) { batch.set(Q.doc(q.id), q, { merge: true }); n++; }
        await batch.commit();
      }
      return n;
    },
    async listQuestions({ category, type }) {
      let ref = category && category !== 'campuran' ? Q.where('category', '==', category) : Q.orderBy('createdAt', 'desc');
      const snap = await ref.limit(600).get();
      return snap.docs.map(d => d.data()).filter(q => !type || q.type === type);
    },
    async countQuestions({ category, sinceMs } = {}) {
      let ref = Q;
      if (category) ref = ref.where('category', '==', category);
      if (sinceMs) ref = ref.where('createdAt', '>=', sinceMs);
      const snap = await ref.count().get();
      return snap.data().count;
    },
    async addAttempt(a) { const r = await A.add(a); return r.id; },
    async listAttemptsByUser(uid, sinceMs = 0) {
      const snap = await A.where('uid', '==', uid).limit(3000).get();
      return snap.docs.map(d => d.data()).filter(a => a.createdAt >= sinceMs).sort((x, y) => x.createdAt - y.createdAt);
    },
    async listAttemptsSince(sinceMs) {
      const snap = await A.where('createdAt', '>=', sinceMs).limit(8000).get();
      return snap.docs.map(d => d.data());
    },
    async addMaterials(list) {
      const batch = fs.batch();
      for (const m of list) batch.set(MT.doc(m.id), m);
      await batch.commit();
      return list.length;
    },
    async listMaterials(limit = 60) {
      const snap = await MT.orderBy('createdAt', 'desc').limit(limit).get();
      return snap.docs.map(d => d.data());
    },
    async getMaterial(id) { const d = await MT.doc(id).get(); return d.exists ? d.data() : null; },
    async pruneMaterials(max) {
      const snap = await MT.orderBy('createdAt', 'desc').offset(max).get();
      if (snap.empty) return 0;
      const batch = fs.batch(); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit();
      return snap.size;
    },
    async getRoom(code) { const d = await RM.doc(code).get(); return d.exists ? d.data() : null; },
    async createRoom(room) {
      return fs.runTransaction(async t => {
        const ref = RM.doc(room.code); const s = await t.get(ref);
        if (s.exists) return false;
        t.set(ref, room); return true;
      });
    },
    // fn(room) → { room?: dataBaru, result } ; lempar error untuk membatalkan
    async updateRoom(code, fn) {
      return fs.runTransaction(async t => {
        const ref = RM.doc(code); const s = await t.get(ref);
        const out = fn(s.exists ? s.data() : null);
        if (out.room) t.set(ref, out.room);
        return out.result;
      });
    },
    async setPresence(uid, data) { await PR.doc(uid).set(data); },
    async deletePresence(uid) { await PR.doc(uid).delete().catch(() => {}); },
    async listPresence(sinceMs) {
      const snap = await PR.where('lastSeen', '>=', sinceMs).limit(200).get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    },
    async listRooms() {
      const snap = await RM.where('status', 'in', ['waiting', 'playing']).limit(40).get();
      return snap.docs.map(d => d.data());
    },
    async getMeta(key) { const d = await M.doc(key).get(); return d.exists ? d.data() : null; },
    async setMeta(key, val) { await M.doc(key).set(val, { merge: false }); },
    // Akun dev tidak dipakai di Firestore (akun disimpan di Google Sheet via Apps Script)
  };
}

function memoryBackend() {
  const g = globalThis.__siaplolosMem || (globalThis.__siaplolosMem = { q: new Map(), a: [], m: new Map(), mt: new Map(), rooms: new Map(), pr: new Map(), users: new Map() });
  return {
    kind: 'memory',
    async addQuestions(list) { for (const q of list) g.q.set(q.id, q); return list.length; },
    async listQuestions({ category, type }) {
      return [...g.q.values()].filter(q => (!category || category === 'campuran' || q.category === category) && (!type || q.type === type));
    },
    async countQuestions({ category, sinceMs } = {}) {
      return [...g.q.values()].filter(q => (!category || q.category === category) && (!sinceMs || q.createdAt >= sinceMs)).length;
    },
    async addAttempt(a) { g.a.push(a); return String(g.a.length); },
    async listAttemptsByUser(uid, sinceMs = 0) { return g.a.filter(a => a.uid === uid && a.createdAt >= sinceMs); },
    async listAttemptsSince(sinceMs) { return g.a.filter(a => a.createdAt >= sinceMs); },
    async addMaterials(list) { for (const m of list) g.mt.set(m.id, m); return list.length; },
    async listMaterials(limit = 60) { return [...(g.mt || new Map()).values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit); },
    async getMaterial(id) { return (g.mt || new Map()).get(id) || null; },
    async pruneMaterials(max) { const all = [...(g.mt || new Map()).values()].sort((a, b) => b.createdAt - a.createdAt); all.slice(max).forEach(m => g.mt.delete(m.id)); return Math.max(0, all.length - max); },
    async getRoom(code) { const r = (g.rooms ||= new Map()).get(code); return r ? structuredClone(r) : null; },
    async createRoom(room) { g.rooms ||= new Map(); if (g.rooms.has(room.code)) return false; g.rooms.set(room.code, structuredClone(room)); return true; },
    async updateRoom(code, fn) { g.rooms ||= new Map(); const cur = g.rooms.get(code); const out = fn(cur ? structuredClone(cur) : null); if (out.room) g.rooms.set(code, out.room); return out.result; },
    async setPresence(uid, data) { (g.pr ||= new Map()).set(uid, data); },
    async deletePresence(uid) { (g.pr ||= new Map()).delete(uid); },
    async listPresence(sinceMs) { return [...(g.pr || new Map()).entries()].filter(([, v]) => v.lastSeen >= sinceMs).map(([uid, v]) => ({ uid, ...v })); },
    async listRooms() { return [...(g.rooms || new Map()).values()].filter(r => ['waiting', 'playing'].includes(r.status)).map(r => structuredClone(r)); },
    async getMeta(key) { return g.m.get(key) || null; },
    async setMeta(key, val) { g.m.set(key, val); },
    users: g.users,
  };
}
