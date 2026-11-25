// 🏢 Command Center — kantor 3D detail (1 lantai, ala dollhouse) khusus admin
import { api, session } from './api.js';
import { $, $$, esc, fmt, timeAgo, toast } from './ui.js';
import { catByKey, modeByKey } from './data.js';

// Denah (satuan meter). Baris belakang z[-18,-7], koridor z[-7,-4.5], baris depan z[-4.5,6]
const ZB1 = -18, ZB2 = -7, ZF1 = -4.5, ZF2 = 6, ZC = (ZB2 + ZF1) / 2, BX1 = -26, BX2 = 26;
const ROOMS = [
  { key: 'ai', name: 'Studio AI', ico: '✨', x1: -26, x2: -15, row: 'back', door: -18, pages: [], verb: '', floor: 'server', glass: true,
    guard: { name: 'Gemini Bot', task: (n, s) => s.system.generating ? 'sedang membuat soal & materi…' : s.system.ai ? 'menunggu jadwal 06.00' : 'belum aktif (API key)' } },
  { key: 'materi', name: 'Perpustakaan', ico: '📖', x1: -15, x2: -3, row: 'back', door: -9, pages: ['materi'], verb: 'membaca materi', floor: 'wood',
    guard: { name: 'Bot Pustakawan', task: n => n ? `melayani ${n} pembaca` : 'merapikan buku' } },
  { key: 'evaluasi', name: 'Ruang Analitik', ico: '📈', x1: -3, x2: 9, row: 'back', door: 3, pages: ['evaluasi'], verb: 'rapat evaluasi', floor: 'herring', glass: true,
    guard: { name: 'Bot Analis', task: n => n ? `presentasi grafik ke ${n} orang` : 'menyiapkan laporan' } },
  { key: 'peringkat', name: 'Hall of Fame', ico: '🏆', x1: 9, x2: 18, row: 'back', door: 13.5, pages: ['peringkat'], verb: 'lihat peringkat', floor: 'carpetDark',
    guard: { name: 'Bot Juri', task: n => n ? `memamerkan juara ke ${n} orang` : 'memoles piala' } },
  { key: 'pantry', name: 'Pantry', ico: '☕', x1: 18, x2: 26, row: 'back', door: 22, pages: ['pantry'], verb: 'istirahat ngopi', floor: 'checker',
    guard: { name: 'Bot Barista', task: n => n ? `membuatkan kopi untuk ${n} orang` : 'membersihkan mesin kopi' } },
  { key: 'beranda', name: 'Lobby', ico: '🏠', x1: -26, x2: -14, row: 'front', door: -16.5, pages: ['beranda', 'kantor', 'command'], verb: 'santai di lobby', floor: 'herring',
    guard: { name: 'Bot Resepsionis', task: n => n ? `menyambut ${n} tamu` : 'siap menyambut' } },
  { key: 'akun', name: 'Pos Akun', ico: '🔐', x1: -14, x2: -8, row: 'front', door: -11, pages: ['profil', 'teknologi', 'login'], verb: 'urus akun', floor: 'tile',
    guard: { name: 'Bot Satpam', task: n => n ? `memeriksa ${n} akun` : 'berjaga di gerbang' } },
  { key: 'latihan', name: 'Ruang Latihan', ico: '🎯', x1: -8, x2: 12, row: 'front', door: 2, pages: ['latihan', 'quiz', 'hasil'], verb: 'mengerjakan soal', floor: 'carpet',
    guard: { name: 'Bot Pengawas', task: n => n ? `mengawasi ${n} peserta` : 'menyiapkan soal' } },
  { key: 'duel', name: 'Arena Duel', ico: '⚔️', x1: 12, x2: 26, row: 'front', door: 16, pages: ['duel'], verb: 'di arena duel', floor: 'wood', glass: true,
    guard: { name: 'Bot Wasit', task: (n, s) => s.duels.some(d => d.playing) ? `memimpin ${s.duels.filter(d => d.playing).length} duel` : n ? 'menunggu duel dimulai' : 'menjaga arena' } },
];
ROOMS.forEach(r => {
  r.z1 = r.row === 'back' ? ZB1 : ZF1; r.z2 = r.row === 'back' ? ZB2 : ZF2;
  r.cx = (r.x1 + r.x2) / 2; r.cz = (r.z1 + r.z2) / 2; r.w = r.x2 - r.x1; r.d = r.z2 - r.z1;
  r.doorZ = r.row === 'back' ? ZB2 : ZF1; r.inZ = r.row === 'back' ? ZB2 - 1.2 : ZF1 + 1.2;
});
const roomOfPage = p => ROOMS.find(r => r.pages.includes(p)) || ROOMS.find(r => r.key === 'beranda');

const SCENES = {
  dark: { night: true, wood: '#8a5a35', herring: '#9c6b43', carpet: '#7f1d1d', carpetDark: '#3b1d1d', tile: ['#d6d3d1', '#a8a29e'], checker: ['#e7e5e4', '#57534e'], server: ['#1f2937', '#111827'],
    wall: 0xe9dcc6, trim: 0x6b4423, ext: 0x5b4636, rug: 0xd97706, sofa: 0x7c2d12, fabric: 0x6b7280, ground: 0x14532d, road: 0x111827, walk: 0x57534e, city: [0x1e293b, 0x283548, 0x1f2a44], sky: 0x9db4ff, gnd: 0x1e1b4b, hemi: 0.7, sun: 0.5,
    rooms: [0x6366f1, 0xf59e0b, 0x14b8a6, 0xeab308, 0xf97316, 0x22c55e, 0xa855f7, 0x3b82f6, 0xef4444] },
  light: { night: false, wood: '#c8a27a', herring: '#d4b08a', carpet: '#475569', carpetDark: '#334155', tile: ['#f1f5f9', '#cbd5e1'], checker: ['#ffffff', '#94a3b8'], server: ['#334155', '#1e293b'],
    wall: 0xf8fafc, trim: 0xa1866b, ext: 0xe2e8f0, rug: 0xf59e0b, sofa: 0x475569, fabric: 0x94a3b8, ground: 0x86efac, road: 0x475569, walk: 0xe2e8f0, city: [0xe2e8f0, 0xcbd5e1, 0xdbeafe], sky: 0xffffff, gnd: 0xbfdbfe, hemi: 1.45, sun: 1.6,
    rooms: [0x6366f1, 0xf59e0b, 0x14b8a6, 0xeab308, 0xf97316, 0x22c55e, 0xa855f7, 0x3b82f6, 0xef4444] },
  dongeng: { night: false, wood: '#f3d1b0', herring: '#f5c6d6', carpet: '#f9a8d4', carpetDark: '#c4b5fd', tile: ['#fdf2f8', '#fbcfe8'], checker: ['#fff7ed', '#fbcfe8'], server: ['#c4b5fd', '#a78bfa'],
    wall: 0xfdf2f8, trim: 0xc4b5fd, ext: 0xfbcfe8, rug: 0x93c5fd, sofa: 0xf472b6, fabric: 0xddd6fe, ground: 0xbbf7d0, road: 0xa78bfa, walk: 0xfef3c7, city: [0xfbcfe8, 0xddd6fe, 0xbfdbfe], sky: 0xfff1f2, gnd: 0xf5d0fe, hemi: 1.55, sun: 1.4,
    rooms: [0xa78bfa, 0xf59e0b, 0x2dd4bf, 0xfacc15, 0xfb923c, 0x4ade80, 0xc084fc, 0x60a5fa, 0xf472b6] },
  modern: { night: true, wood: '#3f3f46', herring: '#27272a', carpet: '#18181b', carpetDark: '#0a0a0a', tile: ['#3f3f46', '#27272a'], checker: ['#3f3f46', '#18181b'], server: ['#18181b', '#09090b'],
    wall: 0x27272a, trim: 0xa3e635, ext: 0x18181b, rug: 0xa3e635, sofa: 0x27272a, fabric: 0x3f3f46, ground: 0x0a0a0a, road: 0x18181b, walk: 0x27272a, city: [0x18181b, 0x1f1f23, 0x27272a], sky: 0xd4d4d8, gnd: 0x18181b, hemi: 0.65, sun: 0.45,
    rooms: [0xa3e635, 0xfacc15, 0x22d3ee, 0xfde047, 0xfb923c, 0x4ade80, 0xc084fc, 0x38bdf8, 0xf472b6] },
  pro: { night: false, wood: '#d6c4a8', herring: '#cbb592', carpet: '#1e3a8a', carpetDark: '#172554', tile: ['#f8fafc', '#e2e8f0'], checker: ['#ffffff', '#cbd5e1'], server: ['#334155', '#1e293b'],
    wall: 0xffffff, trim: 0x1e3a8a, ext: 0xe5e7eb, rug: 0xb7791f, sofa: 0x1e3a8a, fabric: 0xcbd5e1, ground: 0xbbf7d0, road: 0x64748b, walk: 0xf1f5f9, city: [0xe2e8f0, 0xf1f5f9, 0xcbd5e1], sky: 0xffffff, gnd: 0xe2e8f0, hemi: 1.5, sun: 1.4,
    rooms: [0x1d4ed8, 0xb7791f, 0x0f766e, 0xa16207, 0xc2410c, 0x15803d, 0x4338ca, 0x1e40af, 0x9f1239] },
};
const DEMO_NAMES = ['Rina', 'Andi', 'Sari', 'Dimas', 'Fajar', 'Putri', 'Bayu', 'Nadia', 'Yoga', 'Lestari', 'Rafi'];
const DEMO_PAGES = ['beranda', 'quiz', 'quiz', 'quiz', 'materi', 'duel', 'duel', 'evaluasi', 'peringkat', 'profil', 'pantry', 'latihan'];
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const hue = n => hash(n) % 360;
const hex = n => '#' + n.toString(16).padStart(6, '0');
const FY = 0.15; // permukaan lantai
let themeListener = null;

export async function renderAdminLive(app) {
  if (!session.loggedIn) {
    app.innerHTML = `<div class="glass card empty fade-in"><div style="font-size:52px">🏢</div><h2 class="h2">Kantor Live SiapLolos</h2><p class="muted">Lihat siapa saja yang sedang belajar, duel, atau rehat ngopi secara langsung. Masuk dulu untuk melihat kantor.</p><button class="btn" id="toLogin">Daftar / Masuk</button></div>`;
    $('#toLogin').onclick = () => { session.clear(); location.hash = '#/login'; };
    return;
  }
  if (themeListener) window.removeEventListener('theme:change', themeListener);
  themeListener = () => { if (location.hash.startsWith('#/command')) renderAdminLive(app); };
  window.addEventListener('theme:change', themeListener);

  const themeKey = document.documentElement.getAttribute('data-theme') || 'dark';
  const S = SCENES[themeKey] || SCENES.dark;
  const NIGHT = S.night, SMALL = innerWidth < 700;
  ROOMS.forEach((r, i) => (r.color = S.rooms[i % S.rooms.length]));

  app.innerHTML = `
  <section class="cc fade-in">
    <div class="row between wrap" style="gap:10px">
      <div><h1 class="h1" style="margin:0">🏢 SiapLolos Office</h1><p class="muted" style="margin:0">Kantor live · lihat siapa yang sedang belajar, duel, atau rehat ngopi</p></div>
      <div class="row" style="gap:8px">
        <label class="chip" style="cursor:pointer"><input type="checkbox" id="demoChk" ${window.__ccDemo ? 'checked' : ''} style="accent-color:var(--cyan)"> Mode demo</label>
        <span class="chip"><span class="live-dot on"></span> Live · ${NIGHT ? '🌙 malam' : '☀️ siang'}</span>
      </div>
    </div>
    <div class="cc-stats" id="ccStats"></div>
    <div class="cc-tabs" id="ccTabs">
      <button data-cam="overview" class="on">🗺️ Overview</button>
      ${ROOMS.map(r => `<button data-cam="${r.key}">${r.ico} ${r.name}</button>`).join('')}
    </div>
    <div class="cc-main">
      <div class="cc-stage glass city ${NIGHT ? 'night' : 'day'}" id="ccStage">
        <canvas id="ccCanvas"></canvas>
        <div class="cc-overlay" id="ccOverlay"></div>
        <div class="cc-hint dim">🖱️ Geser untuk memutar · klik kanan/dua jari untuk geser · scroll/cubit untuk zoom</div>
        <div class="cc-loading" id="ccLoading"><span class="spinner"></span> Membangun kantor…</div>
        <button class="cc-fs" id="ccFs" title="Layar penuh" aria-label="Layar penuh">⛶</button>
        <div class="cc-fs-stats" id="ccFsStats"></div>
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

  /* ───── Renderer, kamera, cahaya ───── */
  const stage = $('#ccStage'), canvas = $('#ccCanvas'), overlay = $('#ccOverlay');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  // Mode ringan: resolusi dibatasi, bayangan sederhana & tidak dihitung tiap frame
  let pr = Math.min(devicePixelRatio || 1, 1.25);
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  window.__bgPause = true; // jeda background 3D beranda selama di kantor
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
  const controls = new OrbitControls(cam, canvas);
  Object.assign(controls, { enableDamping: true, minDistance: 8, maxDistance: 140, maxPolarAngle: Math.PI / 2.3, minPolarAngle: Math.PI / 7, screenSpacePanning: false });
  const OVER = { target: new THREE.Vector3(-1.5, 0, -6), dist: SMALL ? 112 : 86 };
  const overDir = () => { const st = document.getElementById('ccStage'); const a = st ? st.clientWidth / Math.max(1, st.clientHeight) : 1.4;
    return a < 0.85 ? { dir: new THREE.Vector3(0.95, 1.25, 0.32).normalize(), dist: 62 / Math.max(0.45, a) * 0.82 } : { dir: new THREE.Vector3(-0.42, 0.78, 0.62).normalize(), dist: OVER.dist }; };
  controls.target.copy(OVER.target);
  { const o = overDir(); cam.position.copy(OVER.target).addScaledVector(o.dir, o.dist); }

  scene.add(new THREE.HemisphereLight(S.sky, S.gnd, NIGHT ? S.hemi * 1.45 : S.hemi));
  const sun = new THREE.DirectionalLight(NIGHT ? 0x93a5ff : 0xfff4e0, S.sun);
  sun.position.set(-22, 40, 26); sun.castShadow = true; sun.shadow.mapSize.set(SMALL ? 512 : 1024, SMALL ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 30, bottom: -30, far: 140 }); sun.shadow.bias = -0.0004;
  scene.add(sun);

  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
  const B = color => new THREE.MeshBasicMaterial({ color });
  const glassMat = (op = 0.22) => new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: op, roughness: 0.05, metalness: 0.2, depthWrite: false });
  let poolTex = null;
  const pool = (x, z, r, color, op, y = 0.04) => {
    if (!poolTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); poolTex = new THREE.CanvasTexture(c); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 2; scene.add(m); return m;
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, parent = scene, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const grp = (x, z, rot = 0, y = FY) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; scene.add(g); return g; };
  const animated = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ───── Tekstur prosedural ───── */
  const texCache = {};
  function canvasTex(key, w, h, draw, rx = 1, ry = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
    return t;
  }
  const shade = (hexStr, amt) => { const n = parseInt(hexStr.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt; r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b)); return `rgb(${r},${g},${b})`; };
  const FLOORS = {
    wood: () => canvasTex('wood', 256, 256, (g, w, h) => { const ph = 32; for (let y = 0; y < h; y += ph) { let x = -Math.random() * 120; while (x < w) { const L = 90 + Math.random() * 90; g.fillStyle = shade(S.wood, Math.round(rnd(-18, 18))); g.fillRect(x, y, L, ph); g.strokeStyle = shade(S.wood, -40); g.lineWidth = 1.5; g.strokeRect(x, y, L, ph); for (let k = 0; k < 3; k++) { g.strokeStyle = shade(S.wood, -12); g.beginPath(); g.moveTo(x + 4, y + 6 + k * 8); g.lineTo(x + L - 4, y + 6 + k * 8 + rnd(-2, 2)); g.stroke(); } x += L; } } }),
    herring: () => canvasTex('her', 256, 256, (g, w, h) => { g.fillStyle = shade(S.herring, -30); g.fillRect(0, 0, w, h); const s = 32; for (let y = -s * 2; y < h + s * 2; y += s) for (let x = -s * 2; x < w + s * 2; x += s * 2) { [[0, 1], [1, -1]].forEach(([o, dir], k) => { g.save(); g.translate(x + o * s, y + o * s); g.rotate(dir * Math.PI / 4); g.fillStyle = shade(S.herring, Math.round(rnd(-14, 16))); g.fillRect(0, 0, s * 1.35, s * 0.45); g.strokeStyle = shade(S.herring, -45); g.strokeRect(0, 0, s * 1.35, s * 0.45); g.restore(); }); } }),
    carpet: (col = S.carpet) => canvasTex('car' + col, 128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let i = 0; i < 2400; i++) { g.fillStyle = shade(col, Math.round(rnd(-22, 22))); g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }),
    tile: () => canvasTex('tile', 128, 128, (g, w, h) => { const s = 32; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = shade(S.tile[0], Math.round(rnd(-8, 8))); g.fillRect(x, y, s, s); g.strokeStyle = S.tile[1]; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, s - 2, s - 2); } }),
    checker: () => canvasTex('chk', 128, 128, (g, w, h) => { const s = 32; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = ((x + y) / s) % 2 ? S.checker[1] : S.checker[0]; g.fillRect(x, y, s, s); } }),
    server: () => canvasTex('srv', 128, 128, (g, w, h) => { const s = 32; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = S.server[0]; g.fillRect(x, y, s, s); g.strokeStyle = S.server[1]; g.lineWidth = 3; g.strokeRect(x, y, s, s); g.fillStyle = shade(S.server[0], 25); for (let k = 0; k < 4; k++) g.fillRect(x + 6 + k * 6, y + 14, 2, 4); } }),
  };
  function floorMesh(x1, z1, x2, z2, kind, scale = 3) {
    const tex = kind === 'carpetDark' ? FLOORS.carpet(S.carpetDark) : FLOORS[kind]();
    tex.repeat.set((x2 - x1) / scale, (z2 - z1) / scale);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ map: tex, roughness: kind.startsWith('carpet') ? 0.95 : 0.55 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, FY + 0.005, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m); return m;
  }
  function textTex(lines, { w = 512, h = 256, bg = '#0f172a', fg = '#ffffff', accent = '#38bdf8', chart = false, size = 64 } = {}) {
    return canvasTex('t' + lines.join(), w, h, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (chart) { const bars = [40, 70, 55, 90, 75, 110]; bars.forEach((b, i) => { g.fillStyle = i % 2 ? accent : shade(accent, -40); g.fillRect(40 + i * 70, h - 30 - b * 1.4, 44, b * 1.4); }); g.strokeStyle = '#fbbf24'; g.lineWidth = 5; g.beginPath(); bars.forEach((b, i) => { const X = 62 + i * 70, Y = h - 40 - b * 1.6; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => { g.font = `800 ${i ? Math.round(size * 0.45) : size}px "Plus Jakarta Sans", Arial, sans-serif`; if (i) g.fillStyle = accent; g.fillText(l, w / 2, chart ? 34 + i * 30 : h / 2 + (i - (lines.length - 1) / 2) * size * 0.9); });
    });
  }
  const screenMat = (lines, opt) => new THREE.MeshBasicMaterial({ map: textTex(lines, opt) });

  /* ───── Lingkungan luar ───── */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), M(S.ground, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const ROADZ = 15;
  box(220, 0.04, 6, M(S.road, { roughness: 0.95 }), 0, 0, ROADZ, scene, false);
  for (let x = -100; x < 100; x += 4) box(2, 0.05, 0.16, B(0xfacc15), x, 0.01, ROADZ, scene, false);
  box(220, 0.16, 2.6, M(S.walk), 0, 0, ROADZ - 4.3, scene, false);
  box(220, 0.16, 2.6, M(S.walk), 0, 0, ROADZ + 4.3, scene, false);
  box(3.4, 0.1, ROADZ - 5.6 - ZF2, M(S.walk), -20, 0, (ZF2 + ROADZ - 5.6) / 2, scene, false);     // jalan setapak ke pintu
  function tree(x, z, s = 1) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t);
    box(0.35, 1.3, 0.35, M(0x6b3f1d), 0, 0, 0, t);
    box(1.8, 1.4, 1.8, M(themeKey === 'dongeng' ? 0xa7f3d0 : NIGHT ? 0x166534 : 0x22c55e), 0, 1.2, 0, t);
    box(1.2, 0.9, 1.2, M(themeKey === 'dongeng' ? 0x86efac : NIGHT ? 0x14532d : 0x16a34a), 0.1, 2.5, 0.05, t);
  }
  for (let x = -90; x <= 90; x += 7) { if (x < BX1 - 2 || x > BX2 + 2) tree(x, ROADZ - 6.8, 0.9); tree(x + 3.5, ROADZ + 6.6, 0.9); }
  for (let z = ZB1 - 2; z <= ZF2 + 2; z += 5) { tree(BX1 - 4, z, rnd(0.9, 1.3)); tree(BX2 + 4, z, rnd(0.9, 1.3)); }
  for (let x = BX1; x <= BX2; x += 6) tree(x + rnd(-1, 1), ZB1 - 4.5, rnd(1, 1.4));
  // hedge depan gedung
  for (let x = BX1 + 0.5; x < BX2; x += 1.6) if (Math.abs(x + 20) > 2.6) box(1.5, 0.7, 0.8, M(NIGHT ? 0x14532d : 0x16a34a), x, 0, ZF2 + 1.1);
  // lampu jalan
  for (let x = -72; x <= 72; x += 12) {
    box(0.14, 3.6, 0.14, M(0x475569), x, 0.16, ROADZ - 4.8); box(0.9, 0.1, 0.12, M(0x475569), x + 0.4, 3.7, ROADZ - 4.8);
    box(0.4, 0.14, 0.26, NIGHT ? B(0xfff3c4) : M(0xe2e8f0), x + 0.75, 3.6, ROADZ - 4.8, scene, false);
    if (NIGHT && Math.abs(x) <= 36) pool(x + 0.75, ROADZ - 4.8, 2.6, 0xffe2a8, 0.35);
  }
  // gedung latar
  function windowTex(lit) {
    return canvasTex('win' + lit + Math.random(), 64, 64, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const on = lit && Math.random() < 0.55; g.fillStyle = on ? ['#fde68a', '#fef3c7', '#bae6fd'][Math.floor(Math.random() * 3)] : lit ? '#111827' : '#64748b'; g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9); } });
  }
  function cityBlock(x, z, w, d, h, color) {
    const tex = windowTex(NIGHT); tex.repeat.set(Math.max(1, w / 3), Math.max(1, h / 3)); tex.magFilter = THREE.NearestFilter;
    const mat = NIGHT ? new THREE.MeshStandardMaterial({ color, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.7 });
    box(w, h, d, mat, x, 0, z); box(w + 0.3, 0.4, d + 0.3, M(new THREE.Color(color).multiplyScalar(0.8)), x, h, z);
  }
  for (let x = -80; x <= 80; x += rnd(8, 11)) cityBlock(x, rnd(-40, -32), rnd(6, 9), rnd(6, 9), rnd(10, 28), S.city[Math.floor(Math.random() * S.city.length)]);
  for (let x = -80; x <= 80; x += rnd(9, 13)) if (Math.abs(x) > 34) cityBlock(x, rnd(26, 31), rnd(6, 8), rnd(4, 6), rnd(3, 6), S.city[Math.floor(Math.random() * S.city.length)]);
  // mobil
  const cars = [];
  for (let i = 0; i < 8; i++) {
    const dir = i % 2 ? 1 : -1; const car = new THREE.Group(); scene.add(car);
    const color = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xf97316, 0xe5e7eb, 0x111827, 0xa855f7][i];
    box(2.2, 0.55, 1.1, M(color, { metalness: 0.3, roughness: 0.4 }), 0, 0.25, 0, car);
    box(1.2, 0.45, 1.0, M(0x1e293b, { metalness: 0.4, roughness: 0.2 }), -0.15, 0.8, 0, car);
    [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.55], [0.7, -0.55]].forEach(([a, b]) => { const w = cyl(0.22, 0.22, 0.16, M(0x111111), a, 0.14, b, car, 12); w.rotation.x = Math.PI / 2; });
    box(0.06, 0.14, 0.24, B(NIGHT ? 0xfffbeb : 0xe5e7eb), 1.1, 0.4, 0.35, car, false); box(0.06, 0.14, 0.24, B(NIGHT ? 0xfffbeb : 0xe5e7eb), 1.1, 0.4, -0.35, car, false);
    box(0.06, 0.12, 0.22, B(0xdc2626), -1.1, 0.4, 0.35, car, false); box(0.06, 0.12, 0.22, B(0xdc2626), -1.1, 0.4, -0.35, car, false);
    car.position.set(rnd(-90, 90), 0.05, dir > 0 ? ROADZ + 1.3 : ROADZ - 1.3); car.rotation.y = dir > 0 ? 0 : Math.PI;
    cars.push({ car, dir, speed: rnd(3.5, 6.5) });
  }
  const clouds = [];
  if (!NIGHT) for (let i = 0; i < 6; i++) { const c = new THREE.Group(); c.position.set(rnd(-70, 70), rnd(26, 34), rnd(-40, 0)); scene.add(c); for (let k = 0; k < 4; k++) box(rnd(2.5, 4.5), rnd(1, 1.8), rnd(2, 3), M(0xffffff, { transparent: true, opacity: 0.92 }), k * 1.8 - 2.6, rnd(-0.3, 0.4), rnd(-0.6, 0.6), c, false); clouds.push(c); }

  /* ───── Struktur gedung ───── */
  box(BX2 - BX1 + 0.6, FY, ZF2 - ZB1 + 0.6, M(S.ext), (BX1 + BX2) / 2, 0, (ZB1 + ZF2) / 2);                   // fondasi
  ROOMS.forEach(r => floorMesh(r.x1, r.z1, r.x2, r.z2, r.floor, r.floor === 'herring' ? 2.4 : 3));
  floorMesh(BX1, ZB2, BX2, ZF1, 'wood');
  const wallM = M(S.wall, { roughness: 0.85 }), trimM = M(S.trim, { roughness: 0.6 }), extM = M(S.ext, { roughness: 0.8 });
  const WH = 2.3, WT = 0.18;
  function wallX(x1, x2, z, { h = WH, mat = wallM, gap = null, gw = 1.7, glass = false } = {}) {
    const segs = gap == null ? [[x1, x2]] : [[x1, gap - gw / 2], [gap + gw / 2, x2]];
    segs.forEach(([a, b]) => {
      if (b - a < 0.05) return;
      if (glass) { box(b - a, 0.5, WT, mat, (a + b) / 2, FY, z); box(b - a, h - 0.5, 0.06, glassMat(0.2), (a + b) / 2, FY + 0.5, z, scene, false); for (let x = a; x <= b + 0.01; x += Math.max(1.2, (b - a) / Math.ceil((b - a) / 2))) box(0.06, h - 0.5, 0.1, trimM, x, FY + 0.5, z); }
      else box(b - a, h, WT, mat, (a + b) / 2, FY, z);
      box(b - a, 0.07, WT + 0.06, trimM, (a + b) / 2, FY + h, z, scene, false);
      box(b - a, 0.12, WT + 0.04, trimM, (a + b) / 2, FY, z, scene, false);
    });
  }
  function wallZ(z1, z2, x, { h = WH, mat = wallM, glass = false } = {}) {
    if (glass) { box(WT, 0.5, z2 - z1, mat, x, FY, (z1 + z2) / 2); box(0.06, h - 0.5, z2 - z1, glassMat(0.2), x, FY + 0.5, (z1 + z2) / 2, scene, false); }
    else box(WT, h, z2 - z1, mat, x, FY, (z1 + z2) / 2);
    box(WT + 0.06, 0.07, z2 - z1, trimM, x, FY + h, (z1 + z2) / 2, scene, false);
    box(WT + 0.04, 0.12, z2 - z1, trimM, x, FY, (z1 + z2) / 2, scene, false);
  }
  // dinding koridor per ruangan (dengan pintu)
  ROOMS.forEach(r => wallX(r.x1, r.x2, r.doorZ, { gap: r.door, glass: !!r.glass }));
  // partisi
  [-15, -3, 9, 18].forEach(x => wallZ(ZB1, ZB2, x));
  [-14, -8, 12].forEach((x, i) => wallZ(ZF1, ZF2, x, { glass: i === 2 }));
  // dinding luar belakang (jendela) & samping
  const EH = 2.7;
  box(BX2 - BX1, 0.9, WT, extM, (BX1 + BX2) / 2, FY, ZB1);
  box(BX2 - BX1, EH - 1.4, 0.06, glassMat(NIGHT ? 0.35 : 0.25), (BX1 + BX2) / 2, FY + 0.9, ZB1, scene, false);
  box(BX2 - BX1, 0.5, WT, extM, (BX1 + BX2) / 2, FY + EH - 0.5, ZB1);
  for (let x = BX1; x <= BX2; x += 2) box(0.1, EH - 1.4, 0.14, extM, x, FY + 0.9, ZB1);
  [BX1, BX2].forEach(x => { box(WT, 0.9, ZF2 - ZB1, extM, x, FY, (ZB1 + ZF2) / 2); box(0.06, EH - 1.4, ZF2 - ZB1, glassMat(0.2), x, FY + 0.9, (ZB1 + ZF2) / 2, scene, false); box(WT, 0.5, ZF2 - ZB1, extM, x, FY + EH - 0.5, (ZB1 + ZF2) / 2); });
  // dinding depan rendah (potongan) + pintu masuk lobby
  wallX(BX1, BX2, ZF2, { h: 0.9, mat: extM, gap: -20, gw: 3 });
  [-21.7, -18.3].forEach(x => box(0.25, 3.2, 0.25, extM, x, FY, ZF2 + 0.1));
  box(4.6, 0.08, 2.6, glassMat(0.35), -20, FY + 3.2, ZF2 + 1.1, scene, false); box(4.6, 0.1, 0.1, trimM, -20, FY + 3.2, ZF2 + 2.35, scene, false);
  const canopy = box(4.2, 0.5, 0.08, screenMat(['SIAPLOLOS', 'O F F I C E'], { w: 512, h: 96, bg: hex(S.trim), size: 46, accent: '#fde68a' }), -20, FY + 3.45, ZF2 + 2.42, scene, false);
  box(2.6, 0.03, 1.6, M(0x7f1d1d), -20, FY, ZF2 - 0.6, scene, false);
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


  /* ───── Perabot ───── */
  const R = Object.fromEntries(ROOMS.map(r => [r.key, r]));
  ROOMS.forEach(r => (r.spots = []));
  const spot = (room, parent, x, z, yaw, sit, act) => { const o = new THREE.Object3D(); o.position.set(x, 0, z); parent.add(o); room.spots.push({ obj: o, parent, yaw, sit, act }); };
  const darkM = M(0x1f2937), metalM = M(0x9ca3af, { metalness: 0.6, roughness: 0.35 }), whiteM = M(0xf8fafc);
  const deskTopM = M(themeKey === 'modern' ? 0x3f3f46 : themeKey === 'pro' ? 0xf1f5f9 : 0xd6b48a, { roughness: 0.5 });
  const screenGlow = (col) => new THREE.MeshBasicMaterial({ color: col });

  function chair(p, x, z, rot, col = 0x1f2937) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rot; p.add(c);
    cyl(0.05, 0.05, 0.32, metalM, 0, 0.06, 0, c, 8);
    for (let k = 0; k < 5; k++) { const leg = box(0.3, 0.04, 0.05, metalM, 0, 0.04, 0, c, false); leg.rotation.y = (k / 5) * Math.PI * 2; leg.position.x = Math.cos(leg.rotation.y) * 0.13; leg.position.z = -Math.sin(leg.rotation.y) * 0.13; }
    box(0.5, 0.08, 0.48, M(col), 0, 0.4, 0, c);
    box(0.48, 0.58, 0.07, M(col), 0, 0.48, -0.22, c);
    return c;
  }
  function plant(p, x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); p.add(g);
    cyl(0.22, 0.17, 0.42, M(themeKey === 'dongeng' ? 0xfbcfe8 : 0xe7e5e4), 0, 0, 0, g, 12);
    box(0.45, 0.45, 0.45, M(0x16a34a), 0, 0.42, 0, g); box(0.3, 0.4, 0.3, M(0x22c55e), 0.06, 0.82, -0.04, g); box(0.2, 0.25, 0.2, M(0x15803d), -0.12, 1.1, 0.06, g, false);
  }
  function rug(p, x, z, w, d, color, rot = 0) { const m = box(w, 0.02, d, M(color, { roughness: 1 }), x, 0.01, z, p, false); m.rotation.y = rot; box(w - 0.3, 0.025, d - 0.3, M(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25), { roughness: 1 }), x, 0.012, z, p, false).rotation.y = rot; }
  function sofa(p, x, z, rot, len = 2.2, col = S.sofa) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; p.add(g);
    const m = M(col, { roughness: 0.9 }), m2 = M(new THREE.Color(col).multiplyScalar(0.82), { roughness: 0.9 });
    box(len, 0.32, 0.85, m2, 0, 0.05, 0, g); box(len, 0.5, 0.22, m2, 0, 0.3, -0.33, g);
    box(0.2, 0.42, 0.85, m2, -len / 2 + 0.1, 0.05, 0, g); box(0.2, 0.42, 0.85, m2, len / 2 - 0.1, 0.05, 0, g);
    const n = Math.round(len / 0.75); for (let k = 0; k < n; k++) box((len - 0.5) / n - 0.04, 0.12, 0.6, m, -len / 2 + 0.25 + ((len - 0.5) / n) * (k + 0.5), 0.37, 0.06, g);
    return g;
  }
  function armchair(p, x, z, rot, col = S.sofa) { return sofa(p, x, z, rot, 0.95, col); }
  function bookshelf(p, x, z, rot, w = 1.6, h = 2) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; p.add(g);
    const wood = M(themeKey === 'modern' ? 0x27272a : 0x7c4a1e);
    box(w, h, 0.05, wood, 0, 0, -0.2, g); box(0.06, h, 0.42, wood, -w / 2, 0, 0, g); box(0.06, h, 0.42, wood, w / 2, 0, 0, g); box(w, 0.06, 0.42, wood, 0, h - 0.06, 0, g);
    const rows = Math.round(h / 0.5);
    for (let r = 0; r < rows; r++) {
      box(w, 0.05, 0.42, wood, 0, r * (h / rows), 0, g, false);
      let bx = -w / 2 + 0.08;
      while (bx < w / 2 - 0.12) { const bw = rnd(0.12, 0.22), bh = rnd(0.25, 0.38); box(bw, bh, 0.3, M([0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xf8fafc, 0x0f766e, 0x9f1239][Math.floor(Math.random() * 8)]), bx + bw / 2, r * (h / rows) + 0.05, 0.02, g, false); bx += bw + 0.012; }
    }
    return g;
  }
  function monitor(p, x, z, rot = 0, w = 0.55, col = 0x38bdf8) {
    const g = new THREE.Group(); g.position.set(x, 0.77, z); g.rotation.y = rot; p.add(g);
    box(0.16, 0.02, 0.12, darkM, 0, 0, 0, g, false); box(0.04, 0.2, 0.04, darkM, 0, 0.02, -0.02, g, false);
    box(w, w * 0.6, 0.04, darkM, 0, 0.18, -0.03, g);
    const scr = box(w - 0.05, w * 0.6 - 0.05, 0.005, screenGlow(col), 0, 0.205, 0, g, false); scr.userData.screen = true; animated.push(scr);
    return g;
  }
  function deskBasic(p, x, z, rot, w = 1.5, d = 0.75) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; p.add(g);
    box(w, 0.05, d, deskTopM, 0, 0.72, 0, g);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.05, 0.72, 0.05, metalM, a * (w / 2 - 0.06), 0, b * (d / 2 - 0.06), g, false));
    return g;
  }
  // kubikel: monitor ganda, sekat, kursi (karakter duduk menghadap -z lokal)
  function cubicle(room, p, x, z, rot, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; p.add(g);
    deskBasic(g, 0, 0, 0, 1.6, 0.75);
    const fab = M(S.fabric, { roughness: 1 });
    box(1.7, 1.2, 0.06, fab, 0, 0, -0.42, g); box(1.7, 0.05, 0.1, trimM, 0, 1.2, -0.42, g, false);
    box(0.06, 1.2, 0.85, fab, -0.85, 0, 0, g); box(0.1, 0.05, 0.85, trimM, -0.85, 1.2, 0, g, false);
    monitor(g, -0.3, -0.2, 0.15, 0.5, col); monitor(g, 0.32, -0.2, -0.15, 0.5, col);
    box(0.42, 0.02, 0.14, darkM, 0, 0.77, 0.08, g, false);
    if (Math.random() < 0.6) cyl(0.04, 0.04, 0.1, M([0xef4444, 0xf8fafc, 0x3b82f6][Math.floor(Math.random() * 3)]), 0.6, 0.77, 0.1, g, 8);
    if (Math.random() < 0.35) plant(g, -0.62, -0.22, 0.35);
    chair(g, 0, 0.62, Math.PI);
    spot(room, g, 0, 0.62, rot + Math.PI, true, 'type');
    return g;
  }

  /* ───── Isi tiap ruangan ───── */
  // Studio AI — rak server
  {
    const r = R.ai, g = grp(r.cx, r.cz);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
      const rx = -3.4 + i * 1.9, rz = -3.2 + row * 2.6;
      const rk = box(0.9, 2.1, 0.8, M(0x111827, { metalness: 0.4, roughness: 0.4 }), rx, 0, rz, g);
      for (let j = 0; j < 7; j++) { const led = box(0.7, 0.04, 0.02, B([0x22d3ee, 0x4ade80, 0x60a5fa][j % 3]), 0, 0.2 + j * 0.25 - 1.05, 0.41 * (row ? -1 : 1), rk, false); led.userData.led = Math.random() * 6; animated.push(led); }
    }
    box(8, 0.08, 0.3, metalM, -0.6, 2.25, -3.2, g, false); box(8, 0.08, 0.3, metalM, -0.6, 2.25, -0.6, g, false);
    box(1.2, 1.6, 0.7, M(0xe5e7eb), 4.3, 0, -4.2, g); box(1, 0.4, 0.02, darkM, 4.3, 1.1, -3.84, g, false);
    deskBasic(g, 2.2, 2.6, Math.PI, 2, 0.8); monitor(g, 1.8, 2.7, Math.PI, 0.6, 0x818cf8); monitor(g, 2.6, 2.7, Math.PI, 0.6, 0x22d3ee); chair(g, 2.2, 1.9, 0, 0x312e81);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: 1 })); orb.position.set(-3.5, 1.3, 2.8); orb.userData.orb = true; g.add(orb); animated.push(orb);
    cyl(0.5, 0.6, 0.3, darkM, -3.5, 0, 2.8, g, 24);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 8, 48), B(r.color)); ring.rotation.x = Math.PI / 2; ring.position.set(-3.5, 1.3, 2.8); ring.userData.spin = true; g.add(ring); animated.push(ring);
    r.guardPos = [0.2, 0.02, 2.4, 0.6];
  }
  // Perpustakaan
  {
    const r = R.materi, g = grp(r.cx, r.cz);
    for (let i = 0; i < 6; i++) bookshelf(g, -5 + i * 2, -5.25, 0, 1.9, 2.1);
    bookshelf(g, -5.6, -1.5, Math.PI / 2, 2.4, 2.1); bookshelf(g, 5.6, -1.5, -Math.PI / 2, 2.4, 2.1);
    rug(g, -0.2, 0.3, 7, 4.2, S.rug);
    [[-2, 0.3], [1.8, 0.3]].forEach(([tx, tz]) => {
      deskBasic(g, tx, tz, 0, 2.2, 1.1);
      box(0.3, 0.06, 0.22, M(0xfef3c7), tx - 0.4, 0.77, tz - 0.1, g, false); box(0.25, 0.08, 0.2, M(0x3b82f6), tx + 0.5, 0.77, tz + 0.1, g, false);
      [[-0.55, -0.85, 0], [0.55, -0.85, 0], [-0.55, 0.85, Math.PI], [0.55, 0.85, Math.PI]].forEach(([cx, cz, cr]) => { chair(g, tx + cx, tz + cz, cr, 0x7c2d12); spot(r, g, tx + cx, tz + cz, cr, true, 'read'); });
    });
    armchair(g, -4.5, 3.3, Math.PI * 0.8); armchair(g, 4.5, 3.3, -Math.PI * 0.8);
    spot(r, g, -4.5, 3.3, Math.PI * 0.8, true, 'read'); spot(r, g, 4.5, 3.3, -Math.PI * 0.8, true, 'read');
    [-3.6, 3.6].forEach(x => { cyl(0.03, 0.03, 1.6, darkM, x, 0, 3.6, g, 6); cyl(0.12, 0.25, 0.3, M(0xfde68a, { emissive: NIGHT ? 0xfde68a : 0x000000, emissiveIntensity: 0.6 }), x, 1.55, 3.6, g, 12); });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), M(0x0ea5e9)); globe.position.set(5, 1.2, 2.4); globe.userData.spin = true; g.add(globe); animated.push(globe); cyl(0.05, 0.15, 0.95, M(0x7c4a1e), 5, 0, 2.4, g, 8);
    plant(g, -5.4, 4.6); plant(g, 5.4, 4.6);
    r.guardPos = [-2.6, 0.02, 4.4, 0.4];
  }
  // Ruang Analitik — ruang rapat
  {
    const r = R.evaluasi, g = grp(r.cx, r.cz);
    rug(g, 0, -0.6, 7, 4.4, S.rug);
    box(5.4, 0.08, 1.7, deskTopM, 0, 0.72, -0.6, g); box(0.5, 0.72, 1.1, darkM, -1.8, 0, -0.6, g); box(0.5, 0.72, 1.1, darkM, 1.8, 0, -0.6, g);
    for (let k = 0; k < 4; k++) { const cx = -1.95 + k * 1.3; chair(g, cx, -1.8, 0); chair(g, cx, 0.6, Math.PI); spot(r, g, cx, -1.8, 0, true, 'chat'); spot(r, g, cx, 0.6, Math.PI, true, 'chat'); }
    chair(g, 3.3, -0.6, -Math.PI / 2); spot(r, g, 3.3, -0.6, -Math.PI / 2, true, 'chat');
    for (let k = 0; k < 4; k++) box(0.25, 0.02, 0.3, whiteM, -1.9 + k * 1.3, 0.77, -1.2, g, false);
    const tv = box(4, 2.1, 0.08, screenMat(['EVALUASI MINGGUAN', 'akurasi · progres · streak'], { w: 512, h: 288, chart: true, accent: hex(r.color), size: 34 }), 0, 0.85, -5.3, g, false);
    box(4.2, 2.3, 0.05, darkM, 0, 0.75, -5.35, g);
    box(0.06, 1.2, 2.4, whiteM, -5.7, 0.8, -1, g); box(0.02, 0.5, 1.6, M(0x93c5fd), -5.66, 1.2, -1.3, g, false);
    box(2.4, 0.8, 0.5, M(0x7c4a1e), 3.6, 0, -5.2, g); plant(g, 5.3, -4.9); plant(g, -5.3, 4.5);
    r.guardPos = [4.6, 0.02, 3.6, -0.6];
  }
  // Hall of Fame
  {
    const r = R.peringkat, g = grp(r.cx, r.cz);
    box(1.6, 0.02, 8, M(0xb91c1c, { roughness: 1 }), 0, 0.01, -0.5, g, false);
    [[0, 1.0, 0xfacc15, '1'], [-1.3, 0.7, 0xcbd5e1, '2'], [1.3, 0.45, 0xf97316, '3']].forEach(([x, h, c]) => box(1.2, h, 1.2, M(c, { metalness: 0.45, roughness: 0.3 }), x, 0, -2.4, g));
    const cup = cyl(0.28, 0.14, 0.5, M(0xfacc15, { metalness: 0.85, roughness: 0.2 }), 0, 1.0, -2.4, g); cup.userData.spin = true; animated.push(cup);
    for (let i = 0; i < 3; i++) {
      const cx = -3.2 + i * 3.2;
      box(1.8, 2, 0.5, M(0x7c4a1e), cx, 0, -5.2, g); box(1.7, 1.6, 0.04, glassMat(0.25), cx, 0.3, -4.94, g, false);
      for (let j = 0; j < 3; j++) cyl(0.08, 0.05, 0.22, M([0xfacc15, 0xcbd5e1, 0xf97316][j], { metalness: 0.8, roughness: 0.25 }), cx - 0.5 + j * 0.5, 0.9, -5.15, g, 10);
    }
    for (let i = 0; i < 4; i++) { box(0.06, 0.7, 0.9, M(0xfacc15, { metalness: 0.6 }), -4.38, 1.1, -3 + i * 1.6, g); box(0.02, 0.56, 0.74, M([0x3b82f6, 0x22c55e, 0xef4444, 0xa855f7][i]), -4.34, 1.17, -3 + i * 1.6, g, false); }
    sofa(g, 3.2, 2.6, -Math.PI / 2, 2.2); plant(g, 4, -4.8); plant(g, -3.9, 4.6);
    [[-0.8, 0], [0.8, 0], [-1.6, -0.9], [1.6, -0.9], [0, 1.2], [-1.2, 2.2], [1.2, 2.2]].forEach(([x, z]) => spot(r, g, x, z, Math.PI, false, 'cheer'));
    r.guardPos = [2.6, 0.02, 4.2, -0.5];
  }
  // Pantry
  {
    const r = R.pantry, g = grp(r.cx, r.cz);
    const cab = M(themeKey === 'modern' ? 0x27272a : themeKey === 'dongeng' ? 0xfbcfe8 : 0xe7e5e4), top = M(themeKey === 'pro' ? 0x1e293b : 0x57534e, { roughness: 0.3 });
    box(7.4, 0.9, 0.65, cab, -0.1, 0, -5.15, g); box(7.5, 0.06, 0.72, top, -0.1, 0.9, -5.15, g);
    box(7.4, 0.7, 0.4, cab, -0.1, 1.55, -5.3, g);
    box(0.7, 0.04, 0.4, metalM, -1.5, 0.95, -5.1, g, false); cyl(0.02, 0.02, 0.3, metalM, -1.5, 0.95, -5.3, g, 6);
    box(0.45, 0.5, 0.4, darkM, 1.2, 0.96, -5.1, g); const cm = box(0.08, 0.08, 0.02, B(0xef4444), 1.2, 1.25, -4.89, g, false); cm.userData.blink = 0; animated.push(cm);
    box(0.6, 0.35, 0.4, M(0xd1d5db), 2.4, 0.96, -5.1, g);
    box(0.9, 2.1, 0.75, M(0xe5e7eb, { metalness: 0.4, roughness: 0.3 }), -3.5, 0, -4.95, g); box(0.04, 0.5, 0.04, metalM, -3.1, 1.2, -4.55, g, false);
    box(0.4, 1.1, 0.4, M(0xf8fafc), 3.4, 0, -2.5, g); cyl(0.16, 0.16, 0.45, M(0x93c5fd, { transparent: true, opacity: 0.7 }), 3.4, 1.1, -2.5, g, 12);
    const tbl = cyl(1.0, 1.0, 0.06, deskTopM, 0, 0.72, 0.8, g, 24); cyl(0.08, 0.3, 0.72, darkM, 0, 0, 0.8, g, 10);
    const bowl = cyl(0.22, 0.14, 0.12, M(0xf8fafc), 0, 0.78, 0.8, g, 12); [0xef4444, 0xfacc15, 0x22c55e].forEach((c, k) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M(c)); f.position.set(-0.08 + k * 0.08, 0.92, 0.8); g.add(f); });
    [0, 1, 2, 3].forEach(k => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; const cx = Math.sin(a) * 1.35, cz = 0.8 + Math.cos(a) * 1.35; chair(g, cx, cz, a + Math.PI, 0x92400e); spot(r, g, cx, cz, a + Math.PI, true, 'eat'); });
    [[0.6, -3.9, Math.PI], [-0.4, -3.9, Math.PI], [2.6, -2.2, -Math.PI / 2]].forEach(([x, z, y]) => spot(r, g, x, z, y, false, 'coffee'));
    plant(g, -3.4, 4.6); plant(g, 3.4, 4.6);
    r.guardPos = [1.2, 0.02, -3.9, Math.PI];
  }
  // Lobby
  {
    const r = R.beranda, g = grp(r.cx, r.cz);
    rug(g, 0.4, 1.6, 5.4, 3.6, S.rug);
    const logo = box(5, 1.3, 0.06, screenMat(['SIAPLOLOS', 'latihan cerdas · lolos seleksi'], { w: 640, h: 192, bg: hex(S.trim), size: 82, accent: '#fde68a' }), 0, 1.0, -4.85, g, false);
    box(5.4, 2.3, 0.1, M(S.trim), 0, 0, -4.95, g);
    const rd = M(themeKey === 'modern' ? 0x27272a : 0xf8fafc);
    box(3.6, 1.05, 0.7, rd, 0, 0, -3.2, g); box(3.8, 0.06, 0.85, M(S.trim), 0, 1.05, -3.2, g); box(0.7, 1.05, 1.4, rd, 1.85, 0, -2.85, g);
    box(3.4, 0.08, 0.02, B(r.color), 0, 0.5, -2.84, g, false);
    monitor(g, -0.6, -3.4, 0, 0.5, 0x60a5fa); chair(g, -0.2, -3.95, 0);
    sofa(g, -1.6, 1.4, Math.PI / 2, 2.4); sofa(g, 2.4, 1.4, -Math.PI / 2, 2.4);
    box(1.4, 0.38, 0.8, M(0x7c4a1e), 0.4, 0, 1.4, g); box(0.3, 0.03, 0.2, M(0xef4444), 0.2, 0.39, 1.3, g, false);
    [-0.6, 0.2, 1.0].forEach(z => { spot(r, g, -1.45, 1.4 + z - 0.2, Math.PI / 2, true, 'chat'); spot(r, g, 2.25, 1.4 + z - 0.2, -Math.PI / 2, true, 'chat'); });
    plant(g, -5.3, -4.3, 1.2); plant(g, 5.3, -4.3, 1.2); plant(g, -5.3, 4.3); plant(g, 4.6, 4.3);
    r.guardPos = [1.3, 0.02, -2.2, 0];
  }
  // Pos Akun
  {
    const r = R.akun, g = grp(r.cx, r.cz);
    box(1.8, 1, 0.7, M(0x334155), -1.6, 0, -3.6, g); box(1.9, 0.06, 0.8, M(S.trim), -1.6, 1, -3.6, g);
    [-2.1, -1.6, -1.1].forEach(x => monitor(g, x, -3.75, 0, 0.42, 0x4ade80));
    chair(g, -1.6, -4.4, 0);
    [-0.4, 1.2].forEach(x => { box(0.3, 1, 0.9, metalM, x, 0, 0.3, g); box(0.3, 1, 0.9, metalM, x + 0.95, 0, 0.3, g); const arm = box(0.62, 0.05, 0.05, B(0xef4444), x + 0.47, 0.85, 0.3, g, false); arm.userData.gate = Math.random() * 6; animated.push(arm); });
    for (let i = 0; i < 4; i++) { box(0.55, 1.9, 0.5, M([0x3b82f6, 0x64748b][i % 2]), 2.4, 0, -4 + i * 0.6, g); box(0.04, 0.12, 0.02, metalM, 2.13, 1.1, -4 + i * 0.6, g, false); }
    [[0.07, 1.4], [1.68, 1.4], [0.07, 2.6], [1.68, 2.6], [-1.6, 3], [-2.2, 1.8]].forEach(([x, z]) => spot(r, g, x, z, Math.PI, false, 'gate'));
    plant(g, -2.5, 4.4);
    r.guardPos = [-0.2, 0.02, -1.6, 0.3];
  }
  // Ruang Latihan — area kubikel
  {
    const r = R.latihan, g = grp(r.cx, r.cz);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) cubicle(r, g, -7.2 + i * 2.85 + (i >= 3 ? 0.6 : 0), -2.9 + row * 2.75, 0, r.color);
    const proj = box(5, 2.2, 0.06, screenMat(['RUANG LATIHAN', 'TWK · TIU · TKP · OJK · BI · BUMN'], { w: 640, h: 288, bg: '#0f172a', accent: hex(r.color), size: 60 }), 0, 0.2, 0, g, false);
    proj.position.set(9.85, 1.5, 0.4); proj.rotation.y = -Math.PI / 2;
    box(0.06, 0.06, 5.2, darkM, 9.9, 2.65, 0.4, g, false);
    box(0.9, 1.2, 0.6, M(0xd1d5db), 9.3, 0, 4.4, g); box(0.7, 0.05, 0.4, darkM, 9.3, 1.2, 4.4, g, false);
    box(0.4, 1.1, 0.4, M(0xf8fafc), -9.4, 0, 4.4, g); cyl(0.16, 0.16, 0.45, M(0x93c5fd, { transparent: true, opacity: 0.7 }), -9.4, 1.1, 4.4, g, 12);
    plant(g, -9.4, -4.6, 1.2); plant(g, 9.4, -4.6, 1.2); plant(g, 6, 4.6);
    r.guardPos = [3.3, 0.02, -4.2, Math.PI];
  }
  // Arena Duel — ruang game
  {
    const r = R.duel, g = grp(r.cx, r.cz);
    rug(g, -3.2, 1.8, 4.4, 3.4, 0x1e3a8a); rug(g, 3.4, 1.8, 4, 3.2, 0x065f46);
    // meja biliar
    const bt = new THREE.Group(); bt.position.set(-3.2, 0, 1.8); g.add(bt);
    box(2.8, 0.75, 1.5, M(0x5b3416), 0, 0, 0, bt); box(2.6, 0.04, 1.3, M(0x15803d, { roughness: 1 }), 0, 0.75, 0, bt, false);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => box(0.18, 0.75, 0.18, M(0x3f2410), a * 1.25, 0, b * 0.6, bt));
    [0xfacc15, 0xef4444, 0x3b82f6, 0xf8fafc, 0x111827, 0xf97316].forEach((c, k) => { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(c, { roughness: 0.2 })); ball.position.set(-0.5 + (k % 3) * 0.12, 0.84, -0.12 + Math.floor(k / 3) * 0.12); bt.add(ball); });
    const cue = box(1.4, 0.03, 0.03, M(0xd6b48a), 0.6, 0.85, 0.3, bt, false); cue.rotation.y = 0.3;
    // ping-pong
    const pp = new THREE.Group(); pp.position.set(3.4, 0, 1.8); g.add(pp);
    box(2.6, 0.06, 1.4, M(0x1d4ed8), 0, 0.72, 0, pp); box(0.02, 0.16, 1.5, whiteM, 0, 0.78, 0, pp, false); box(2.6, 0.01, 0.02, whiteM, 0, 0.78, 0, pp, false);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => box(0.06, 0.72, 0.06, metalM, a * 1.2, 0, b * 0.6, pp, false));
    // foosball & bean bag
    box(1.3, 0.85, 0.7, M(0x7c2d12), 5.6, 0, -1.2, g); box(1.2, 0.02, 0.6, M(0x16a34a), 5.6, 0.85, -1.2, g, false);
    for (let k = 0; k < 4; k++) box(0.02, 0.02, 1.0, metalM, 5.15 + k * 0.3, 0.93, -1.2, g, false);
    [[-5.8, 4.4, 0xef4444], [-4.6, 4.6, 0xfacc15], [5.8, 4.4, 0x8b5cf6]].forEach(([x, z, c]) => { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), M(c, { roughness: 0.9 })); bb.scale.set(1, 0.6, 1); bb.position.set(x, 0.3, z); bb.castShadow = true; g.add(bb); });
    // meja duel berhadapan + papan skor
    [-1.3, 1.3].forEach((x, k) => { deskBasic(g, x, -2.9, 0, 1.6, 0.7); monitor(g, x, -3.05, 0, 0.55, k ? 0xef4444 : 0x3b82f6); chair(g, x, -2.3, Math.PI, k ? 0x7f1d1d : 0x1e3a8a); spot(r, g, x, -2.3, Math.PI, true, 'duel'); });
    const sb = box(4.4, 1.5, 0.06, screenMat(['ARENA DUEL', '⚔️  P1   VS   P2  ⚔️'], { w: 640, h: 220, bg: '#111827', accent: '#facc15', size: 70 }), 0, 1.0, -4.85, g, false);
    box(4.6, 1.7, 0.05, darkM, 0, 0.9, -4.9, g);
    const vs = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), B(0xfacc15)); vs.position.set(0, 1.25, -2.9); vs.userData.spin = true; g.add(vs); animated.push(vs);
    box(0.8, 1.8, 0.7, M(0x312e81), -6.2, 0, -3.6, g); box(0.6, 0.45, 0.02, screenGlow(0xf472b6), -6.2, 1.25, -3.24, g, false);
    [[-4.2, 1.8, -Math.PI / 2], [-2.2, 3.1, Math.PI], [2.1, 1.8, Math.PI / 2], [4.7, 1.8, -Math.PI / 2], [5.6, -0.3, Math.PI], [-6.2, -2.6, Math.PI]].forEach(([x, z, y]) => spot(r, g, x, z, y, false, 'play'));
    plant(g, 6.4, -4.4, 1.2);
    r.guardPos = [3.4, 0.02, -4.1, Math.PI];
  }
  // lampu interior malam
  // lampu ruangan palsu (genangan cahaya) – jauh lebih ringan daripada PointLight
  if (NIGHT) ROOMS.forEach(r => pool(r.cx, r.cz, Math.max(r.w, r.d) * 0.55, 0xffd7a0, 0.22, FY + 0.03));

  /* ───── Bekukan objek statis (hemat CPU) ───── */
  { const dyn = new Set([...animated, ...cars.map(c => c.car), ...clouds]);
    const freeze = (o, skip) => { const isDyn = skip || dyn.has(o); if (!isDyn) { o.updateMatrix(); o.matrixAutoUpdate = false; } o.children.forEach(c => freeze(c, isDyn)); };
    scene.children.forEach(c => freeze(c, false)); }
  /* ───── Bot penjaga ───── */
  const guards = {};
  ROOMS.forEach(r => {
    const g = makeGuard(r.color, r.key === 'ai');
    const [x, y, z, rot] = r.guardPos || [0, 0.02, 0, 0];
    g.position.set(r.cx + x, FY + y, r.cz + z); g.rotation.y = rot; scene.add(g);
    guards[r.key] = g;
  });
  scene.updateMatrixWorld(true);
  ROOMS.forEach(r => r.spots.forEach(s => { s.pos = new THREE.Vector3(); s.obj.getWorldPosition(s.pos); s.pos.y = FY; }));

  /* ───── Navigasi karakter ───── */
  const V = (x, z) => new THREE.Vector3(x, FY, z);
  const chars = new Map(); const tmp = new THREE.Vector3();
  const roomAt = (x, z) => ROOMS.find(r => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) || null;
  function route(ch, room, spotObj) {
    const p = ch.group.position, wps = [];
    let cur = roomAt(p.x, p.z);
    if (p.z > ZF2 - 0.1) { wps.push(V(-20, ZF2 + 0.9), V(-20, ZF2 - 1.2)); cur = R.beranda; }
    if (cur !== room) {
      if (cur) wps.push(V(cur.door, cur.inZ), V(cur.door, ZC));
      wps.push(V(room.door, ZC), V(room.door, room.inZ));
    }
    wps.push(spotObj.pos.clone());
    ch.waypoints = wps; ch.seated = false;
  }
  function fallbackSpot(room, i) {
    const o = { pos: V(room.cx + ((i % 4) - 1.5) * 1.1, room.inZ + (room.row === 'back' ? -1 : 1) * (1 + Math.floor(i / 4) * 0.9)), yaw: room.row === 'back' ? Math.PI : 0, sit: false, act: 'stand' };
    return o;
  }
  function placeChars(users) {
    const seen = new Set();
    ROOMS.forEach(r => (r.occupants = []));
    users.forEach(u => {
      const idle = !u.demo && u.lastSeen && state.serverNow - u.lastSeen > 70000;
      const room = idle ? R.pantry : u.justLoggedIn && u.page === 'beranda' ? R.akun : roomOfPage(u.page);
      room.occupants.push(u); seen.add(u.key); u._idle = idle;
      let ch = chars.get(u.key);
      if (!ch) {
        const g = makeHuman(u.name); g.position.set(-20 + rnd(-5, 5), FY - 0.1, ZF2 + rnd(2.5, 4));
        ch = { group: g, u, room: null, waypoints: [], spot: null }; chars.set(u.key, ch);
        pushFeed({ ico: '🚶', text: `<b>${esc(u.name)}</b> ${u.demo ? 'datang (demo)' : 'masuk kantor'}`, at: Date.now() });
      } else if (ch.room && ch.room !== room.key) pushFeed({ ico: room.ico, text: `<b>${esc(u.name)}</b> ${room.key === 'pantry' && idle ? 'rehat ngopi di Pantry ☕' : 'pindah ke ' + room.name}`, at: Date.now() });
      ch.u = u;
    });
    ROOMS.forEach(r => {
      r.occupants.forEach((u, i) => {
        const ch = chars.get(u.key); if (!ch) return;
        const sp = r.spots[i] || fallbackSpot(r, i - r.spots.length);
        if (ch.room !== r.key || ch.spot !== sp) { const changedRoom = ch.room !== r.key; ch.spot = sp; if (changedRoom || !ch.seated) route(ch, r, sp); else route(ch, r, sp); ch.room = r.key; }
      });
      const n = r.occupants.length; if (n > (r.prev || 0)) guards[r.key].userData.wave = 2.2; r.prev = n;
    });
    for (const [k, ch] of chars) if (!seen.has(k)) { scene.remove(ch.group); chars.delete(k); pushFeed({ ico: '👋', text: `<b>${esc(ch.u.name)}</b> pulang (offline)`, at: Date.now() }); }
  }

  /* ───── Overlay ───── */
  const labelEls = {}, guardEls = {}, labelAnch = {};
  ROOMS.forEach(r => {
    const el = document.createElement('button'); el.className = 'cc-label'; el.style.setProperty('--c', hex(r.color));
    el.onclick = () => selectRoom(r.key, true); overlay.appendChild(el); labelEls[r.key] = el;
    const ge = document.createElement('div'); ge.className = 'cc-tag bot hide'; ge.style.setProperty('--c', hex(r.color)); overlay.appendChild(ge); guardEls[r.key] = ge;
    const a = new THREE.Object3D(); a.position.set(r.cx, FY + 3.1, r.z1 + 0.6); scene.add(a); labelAnch[r.key] = a;
  });
  const tagEls = new Map(); const v = new THREE.Vector3();
  const toScreen = (obj, offY = 0) => { obj.getWorldPosition(v); v.y += offY; v.project(cam); return { x: (v.x * 0.5 + 0.5) * SW, y: (-v.y * 0.5 + 0.5) * SH, behind: v.z > 1 }; };
  // tulis ke DOM hanya bila posisinya berubah (hindari reflow tiap frame)
  const place = (el, p, anchor = '-100%') => { const tr = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, ${anchor})`; if (el._tr !== tr) { el.style.transform = tr; el._tr = tr; } const vis = p.behind ? 'hidden' : ''; if (el._vis !== vis) { el.style.visibility = vis; el._vis = vis; } };
  function drawOverlay() {
    ROOMS.forEach(r => { place(labelEls[r.key], toScreen(labelAnch[r.key]), '-50%'); place(guardEls[r.key], toScreen(guards[r.key], r.key === 'ai' ? 2.6 : 2.3)); });
    for (const [k, ch] of chars) {
      let el = tagEls.get(k);
      if (!el) { el = document.createElement('div'); el.className = 'cc-tag compact'; overlay.appendChild(el); tagEls.set(k, el); }
      place(el, toScreen(ch.group, ch.seated ? 1.75 : 2.15));
    }
    for (const [k, el] of tagEls) if (!chars.has(k)) { el.remove(); tagEls.delete(k); }
    drawBubbles(performance.now());
  }
  function refreshLabels() {
    ROOMS.forEach(r => {
      const n = r.occupants.length;
      let sub = `${n} orang`;
      if (r.key === 'ai') sub = state.system.generating ? `⚙️ membuat ${state.system.genType === 'materi' ? 'materi' : 'soal'}…` : `${fmt(state.system.bank)} soal`;
      if (r.key === 'duel') sub = `${n} orang · ${state.duels.filter(d => d.playing).length} duel`;
      labelEls[r.key].innerHTML = `<span class="ico">${r.ico}</span><span><b>${r.name}</b><small>${sub}</small></span>${n ? `<span class="cnt">${n}</span>` : ''}`;
      guardEls[r.key].innerHTML = `<b>🤖 ${r.guard.name}</b><small>${r.guard.task(n, state)}</small>`;
    });
    for (const [k, ch] of chars) { const el = tagEls.get(k); if (el) { ch._emo = exprOf(ch); el.innerHTML = tagHTML(ch); } }
  }

  /* ───── Ekspresi, balon komentar & popup ───── */
  const bubbles = [];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // obj: grup karakter/penjaga · kind: 'say' (komentar) | 'pop' (perayaan besar)
  function say(obj, text, { kind = 'say', ms = 3600, offY = 2.6, tone = '' } = {}) {
    if (!obj || !document.body.contains(stage)) return;
    for (const b of bubbles) if (b.obj === obj && b.kind === kind) b.until = 0;   // ganti balon lama
    const el = document.createElement('div');
    el.className = `cc-${kind} ${tone}`; el.innerHTML = text;
    if (kind === 'pop') el.insertAdjacentHTML('beforeend', '<i class="cc-conf">' + Array.from({ length: 14 }, (_, i) => `<b style="--a:${i * 26}deg;--d:${(i % 3) * 0.08}s;--c:${['#f472b6', '#facc15', '#22d3ee', '#a78bfa', '#4ade80'][i % 5]}"></b>`).join('') + '</i>');
    overlay.appendChild(el);
    bubbles.push({ el, obj, kind, offY, until: performance.now() + ms });
  }
  function drawBubbles(now) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (now > b.until || !b.obj.parent) {
        if (!b.el.classList.contains('out')) { b.el.classList.add('out'); setTimeout(() => b.el.remove(), 320); }
        bubbles.splice(i, 1); continue;
      }
      const ch = [...chars.values()].find(c => c.group === b.obj);
      const pt = toScreen(b.obj, b.offY - (ch?.seated ? 0.4 : 0));
      const hw = (b.w ||= b.el.offsetWidth) / 2 + 8;           // jaga balon tetap di dalam layar
      pt.x = Math.min(Math.max(pt.x, hw), SW - hw); pt.y = Math.max(pt.y, 40);
      place(b.el, pt);
    }
  }
  const charByKey = k => chars.get(k) || null;
  const charByName = n => [...chars.values()].find(c => c.u.name === n) || null;
  // ekspresi kecil di samping nama, sesuai aktivitas
  function exprOf(ch) {
    if (ch.override && ch.override.until > performance.now()) return ch.override.emo;
    if (ch.u._idle) return '😴';
    const act = ch.spot?.act;
    return { type: pick(['🤔', '🧐', '✍️']), duel: '😤', read: '📖', eat: '😋', coffee: '☕', cheer: '🥳', play: '😆' }[act] || { latihan: '🤔', quiz: '😤', materi: '📖', duel: '⚔️', evaluasi: '📈', peringkat: '🏆', profil: '😎', kantor: '🤩', beranda: '🙂', teknologi: '🤓' }[ch.u.page] || '🙂';
  }
  function tagHTML(ch) { const e = ch._emo || (ch._emo = exprOf(ch)); return `<b><span class="cc-emo">${e}</span>${esc(ch.u.name)}</b>`; }
  function setOverride(ch, act, emo, ms) { if (!ch) return; ch.override = { act, emo, until: performance.now() + ms }; ch._emo = emo; const el = tagEls.get(ch.u.key); if (el) el.innerHTML = tagHTML(ch); }
  const LINES = {
    latihan: ['Hmm, soal ini tricky 🤔', 'Jawabannya C… eh, B? 😅', 'Fokus, fokus! 💪', 'Satu soal lagi!', 'Waktunya mepet ⏱️', 'Oh, ini pernah keluar!'],
    quiz: ['Bismillah 🙏', 'Jangan panik…', 'Yes, ini aku tahu! ✨', 'Hmm, eliminasi dulu'],
    materi: ['Oh, gitu ternyata 📖', 'Catat dulu ✍️', 'Ini bakal keluar di tes!', 'BI-Rate naik lagi ya?', 'Menarik juga beritanya 🗞️'],
    duel: ['Ayo, kalahkan aku! ⚔️', 'Cepetan jawab! ⏱️', 'Skorku nyusul nih 😤', 'GG! 🤝', 'Bot-nya jago juga 🤖'],
    evaluasi: ['Akurasiku naik 📈', 'TIU masih lemah nih…', 'Streak hari ke-sekian 🔥'],
    peringkat: ['Kapan ya masuk top 3 🏆', 'Dikit lagi nyalip! 🚀'],
    profil: ['Ganti foto dulu ah 📷', 'Tema Senja keren juga 🌄'],
    kantor: ['Wah, kantornya keren 🏢', 'Itu aku ya? 👀'],
    beranda: ['Mulai dari mana ya?', 'Cek materi terbaru dulu', 'Semangat pagi! ☀️'],
    teknologi: ['Oh, pakai Firebase toh 🤓'],
    idle: ['Zzz… 😴', 'Ngopi dulu ☕', 'Rehat 5 menit ya', 'Kopinya enak banget'],
  };
  const GUARD_LINES = {
    ai: s => s.system.generating ? ['Lagi baca berita… 📰', 'Merangkai soal… ⚙️', 'Sebentar lagi jadi!'] : ['Siaga, menunggu jadwal 06.00 ⏰', `Bank soal: ${fmt(s.system.bank)} 📚`],
    materi: () => ['Selamat membaca 📖', 'Ada materi baru hari ini!'],
    latihan: () => ['Semangat latihannya! 💪', 'Jangan lupa baca pembahasan'],
    duel: s => s.duels.some(d => d.playing) ? ['Pertandingan seru! 🔥', 'Siapa yang menang ya?'] : ['Arena siap, ayo duel! ⚔️'],
    pantry: () => ['Kopi gratis hari ini ☕', 'Jangan lama-lama rehatnya 😉'],
    akun: () => ['Selamat datang! 👋'],
  };
  // obrolan acak setiap beberapa detik
  const chatter = setInterval(() => {
    if (!document.body.contains(stage)) return clearInterval(chatter);
    if (document.hidden || !onScreen) return;
    const list = [...chars.values()].filter(c => !c.waypoints.length);
    if (list.length && Math.random() < 0.8) {
      const ch = pick(list); ch._emo = exprOf(ch); const el = tagEls.get(ch.u.key); if (el) el.innerHTML = tagHTML(ch);
      const pool = ch.u._idle || ch.room === 'pantry' ? LINES.idle : LINES[ch.u.page] || LINES.beranda;
      say(ch.group, pick(pool), { ms: 3200, offY: 2.75 });
    }
    if (Math.random() < 0.35) {
      const r = pick(ROOMS.filter(x => GUARD_LINES[x.key] && (x.occupants.length || x.key === 'ai')));
      if (r) say(guards[r.key], pick(GUARD_LINES[r.key](state)), { ms: 3000, offY: r.key === 'ai' ? 3.1 : 2.8, tone: 'bot' });
    }
  }, 4200);
  // reaksi terhadap peristiwa nyata (dibandingkan dengan data sebelumnya)
  let prevSys = null; const seenReact = new Set();
  function react(prevUsers) {
    const s = state.system, G = guards.ai;
    const genWho = charByKey(s.genByKey) || charByKey(state.meKey);
    const what = t => (t === 'materi' ? 'materi' : t === 'soal' ? 'soal' : 'soal & materi');
    if (prevSys && !prevSys.generating && s.generating) {
      if (genWho) { say(genWho.group, `Bikin ${what(s.genType)} baru dulu ya 🧠`, { ms: 3800 }); setOverride(genWho, 'stand', '🧠', 6000); }
      say(G, 'Siap! Lagi baca berita terbaru… 📰', { ms: 4000, offY: 3.1, tone: 'bot' });
    }
    const lg = s.lastGenerate;
    if (prevSys && lg && lg.at !== prevSys.lastGenerate?.at && Date.now() - lg.at < 5 * 60e3) {
      const who = charByKey(lg.byKey) || genWho;
      const ok = (lg.total || 0) + (lg.materials || 0) > 0;
      const msg = ok ? `🎉 Yeay! ${[lg.total ? `+${lg.total} soal` : '', lg.materials ? `+${lg.materials} materi` : ''].filter(Boolean).join(' · ')} baru!` : '😵 Yah, Gemini lagi sibuk…';
      if (who) { say(who.group, msg, { kind: 'pop', ms: 5200, offY: 3.2, tone: ok ? '' : 'bad' }); setOverride(who, ok ? 'cheer' : 'sad', ok ? '🥳' : '😫', 5000); }
      else say(G, msg, { kind: 'pop', ms: 5200, offY: 3.4, tone: ok ? '' : 'bad' });
      say(G, ok ? 'Selesai! Silakan dicoba 📚' : 'Maaf, coba lagi nanti ya 🙏', { ms: 4200, offY: 3.1, tone: 'bot' });
      if (ok) sfxSafe('win'); else sfxSafe('lose');
      // penonton lain ikut senang
      if (ok) [...chars.values()].filter(c => c !== who).slice(0, 4).forEach((c, i) => setTimeout(() => { setOverride(c, 'cheer', '👏', 2500); say(c.group, pick(['Mantap! 👏', 'Asik, soal baru!', 'Gas latihan! 🚀', 'Keren admin! 🙌']), { ms: 2600 }); }, 600 + i * 450));
    }
    // hasil latihan baru → reaksi sesuai skor
    for (const a of state.recent) {
      const id = a.name + a.createdAt; if (seenReact.has(id)) continue; seenReact.add(id);
      if (!prevSys || Date.now() - a.createdAt > 3 * 60e3) continue;
      const c = charByName(a.name); if (!c) continue;
      if (a.score >= 80) { say(c.group, `Yes! Skor ${a.score} 🔥`, { kind: 'pop', ms: 4200, offY: 3 }); setOverride(c, 'cheer', '🤩', 4500); }
      else if (a.score >= 60) { say(c.group, `Lumayan, ${a.score} 👍`, { ms: 3600 }); setOverride(c, 'stand', '😊', 4000); }
      else { say(c.group, `Yah… ${a.score} 😅 coba lagi!`, { ms: 3800, tone: 'sad' }); setOverride(c, 'sad', '😢', 4500); }
    }
    // sapaan & pindah ruangan
    const before = new Map((prevUsers || []).map(u => [u.key, u]));
    if (prevSys) for (const u of [...state.users, ...demo]) {
      const c = charByKey(u.key); if (!c) continue; const p = before.get(u.key);
      if (!p) setTimeout(() => say(c.group, pick(['Halo semua! 👋', 'Selamat datang aku 😄', 'Pagi! Siap belajar ✨']), { ms: 3200 }), 1500);
      else if (p.page !== u.page) setTimeout(() => say(c.group, pick({ latihan: ['Gas latihan! 💪'], quiz: ['Mulai ujian! 📝'], materi: ['Baca materi dulu 📖'], duel: ['Siapa berani duel? ⚔️'], evaluasi: ['Cek nilai dulu 📈'], peringkat: ['Lihat peringkat 🏆'] }[u.page] || ['Pindah dulu ya 🚶']), { ms: 3000 }), 2500);
    }
    prevSys = JSON.parse(JSON.stringify(s));
  }
  const sfxSafe = n => import('./sound.js').then(m => m.sfx(n)).catch(() => {});

  /* ───── Kamera: tab & terbang ───── */
  let fly = null;
  controls.addEventListener('start', () => (fly = null));
  function flyTo(key) {
    if (key === 'overview') { const o = overDir(); fly = { target: OVER.target.clone(), pos: OVER.target.clone().addScaledVector(o.dir, o.dist) }; return; }
    const r = R[key]; const portrait = stage.clientWidth < stage.clientHeight * 0.85; const dist = (Math.max(r.w, r.d) * 1.55 + 7) * (portrait ? 1.9 : SMALL ? 1.4 : 1);
    const t = new THREE.Vector3(r.cx, 0.6, r.cz);
    fly = { target: t, pos: t.clone().add(new THREE.Vector3(-0.28, 0.86, 0.43).normalize().multiplyScalar(dist)) };
  }
  let selected = null;
  function selectRoom(key, move) {
    selected = key === 'overview' ? null : key;
    $$('#ccTabs button').forEach(b => b.classList.toggle('on', b.dataset.cam === (selected || 'overview')));
    Object.entries(labelEls).forEach(([k, el]) => el.classList.toggle('on', k === selected));
    Object.entries(guardEls).forEach(([k, el]) => el.classList.toggle('hide', k !== selected));
    if (move) flyTo(key);
    showRoom();
  }
  $$('#ccTabs button').forEach(b => (b.onclick = () => selectRoom(b.dataset.cam, true)));
  // ───── Layar penuh ─────
  const tabsEl = $('#ccTabs'), tabsHome = tabsEl.parentNode, tabsNext = tabsEl.nextSibling, fsBtn = $('#ccFs');
  const isFull = () => document.fullscreenElement === stage || document.webkitFullscreenElement === stage || stage.classList.contains('cc-full');
  // Mode cadangan (iPhone/HP yang tidak mendukung Fullscreen API): pindahkan stage ke <body> agar
  // position:fixed benar-benar menutupi layar (panel kaca/animasi induk bisa "mengurung" elemen fixed).
  let stageHome = null;
  function fallbackFull() {
    if (stage.classList.contains('cc-full')) return;
    stageHome = document.createComment('cc-stage');
    stage.parentNode.insertBefore(stageHome, stage);
    document.body.appendChild(stage);
    stage.classList.add('cc-full'); document.documentElement.classList.add('cc-lock');
    scrollTo(0, 0);
  }
  function enterFull() {
    stage.prepend(tabsEl); tabsEl.classList.add('in-stage');
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen || stage.webkitRequestFullScreen;
    let p = null;
    try { p = req ? req.call(stage, { navigationUI: 'hide' }) : null; } catch { p = null; }
    if (p && typeof p.then === 'function') {
      p.then(() => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch {} }).catch(fallbackFull);
    } else {
      // Safari lama mengembalikan undefined: cek sebentar apakah benar masuk layar penuh
      setTimeout(() => { if (!document.fullscreenElement && !document.webkitFullscreenElement) fallbackFull(); }, req ? 300 : 0);
    }
    fsBtn.textContent = '✕'; fsBtn.title = 'Keluar layar penuh';
  }
  function exitFull() {
    try { if (document.fullscreenElement || document.webkitFullscreenElement) { const ex = document.exitFullscreen || document.webkitExitFullscreen; const r = ex?.call(document); r?.catch?.(() => {}); } } catch {}
    try { screen.orientation?.unlock?.(); } catch {}
    if (stage.classList.contains('cc-full')) {
      stage.classList.remove('cc-full'); document.documentElement.classList.remove('cc-lock');
      if (stageHome?.parentNode) { stageHome.parentNode.insertBefore(stage, stageHome); stageHome.remove(); }
      stageHome = null;
    }
    if (tabsNext && tabsNext.parentNode === tabsHome) tabsHome.insertBefore(tabsEl, tabsNext); else tabsHome.appendChild(tabsEl);
    tabsEl.classList.remove('in-stage');
    fsBtn.textContent = '⛶'; fsBtn.title = 'Layar penuh';
  }
  fsBtn.onclick = () => { isFull() ? exitFull() : enterFull(); setTimeout(() => { if (!selected) flyTo('overview'); }, 350); };
  const onFsChange = () => {
    if (!document.body.contains(stage)) { document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange', onFsChange); return; }
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !stage.classList.contains('cc-full') && tabsEl.classList.contains('in-stage')) exitFull(); };
  document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange);
  const onKey = e => { if (e.key === 'Escape' && stage.classList.contains('cc-full')) exitFull(); if (!document.body.contains(stage)) removeEventListener('keydown', onKey); };
  addEventListener('keydown', onKey);
  // keluar halaman saat mode cadangan aktif → bereskan agar tidak tertinggal di <body>
  window.addEventListener('hashchange', () => { if (stage.classList.contains('cc-full')) { exitFull(); stage.remove(); } }, { once: true });
  function showRoom() {
    const box2 = $('#ccRoomInfo');
    if (!selected) {
      box2.innerHTML = `<b>🗺️ Denah kantor</b><p class="dim" style="margin:4px 0 10px">Pilih tab atau ketuk label ruangan untuk terbang ke sana.</p>
        <div class="stack" style="gap:6px">${ROOMS.map(r => `<button class="dp" data-go="${r.key}" style="text-align:left;width:100%"><span style="font-size:18px">${r.ico}</span><span class="dp-name">${r.name}</span><span class="dim" style="font-size:12px">${r.occupants.length} orang</span></button>`).join('')}</div>`;
      $$('[data-go]', box2).forEach(b => (b.onclick = () => selectRoom(b.dataset.go, true)));
      return;
    }
    const r = R[selected]; const n = r.occupants.length;
    let extra = '';
    if (r.key === 'ai') { const s = state.system; extra = `<div class="stack" style="gap:6px;margin-top:8px"><div class="dim">AI: ${s.ai ? '✅ aktif' : '⚠️ belum diatur'} · Database: ${s.firebase ? '✅ Firebase' : '⚠️ memori'}</div><div class="dim">Bank soal: ${fmt(s.bank)} (${fmt(s.generated)} dari berita) · Materi hari ini: ${state.today.materials}</div>${s.lastGenerate ? `<div class="dim">Terakhir generate: ${timeAgo(s.lastGenerate.at)} — ${s.lastGenerate.total} soal, ${s.lastGenerate.materials} materi</div>` : ''}</div>`; }
    if (r.key === 'duel') extra = state.duels.length ? `<div class="stack" style="gap:6px;margin-top:8px">${state.duels.map(d => `<div class="tip"><span>⚔️</span><span><b>${esc(d.title)}</b> #${d.code} · ${esc(d.phase)}<br><span class="dim">${d.players.map(p => `${esc(p.name)} (${fmt(p.score)})`).join(' vs ')}${d.bot ? ' vs 🤖 Bot' : ''}</span></span></div>`).join('')}</div>` : '<p class="dim" style="margin:8px 0 0">Belum ada room duel aktif.</p>';
    if (r.key === 'pantry') extra = '<p class="dim" style="margin:8px 0 0">Pengguna yang tidak aktif lebih dari ±1 menit (tab disembunyikan) dianggap sedang rehat ngopi di sini.</p>';
    box2.innerHTML = `
      <div class="row between"><div class="row" style="gap:10px"><span style="font-size:26px">${r.ico}</span><div><b>${r.name}</b><div class="dim">${n} orang di sini</div></div></div><button class="btn ghost sm" id="backOv">🗺️</button></div>
      <div class="guard-card" style="--c:${hex(r.color)}"><span class="guard-ico">🤖</span><div><b>${r.guard.name}</b><div class="dim">Penjaga · ${r.guard.task(n, state)}</div></div></div>
      ${n ? `<div class="duel-players">${r.occupants.map(u => `<div class="dp"><span class="av" style="--h:${hue(u.name)};margin:0">${esc(u.name[0])}</span><span class="dp-name">${esc(u.name)}${u.demo ? ' <span class="dim">(demo)</span>' : ''}</span><span class="dim" style="font-size:12px">${u._idle ? '☕ rehat' : esc(u.target || '')}</span></div>`).join('')}</div>` : ''}${extra}`;
    $('#backOv').onclick = () => selectRoom('overview', true);
  }

  /* ───── Data ───── */
  const state = { serverNow: Date.now(), users: [], duels: [], recent: [], today: { sessions: 0, questions: 0, learners: 0, materials: 0 }, system: { bank: 0, generated: 0 } };
  ROOMS.forEach(r => (r.occupants = []));
  const feed = window.__ccFeed || (window.__ccFeed = []); const seenAttempts = new Set(feed.map(f => f.id).filter(Boolean));
  function pushFeed(item) { feed.unshift(item); feed.length = Math.min(feed.length, 40); renderFeed(); }
  function renderFeed() { const el = $('#ccFeed'); if (el) el.innerHTML = feed.length ? feed.slice(0, 25).map(f => `<div class="cc-ev"><span>${f.ico}</span><span>${f.text}<br><small class="dim">${timeAgo(f.at)}</small></span></div>`).join('') : '<div class="dim">Belum ada aktivitas.</div>'; }
  let demo = window.__ccDemoUsers || [];
  const makeDemo = () => (demo = DEMO_NAMES.map((n, i) => ({ key: 'demo' + i, name: n, target: ['CPNS', 'BUMN', 'OJK (PCS)', 'Bank Indonesia (PCPM)'][i % 4], page: DEMO_PAGES[i % DEMO_PAGES.length], demo: true, since: Date.now() - i * 60000 })));
  const shuffleDemo = () => demo.forEach(u => { if (Math.random() < 0.25) u.page = DEMO_PAGES[Math.floor(Math.random() * DEMO_PAGES.length)]; });
  async function load() {
    if (!document.body.contains(stage)) return false;
    const prevUsers = [...state.users, ...demo].map(u => ({ key: u.key, page: u.page }));
    try {
      Object.assign(state, await api('/admin-live'));
      state.recent.slice().reverse().forEach(a => { const id = a.name + a.createdAt; if (seenAttempts.has(id)) return; seenAttempts.add(id); feed.push({ id, ico: modeByKey[a.mode]?.ico || '📝', text: `<b>${esc(a.name)}</b> selesai ${modeByKey[a.mode]?.name || a.mode} ${esc(catByKey[a.category]?.name || '')} — skor ${a.score}`, at: a.createdAt }); });
      feed.sort((a, b) => b.at - a.at); renderFeed();
    } catch (e) { toast(e.message, 'err'); }
    const demoOn = $('#demoChk')?.checked; window.__ccDemo = demoOn;
    if (demoOn) { if (!demo.length) makeDemo(); else shuffleDemo(); } else demo = [];
    window.__ccDemoUsers = demo;
    placeChars([...state.users, ...demo]); refreshLabels(); renderStats(); showRoom();
    react(prevUsers);
    return true;
  }
  function renderStats() {
    const s = state.system, t = state.today;
    $('#ccStats').innerHTML = [
      ['🟢', 'Online', state.users.length + (demo.length ? ` +${demo.length} demo` : '')], ['📝', 'Sesi hari ini', t.sessions], ['🧑‍🎓', 'Pelajar hari ini', t.learners],
      ['❓', 'Soal dikerjakan', fmt(t.questions)], ['⚔️', 'Duel aktif', state.duels.filter(d => d.playing).length], ['📚', 'Bank soal', fmt(s.bank)],
      ['📖', 'Materi hari ini', t.materials], ['✨', 'Studio AI', s.generating ? 'bekerja…' : s.ai ? 'siaga' : 'off'],
    ].map(([i, l, val]) => `<div class="glass cc-stat"><span>${i}</span><div><b>${val}</b><small>${l}</small></div></div>`).join('');
    const fs = $('#ccFsStats'); if (fs) fs.innerHTML = `<span>🟢 ${state.users.length + demo.length} online</span><span>📝 ${t.sessions} sesi</span><span>⚔️ ${state.duels.filter(d => d.playing).length} duel</span><span>📚 ${fmt(s.bank)} soal</span>`;
  }
  $('#demoChk').onchange = () => load();

  /* ───── Animasi ───── */
  let SW = 1, SH = 1;
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; SW = w; SH = h; cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.setSize(w, h, false); };
  new ResizeObserver(resize).observe(stage); resize();
  const clock = new THREE.Clock();
  const swing = (ud, amt, speed, t) => { const s = Math.sin(t * speed + ud.phase) * amt; ud.legL.rotation.x = s; ud.legR.rotation.x = -s; ud.armL.rotation.x = -s; ud.armR.rotation.x = s; };
  const ease = (o, k, v) => (o.rotation.x += (v - o.rotation.x) * k);

  let onScreen = true, slow = 0, frames = 0, shadowT = 0;
  new IntersectionObserver(es => (onScreen = es[0].isIntersecting)).observe(stage);
  function frame() {
    if (!document.body.contains(stage)) { renderer.dispose(); window.__bgPause = false; return; }
    if (!onScreen || document.hidden) { clock.getDelta(); setTimeout(() => requestAnimationFrame(frame), 250); return; }
    const raw = clock.getDelta(), dt = Math.min(raw, 0.1), t = clock.elapsedTime, busy = state.system.generating;
    // kualitas adaptif: bila FPS < ~40, turunkan resolusi lalu matikan bayangan
    if (++frames > 30) { slow = slow * 0.9 + (raw > 0.026 ? 1 : 0) * 0.1; if (frames > 90 && slow > 0.6) {
      frames = 31; slow = 0;
      if (pr > 1) { pr = 1; renderer.setPixelRatio(pr); resize(); }
      else if (pr > 0.8) { pr = 0.8; renderer.setPixelRatio(pr); resize(); }
      else if (sun.castShadow) { sun.castShadow = false; }
    } }
    shadowT -= dt; if (shadowT <= 0 && sun.castShadow) { renderer.shadowMap.needsUpdate = true; shadowT = 0.35; }
    if (fly) {
      const k = Math.min(1, dt * 3.2);
      controls.target.lerp(fly.target, k); cam.position.lerp(fly.pos, k);
      if (cam.position.distanceTo(fly.pos) < 0.08) fly = null;
    }
    animated.forEach(o => {
      const u = o.userData;
      if (u.spin) o.rotation.y = t * 1.2;
      if (u.orb) { o.material.emissiveIntensity = 0.8 + Math.sin(t * (busy ? 9 : 3)) * 0.5; o.scale.setScalar(1 + (busy ? Math.sin(t * 6) * 0.12 : 0)); }
      if (u.led !== undefined) o.visible = Math.sin(t * (busy ? 9 : 2) + u.led) > -0.3;
      if (u.blink !== undefined) o.visible = Math.sin(t * 3) > 0;
      if (u.gate !== undefined) o.rotation.z = Math.max(0, Math.sin(t * 0.8 + u.gate)) * 1.3;
    });
    cars.forEach(c => { c.car.position.x += c.dir * c.speed * dt; if (c.car.position.x > 100) c.car.position.x = -100; if (c.car.position.x < -100) c.car.position.x = 100; });
    clouds.forEach((c, i) => { c.position.x += (0.4 + i * 0.08) * dt; if (c.position.x > 80) c.position.x = -80; });
    // penjaga
    ROOMS.forEach(r => {
      const g = guards[r.key], ud = g.userData, isAI = r.key === 'ai';
      ud.head.rotation.y = Math.sin(t * 0.7 + ud.phase) * 0.5; ud.bulb.scale.setScalar(1 + Math.sin(t * 4 + ud.phase) * 0.25);
      g.position.y = FY + 0.02 + Math.sin(t * 2 + ud.phase) * 0.02;
      if (ud.wave > 0) { ud.wave -= dt; guardEls[r.key].classList.remove('hide'); ud.armR.rotation.z = 2.6 + Math.sin(t * 14) * 0.35; ud.armR.rotation.x = 0; if (ud.wave <= 0 && r.key !== selected) guardEls[r.key].classList.add('hide'); }
      else if (isAI && busy) { ud.armL.rotation.x = Math.sin(t * 16) * 0.6 - 0.6; ud.armR.rotation.x = Math.cos(t * 16) * 0.6 - 0.6; ud.armR.rotation.z = 0; g.position.y = FY + 0.02 + Math.abs(Math.sin(t * 8)) * 0.1; }
      else { ud.armR.rotation.z *= 0.85; ud.armL.rotation.x = Math.sin(t * 1.2 + ud.phase) * 0.08; ud.armR.rotation.x = -Math.sin(t * 1.2 + ud.phase) * 0.08; }
    });
    // manusia
    for (const ch of chars.values()) {
      const g = ch.group, ud = g.userData, wp = ch.waypoints[0], k = Math.min(1, dt * 10);
      if (wp) {
        tmp.copy(wp).sub(g.position); tmp.y = 0; const d = tmp.length();
        if (d < 0.05) { g.position.x = wp.x; g.position.z = wp.z; ch.waypoints.shift(); }
        else { g.position.addScaledVector(tmp.normalize(), Math.min(d, 3 * dt)); g.position.y += (FY + 0.02 - g.position.y) * k; g.rotation.y = Math.atan2(tmp.x, tmp.z); swing(ud, 0.7, 11, t); ud.head.rotation.x = 0; ud.head.rotation.y = 0; }
        ch.seated = false;
        continue;
      }
      let sp = ch.spot || { yaw: 0, sit: false, act: 'stand' };
      if (ch.override && ch.override.until > performance.now() && ch.override.act !== 'stand') sp = { ...sp, sit: false, act: ch.override.act };
      let yaw = sp.yaw; const dy = ((yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; g.rotation.y += dy * k;
      const ph = ud.phase;
      if (sp.sit) {
        ch.seated = true; g.position.y += (FY + 0.01 - g.position.y) * k;
        ease(ud.legL, k, -1.45); ease(ud.legR, k, -1.45);
        if (sp.act === 'type' || sp.act === 'duel') { const f = sp.act === 'duel' ? 22 : 14; ud.armL.rotation.x = -1.15 + Math.sin(t * f + ph) * 0.12; ud.armR.rotation.x = -1.15 + Math.cos(t * f + ph) * 0.12; ud.head.rotation.x = 0.1 + Math.sin(t * 2 + ph) * 0.05; ud.head.rotation.y = sp.act === 'duel' ? Math.sin(t * 3 + ph) * 0.15 : 0; }
        else if (sp.act === 'read') { ease(ud.armL, k, -0.95); ease(ud.armR, k, -0.95); ud.head.rotation.x = 0.32 + Math.sin(t * 0.8 + ph) * 0.04; ud.head.rotation.y = Math.sin(t * 0.3 + ph) * 0.08; }
        else if (sp.act === 'eat') { const c = Math.max(0, Math.sin(t * 1.4 + ph)); ud.armR.rotation.x = -0.5 - c * 1.7; ease(ud.armL, k, -0.7); ud.head.rotation.x = 0.05 - c * 0.1; }
        else { ease(ud.armL, k, -0.35); ud.armR.rotation.x = -0.35 - Math.max(0, Math.sin(t * 1.1 + ph)) * 0.9; ud.head.rotation.y = Math.sin(t * 0.6 + ph) * 0.55; ud.head.rotation.x = 0; }
      } else {
        ch.seated = false; ease(ud.legL, k, 0); ease(ud.legR, k, 0);
        let y = FY + 0.02;
        if (sp.act === 'cheer') { ud.armL.rotation.x = ud.armR.rotation.x = -2.8; y += Math.abs(Math.sin(t * 5 + ph)) * 0.25; }
        else if (sp.act === 'play') { ud.armR.rotation.x = -0.6 + Math.sin(t * 6 + ph) * 0.8; ease(ud.armL, k, -0.3); g.rotation.y = yaw + Math.sin(t * 2 + ph) * 0.4; ud.head.rotation.y = Math.sin(t * 6 + ph) * 0.3; }
        else if (sp.act === 'coffee') { const c = Math.max(0, Math.sin(t * 1.2 + ph)); ud.armR.rotation.x = -0.6 - c * 1.5; ease(ud.armL, k, 0); ud.head.rotation.y = Math.sin(t * 0.5 + ph) * 0.4; }
        else if (sp.act === 'sad') { ease(ud.armL, k, 0.15); ease(ud.armR, k, 0.15); ud.head.rotation.x += (0.45 - ud.head.rotation.x) * k; ud.head.rotation.y = Math.sin(t * 0.7 + ph) * 0.25; y -= 0.03; }
        else { ease(ud.armL, k, 0); ease(ud.armR, k, 0); ud.head.rotation.y = Math.sin(t * 0.8 + ph) * 0.5; ud.head.rotation.x = 0; }
        g.position.y += (y - g.position.y) * Math.min(1, dt * 14);
      }
    }
    controls.update(); renderer.render(scene, cam); drawOverlay();
    requestAnimationFrame(frame);
  }
  $('#ccLoading').remove();
  renderFeed(); selectRoom('overview', false); frame();
  const loop = async () => { if (await load()) setTimeout(loop, 5000); };
  loop();
}
