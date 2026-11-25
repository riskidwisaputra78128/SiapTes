// 🏢 Command Center — visualisasi kantor 3D isometrik (khusus admin)
import { api, session } from './api.js';
import { $, $$, esc, fmt, timeAgo, toast } from './ui.js';
import { catByKey, modeByKey } from './data.js';

const ROOMS = [
  { key: 'beranda', name: 'Lobby', ico: '🏠', color: 0x22c55e, pages: ['beranda'], verb: 'santai di lobby', prop: 'sofa' },
  { key: 'latihan', name: 'Ruang Latihan', ico: '🎯', color: 0x3b82f6, pages: ['latihan', 'quiz', 'hasil'], verb: 'mengerjakan soal', prop: 'desks' },
  { key: 'materi', name: 'Perpustakaan', ico: '📖', color: 0xf59e0b, pages: ['materi'], verb: 'membaca materi', prop: 'books' },
  { key: 'duel', name: 'Arena Duel', ico: '⚔️', color: 0xef4444, pages: ['duel'], verb: 'di arena duel', prop: 'arena' },
  { key: 'evaluasi', name: 'Ruang Analitik', ico: '📈', color: 0x14b8a6, pages: ['evaluasi'], verb: 'cek evaluasi', prop: 'charts' },
  { key: 'peringkat', name: 'Hall of Fame', ico: '🏆', color: 0xeab308, pages: ['peringkat'], verb: 'lihat peringkat', prop: 'podium' },
  { key: 'akun', name: 'Pos Akun', ico: '🔐', color: 0xa855f7, pages: ['profil', 'teknologi', 'login'], verb: 'urus akun', prop: 'gate' },
  { key: 'ai', name: 'Studio AI', ico: '✨', color: 0x6366f1, pages: [], verb: '', prop: 'ai' },
];
const roomOfPage = p => ROOMS.find(r => r.pages.includes(p)) || ROOMS[0];
const DEMO_NAMES = ['Rina', 'Andi', 'Sari', 'Dimas', 'Fajar', 'Putri', 'Bayu', 'Nadia', 'Yoga', 'Lestari', 'Rafi', 'Citra'];
const DEMO_PAGES = ['beranda', 'quiz', 'quiz', 'materi', 'duel', 'duel', 'evaluasi', 'peringkat', 'profil', 'latihan'];
const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export async function renderAdminLive(app) {
  if (!session.user?.admin) {
    app.innerHTML = `<div class="glass card empty"><div style="font-size:44px">🔒</div><h2 class="h2">Khusus admin</h2><p class="muted">Halaman ini hanya bisa dibuka akun yang terdaftar di ADMIN_EMAILS.</p></div>`;
    return;
  }
  app.innerHTML = `
  <section class="cc fade-in">
    <div class="row between wrap" style="gap:10px">
      <div><h1 class="h1" style="margin:0">🏢 Command Center</h1><p class="muted" style="margin:0">Visualisasi aktivitas SiapLolos secara langsung · khusus admin</p></div>
      <div class="row" style="gap:8px">
        <label class="chip" style="cursor:pointer"><input type="checkbox" id="demoChk" style="accent-color:var(--cyan)"> Mode demo</label>
        <span class="chip"><span class="live-dot on"></span> Live</span>
      </div>
    </div>
    <div class="cc-stats" id="ccStats"></div>
    <div class="cc-main">
      <div class="cc-stage glass" id="ccStage">
        <canvas id="ccCanvas"></canvas>
        <div class="cc-overlay" id="ccOverlay"></div>
        <div class="cc-hint dim">🖱️ Geser untuk memutar · scroll/pinch untuk zoom · ketuk label ruangan</div>
        <div class="cc-loading" id="ccLoading"><span class="spinner"></span> Membangun kantor 3D…</div>
      </div>
      <aside class="cc-side">
        <div class="glass card" id="ccRoomInfo"><b>Pilih ruangan</b><p class="dim" style="margin:6px 0 0">Ketuk label ruangan di peta untuk melihat siapa yang ada di dalamnya.</p></div>
        <div class="glass card"><div class="row between"><b>⚡ Aktivitas terbaru</b><span class="dim" id="ccUpd"></span></div><div class="cc-feed" id="ccFeed"></div></div>
      </aside>
    </div>
  </section>`;

  let THREE, OrbitControls;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch {
    $('#ccLoading').innerHTML = '⚠️ Gagal memuat Three.js. Cek koneksi internet.'; return;
  }

  /* ───── Scene ───── */
  const stage = $('#ccStage'), canvas = $('#ccCanvas'), overlay = $('#ccOverlay');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const light = document.documentElement.getAttribute('data-theme');
  const isLight = ['light', 'dongeng', 'pro'].includes(light);
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  cam.position.set(26, 24, 26); cam.zoom = innerWidth < 700 ? 0.78 : 1.2;
  const controls = new OrbitControls(cam, canvas);
  controls.enableDamping = true; controls.minZoom = 0.35; controls.maxZoom = 2.4;
  controls.maxPolarAngle = Math.PI / 2.4; controls.minPolarAngle = Math.PI / 6; controls.enablePan = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, isLight ? 0xc7d2fe : 0x1e1b4b, isLight ? 1.6 : 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(14, 26, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26 });
  scene.add(sun);

  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // ground grid
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), M(isLight ? 0xe2e8f0 : 0x0b1024, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // center hub "SiapLolos Core"
  const hub = new THREE.Group(); scene.add(hub);
  const hubBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.5, 48), M(isLight ? 0xcbd5e1 : 0x1e293b));
  hubBase.position.y = 0.25; hubBase.receiveShadow = true; hub.add(hubBase);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + i * 0.7, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 - i * 0.15 }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.55; hub.add(r); rings.push(r);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 1.2, flatShading: true }));
  core.position.y = 2.2; hub.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  beam.position.y = 1.4; hub.add(beam);
  const coreLight = new THREE.PointLight(0x38bdf8, 8, 14); coreLight.position.y = 2.2; hub.add(coreLight);

  // rooms
  let robot = null;
  const R = 11.5, SIZE = 6.2;
  const roomObjs = {};
  ROOMS.forEach((rm, i) => {
    const ang = (i / ROOMS.length) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(ang) * R, cz = Math.sin(ang) * R;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = -ang + Math.PI / 2; scene.add(g);
    const col = new THREE.Color(rm.color);
    const floorCol = col.clone().lerp(new THREE.Color(isLight ? 0xffffff : 0x0f172a), isLight ? 0.55 : 0.35);
    box(SIZE, 0.4, SIZE, M(floorCol), 0, 0, 0, g);
    box(SIZE, 0.06, SIZE, M(col.clone().lerp(new THREE.Color(0xffffff), 0.25), { roughness: 0.4 }), 0, 0.4, 0, g);
    const wallMat = M(col.clone().lerp(new THREE.Color(0xffffff), isLight ? 0.4 : 0.1), { transparent: true, opacity: 0.85 });
    box(SIZE, 1.6, 0.18, wallMat, 0, 0.4, -SIZE / 2 + 0.09, g);
    box(0.18, 1.6, SIZE, wallMat, -SIZE / 2 + 0.09, 0.4, 0, g);
    buildProps(rm.prop, g, col);
    // path to hub
    const path = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, R - SIZE / 2 - 3.6), new THREE.MeshBasicMaterial({ color: rm.color, transparent: true, opacity: 0.35 }));
    path.position.set(Math.cos(ang) * (R / 2 + 0.2), 0.03, Math.sin(ang) * (R / 2 + 0.2)); path.rotation.y = -ang + Math.PI / 2; scene.add(path);
    // label anchor
    const anchor = new THREE.Object3D(); anchor.position.set(0, 3.4, -0.6); g.add(anchor);
    const slotsWorld = [];
    for (let k = 0; k < 9; k++) { const o = new THREE.Object3D(); o.position.set(((k % 3) - 1) * 1.55, 0.46, (Math.floor(k / 3) - 0.6) * 1.45 + 0.4); g.add(o); slotsWorld.push(o); }
    roomObjs[rm.key] = { rm, group: g, anchor, slots: slotsWorld, center: new THREE.Vector3(cx, 0.46, cz), occupants: [] };
  });

  function buildProps(kind, g, col) {
    const desk = (x, z, rot = 0) => {
      const d = new THREE.Group(); d.position.set(x, 0.46, z); d.rotation.y = rot; g.add(d);
      box(1.1, 0.06, 0.6, M(0xe5e7eb), 0, 0.55, 0, d);
      [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].forEach(([a, b]) => box(0.05, 0.55, 0.05, M(0x94a3b8), a, 0, b, d));
      box(0.5, 0.34, 0.04, M(0x111827), 0, 0.61, -0.18, d);
      const scr = box(0.44, 0.28, 0.01, new THREE.MeshBasicMaterial({ color: col }), 0, 0.64, -0.155, d);
      scr.userData.screen = true; return d;
    };
    if (kind === 'desks') { [-1.6, 0, 1.6].forEach(x => [-1.2, 0.9].forEach(z => desk(x, z))); }
    if (kind === 'sofa') {
      box(2.6, 0.45, 0.9, M(col.clone().multiplyScalar(0.8)), -0.4, 0.46, -1.9); box(2.6, 0.5, 0.25, M(col.clone().multiplyScalar(0.7)), -0.4, 0.9, -2.25);
      box(1.2, 0.3, 0.7, M(0x78350f), -0.4, 0.46, -0.6); plant(2.2, -2.2); plant(-2.4, 1.8);
    }
    if (kind === 'books') {
      for (let i = 0; i < 3; i++) { const s = box(1.6, 1.4, 0.4, M(0x92400e), -1.9 + i * 1.8, 0.46, -2.6); for (let j = 0; j < 3; j++) box(1.4, 0.06, 0.36, M(0xfef3c7), 0, 0.3 + j * 0.42, 0, s); }
      desk(-1, 0.6); desk(1.2, 0.6); plant(2.4, 2.2);
    }
    if (kind === 'arena') {
      desk(-1.4, 0.2, Math.PI / 2); desk(1.4, 0.2, -Math.PI / 2);
      const vs = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      vs.position.set(0, 1.9, 0.2); vs.userData.spin = true; g.add(vs);
      box(4.6, 0.04, 0.12, new THREE.MeshBasicMaterial({ color: 0xfacc15 }), 0, 0.47, 0.2);
    }
    if (kind === 'charts') {
      box(3.6, 1.8, 0.08, M(0x0f172a), 0, 0.8, -2.7);
      for (let i = 0; i < 5; i++) { const b = box(0.4, 0.3 + i * 0.25, 0.1, new THREE.MeshBasicMaterial({ color: col }), -1.2 + i * 0.6, 0.95, -2.62); b.userData.bar = i; }
      desk(-1, 0.6); desk(1.2, 0.6);
    }
    if (kind === 'podium') {
      [[0, 0.9, 0xfacc15], [-1.1, 0.6, 0xcbd5e1], [1.1, 0.4, 0xf97316]].forEach(([x, h, c]) => box(1, h, 1, M(c, { metalness: 0.4, roughness: 0.3 }), x, 0.46, -1.4));
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.12, 0.45, 16), M(0xfacc15, { metalness: 0.8, roughness: 0.2 })); cup.position.set(0, 1.65, -1.4); cup.userData.spin = true; g.add(cup);
    }
    if (kind === 'gate') {
      box(0.2, 1.4, 0.2, M(0x64748b), -0.8, 0.46, -1); box(0.2, 1.4, 0.2, M(0x64748b), 0.8, 0.46, -1);
      box(1.8, 0.2, 0.2, new THREE.MeshBasicMaterial({ color: col }), 0, 1.86, -1); desk(-1.6, 1.2); plant(2.3, -2.3);
    }
    if (kind === 'ai') {
      for (let i = 0; i < 3; i++) { const rk = box(0.8, 1.8, 0.7, M(0x1e293b), -2 + i * 1.0, 0.46, -2.4); for (let j = 0; j < 5; j++) { const led = box(0.6, 0.05, 0.02, new THREE.MeshBasicMaterial({ color: j % 2 ? 0x22d3ee : 0x4ade80 }), 0, 0.25 + j * 0.3, 0.36, rk); led.userData.led = Math.random() * 6; } }
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), new THREE.MeshStandardMaterial({ color: 0xa5b4fc, emissive: 0x6366f1, emissiveIntensity: 1 }));
      orb.position.set(1.6, 1.6, -1.6); orb.userData.orb = true; g.add(orb);
      robot = makeRobot(); robot.position.set(0.6, 0.46, 0.6); g.add(robot);
    }
  }
  function plant() { /* tanaman ditambahkan setelah ruangan jadi */ }

  function makeRobot() {
    const r = new THREE.Group();
    box(0.55, 0.6, 0.4, M(0xe0e7ff, { metalness: 0.5, roughness: 0.3 }), 0, 0.25, 0, r);
    const head = box(0.5, 0.38, 0.4, M(0xc7d2fe, { metalness: 0.5, roughness: 0.3 }), 0, 0.88, 0, r);
    box(0.32, 0.1, 0.02, new THREE.MeshBasicMaterial({ color: 0x22d3ee }), 0, 0.14, 0.21, head);
    const ant = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf472b6 })); ant.position.y = 0.5; head.add(ant);
    box(0.08, 0.4, 0.08, M(0xc7d2fe), -0.36, 0.3, 0, r); box(0.08, 0.4, 0.08, M(0xc7d2fe), 0.36, 0.3, 0, r);
    box(0.12, 0.25, 0.12, M(0x94a3b8), -0.14, 0, 0, r); box(0.12, 0.25, 0.12, M(0x94a3b8), 0.14, 0, 0, r);
    r.userData.head = head; return r;
  }

  // build ulang props dengan tanaman (fungsi plant butuh scene siap)
  // (tanaman dibuat sederhana agar ringan)
  function realPlant(g, x, z) {
    const p = new THREE.Group(); p.position.set(x, 0.46, z); g.add(p);
    box(0.3, 0.3, 0.3, M(0xd6d3d1), 0, 0, 0, p);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), M(0x16a34a, { flatShading: true })); leaf.position.y = 0.55; leaf.castShadow = true; p.add(leaf);
  }
  Object.values(roomObjs).forEach(o => { realPlant(o.group, SIZE / 2 - 0.5, SIZE / 2 - 0.5); });

  /* ───── Karakter ───── */
  const chars = new Map(); // key → {group, target, room, name, ...}
  function makeChar(name) {
    const g = new THREE.Group();
    const c = new THREE.Color().setHSL(hue(name) / 360, 0.65, 0.55);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 12), M(c)); body.position.y = 0.48; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M(0xfcd9b6)); head.position.y = 1.05; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(new THREE.Color().setHSL((hue(name + 'h') % 40) / 360, 0.5, 0.2))); hair.position.y = 1.08; g.add(hair);
    g.scale.setScalar(1.35);
    g.userData = { body, head, phase: Math.random() * 6 };
    scene.add(g); return g;
  }

  function placeChars(users) {
    const seen = new Set();
    Object.values(roomObjs).forEach(o => (o.occupants = []));
    users.forEach(u => {
      const room = u.justLoggedIn && u.page === 'beranda' ? roomObjs.akun : roomObjs[roomOfPage(u.page).key];
      room.occupants.push(u);
      seen.add(u.key);
      let ch = chars.get(u.key);
      if (!ch) {
        const g = makeChar(u.name);
        g.position.copy(roomObjs.akun.center).add(new THREE.Vector3(0, 0, 0)); // masuk lewat Pos Akun
        ch = { group: g, u, room: null, waypoints: [] };
        chars.set(u.key, ch);
        pushFeed({ ico: '🔓', text: `<b>${esc(u.name)}</b> ${u.demo ? 'masuk (demo)' : 'sedang online'}`, at: Date.now() });
      }
      ch.u = u;
      if (ch.room !== room.rm.key) {
        const slot = room.slots[room.occupants.length - 1 % room.slots.length] || room.slots[0];
        const target = new THREE.Vector3(); slot.getWorldPosition(target);
        ch.waypoints = ch.room ? [new THREE.Vector3(0, 0.5, 0).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), target] : [target];
        if (ch.room) pushFeed({ ico: room.rm.ico, text: `<b>${esc(u.name)}</b> pindah ke ${room.rm.name}`, at: Date.now() });
        ch.room = room.rm.key; ch.slotTarget = target;
      }
    });
    // relokasi slot agar tidak menumpuk
    Object.values(roomObjs).forEach(o => o.occupants.forEach((u, i) => {
      const ch = chars.get(u.key); if (!ch) return;
      const t = new THREE.Vector3(); o.slots[i % o.slots.length].getWorldPosition(t);
      if (i >= o.slots.length) t.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6));
      if (!ch.waypoints.length) ch.waypoints = [t]; else ch.waypoints[ch.waypoints.length - 1] = t;
      ch.slotTarget = t;
    }));
    // hapus yang offline
    for (const [k, ch] of chars) if (!seen.has(k)) {
      scene.remove(ch.group); chars.delete(k);
      pushFeed({ ico: '👋', text: `<b>${esc(ch.u.name)}</b> offline`, at: Date.now() });
    }
  }

  /* ───── Overlay label (HTML) ───── */
  const labelEls = {};
  ROOMS.forEach(rm => {
    const el = document.createElement('button'); el.className = 'cc-label'; el.style.setProperty('--c', '#' + rm.color.toString(16).padStart(6, '0'));
    el.onclick = () => showRoom(rm.key); overlay.appendChild(el); labelEls[rm.key] = el;
  });
  const coreEl = document.createElement('div'); coreEl.className = 'cc-core'; overlay.appendChild(coreEl);
  const tagEls = new Map();
  const v = new THREE.Vector3();
  const toScreen = (obj, offY = 0) => {
    obj.getWorldPosition(v); v.y += offY; v.project(cam);
    return { x: (v.x * 0.5 + 0.5) * stage.clientWidth, y: (-v.y * 0.5 + 0.5) * stage.clientHeight, vis: v.z < 1 };
  };
  function drawOverlay() {
    ROOMS.forEach(rm => {
      const o = roomObjs[rm.key]; const p = toScreen(o.anchor); const el = labelEls[rm.key];
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    });
    const cp = toScreen(core, 1.4); coreEl.style.transform = `translate(${cp.x}px, ${cp.y}px) translate(-50%, -100%)`;
    for (const [k, ch] of chars) {
      let el = tagEls.get(k);
      if (!el) { el = document.createElement('div'); el.className = 'cc-tag'; overlay.appendChild(el); tagEls.set(k, el); }
      const p = toScreen(ch.group, 2.05); el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
    for (const [k, el] of tagEls) if (!chars.has(k)) { el.remove(); tagEls.delete(k); }
  }
  function refreshLabels() {
    ROOMS.forEach(rm => {
      const o = roomObjs[rm.key]; const n = o.occupants.length;
      let sub = `${n} orang`;
      if (rm.key === 'ai') sub = state.system.generating ? '⚙️ sedang membuat soal…' : `idle · ${fmt(state.system.bank)} soal`;
      if (rm.key === 'duel') sub = `${n} orang · ${state.duels.filter(d => d.playing).length} duel aktif`;
      labelEls[rm.key].innerHTML = `<span class="ico">${rm.ico}</span><span><b>${rm.name}</b><small>${sub}</small></span>${n ? `<span class="cnt">${n}</span>` : ''}`;
    });
    coreEl.innerHTML = `<b>SIAPLOLOS CORE</b><small>${state.users.length} online · ${fmt(state.system.bank)} soal · ${state.today.sessions} sesi hari ini</small>`;
    for (const [k, ch] of chars) {
      const el = tagEls.get(k); if (!el) continue;
      const u = ch.u; const rm = ROOMS.find(r => r.key === ch.room);
      const duel = u.duel || state.duels.find(d => d.players.some(p => p.key === k));
      const act = ch.room === 'akun' && u.justLoggedIn ? 'baru login 🔓' : ch.room === 'duel' && duel?.playing ? `duel ${duel.phase} ⚔️` : rm?.verb || '';
      el.innerHTML = `<b>${esc(u.name)}</b><small>${act}</small>`;
      el.classList.toggle('compact', (roomObjs[ch.room]?.occupants.length || 0) > 3);
    }
  }
  let selected = 'ai';
  function showRoom(key) {
    selected = key;
    const o = roomObjs[key]; const rm = o.rm;
    let extra = '';
    if (key === 'ai') {
      const s = state.system;
      extra = `<div class="stack" style="gap:6px;margin-top:8px">
        <div class="tip ${s.generating ? 'good' : ''}"><span>${s.generating ? '⚙️' : '😴'}</span><span>${s.generating ? 'Gemini sedang membuat soal & materi dari berita terbaru…' : 'Menunggu jadwal berikutnya (06.00 WIB) atau tombol Generate di Profil.'}</span></div>
        <div class="dim">AI: ${s.ai ? '✅ aktif' : '⚠️ belum diatur'} · Database: ${s.firebase ? '✅ Firebase' : '⚠️ memori'}</div>
        <div class="dim">Bank soal: ${fmt(s.bank)} (${fmt(s.generated)} dari berita) · Materi hari ini: ${state.today.materials}</div>
        ${s.lastGenerate ? `<div class="dim">Terakhir generate: ${timeAgo(s.lastGenerate.at)} — ${s.lastGenerate.total} soal, ${s.lastGenerate.materials} materi</div>` : ''}</div>`;
    }
    if (key === 'duel') {
      extra = state.duels.length ? `<div class="stack" style="gap:6px;margin-top:8px">${state.duels.map(d => `<div class="tip"><span>⚔️</span><span><b>${esc(d.title)}</b> #${d.code} · ${esc(d.phase)}<br><span class="dim">${d.players.map(p => `${esc(p.name)} (${fmt(p.score)})`).join(' vs ')}${d.bot ? ' vs 🤖 Bot' : ''}</span></span></div>`).join('')}</div>` : '<p class="dim">Belum ada room duel aktif.</p>';
    }
    $('#ccRoomInfo').innerHTML = `<div class="row" style="gap:10px"><span style="font-size:26px">${rm.ico}</span><div><b>${rm.name}</b><div class="dim">${o.occupants.length} orang di sini</div></div></div>
      ${o.occupants.length ? `<div class="duel-players">${o.occupants.map(u => `<div class="dp"><span class="av" style="--h:${hue(u.name)};margin:0">${esc(u.name[0])}</span><span class="dp-name">${esc(u.name)}${u.demo ? ' <span class="dim">(demo)</span>' : ''}</span><span class="dim" style="font-size:12px">${esc(u.target || '')}</span></div>`).join('')}</div>` : ''}${extra}`;
    Object.values(labelEls).forEach(el => el.classList.remove('on')); labelEls[key].classList.add('on');
  }

  /* ───── Data ───── */
  const state = { users: [], duels: [], recent: [], today: { sessions: 0, questions: 0, learners: 0, materials: 0 }, system: { bank: 0, generated: 0 } };
  const feed = []; const seenAttempts = new Set();
  function pushFeed(item) { feed.unshift(item); feed.length = Math.min(feed.length, 40); renderFeed(); }
  function renderFeed() {
    const el = $('#ccFeed'); if (!el) return;
    el.innerHTML = feed.length ? feed.slice(0, 25).map(f => `<div class="cc-ev"><span>${f.ico}</span><span>${f.text}<br><small class="dim">${timeAgo(f.at)}</small></span></div>`).join('') : '<div class="dim">Belum ada aktivitas.</div>';
  }
  let demo = [];
  function makeDemo() {
    demo = DEMO_NAMES.slice(0, 9).map((n, i) => ({ key: 'demo' + i, name: n, target: ['CPNS', 'BUMN', 'OJK (PCS)', 'Bank Indonesia (PCPM)'][i % 4], page: DEMO_PAGES[i % DEMO_PAGES.length], demo: true, since: Date.now() - i * 60000 }));
  }
  function shuffleDemo() { demo.forEach(u => { if (Math.random() < 0.35) u.page = DEMO_PAGES[Math.floor(Math.random() * DEMO_PAGES.length)]; }); }

  async function load() {
    if (!document.body.contains(stage)) return false;
    try {
      const d = await api('/admin-live');
      Object.assign(state, d);
      d.recent.slice().reverse().forEach(a => {
        const id = a.name + a.createdAt; if (seenAttempts.has(id)) return; seenAttempts.add(id);
        if (seenAttempts.size > 1 || Date.now() - a.createdAt < 3600e3) feed.push({ ico: modeByKey[a.mode]?.ico || '📝', text: `<b>${esc(a.name)}</b> selesai ${modeByKey[a.mode]?.name || a.mode} ${esc(catByKey[a.category]?.name || '')} — skor ${a.score}`, at: a.createdAt });
      });
      feed.sort((a, b) => b.at - a.at); renderFeed();
    } catch (e) { toast(e.message, 'err'); }
    if ($('#demoChk')?.checked) { if (!demo.length) makeDemo(); else shuffleDemo(); } else demo = [];
    const users = [...state.users, ...demo];
    placeChars(users); refreshLabels(); renderStats(); showRoom(selected);
    $('#ccUpd').textContent = 'live';
    return true;
  }
  function renderStats() {
    const s = state.system, t = state.today;
    $('#ccStats').innerHTML = [
      ['🟢', 'Online', state.users.length + (demo.length ? ` +${demo.length} demo` : '')],
      ['📝', 'Sesi hari ini', t.sessions], ['🧑‍🎓', 'Pelajar hari ini', t.learners], ['❓', 'Soal dikerjakan', fmt(t.questions)],
      ['⚔️', 'Duel aktif', state.duels.filter(d => d.playing).length], ['📚', 'Bank soal', fmt(s.bank)], ['📖', 'Materi hari ini', t.materials],
      ['✨', 'Studio AI', s.generating ? 'bekerja…' : s.ai ? 'siaga' : 'off'],
    ].map(([i, l, v]) => `<div class="glass cc-stat"><span>${i}</span><div><b>${v}</b><small>${l}</small></div></div>`).join('');
  }
  $('#demoChk').onchange = () => load();

  /* ───── Loop ───── */
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight, a = w / h, f = 14;
    cam.left = -f * a; cam.right = f * a; cam.top = f; cam.bottom = -f; cam.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  new ResizeObserver(resize).observe(stage); resize();
  const clock = new THREE.Clock();
  let running = true;
  function frame() {
    if (!document.body.contains(stage)) { running = false; renderer.dispose(); return; }
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    core.rotation.y = t * 0.6; core.position.y = 2.2 + Math.sin(t * 1.5) * 0.15;
    rings.forEach((r, i) => { r.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04); });
    scene.traverse(o => {
      if (o.userData.spin) o.rotation.y = t * 1.5;
      if (o.userData.orb) { const k = state.system.generating ? 3 : 1; o.material.emissiveIntensity = 0.8 + Math.sin(t * 3 * k) * 0.5; o.scale.setScalar(1 + (state.system.generating ? Math.sin(t * 6) * 0.12 : 0)); }
      if (o.userData.led !== undefined) o.visible = Math.sin(t * (state.system.generating ? 9 : 2) + o.userData.led) > -0.3;
      if (o.userData.bar !== undefined) o.scale.y = 1 + Math.sin(t * 1.5 + o.userData.bar) * 0.25;
    });
    if (robot) {
      const busy = state.system.generating;
      robot.rotation.y = busy ? Math.sin(t * 4) * 0.6 : Math.sin(t * 0.6) * 0.3;
      robot.position.y = 0.46 + (busy ? Math.abs(Math.sin(t * 8)) * 0.12 : Math.sin(t * 2) * 0.03);
      robot.userData.head.rotation.z = busy ? Math.sin(t * 10) * 0.15 : 0;
    }
    for (const ch of chars.values()) {
      const g = ch.group, ud = g.userData;
      const wp = ch.waypoints[0];
      if (wp) {
        const dir = wp.clone().sub(g.position); dir.y = 0;
        const dist = dir.length();
        if (dist < 0.06) ch.waypoints.shift();
        else {
          const step = Math.min(dist, 3.4 * dt);
          g.position.add(dir.normalize().multiplyScalar(step));
          g.rotation.y = Math.atan2(dir.x, dir.z);
          ud.body.position.y = 0.48 + Math.abs(Math.sin(t * 12 + ud.phase)) * 0.08;
        }
      } else {
        // aktivitas di tempat
        const roomKey = ch.room;
        if (roomKey === 'latihan' || roomKey === 'materi' || roomKey === 'evaluasi') { ud.head.rotation.x = Math.sin(t * 6 + ud.phase) * 0.12; g.rotation.y = Math.PI + Math.sin(t * 0.5 + ud.phase) * 0.2; }
        else if (roomKey === 'duel') { g.rotation.y = Math.sin(t * 3 + ud.phase) * 0.5; ud.body.position.y = 0.48 + Math.abs(Math.sin(t * 5 + ud.phase)) * 0.06; }
        else if (roomKey === 'peringkat') { ud.body.position.y = 0.48 + Math.abs(Math.sin(t * 4 + ud.phase)) * 0.15; }
        else { ud.body.position.y = 0.48 + Math.sin(t * 2 + ud.phase) * 0.02; g.rotation.y += 0.002; }
      }
      ud.head.position.y = ud.body.position.y + 0.57;
    }
    controls.update();
    renderer.render(scene, cam);
    drawOverlay();
    if (running) requestAnimationFrame(frame);
  }
  $('#ccLoading').remove();
  frame();
  const loop = async () => { if (await load()) setTimeout(loop, 5000); };
  loop();
}
