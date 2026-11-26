// Latar 3D sinematik untuk tema Shinobi Senja & Pahlawan Kosmik (Three.js, semua dibuat dengan kode — tanpa aset luar)
//  - Kiro (kucing ninja) melempar shuriken saat jawaban benar
//  - Nova (robot penjaga) menyalakan perisai energi saat jawaban benar
// fx: 'full' (60fps, bayangan) · 'lite' (±30fps, tanpa bayangan, objek lebih sedikit) · 'off' (render sekali, diam)
const SMALL = () => innerWidth < 760;

export async function mount3D(host, key, fx = 'full') {
  let THREE;
  try { THREE = await import('three'); } catch { return null; }
  const lite = fx !== 'full', small = SMALL();
  const canvas = document.createElement('canvas');
  canvas.className = 'sc-3d';
  host.prepend(canvas);
  let R;
  try { R = new THREE.WebGLRenderer({ canvas, antialias: !lite && !small, powerPreference: lite ? 'low-power' : 'high-performance' }); }
  catch { canvas.remove(); return null; }
  const PR = fx === 'full' ? Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6) : small ? 0.8 : 1;
  R.setPixelRatio(PR);
  R.shadowMap.enabled = !lite; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
  const cam = new THREE.PerspectiveCamera(small ? 55 : 45, innerWidth / innerHeight, 0.1, 400);
  const resize = () => { R.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = SMALL() ? 55 : 45; cam.updateProjectionMatrix(); };
  resize();

  const glowTex = c1 => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, c1); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const skyMat = (top, bot) => new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bot) } },
    vertexShader: 'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 t,b;varying vec3 p;void main(){gl_FragColor=vec4(mix(b,t,smoothstep(-.1,.6,p.y)),1.);}' });
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.05 }, o));
  const glowSprite = (col, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(col), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(s, s, 1); return sp; };

  const W = key === 'kosmik' ? buildKosmik() : buildShinobi();
  let burst = 0, raf = 0, alive = true, last = 0, ang = W.ang0, mx = 0, tx = 0;
  const clock = new THREE.Clock();
  const onBurst = () => { burst = 1; W.cele(); if (fx === 'off') draw(); };
  const onMove = e => { tx = e.clientX / innerWidth - 0.5; };
  const onVis = () => { if (!document.hidden && alive && fx !== 'off') loop(); };
  addEventListener('resize', resize); addEventListener('bg:burst', onBurst);
  if (!small && fx === 'full') addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('visibilitychange', onVis);

  function placeCam(t) {
    // di layar lebar maskot digeser ke kanan agar tidak tertutup konten utama
    const side = SMALL() ? 0 : -3.2;
    cam.position.set(Math.sin(ang) * W.camR + side * Math.cos(ang), W.camY + Math.sin(t * 0.3) * 0.15, Math.cos(ang) * W.camR - side * Math.sin(ang));
    const look = W.look.clone().add(new THREE.Vector3(side * Math.cos(ang), 0, -side * Math.sin(ang)));
    cam.lookAt(look);
  }
  let lastDraw = 0;
  function draw() {
    const t = clock.getElapsedTime(), dt = lastDraw ? Math.min(0.05, t - lastDraw) : 0.016; lastDraw = t;
    W.update(t, dt, burst); burst = Math.max(0, burst - dt * 0.9);
    mx += (tx - mx) * 0.04; placeCam(t);
    R.render(W.scene, cam);
  }
  function loop(now = performance.now()) {
    if (!alive || document.hidden) return;
    raf = requestAnimationFrame(loop);
    if (fx === 'lite' && now - last < 33) return;
    const d = (now - last) / 1000; last = now;
    if (d < 1) ang += d * 0.035 + (mx * 0.002);
    draw();
  }
  if (fx === 'off') { draw(); setTimeout(draw, 60); } else loop();
  requestAnimationFrame(() => host.classList.add('ready'));

  /* ───────── Shinobi Senja ───────── */
  function buildShinobi() {
    const s = new THREE.Scene(); s.fog = new THREE.Fog(0x4a2848, 14, 55);
    s.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMat(0x241a4a, 0xf08a5d)));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffe2a8, fog: false })); moon.position.set(10, 13, -40); s.add(moon);
    const mg = glowSprite('rgba(255,210,150,.9)', 24); mg.material.fog = false; mg.position.copy(moon.position); s.add(mg);
    s.add(new THREE.HemisphereLight(0xffb48a, 0x2a1530, 1.4));
    const key = new THREE.DirectionalLight(0xffc89a, 2.4); key.position.set(8, 12, -6);
    if (!lite) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); }
    s.add(key);
    const fill = new THREE.DirectionalLight(0x9a8cff, 0.8); fill.position.set(-6, 4, 8); s.add(fill);
    const rim = new THREE.PointLight(0xff5577, 6, 20, 1); rim.position.set(-3, 3, -2); s.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), std(0x2b1a2e, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), std(0x5a5468, { roughness: 0.95, flatShading: true })); rock.scale.set(1.4, 0.6, 1.2); rock.position.y = 0.4; rock.castShadow = rock.receiveShadow = true; s.add(rock);
    const bm = std(0x3a8a48, { roughness: 0.45 }), nm = std(0x24602f), lfm = std(0x4fae58, { side: THREE.DoubleSide });
    const stalkG = new THREE.CylinderGeometry(0.13, 0.16, 1, 10), nodeG = new THREE.TorusGeometry(0.15, 0.035, 6, 14), leafG = new THREE.PlaneGeometry(1.2, 0.22);
    const bam = [];
    for (let i = 0; i < (lite ? 30 : 55); i++) {
      const a = Math.random() * Math.PI * 2, r = 4.5 + Math.random() * 16, h = 7 + Math.random() * 7; const g = new THREE.Group();
      const st = new THREE.Mesh(stalkG, bm); st.scale.y = h; st.position.y = h / 2; st.castShadow = !lite; g.add(st);
      for (let y = 1; y < h; y += 1.3) { const n = new THREE.Mesh(nodeG, nm); n.rotation.x = Math.PI / 2; n.position.y = y; g.add(n); }
      for (let k = 0; k < 4; k++) { const lf = new THREE.Mesh(leafG, lfm); lf.position.set(0.5, h - 0.5 - k * 0.8, 0); lf.rotation.set(0, k * 2, -0.5); g.add(lf); }
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.userData.ph = Math.random() * 6; s.add(g); bam.push(g);
    }
    // Kiro si kucing ninja
    const cat = new THREE.Group(); const fur = std(0x34314a, { roughness: 0.75 }), red = std(0xe84a5f, { roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), fur); body.scale.set(1, 1.15, 0.9); body.position.y = 1.45; cat.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), std(0x5a5570)); belly.scale.set(1, 1.2, 0.5); belly.position.set(0, 1.4, 0.33); cat.add(belly);
    const head = new THREE.Group(); head.position.y = 2.35; cat.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), fur));
    const muz = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), std(0x6a6580)); muz.scale.set(1.3, 0.8, 0.8); muz.position.set(0, -0.13, 0.42); head.add(muz);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), std(0xff8fa3)); nose.position.set(0, -0.07, 0.56); head.add(nose);
    const eyes = [];
    [-1, 1].forEach(sd => {
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 16), fur); e.position.set(sd * 0.28, 0.45, 0); e.rotation.z = -sd * 0.25; head.add(e);
      const ei = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 12), std(0xff8fa3)); ei.position.set(sd * 0.28, 0.43, 0.05); ei.rotation.z = -sd * 0.25; head.add(ei);
      const ey = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffd166 })); ey.position.set(sd * 0.18, 0.07, 0.43); head.add(ey); eyes.push(ey);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), new THREE.MeshBasicMaterial({ color: 0x111111 })); pu.position.set(sd * 0.18, 0.07, 0.51); pu.scale.set(0.6, 1.2, 0.6); head.add(pu);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 10), fur); leg.position.set(sd * 0.22, 0.95, 0); cat.add(leg);
    });
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 10), fur); armL.position.set(-0.55, 1.45, 0.1); armL.rotation.z = -0.6; cat.add(armL);
    const armR = new THREE.Group(); armR.position.set(0.5, 1.75, 0.05); cat.add(armR);
    const armRm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 10), fur); armRm.position.set(0.1, -0.28, 0); armRm.rotation.z = 0.5; armR.add(armRm);
    const mask = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 40), red); mask.position.y = 0.17; mask.rotation.x = Math.PI / 2; head.add(mask);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.04), std(0xc9cbd6, { metalness: 0.9, roughness: 0.25 })); plate.position.set(0, 0.17, 0.52); head.add(plate);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.02), red); t1.position.set(-0.12, -0.05, -0.55); t1.rotation.set(0.5, 0, 0.35); head.add(t1);
    const t2 = t1.clone(); t2.position.x = 0.08; t2.rotation.z = -0.15; head.add(t2);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 10, 32), red); scarf.position.y = 1.95; scarf.rotation.x = Math.PI / 2; cat.add(scarf);
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 10, 32, Math.PI * 1.1), fur); tail.position.set(0, 1.2, -0.55); tail.rotation.set(0, Math.PI / 2, 0.4); cat.add(tail);
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.85, 16), std(0xf2d9a6)); scroll.position.set(0.45, 1.5, -0.45); scroll.rotation.z = 0.9; cat.add(scroll);
    cat.traverse(o => { if (o.isMesh) o.castShadow = !lite; }); cat.position.y = 0.5; s.add(cat);
    // shuriken + percikan
    const shu = new THREE.Group(); const sm = std(0xdfe1ea, { metalness: 0.95, roughness: 0.2 });
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), sm); b.rotation.z = k * Math.PI / 2; b.position.set(Math.sin(k * Math.PI / 2) * 0.25, Math.cos(k * Math.PI / 2) * 0.25, 0); shu.add(b); }
    shu.add(glowSprite('rgba(255,240,220,.7)', 1.4)); shu.visible = false; s.add(shu);
    const sparks = Array.from({ length: 16 }, () => { const p = glowSprite('rgba(255,120,140,.9)', 0.3); p.visible = false; s.add(p); return p; });
    // daun & kelopak jatuh
    const N = lite ? 70 : 200, lm = std(0x8fcf6a, { side: THREE.DoubleSide }), lg = new THREE.PlaneGeometry(0.2, 0.07);
    const leaves = new THREE.InstancedMesh(lg, lm, N); const L = [], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < N; i++) L.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 14, z: (Math.random() - 0.5) * 30, v: 0.4 + Math.random() * 0.6, ph: Math.random() * 6, r: Math.random() * 6 });
    s.add(leaves);
    let throwK = -1;
    return {
      scene: s, camR: small ? 11.5 : 10.5, camY: 3.4, look: new THREE.Vector3(0, 1.8, 0), ang0: 0.5,
      update(t, dt, b) {
        bam.forEach(g => (g.rotation.z = Math.sin(t * 0.8 + g.userData.ph) * 0.03 * (1 + b * 3)));
        for (let i = 0; i < N; i++) { const l = L[i]; l.y -= l.v * dt; l.x += Math.sin(t + l.ph) * 0.01; l.r += dt * 2; if (l.y < 0) l.y = 14; E.set(l.r, l.r * 0.7, 0); Q.setFromEuler(E); V.set(l.x, l.y, l.z); M4.compose(V, Q, S1); leaves.setMatrixAt(i, M4); }
        leaves.instanceMatrix.needsUpdate = true;
        cat.position.y = 0.5 + Math.sin(t * 2) * 0.04; head.rotation.y = Math.sin(t * 0.7) * 0.25; tail.rotation.z = 0.4 + Math.sin(t * 1.8) * 0.15;
        t1.rotation.x = 0.5 + Math.sin(t * 5) * 0.25; t2.rotation.x = 0.5 + Math.cos(t * 5) * 0.25;
        const blink = (t % 4) < 0.12 ? 0.1 : 1; eyes.forEach(e => (e.scale.y = blink));
        if (throwK >= 0) {
          throwK += dt; const k = throwK;
          armR.rotation.z = k < 0.25 ? -k * 8 : Math.max(0, -2 + (k - 0.25) * 6);
          shu.visible = k > 0.2; shu.position.set(0.9 + (k - 0.2) * 6, 2.3 + Math.sin(k * 3) * 0.3, (k - 0.2) * -3.5); shu.rotation.z += dt * 25;
          sparks.forEach((p, i) => { p.visible = k > 0.2 && k < 1.2; const a = i / sparks.length * 6.28; p.position.set(0.9 + Math.cos(a) * k * 1.2, 2.3 + Math.sin(a) * k * 1.2, 0.2); p.material.opacity = Math.max(0, 1 - k); });
          if (k > 1.8) { throwK = -1; shu.visible = false; sparks.forEach(p => (p.visible = false)); armR.rotation.z = 0; }
        }
      },
      cele() { throwK = 0; },
    };
  }

  /* ───────── Pahlawan Kosmik ───────── */
  function buildKosmik() {
    const s = new THREE.Scene(); s.fog = new THREE.FogExp2(0x070b1f, 0.01);
    s.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMat(0x101a55, 0x020414)));
    const sp = []; for (let i = 0; i < (lite ? 900 : 2200); i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 60); sp.push(v.x, v.y, v.z); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdbe4ff, size: 0.4, fog: false })); s.add(stars);
    const pc = document.createElement('canvas'); pc.width = 512; pc.height = 256; const g = pc.getContext('2d');
    for (let y = 0; y < 256; y += 3) { const h = 230 + Math.sin(y * 0.09) * 30 + Math.random() * 10; g.fillStyle = `hsl(${h},60%,${32 + Math.sin(y * 0.05) * 14}%)`; g.fillRect(0, y, 512, 3); }
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 64), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.9, fog: false })); planet.position.set(14, 6, -30); s.add(planet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(11, 16, 128), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.35, fog: false })); ring.position.copy(planet.position); ring.rotation.set(1.2, 0.2, 0.3); s.add(ring);
    const neb = glowSprite('rgba(120,80,255,.45)', 1); neb.material.fog = false; neb.scale.set(70, 40, 1); neb.position.set(-25, 12, -60); s.add(neb);
    const neb2 = glowSprite('rgba(40,180,255,.25)', 1); neb2.material.fog = false; neb2.scale.set(50, 30, 1); neb2.position.set(30, -8, -70); s.add(neb2);
    s.add(new THREE.AmbientLight(0x4b5aa0, 1.2));
    const sun = new THREE.DirectionalLight(0xdbeaff, 3); sun.position.set(-10, 10, 8); if (!lite) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); } s.add(sun);
    const cyan = new THREE.PointLight(0x38bdf8, 12, 14, 1.5); cyan.position.set(0, 2.4, 1.8); s.add(cyan);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 0.4, 64), std(0x1e293b, { metalness: 0.8, roughness: 0.3 })); plat.position.y = 0.2; plat.receiveShadow = true; s.add(plat);
    const ringP = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: 0x38bdf8 })); ringP.rotation.x = Math.PI / 2; ringP.position.y = 0.42; s.add(ringP);
    const bot = new THREE.Group(); const metal = std(0xd5dde8, { metalness: 0.85, roughness: 0.22 }), dark = std(0x334155, { metalness: 0.75, roughness: 0.3 }), gold = std(0xfbbf24, { metalness: 0.9, roughness: 0.25 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.7), metal); torso.position.y = 1.7; bot.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.3, 0.75), dark); chest.position.y = 2.15; bot.add(chest);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: 0x9be7ff })); core.position.set(0, 1.75, 0.36); bot.add(core);
    const cg = glowSprite('rgba(80,200,255,.9)', 1.1); cg.position.set(0, 1.75, 0.4); bot.add(cg);
    const head = new THREE.Group(); head.position.y = 2.65; bot.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.65), metal));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: 0x5cd0ff })); visor.position.set(0, 0.03, 0.34); head.add(visor);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), gold); ant.position.set(0.25, 0.5, 0); head.add(ant);
    const antB = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff5577 })); antB.position.set(0.25, 0.75, 0); head.add(antB);
    const arms = [];
    [-1, 1].forEach(sd => {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), gold); sh.position.set(sd * 0.72, 2.2, 0); bot.add(sh);
      const arm = new THREE.Group(); arm.position.set(sd * 0.77, 2.1, 0); bot.add(arm); arms.push(arm);
      const ar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), dark); ar.position.y = -0.48; arm.add(ar);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), metal); fist.position.y = -1.02; arm.add(fist);
      const lg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.36), dark); lg.position.set(sd * 0.28, 0.8, 0); bot.add(lg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.5), metal); boot.position.set(sd * 0.28, 0.48, 0.05); bot.add(boot);
    });
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7, 10, 10), std(0x1d4ed8, { side: THREE.DoubleSide, roughness: 0.8 })); cape.position.set(0, 1.5, -0.42); bot.add(cape);
    bot.traverse(o => { if (o.isMesh) o.castShadow = !lite; }); bot.position.y = 0.4; s.add(bot);
    const shieldM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, boost: { value: 0 } },
      vertexShader: 'varying vec3 n;varying vec3 v;varying vec3 wp;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);wp=position;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float t,boost;varying vec3 n;varying vec3 v;varying vec3 wp;void main(){float f=pow(1.-abs(dot(n,v)),2.5);float hex=.5+.5*sin(wp.y*14.+t*3.)*sin(wp.x*14.)*sin(wp.z*14.);float a=f*(.45+boost)+hex*.05*(1.+boost*4.);gl_FragColor=vec4(vec3(.3,.75,1.)*(1.+boost),a);}' });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(2.2, 48, 48), shieldM); shield.position.y = 1.7; s.add(shield);
    const bolts = new THREE.Group(); s.add(bolts);
    const bolt = (near) => { const pts = []; let p = near ? new THREE.Vector3((Math.random() - 0.5) * 4, 7, -2 - Math.random() * 3) : new THREE.Vector3((Math.random() - 0.5) * 16, 12, -8 - Math.random() * 10); for (let i = 0; i < 10; i++) { pts.push(p.clone()); p.add(new THREE.Vector3((Math.random() - 0.5) * 2, near ? -0.7 : -1.4, (Math.random() - 0.5))); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc5f6ff, transparent: true, opacity: 1 })); l.userData.life = 0.4; bolts.add(l); };
    const pa = cape.geometry.attributes.position, base = Float32Array.from(pa.array);
    return {
      scene: s, camR: small ? 12 : 11, camY: 3, look: new THREE.Vector3(0, 1.8, 0), ang0: 0.5,
      update(t, dt, b) {
        stars.rotation.y += dt * 0.01; planet.rotation.y += dt * 0.05; ringP.rotation.z += dt * 0.6;
        bot.position.y = 0.4 + Math.sin(t * 1.6) * 0.06; head.rotation.y = Math.sin(t * 0.6) * 0.3;
        arms.forEach((a, i) => (a.rotation.z = (i ? 1 : -1) * (0.05 + b * 2.4)));
        for (let i = 0; i < pa.count; i++) { const y = base[i * 3 + 1], x = base[i * 3]; pa.setZ(i, Math.sin(t * 3 + y * 3 + x * 2) * 0.08 * (0.85 - y) * (1 + b * 2)); } pa.needsUpdate = true;
        shieldM.uniforms.t.value = t; shieldM.uniforms.boost.value = b * 1.3;
        cyan.intensity = 12 + Math.sin(t * 4) * 2 + b * 25; visor.material.color.setHSL(0.55, 1, 0.6 + b * 0.3);
        if (Math.random() < dt * 0.4) bolt(false);
        bolts.children.slice().forEach(l => { l.userData.life -= dt; l.material.opacity = Math.max(0, l.userData.life / 0.4); if (l.userData.life <= 0) { bolts.remove(l); l.geometry.dispose(); l.material.dispose(); } });
      },
      cele() { for (let i = 0; i < 4; i++) bolt(true); },
    };
  }

  return {
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('resize', resize); removeEventListener('bg:burst', onBurst); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
      W.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => { x?.map?.dispose?.(); x?.dispose?.(); }); });
      R.dispose(); R.forceContextLoss?.(); canvas.remove();
    },
  };
}
