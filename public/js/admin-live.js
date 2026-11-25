// 🏢 Command Center — kantor 3D isometrik dengan karakter kotak & bot penjaga (khusus admin)
import { api, session } from './api.js';
import { $, esc, fmt, timeAgo, toast } from './ui.js';
import { catByKey, modeByKey } from './data.js';

const ROOMS = [
  { key: 'beranda', name: 'Lobby', ico: '🏠', pages: ['beranda'], verb: 'santai di lobby', prop: 'sofa',
    guard: { name: 'Bot Resepsionis', task: n => n ? `menyambut ${n} tamu` : 'siap menyambut' } },
  { key: 'latihan', name: 'Ruang Latihan', ico: '🎯', pages: ['latihan', 'quiz', 'hasil'], verb: 'mengerjakan soal', prop: 'desks',
    guard: { name: 'Bot Pengawas', task: n => n ? `mengawasi ${n} peserta` : 'menyiapkan soal' } },
  { key: 'materi', name: 'Perpustakaan', ico: '📖', pages: ['materi'], verb: 'membaca materi', prop: 'books',
    guard: { name: 'Bot Pustakawan', task: n => n ? `melayani ${n} pembaca` : 'merapikan buku' } },
  { key: 'duel', name: 'Arena Duel', ico: '⚔️', pages: ['duel'], verb: 'di arena duel', prop: 'arena',
    guard: { name: 'Bot Wasit', task: (n, s) => s.duels.some(d => d.playing) ? `memimpin ${s.duels.filter(d => d.playing).length} duel` : n ? 'menunggu duel dimulai' : 'menjaga arena' } },
  { key: 'evaluasi', name: 'Ruang Analitik', ico: '📈', pages: ['evaluasi'], verb: 'cek evaluasi', prop: 'charts',
    guard: { name: 'Bot Analis', task: n => n ? `menjelaskan grafik ke ${n} orang` : 'menghitung statistik' } },
  { key: 'peringkat', name: 'Hall of Fame', ico: '🏆', pages: ['peringkat'], verb: 'lihat peringkat', prop: 'podium',
    guard: { name: 'Bot Juri', task: n => n ? `memamerkan juara ke ${n} orang` : 'memoles piala' } },
  { key: 'akun', name: 'Pos Akun', ico: '🔐', pages: ['profil', 'teknologi', 'login'], verb: 'urus akun', prop: 'gate',
    guard: { name: 'Bot Satpam', task: n => n ? `memeriksa ${n} akun` : 'berjaga di gerbang' } },
  { key: 'ai', name: 'Studio AI', ico: '✨', pages: [], verb: '', prop: 'ai',
    guard: { name: 'Gemini Bot', task: (n, s) => s.system.generating ? 'sedang membuat soal & materi…' : s.system.ai ? 'menunggu jadwal 06.00' : 'belum aktif (API key)' } },
];
const roomOfPage = p => ROOMS.find(r => r.pages.includes(p)) || ROOMS[0];

// Palet scene per tema
const SCENES = {
  dark: { rooms: [0x22c55e, 0x3b82f6, 0xf59e0b, 0xef4444, 0x14b8a6, 0xeab308, 0xa855f7, 0x6366f1], mixTo: 0x0f172a, mix: 0.3, hub: 0x1e293b, ring: 0x38bdf8, core: 0x38bdf8, sky: 0xffffff, gnd: 0x312e81, hemi: 1.15, sun: 1.5, grid: 0x334155, shadow: 0.45, desk: 0xe5e7eb },
  light: { rooms: [0x4ade80, 0x60a5fa, 0xfbbf24, 0xf87171, 0x2dd4bf, 0xfacc15, 0xc084fc, 0x818cf8], mixTo: 0xffffff, mix: 0.45, hub: 0xffffff, ring: 0x0ea5e9, core: 0x0ea5e9, sky: 0xffffff, gnd: 0xc7d2fe, hemi: 1.7, sun: 1.3, grid: 0xcbd5e1, shadow: 0.18, desk: 0xffffff },
  dongeng: { rooms: [0xf9a8d4, 0x93c5fd, 0xfcd34d, 0xfda4af, 0x99f6e4, 0xfde68a, 0xc4b5fd, 0xddd6fe], mixTo: 0xffffff, mix: 0.3, hub: 0xfce7f3, ring: 0xf472b6, core: 0xf9a8d4, sky: 0xfff1f2, gnd: 0xe9d5ff, hemi: 1.8, sun: 1.2, grid: 0xf5d0fe, shadow: 0.15, desk: 0xfffbeb },
  modern: { rooms: [0xa3e635, 0x22d3ee, 0xf472b6, 0xfb923c, 0x4ade80, 0xfacc15, 0xc084fc, 0x38bdf8], mixTo: 0x09090b, mix: 0.62, hub: 0x18181b, ring: 0xa3e635, core: 0xa3e635, sky: 0xffffff, gnd: 0x18181b, hemi: 1.0, sun: 1.4, grid: 0x27272a, shadow: 0.55, desk: 0x27272a },
  pro: { rooms: [0x1e40af, 0x0f766e, 0xb7791f, 0x9f1239, 0x334155, 0xa16207, 0x4338ca, 0x1d4ed8], mixTo: 0xffffff, mix: 0.72, hub: 0xffffff, ring: 0x1d4ed8, core: 0x1e3a8a, sky: 0xffffff, gnd: 0xe2e8f0, hemi: 1.7, sun: 1.2, grid: 0xe2e8f0, shadow: 0.14, desk: 0xf8fafc },
};
const DEMO_NAMES = ['Rina', 'Andi', 'Sari', 'Dimas', 'Fajar', 'Putri', 'Bayu', 'Nadia', 'Yoga'];
const DEMO_PAGES = ['beranda', 'quiz', 'quiz', 'materi', 'duel', 'duel', 'evaluasi', 'peringkat', 'profil', 'latihan'];
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const hue = n => hash(n) % 360;
const hex = n => '#' + n.toString(16).padStart(6, '0');

let themeListener = null;

export async function renderAdminLive(app) {
  if (!session.user?.admin) {
    app.innerHTML = `<div class="glass card empty"><div style="font-size:44px">🔒</div><h2 class="h2">Khusus admin</h2><p class="muted">Halaman ini hanya bisa dibuka akun yang terdaftar di ADMIN_EMAILS.</p></div>`;
    return;
  }
  // render ulang saat tema diganti
  if (themeListener) window.removeEventListener('theme:change', themeListener);
  themeListener = () => { if (location.hash.startsWith('#/command')) renderAdminLive(app); };
  window.addEventListener('theme:change', themeListener);

  const themeKey = document.documentElement.getAttribute('data-theme') || 'dark';
  const S = SCENES[themeKey] || SCENES.dark;
  const demoWas = !!window.__ccDemo;

  app.innerHTML = `
  <section class="cc fade-in">
    <div class="row between wrap" style="gap:10px">
      <div><h1 class="h1" style="margin:0">🏢 Command Center</h1><p class="muted" style="margin:0">Visualisasi aktivitas SiapLolos secara langsung · khusus admin</p></div>
      <div class="row" style="gap:8px">
        <label class="chip" style="cursor:pointer"><input type="checkbox" id="demoChk" ${demoWas ? 'checked' : ''} style="accent-color:var(--cyan)"> Mode demo</label>
        <span class="chip"><span class="live-dot on"></span> Live</span>
      </div>
    </div>
    <div class="cc-stats" id="ccStats"></div>
    <div class="cc-main">
      <div class="cc-stage glass" id="ccStage">
        <canvas id="ccCanvas"></canvas>
        <div class="cc-overlay" id="ccOverlay"></div>
        <div class="cc-hint dim">🖱️ Geser untuk memutar · scroll/cubit untuk zoom · ketuk label ruangan</div>
        <div class="cc-loading" id="ccLoading"><span class="spinner"></span> Membangun kantor 3D…</div>
      </div>
      <aside class="cc-side">
        <div class="glass card" id="ccRoomInfo"></div>
        <div class="glass card"><div class="row between"><b>⚡ Aktivitas terbaru</b><span class="dim">live</span></div><div class="cc-feed" id="ccFeed"></div></div>
      </aside>
    </div>
  </section>`;

  let THREE, OrbitControls;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch { $('#ccLoading').innerHTML = '⚠️ Gagal memuat Three.js. Cek koneksi internet.'; return; }

  /* ───── Dasar scene ───── */
  const stage = $('#ccStage'), canvas = $('#ccCanvas'), overlay = $('#ccOverlay');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  cam.position.set(26, 24, 26); cam.zoom = innerWidth < 700 ? 0.78 : 1.2;
  const controls = new OrbitControls(cam, canvas);
  Object.assign(controls, { enableDamping: true, minZoom: 0.35, maxZoom: 3, maxPolarAngle: Math.PI / 2.4, minPolarAngle: Math.PI / 6 });

  scene.add(new THREE.HemisphereLight(S.sky, S.gnd, S.hemi));
  const sun = new THREE.DirectionalLight(0xffffff, S.sun);
  sun.position.set(14, 26, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26 });
  scene.add(sun);

  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
  const B = (color) => new THREE.MeshBasicMaterial({ color });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // lantai transparen: hanya bayangan + grid tipis, jadi latar ikut warna tema
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: S.shadow }));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
  const grid = new THREE.GridHelper(56, 28, S.grid, S.grid); grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = 0.01; scene.add(grid);

  /* ───── Inti tengah ───── */
  const hub = new THREE.Group(); scene.add(hub);
  const hubBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.5, 48), M(S.hub)); hubBase.position.y = 0.25; hubBase.receiveShadow = true; hubBase.castShadow = true; hub.add(hubBase);
  const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + i * 0.7, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: S.ring, transparent: true, opacity: 0.7 - i * 0.18 })); r.rotation.x = -Math.PI / 2; r.position.y = 0.55; hub.add(r); return r; });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: S.core, emissive: S.core, emissiveIntensity: 0.9, flatShading: true })); core.position.y = 2.2; hub.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 2, 16, 1, true), new THREE.MeshBasicMaterial({ color: S.ring, transparent: true, opacity: 0.25, side: THREE.DoubleSide })); beam.position.y = 1.4; hub.add(beam);
  const coreLight = new THREE.PointLight(S.core, 6, 14); coreLight.position.y = 2.2; hub.add(coreLight);

  /* ───── Karakter manusia kotak ───── */
  const SKIN = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
  const HAIR = [0x2d1b0e, 0x4a2c17, 0x111111, 0x6b3e1f, 0xb5651d, 0x1f2937];
  function limb(w, h, d, mat, x, y, parent) { // pivot di bagian atas
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); parent.add(pivot);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = -h / 2; m.castShadow = true; pivot.add(m);
    return pivot;
  }
  function makeHuman(name) {
    const h = hash(name);
    const g = new THREE.Group();
    const shirt = M(new THREE.Color().setHSL(hue(name) / 360, 0.6, 0.55));
    const pants = M([0x1e3a8a, 0x334155, 0x3f3f46, 0x065f46, 0x7c2d12][h % 5]);
    const skin = M(SKIN[h % SKIN.length]); const hairM = M(HAIR[(h >> 3) % HAIR.length]);
    const legL = limb(0.16, 0.34, 0.18, pants, -0.1, 0.34, g), legR = limb(0.16, 0.34, 0.18, pants, 0.1, 0.34, g);
    box(0.4, 0.36, 0.24, shirt, 0, 0.32, 0, g);
    const armL = limb(0.12, 0.32, 0.14, shirt, -0.27, 0.66, g), armR = limb(0.12, 0.32, 0.14, shirt, 0.27, 0.66, g);
    [armL, armR].forEach(a => { const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.12), skin); hand.position.y = -0.36; a.add(hand); });
    const head = new THREE.Group(); head.position.y = 0.68; g.add(head);
    box(0.46, 0.42, 0.42, skin, 0, 0, 0, head);
    box(0.5, 0.14, 0.46, hairM, 0, 0.36, -0.01, head);              // rambut atas
    box(0.5, 0.3, 0.1, hairM, 0, 0.16, -0.21, head);                // rambut belakang
    if (h % 3 === 0) { box(0.08, 0.22, 0.38, hairM, -0.24, 0.14, -0.02, head); box(0.08, 0.22, 0.38, hairM, 0.24, 0.14, -0.02, head); }
    const eye = B(0x111111);
    box(0.07, 0.09, 0.02, eye, -0.1, 0.18, 0.215, head); box(0.07, 0.09, 0.02, eye, 0.1, 0.18, 0.215, head);
    box(0.025, 0.03, 0.01, B(0xffffff), -0.085, 0.24, 0.227, head); box(0.025, 0.03, 0.01, B(0xffffff), 0.115, 0.24, 0.227, head);
    box(0.08, 0.04, 0.01, B(0xfb7185), -0.17, 0.11, 0.215, head); box(0.08, 0.04, 0.01, B(0xfb7185), 0.17, 0.11, 0.215, head);
    box(0.1, 0.025, 0.01, B(0x7f1d1d), 0, 0.08, 0.215, head);
    if (h % 6 === 1) { box(0.52, 0.06, 0.5, M([0xef4444, 0x3b82f6, 0x22c55e][h % 3]), 0, 0.42, 0.02, head); box(0.5, 0.03, 0.16, M([0xef4444, 0x3b82f6, 0x22c55e][h % 3]), 0, 0.42, 0.3, head); } // topi
    if (h % 7 === 2) { const gl = B(0x1f2937); box(0.14, 0.11, 0.015, gl, -0.1, 0.18, 0.225, head); box(0.14, 0.11, 0.015, gl, 0.1, 0.18, 0.225, head); box(0.08, 0.02, 0.015, gl, 0, 0.2, 0.225, head); } // kacamata
    g.scale.setScalar(1.45);
    g.userData = { legL, legR, armL, armR, head, phase: (h % 100) / 16 };
    scene.add(g); return g;
  }

  /* ───── Bot penjaga ───── */
  function makeGuard(accent, special = false) {
    const g = new THREE.Group();
    const metal = M(special ? 0xe0e7ff : 0xe2e8f0, { metalness: 0.45, roughness: 0.35 });
    const dark = M(0x334155, { metalness: 0.3, roughness: 0.5 });
    const legL = limb(0.14, 0.3, 0.16, dark, -0.1, 0.3, g), legR = limb(0.14, 0.3, 0.16, dark, 0.1, 0.3, g);
    const body = box(0.46, 0.42, 0.32, metal, 0, 0.28, 0, g);
    box(0.2, 0.14, 0.02, B(accent), 0, 0.14, 0.165, body);                  // lencana dada
    const armL = limb(0.12, 0.34, 0.14, metal, -0.3, 0.66, g), armR = limb(0.12, 0.34, 0.14, metal, 0.3, 0.66, g);
    const head = new THREE.Group(); head.position.y = 0.72; g.add(head);
    box(0.5, 0.4, 0.42, metal, 0, 0, 0, head);
    const visor = box(0.4, 0.16, 0.02, new THREE.MeshBasicMaterial({ color: accent }), 0, 0.15, 0.215, head);
    box(0.06, 0.07, 0.01, B(0xffffff), -0.09, 0.2, 0.227, head); box(0.06, 0.07, 0.01, B(0xffffff), 0.09, 0.2, 0.227, head);
    box(0.03, 0.18, 0.03, dark, 0, 0.4, 0, head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: accent })); bulb.position.y = 0.62; head.add(bulb);
    box(0.06, 0.12, 0.12, dark, -0.27, 0.12, 0, head); box(0.06, 0.12, 0.12, dark, 0.27, 0.12, 0, head); // "telinga"
    g.scale.setScalar(special ? 1.75 : 1.5);
    g.userData = { legL, legR, armL, armR, head, visor, bulb, wave: 0, phase: Math.random() * 6 };
    return g;
  }

  /* ───── Ruangan ───── */
  const R = 11.5, SIZE = 6.2, roomObjs = {};
  ROOMS.forEach((rm, i) => {
    const color = S.rooms[i % S.rooms.length]; rm.color = color;
    const ang = (i / ROOMS.length) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(ang) * R, cz = Math.sin(ang) * R;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = -ang + Math.PI / 2; scene.add(g);
    const col = new THREE.Color(color);
    const floorCol = col.clone().lerp(new THREE.Color(S.mixTo), S.mix);
    box(SIZE, 0.4, SIZE, M(floorCol), 0, 0, 0, g);
    box(SIZE - 0.1, 0.05, SIZE - 0.1, M(col.clone().lerp(new THREE.Color(0xffffff), themeKey === 'modern' ? 0 : 0.35), { roughness: 0.5 }), 0, 0.4, 0, g);
    const wallMat = M(col.clone().lerp(new THREE.Color(S.mixTo === 0x09090b ? 0x18181b : 0xffffff), 0.35), { transparent: true, opacity: 0.9 });
    box(SIZE, 1.6, 0.18, wallMat, 0, 0.4, -SIZE / 2 + 0.09, g);
    box(0.18, 1.6, SIZE, wallMat, -SIZE / 2 + 0.09, 0.4, 0, g);
    if (themeKey === 'modern') { box(SIZE, 0.04, 0.04, B(color), 0, 2, -SIZE / 2 + 0.2, g); box(0.04, 0.04, SIZE, B(color), -SIZE / 2 + 0.2, 2, 0, g); } // garis neon
    buildProps(rm.prop, g, col);
    plant(g, SIZE / 2 - 0.45, -SIZE / 2 + 0.6);
    const path = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, R - SIZE / 2 - 3.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 }));
    path.position.set(Math.cos(ang) * (R / 2 + 0.2), 0.03, Math.sin(ang) * (R / 2 + 0.2)); path.rotation.y = -ang + Math.PI / 2; scene.add(path);
    // bot penjaga di pintu depan, menghadap ke inti
    const guard = makeGuard(color, rm.key === 'ai');
    guard.position.set(rm.key === 'ai' ? 0.4 : SIZE / 2 - 0.75, 0.46, rm.key === 'ai' ? 0.5 : SIZE / 2 - 0.75);
    guard.rotation.y = rm.key === 'ai' ? 0.3 : Math.PI / 4;
    g.add(guard);
    const anchor = new THREE.Object3D(); anchor.position.set(-0.6, 3.5, -0.8); g.add(anchor);
    const slots = [];
    for (let k = 0; k < 9; k++) { const o = new THREE.Object3D(); o.position.set(((k % 3) - 1.15) * 1.45, 0.46, (Math.floor(k / 3) - 1) * 1.35 + 0.1); g.add(o); slots.push(o); }
    roomObjs[rm.key] = { rm, group: g, anchor, slots, guard, center: new THREE.Vector3(cx, 0.46, cz), occupants: [], prevCount: 0 };
  });

  function plant(g, x, z) {
    const p = new THREE.Group(); p.position.set(x, 0.46, z); g.add(p);
    box(0.3, 0.3, 0.3, M(themeKey === 'dongeng' ? 0xfbcfe8 : 0xd6d3d1), 0, 0, 0, p);
    box(0.36, 0.36, 0.36, M(themeKey === 'dongeng' ? 0xa7f3d0 : 0x16a34a), 0, 0.3, 0, p);
    box(0.22, 0.22, 0.22, M(themeKey === 'dongeng' ? 0x6ee7b7 : 0x22c55e), 0.04, 0.62, 0.02, p);
  }
  function buildProps(kind, g, col) {
    const desk = (x, z, rot = 0) => {
      const d = new THREE.Group(); d.position.set(x, 0.46, z); d.rotation.y = rot; g.add(d);
      box(1.1, 0.06, 0.6, M(S.desk), 0, 0.55, 0, d);
      [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].forEach(([a, b]) => box(0.05, 0.55, 0.05, M(0x94a3b8), a, 0, b, d));
      box(0.5, 0.34, 0.04, M(0x111827), 0, 0.61, -0.18, d);
      box(0.44, 0.28, 0.01, new THREE.MeshBasicMaterial({ color: col }), 0, 0.64, -0.155, d);
    };
    if (kind === 'desks') [-1.5, 0.1, 1.7].forEach(x => [-1.3, 0.8].forEach(z => desk(x, z)));
    if (kind === 'sofa') { box(2.6, 0.45, 0.9, M(col.clone().multiplyScalar(0.85)), -0.6, 0.46, -2.1); box(2.6, 0.5, 0.25, M(col.clone().multiplyScalar(0.7)), -0.6, 0.9, -2.45); box(1.2, 0.3, 0.7, M(0x92400e), -0.6, 0.46, -0.8); }
    if (kind === 'books') { for (let i = 0; i < 3; i++) { const s = box(1.6, 1.4, 0.4, M(0x92400e), -1.9 + i * 1.8, 0.46, -2.6); for (let j = 0; j < 3; j++) { box(1.4, 0.06, 0.36, M(0xfef3c7), 0, 0.3 + j * 0.42, 0, s); for (let b = 0; b < 5; b++) box(0.18, 0.28, 0.24, M([0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7][(b + j + i) % 5]), -0.55 + b * 0.27, 0.36 + j * 0.42 - 0.7, 0, s); } } desk(-1.2, 0.6); desk(1, 0.6); }
    if (kind === 'arena') {
      desk(-1.5, 0.1, Math.PI / 2); desk(1.3, 0.1, -Math.PI / 2);
      const vs = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 32), B(0xfacc15)); vs.position.set(-0.1, 1.9, 0.1); vs.userData.spin = true; g.add(vs);
      box(4.6, 0.04, 0.12, B(0xfacc15), -0.1, 0.47, 0.1);
    }
    if (kind === 'charts') { box(3.6, 1.8, 0.08, M(0x0f172a), -0.2, 0.8, -2.7); for (let i = 0; i < 5; i++) { const b = box(0.4, 0.3 + i * 0.25, 0.1, B(col), -1.4 + i * 0.6, 0.95, -2.62); b.userData.bar = i; } desk(-1.2, 0.6); desk(1, 0.6); }
    if (kind === 'podium') { [[-0.2, 0.9, 0xfacc15], [-1.3, 0.6, 0xcbd5e1], [0.9, 0.4, 0xf97316]].forEach(([x, h, c]) => box(1, h, 1, M(c, { metalness: 0.4, roughness: 0.3 }), x, 0.46, -1.6)); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.12, 0.45, 16), M(0xfacc15, { metalness: 0.8, roughness: 0.2 })); cup.position.set(-0.2, 1.65, -1.6); cup.userData.spin = true; g.add(cup); }
    if (kind === 'gate') { box(0.2, 1.4, 0.2, M(0x64748b), -1.2, 0.46, -1.2); box(0.2, 1.4, 0.2, M(0x64748b), 0.4, 0.46, -1.2); box(1.8, 0.2, 0.2, B(col), -0.4, 1.86, -1.2); desk(-1.6, 1.0); }
    if (kind === 'ai') {
      for (let i = 0; i < 3; i++) { const rk = box(0.8, 1.8, 0.7, M(0x1e293b), -2 + i * 1.0, 0.46, -2.4); for (let j = 0; j < 5; j++) { const led = box(0.6, 0.05, 0.02, B(j % 2 ? 0x22d3ee : 0x4ade80), 0, 0.25 + j * 0.3, 0.36, rk); led.userData.led = Math.random() * 6; } }
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1 })); orb.position.set(1.6, 1.6, -1.6); orb.userData.orb = true; g.add(orb);
    }
  }

  /* ───── Pengguna (karakter) ───── */
  const chars = new Map();
  const tmp = new THREE.Vector3();
  function placeChars(users) {
    const seen = new Set();
    Object.values(roomObjs).forEach(o => (o.occupants = []));
    users.forEach(u => {
      const room = u.justLoggedIn && u.page === 'beranda' ? roomObjs.akun : roomObjs[roomOfPage(u.page).key];
      room.occupants.push(u); seen.add(u.key);
      let ch = chars.get(u.key);
      if (!ch) {
        const g = makeHuman(u.name); g.position.copy(roomObjs.akun.center);
        ch = { group: g, u, room: null, waypoints: [] }; chars.set(u.key, ch);
        pushFeed({ ico: '🔓', text: `<b>${esc(u.name)}</b> ${u.demo ? 'masuk (demo)' : 'sedang online'}`, at: Date.now() });
      }
      ch.u = u;
      if (ch.room !== room.rm.key) {
        if (ch.room) { ch.waypoints = [new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.5, (Math.random() - 0.5) * 2.4)]; pushFeed({ ico: room.rm.ico, text: `<b>${esc(u.name)}</b> pindah ke ${room.rm.name}`, at: Date.now() }); }
        ch.room = room.rm.key; ch.newTarget = true;
      }
    });
    Object.values(roomObjs).forEach(o => {
      o.occupants.forEach((u, i) => {
        const ch = chars.get(u.key); if (!ch) return;
        const t = new THREE.Vector3(); o.slots[i % o.slots.length].getWorldPosition(t);
        if (i >= o.slots.length) t.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6));
        if (ch.newTarget) { ch.waypoints.push(t); ch.newTarget = false; }
        else if (ch.waypoints.length) ch.waypoints[ch.waypoints.length - 1] = t;
        else if (ch.group.position.distanceTo(t) > 0.2) ch.waypoints = [t];
        ch.home = t;
      });
      if (o.occupants.length > o.prevCount) o.guard.userData.wave = 2.2; // penjaga melambai menyambut
      o.prevCount = o.occupants.length;
    });
    for (const [k, ch] of chars) if (!seen.has(k)) { scene.remove(ch.group); chars.delete(k); pushFeed({ ico: '👋', text: `<b>${esc(ch.u.name)}</b> offline`, at: Date.now() }); }
  }

  /* ───── Overlay HTML ───── */
  const labelEls = {}, guardEls = {};
  ROOMS.forEach(rm => {
    const el = document.createElement('button'); el.className = 'cc-label'; el.style.setProperty('--c', hex(rm.color));
    el.onclick = () => showRoom(rm.key); overlay.appendChild(el); labelEls[rm.key] = el;
    const ge = document.createElement('div'); ge.className = 'cc-tag bot'; ge.style.setProperty('--c', hex(rm.color)); overlay.appendChild(ge); guardEls[rm.key] = ge;
  });
  const coreEl = document.createElement('div'); coreEl.className = 'cc-core'; overlay.appendChild(coreEl);
  const tagEls = new Map(); const v = new THREE.Vector3();
  const toScreen = (obj, offY = 0) => { obj.getWorldPosition(v); v.y += offY; v.project(cam); return { x: (v.x * 0.5 + 0.5) * stage.clientWidth, y: (-v.y * 0.5 + 0.5) * stage.clientHeight }; };
  const place = (el, p) => (el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`);
  function drawOverlay() {
    ROOMS.forEach(rm => { const o = roomObjs[rm.key]; place(labelEls[rm.key], toScreen(o.anchor)); place(guardEls[rm.key], toScreen(o.guard, rm.key === 'ai' ? 2.3 : 2)); });
    place(coreEl, toScreen(core, 1.4));
    for (const [k, ch] of chars) {
      let el = tagEls.get(k);
      if (!el) { el = document.createElement('div'); el.className = 'cc-tag'; overlay.appendChild(el); tagEls.set(k, el); }
      place(el, toScreen(ch.group, 2.05));
    }
    for (const [k, el] of tagEls) if (!chars.has(k)) { el.remove(); tagEls.delete(k); }
  }
  function refreshLabels() {
    ROOMS.forEach(rm => {
      const o = roomObjs[rm.key]; const n = o.occupants.length;
      let sub = `${n} orang`;
      if (rm.key === 'ai') sub = state.system.generating ? '⚙️ membuat soal…' : `${fmt(state.system.bank)} soal`;
      if (rm.key === 'duel') sub = `${n} orang · ${state.duels.filter(d => d.playing).length} duel aktif`;
      labelEls[rm.key].innerHTML = `<span class="ico">${rm.ico}</span><span><b>${rm.name}</b><small>${sub}</small></span>${n ? `<span class="cnt">${n}</span>` : ''}`;
      guardEls[rm.key].innerHTML = `<b>🤖 ${rm.guard.name}</b><small>${rm.guard.task(n, state)}</small>`;
    });
    coreEl.innerHTML = `<b>SIAPLOLOS CORE</b><small>${state.users.length} online · ${fmt(state.system.bank)} soal · ${state.today.sessions} sesi hari ini</small>`;
    for (const [k, ch] of chars) {
      const el = tagEls.get(k); if (!el) continue;
      const u = ch.u; const rm = ROOMS.find(r => r.key === ch.room);
      const duel = state.duels.find(d => d.players.some(p => p.key === k));
      const act = ch.room === 'akun' && u.justLoggedIn ? 'baru login 🔓' : ch.room === 'duel' && duel?.playing ? `duel ${duel.phase} ⚔️` : rm?.verb || '';
      el.innerHTML = `<b>${esc(u.name)}</b><small>${act}</small>`;
      el.classList.toggle('compact', (roomObjs[ch.room]?.occupants.length || 0) > 3);
    }
  }
  let selected = 'ai';
  function showRoom(key) {
    selected = key;
    const o = roomObjs[key]; const rm = o.rm; const n = o.occupants.length;
    let extra = '';
    if (key === 'ai') {
      const s = state.system;
      extra = `<div class="stack" style="gap:6px;margin-top:8px">
        <div class="dim">AI: ${s.ai ? '✅ aktif' : '⚠️ belum diatur'} · Database: ${s.firebase ? '✅ Firebase' : '⚠️ memori'}</div>
        <div class="dim">Bank soal: ${fmt(s.bank)} (${fmt(s.generated)} dari berita) · Materi hari ini: ${state.today.materials}</div>
        ${s.lastGenerate ? `<div class="dim">Terakhir generate: ${timeAgo(s.lastGenerate.at)} — ${s.lastGenerate.total} soal, ${s.lastGenerate.materials} materi</div>` : ''}</div>`;
    }
    if (key === 'duel') extra = state.duels.length ? `<div class="stack" style="gap:6px;margin-top:8px">${state.duels.map(d => `<div class="tip"><span>⚔️</span><span><b>${esc(d.title)}</b> #${d.code} · ${esc(d.phase)}<br><span class="dim">${d.players.map(p => `${esc(p.name)} (${fmt(p.score)})`).join(' vs ')}${d.bot ? ' vs 🤖 Bot' : ''}</span></span></div>`).join('')}</div>` : '<p class="dim" style="margin:8px 0 0">Belum ada room duel aktif.</p>';
    $('#ccRoomInfo').innerHTML = `
      <div class="row" style="gap:10px"><span style="font-size:26px">${rm.ico}</span><div><b>${rm.name}</b><div class="dim">${n} orang di sini</div></div></div>
      <div class="guard-card" style="--c:${hex(rm.color)}"><span class="guard-ico">🤖</span><div><b>${rm.guard.name}</b><div class="dim">Penjaga · ${rm.guard.task(n, state)}</div></div></div>
      ${n ? `<div class="duel-players">${o.occupants.map(u => `<div class="dp"><span class="av" style="--h:${hue(u.name)};margin:0">${esc(u.name[0])}</span><span class="dp-name">${esc(u.name)}${u.demo ? ' <span class="dim">(demo)</span>' : ''}</span><span class="dim" style="font-size:12px">${esc(u.target || '')}</span></div>`).join('')}</div>` : ''}${extra}`;
    Object.values(labelEls).forEach(el => el.classList.remove('on')); labelEls[key].classList.add('on');
  }

  /* ───── Data ───── */
  const state = { users: [], duels: [], recent: [], today: { sessions: 0, questions: 0, learners: 0, materials: 0 }, system: { bank: 0, generated: 0 } };
  const feed = window.__ccFeed || (window.__ccFeed = []); const seenAttempts = new Set(feed.map(f => f.id).filter(Boolean));
  function pushFeed(item) { feed.unshift(item); feed.length = Math.min(feed.length, 40); renderFeed(); }
  function renderFeed() { const el = $('#ccFeed'); if (el) el.innerHTML = feed.length ? feed.slice(0, 25).map(f => `<div class="cc-ev"><span>${f.ico}</span><span>${f.text}<br><small class="dim">${timeAgo(f.at)}</small></span></div>`).join('') : '<div class="dim">Belum ada aktivitas.</div>'; }
  let demo = window.__ccDemoUsers || [];
  const makeDemo = () => (demo = DEMO_NAMES.map((n, i) => ({ key: 'demo' + i, name: n, target: ['CPNS', 'BUMN', 'OJK (PCS)', 'Bank Indonesia (PCPM)'][i % 4], page: DEMO_PAGES[i % DEMO_PAGES.length], demo: true, since: Date.now() - i * 60000 })));
  const shuffleDemo = () => demo.forEach(u => { if (Math.random() < 0.35) u.page = DEMO_PAGES[Math.floor(Math.random() * DEMO_PAGES.length)]; });

  async function load() {
    if (!document.body.contains(stage)) return false;
    try {
      Object.assign(state, await api('/admin-live'));
      state.recent.slice().reverse().forEach(a => {
        const id = a.name + a.createdAt; if (seenAttempts.has(id)) return; seenAttempts.add(id);
        feed.push({ id, ico: modeByKey[a.mode]?.ico || '📝', text: `<b>${esc(a.name)}</b> selesai ${modeByKey[a.mode]?.name || a.mode} ${esc(catByKey[a.category]?.name || '')} — skor ${a.score}`, at: a.createdAt });
      });
      feed.sort((a, b) => b.at - a.at); renderFeed();
    } catch (e) { toast(e.message, 'err'); }
    const demoOn = $('#demoChk')?.checked; window.__ccDemo = demoOn;
    if (demoOn) { if (!demo.length) makeDemo(); else shuffleDemo(); } else demo = [];
    window.__ccDemoUsers = demo;
    placeChars([...state.users, ...demo]); refreshLabels(); renderStats(); showRoom(selected);
    return true;
  }
  function renderStats() {
    const s = state.system, t = state.today;
    $('#ccStats').innerHTML = [
      ['🟢', 'Online', state.users.length + (demo.length ? ` +${demo.length} demo` : '')], ['📝', 'Sesi hari ini', t.sessions], ['🧑‍🎓', 'Pelajar hari ini', t.learners],
      ['❓', 'Soal dikerjakan', fmt(t.questions)], ['⚔️', 'Duel aktif', state.duels.filter(d => d.playing).length], ['📚', 'Bank soal', fmt(s.bank)],
      ['📖', 'Materi hari ini', t.materials], ['✨', 'Studio AI', s.generating ? 'bekerja…' : s.ai ? 'siaga' : 'off'],
    ].map(([i, l, val]) => `<div class="glass cc-stat"><span>${i}</span><div><b>${val}</b><small>${l}</small></div></div>`).join('');
  }
  $('#demoChk').onchange = () => load();

  /* ───── Animasi ───── */
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight, a = w / h, f = 14; Object.assign(cam, { left: -f * a, right: f * a, top: f, bottom: -f }); cam.updateProjectionMatrix(); renderer.setSize(w, h, false); };
  new ResizeObserver(resize).observe(stage); resize();
  const clock = new THREE.Clock(); const animated = [];
  scene.traverse(o => { if (o.userData.spin || o.userData.orb || o.userData.led !== undefined || o.userData.bar !== undefined) animated.push(o); });
  const swing = (ud, amt, speed, t) => { const s = Math.sin(t * speed + ud.phase) * amt; ud.legL.rotation.x = s; ud.legR.rotation.x = -s; ud.armL.rotation.x = -s; ud.armR.rotation.x = s; };
  const rest = ud => { ud.legL.rotation.x *= 0.8; ud.legR.rotation.x *= 0.8; };

  function frame() {
    if (!document.body.contains(stage)) { renderer.dispose(); return; }
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    const busy = state.system.generating;
    core.rotation.y = t * 0.6; core.position.y = 2.2 + Math.sin(t * 1.5) * 0.15;
    rings.forEach((r, i) => r.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04));
    animated.forEach(o => {
      if (o.userData.spin) o.rotation.y = t * 1.5;
      if (o.userData.orb) { o.material.emissiveIntensity = 0.8 + Math.sin(t * (busy ? 9 : 3)) * 0.5; o.scale.setScalar(1 + (busy ? Math.sin(t * 6) * 0.12 : 0)); }
      if (o.userData.led !== undefined) o.visible = Math.sin(t * (busy ? 9 : 2) + o.userData.led) > -0.3;
      if (o.userData.bar !== undefined) o.scale.y = 1 + Math.sin(t * 1.5 + o.userData.bar) * 0.25;
    });
    // bot penjaga
    Object.values(roomObjs).forEach(o => {
      const ud = o.guard.userData, isAI = o.rm.key === 'ai';
      ud.head.rotation.y = Math.sin(t * 0.7 + ud.phase) * 0.5;
      ud.bulb.scale.setScalar(1 + Math.sin(t * 4 + ud.phase) * 0.25);
      o.guard.position.y = 0.46 + Math.sin(t * 2 + ud.phase) * 0.02;
      if (ud.wave > 0) { ud.wave -= dt; ud.armR.rotation.z = -2.6 + Math.sin(t * 14) * 0.35; ud.armR.rotation.x = 0; }
      else if (isAI && busy) { ud.armL.rotation.x = Math.sin(t * 16) * 0.6 - 0.6; ud.armR.rotation.x = Math.cos(t * 16) * 0.6 - 0.6; ud.armR.rotation.z = 0; o.guard.position.y = 0.46 + Math.abs(Math.sin(t * 8)) * 0.1; }
      else { ud.armR.rotation.z *= 0.85; ud.armL.rotation.x = Math.sin(t * 1.2 + ud.phase) * 0.08; ud.armR.rotation.x = -Math.sin(t * 1.2 + ud.phase) * 0.08; }
    });
    // manusia
    for (const ch of chars.values()) {
      const g = ch.group, ud = g.userData, wp = ch.waypoints[0];
      if (wp) {
        tmp.copy(wp).sub(g.position); tmp.y = 0; const dist = tmp.length();
        if (dist < 0.06) { ch.waypoints.shift(); }
        else {
          g.position.addScaledVector(tmp.normalize(), Math.min(dist, 3.2 * dt));
          g.rotation.y = Math.atan2(tmp.x, tmp.z);
          swing(ud, 0.7, 11, t); g.position.y = 0.46 + Math.abs(Math.sin(t * 11 + ud.phase)) * 0.05;
        }
        ud.head.rotation.x = 0;
      } else {
        g.position.y = 0.46;
        const r = ch.room;
        if (r === 'latihan' || r === 'materi' || r === 'evaluasi') { // mengetik / membaca
          g.rotation.y = Math.PI; rest(ud);
          ud.armL.rotation.x = -1.1 + Math.sin(t * 14 + ud.phase) * 0.12; ud.armR.rotation.x = -1.1 + Math.cos(t * 14 + ud.phase) * 0.12;
          ud.head.rotation.x = 0.15 + Math.sin(t * 2 + ud.phase) * 0.05;
        } else if (r === 'duel') { // semangat duel
          rest(ud); ud.armL.rotation.x = -2.4 + Math.sin(t * 8 + ud.phase) * 0.4; ud.armR.rotation.x = -0.3;
          g.position.y = 0.46 + Math.abs(Math.sin(t * 6 + ud.phase)) * 0.08; g.rotation.y = Math.sin(t * 2 + ud.phase) * 0.4;
        } else if (r === 'peringkat') { // melompat senang
          ud.armL.rotation.x = ud.armR.rotation.x = -2.8; g.position.y = 0.46 + Math.abs(Math.sin(t * 5 + ud.phase)) * 0.25; rest(ud);
        } else { // santai, sesekali menengok
          rest(ud); ud.armL.rotation.x *= 0.85; ud.armR.rotation.x *= 0.85; ud.head.rotation.y = Math.sin(t * 0.8 + ud.phase) * 0.4;
          g.rotation.y += Math.sin(t * 0.3 + ud.phase) * 0.003;
        }
      }
    }
    controls.update(); renderer.render(scene, cam); drawOverlay();
    requestAnimationFrame(frame);
  }
  $('#ccLoading').remove();
  renderFeed(); frame();
  const loop = async () => { if (await load()) setTimeout(loop, 5000); };
  loop();
}
