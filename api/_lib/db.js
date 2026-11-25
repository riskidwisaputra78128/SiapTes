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
  return firestoreBackend(getFirestore(app));
}

function firestoreBackend(fs) {
  const Q = fs.collection('questions');
  const A = fs.collection('attempts');
  const M = fs.collection('meta');
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
    async getMeta(key) { const d = await M.doc(key).get(); return d.exists ? d.data() : null; },
    async setMeta(key, val) { await M.doc(key).set(val, { merge: false }); },
    // Akun dev tidak dipakai di Firestore (akun disimpan di Google Sheet via Apps Script)
  };
}

function memoryBackend() {
  const g = globalThis.__siaplolosMem || (globalThis.__siaplolosMem = { q: new Map(), a: [], m: new Map(), users: new Map() });
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
    async getMeta(key) { return g.m.get(key) || null; },
    async setMeta(key, val) { g.m.set(key, val); },
    users: g.users,
  };
}
