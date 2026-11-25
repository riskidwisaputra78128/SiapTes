// Latar 3D: kristal low-poly melayang + partikel, ringan untuk HP. Warna mengikuti tema.
const PALETTES = {
  dark: { colors: [0x22d3ee, 0x818cf8, 0xc084fc, 0x38bdf8, 0xfbbf24], fog: 0x070b1a, fogD: 0.045, star: 0x9fb4ff, starO: 0.8, em: 0.12, wire: 0.18 },
  light: { colors: [0x67e8f9, 0xa5b4fc, 0xd8b4fe, 0x7dd3fc, 0xfcd34d], fog: 0xeef2fb, fogD: 0.03, star: 0x6366f1, starO: 0.35, em: 0.25, wire: 0.25 },
  dongeng: { colors: [0xf9a8d4, 0xc4b5fd, 0x93c5fd, 0xfcd34d, 0xfbcfe8], fog: 0xfdf2fb, fogD: 0.028, star: 0xf59e0b, starO: 0.9, em: 0.35, wire: 0.35 },
  modern: { colors: [0xa3e635, 0x22d3ee, 0xf472b6, 0x52525b, 0x3f3f46], fog: 0x09090b, fogD: 0.05, star: 0xd4d4d8, starO: 0.5, em: 0.08, wire: 0.12 },
  pro: { colors: [0x1e3a8a, 0x3b82f6, 0x94a3b8, 0xcbd5e1, 0xb7791f], fog: 0xf5f6f8, fogD: 0.04, star: 0x1e3a8a, starO: 0.2, em: 0.05, wire: 0.2 },
};
const themeKey = () => document.documentElement.getAttribute('data-theme') || 'dark';

export async function initBackground(canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700;
  let THREE;
  try { THREE = await import('three'); } catch { return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b1a, 0.045);
  const wires = [];
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 14);

  scene.add(new THREE.AmbientLight(0x6070c0, 0.9));
  const l1 = new THREE.PointLight(0x22d3ee, 60, 40); l1.position.set(-6, 4, 6); scene.add(l1);
  const l2 = new THREE.PointLight(0xc084fc, 60, 40); l2.position.set(7, -3, 5); scene.add(l2);

  const geos = [
    new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0),
    new THREE.TorusGeometry(0.8, 0.28, 10, 24), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1.1, 0),
  ];
  let pal = PALETTES[themeKey()] || PALETTES.dark;
  const palette = pal.colors;
  scene.fog.color.set(pal.fog); scene.fog.density = pal.fogD;
  const group = new THREE.Group(); scene.add(group);
  const count = small ? 9 : 16;
  const items = [];
  for (let i = 0; i < count; i++) {
    const color = palette[i % palette.length];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4, flatShading: true, emissive: color, emissiveIntensity: 0.12 });
    const mesh = new THREE.Mesh(geos[i % geos.length], mat);
    const s = 0.35 + Math.random() * (small ? 0.8 : 1.1);
    mesh.scale.setScalar(s);
    mesh.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 14, -Math.random() * 12 + 1);
    mesh.userData = { rx: (Math.random() - 0.5) * 0.01, ry: (Math.random() - 0.5) * 0.012, fy: Math.random() * Math.PI * 2, amp: 0.2 + Math.random() * 0.5 };
    if (i % 3 === 0) {
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }));
      mesh.add(wire); wires.push(wire);
    }
    group.add(mesh); items.push(mesh);
  }

  const pCount = small ? 260 : 600;
  const pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = (Math.random() - 0.5) * 26; pos[i * 3 + 2] = -Math.random() * 20; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.06, transparent: true, opacity: 0.8 }));
  scene.add(stars);
  const applyPalette = () => {
    pal = PALETTES[themeKey()] || PALETTES.dark;
    scene.fog.color.set(pal.fog); scene.fog.density = pal.fogD;
    items.forEach((m, i) => { const c = pal.colors[i % pal.colors.length]; m.material.color.set(c); m.material.emissive.set(c); m.material.emissiveIntensity = pal.em; });
    wires.forEach(w => (w.material.opacity = pal.wire));
    stars.material.color.set(pal.star); stars.material.opacity = pal.starO;
    if (reduced) renderer.render(scene, camera);
  };
  applyPalette();
  window.addEventListener('theme:change', applyPalette);

  let mx = 0, my = 0, tx = 0, ty = 0, scrollY = 0;
  addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  addEventListener('deviceorientation', e => { if (e.gamma != null) { tx = Math.max(-1, Math.min(1, e.gamma / 30)); ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); } }, { passive: true });
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false);
  });

  let running = true, burst = 0;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(); });
  window.addEventListener('bg:burst', () => { burst = 1; });

  const clock = new THREE.Clock();
  function loop() {
    if (!running) return;
    if (window.__bgPause) { setTimeout(() => requestAnimationFrame(loop), 600); return; } // halaman 3D lain sedang aktif
    const t = clock.getElapsedTime();
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    burst *= 0.94;
    for (const m of items) {
      const u = m.userData;
      m.rotation.x += u.rx * (1 + burst * 8); m.rotation.y += u.ry * (1 + burst * 8);
      m.position.y += Math.sin(t * 0.6 + u.fy) * 0.003 * u.amp * 3;
    }
    group.rotation.y = mx * 0.18; group.rotation.x = my * 0.1;
    group.position.y = scrollY * 0.004;
    stars.rotation.y = t * 0.01 + mx * 0.05;
    camera.position.z = 14 - burst * 1.5;
    renderer.render(scene, camera);
    if (!reduced) requestAnimationFrame(loop);
  }
  loop();
  document.querySelector('.bg-fallback').style.opacity = '0.7';
}
