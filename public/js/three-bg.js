// Latar 3D: kristal low-poly melayang + partikel, ringan untuk HP
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
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 14);

  scene.add(new THREE.AmbientLight(0x6070c0, 0.9));
  const l1 = new THREE.PointLight(0x22d3ee, 60, 40); l1.position.set(-6, 4, 6); scene.add(l1);
  const l2 = new THREE.PointLight(0xc084fc, 60, 40); l2.position.set(7, -3, 5); scene.add(l2);

  const geos = [
    new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0),
    new THREE.TorusGeometry(0.8, 0.28, 10, 24), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1.1, 0),
  ];
  const palette = [0x22d3ee, 0x818cf8, 0xc084fc, 0x38bdf8, 0xfbbf24];
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
      mesh.add(wire);
    }
    group.add(mesh); items.push(mesh);
  }

  const pCount = small ? 260 : 600;
  const pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = (Math.random() - 0.5) * 26; pos[i * 3 + 2] = -Math.random() * 20; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.06, transparent: true, opacity: 0.8 }));
  scene.add(stars);

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
