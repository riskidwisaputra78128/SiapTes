// Tema latar foto bergerak:
//  - senja  : foto/video + gerakan kamera, parallax, kabut, partikel cahaya
//  - sakura : foto + WebGL 2.5D → pohon bergoyang tertiup angin, parallax kedalaman, awan bergeser, kelopak berjatuhan
// File media di /public/media/ (lihat README.txt di folder itu).
// Pemandangan lukis (digambar kode, berlapis untuk parallax): sky = gradasi langit, orb = matahari/bulan,
// m = warna gunung jauh→dekat, field = sawah, fx = efek tambahan
const PAINT = {
  senja: { sky: ['#4a3b86', '#b5649a', '#f2a07a', '#ffd69c'], orb: [0.68, 0.5, 0.075, '#fff1c9', 'rgba(255,190,120,'], m: ['#8a6aa6', '#6a4c87', '#4b3a6e'], hill: '#3d5a40', field: ['#557f48', '#7fa865'], haze: 'rgba(255,190,170,', stars: 0 },
  fajar: { sky: ['#283a6b', '#7586c0', '#f0b3c2', '#fde3d3'], orb: [0.3, 0.6, 0.06, '#fff4ec', 'rgba(255,200,200,'], m: ['#8592c0', '#66739f', '#4c5a82'], hill: '#3c5850', field: ['#4f7663', '#79a08a'], haze: 'rgba(255,225,230,', stars: 40 },
  malam: { sky: ['#050a1c', '#0e1840', '#1f2a62', '#353c78'], orb: [0.76, 0.22, 0.045, '#f4f6ff', 'rgba(190,205,255,'], m: ['#28306a', '#1d2452', '#141a3c'], hill: '#10261f', field: ['#17352a', '#25503c'], haze: 'rgba(120,140,220,', stars: 260 },
  pagi: { sky: ['#5ea9e6', '#9fd1f3', '#dff1fb', '#fff5d9'], orb: [0.2, 0.2, 0.032, '#fffdf2', 'rgba(255,245,190,'], m: ['#9db5d6', '#7f9cc4', '#6486ad'], hill: '#4a8a46', field: ['#6fae5a', '#9ccf72'], haze: 'rgba(255,255,255,', stars: 0 },
};
const SCENES = {
  senja: { paint: 'senja', fx: ['fog', 'dust'] },
  fajar: { paint: 'fajar', fx: ['fog', 'dust'] },
  malam: { paint: 'malam', fx: ['fog', 'fireflies'] },
  pagi: { paint: 'pagi', fx: ['fog', 'birds'] },
  sakura: { img: '/media/sakura.jpg', mob: '/media/sakura-m.jpg', mask: '/media/sakura-mask.png', fx: ['petals'] },
  shinobi: { three: true, fx: [] },   // 3D: hutan bambu senja + Kiro si kucing ninja
  kosmik: { three: true, fx: [] },    // 3D: luar angkasa + Nova si robot penjaga
};
export const SCENE_THEMES = Object.keys(SCENES);
import { fxLevel } from './perf.js';
const SMALL = () => innerWidth < 760;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let root = null, cur = null, alive = false, cleanups = [], three = null;
const listen = (t, e, f, o) => { t.addEventListener(e, f, o); cleanups.push(() => t.removeEventListener(e, f, o)); };

async function exists(url) {
  try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return r.ok && !/text\/html/.test(r.headers.get('content-type') || ''); } catch { return false; }
}
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = src; });

// posisi kursor/scroll yang dihaluskan, dipakai semua mode
const pointer = { x: 0, y: 0, tx: 0, ty: 0, sy: 0 };
let gust = 1;

function mount(key) {
  const S = SCENES[key]; cur = key; alive = true;
  root = document.createElement('div');
  root.id = 'scene'; root.dataset.scene = key; root.setAttribute('aria-hidden', 'true');
  if (S.three) {
    root.innerHTML = '<div class="sc-tint"></div><div class="sc-vig"></div>';
    document.body.prepend(root);
    const FX3 = fxLevel(); root.dataset.fx = FX3;
    import('./scene3d.js').then(m => m.mount3D(root, key, FX3)).then(h => {
      if (!alive || cur !== key) { h?.destroy(); return; }
      three = h; if (!h) root.classList.add('no-3d', 'ready');
    }).catch(() => root?.classList.add('no-3d', 'ready'));
    return;
  }
  root.innerHTML = `<div class="sc-par"><div class="sc-kb"></div></div><div class="sc-tint"></div>
    ${S.fx.includes('fog') ? '<div class="sc-fog f1"></div><div class="sc-fog f2"></div>' : ''}
    <canvas class="sc-fx"></canvas><div class="sc-vig"></div>`;
  document.body.prepend(root);
  const FX = fxLevel(); root.dataset.fx = FX;
  if (!SMALL() && FX === 'full') listen(window, 'pointermove', e => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  if (FX === 'full') listen(window, 'scroll', () => { pointer.sy = scrollY; }, { passive: true });
  (S.mask ? mountGL(S) : S.paint ? mountPaint(S) : mountPhoto(S)).catch(() => root?.classList.add('no-photo', 'ready'));
  if (FX !== 'off') startFx(root.querySelector('.sc-fx'), S.fx, FX === 'lite');
  const par = root.querySelector('.sc-par');
  const tick = () => {
    if (!alive) return;
    pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
    if (S.paint) paintParallax();
    else if (!S.mask) par.style.transform = `translate3d(${(-pointer.x * 26).toFixed(1)}px, ${(-pointer.y * 16 - Math.min(pointer.sy, 1500) * 0.04).toFixed(1)}px, 0)`;
    requestAnimationFrame(tick);
  };
  if (!reduced && FX === 'full') tick(); else if (S.paint) setTimeout(paintParallax, 50);
}

function unmount() {
  alive = false; cleanups.forEach(f => f()); cleanups = [];
  three?.destroy(); three = null;
  root?.remove(); root = null; cur = null;
}

/* ───── Mode foto/video (Senja) ───── */
async function mountPhoto(S) {
  const kb = root.querySelector('.sc-kb'), mobile = SMALL();
  const src = mobile && S.mob && await exists(S.mob) ? S.mob : S.img;
  const img = await loadImg(src); if (!alive) return;
  img.className = 'sc-img'; kb.appendChild(img); root.classList.add('ready');
  if (S.video && !mobile && !reduced && !navigator.connection?.saveData && await exists(S.video) && alive) {
    const v = document.createElement('video');
    Object.assign(v, { muted: true, loop: true, autoplay: true, playsInline: true, preload: 'auto', poster: src });
    v.className = 'sc-img sc-video'; v.src = S.video;
    v.addEventListener('playing', () => root?.classList.add('video'), { once: true });
    kb.appendChild(v); v.play().catch(() => {});
  }
}

/* ───── Mode lukis berlapis (Senja/Fajar/Malam/Pagi) ───── */
let layers = [];
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function ridge(ctx, W, H, base, amp, rough, seed, color, blur) {
  const r = rng(seed); const ph = [r() * 6, r() * 6, r() * 6];
  ctx.save(); if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-40, H + 40);
  for (let x = -40; x <= W + 40; x += 6) {
    const u = x / W;
    // puncak tajam: 1-|sin| membentuk lancip ke atas, ditambah lereng kecil & sedikit tekstur
    const pk = Math.pow(1 - Math.abs(Math.sin(u * 2.4 + ph[0])), 1.6);
    const y = base - amp * (0.62 * pk + 0.24 * (1 - Math.abs(Math.sin(u * 6.3 + ph[1]))) + 0.08 * Math.sin(u * 17 + ph[2])) - rough * (r() - 0.5) * 0.4;
    ctx.lineTo(x, y * H);
  }
  ctx.lineTo(W + 40, H + 40); ctx.closePath(); ctx.fill(); ctx.restore();
}
function paintScene(P, W, H) {
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const out = [];
  // 1. langit + matahari/bulan + bintang
  const sky = mk(), g = sky.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); P.sky.forEach((c, i) => gr.addColorStop(i / (P.sky.length - 1), c));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (P.stars) { const r = rng(7); for (let i = 0; i < P.stars; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; const sz = r() < 0.08 ? 1.8 : 0.9; g.fillRect(r() * W, r() * H * 0.62, sz, sz); } }
  const [ox, oy, orr, oc, glow] = P.orb, R = orr * Math.min(W, H) * 1.6;
  const og = g.createRadialGradient(ox * W, oy * H, 0, ox * W, oy * H, R * 5);
  og.addColorStop(0, glow + '.75)'); og.addColorStop(0.25, glow + '.28)'); og.addColorStop(1, glow + '0)');
  g.fillStyle = og; g.fillRect(0, 0, W, H);
  g.fillStyle = oc; g.beginPath(); g.arc(ox * W, oy * H, R, 0, 6.28); g.fill();
  out.push({ c: sky, d: 4 });
  // 2-4. tiga lapis gunung (jauh buram → dekat tajam)
  const md = [[0.6, 0.3, 0.01, 11, 2.2], [0.69, 0.2, 0.008, 23, 1.0], [0.78, 0.12, 0.006, 37, 0.4]];
  md.forEach(([b, a, rf, sd, bl], i) => {
    const c = mk(), x = c.getContext('2d');
    ridge(x, W, H, b, a, rf, sd, P.m[i], bl * (W / 1280));
    // kabut tipis di kaki gunung agar terasa jauh
    const hz = x.createLinearGradient(0, (b - 0.02) * H, 0, (b + 0.14) * H); hz.addColorStop(0, P.haze + '0)'); hz.addColorStop(1, P.haze + (0.32 - i * 0.08) + ')');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hz; x.fillRect(0, 0, W, H);
    out.push({ c, d: 9 + i * 7 });
  });
  // 5. bukit depan + sawah terasering
  const f = mk(), x = f.getContext('2d');
  ridge(x, W, H, 0.84, 0.06, 0.006, 51, P.hill, 0);
  x.globalCompositeOperation = 'source-atop';
  for (let k = 0; k < 16; k++) {
    const y0 = 0.82 + k * 0.016;
    x.strokeStyle = k % 2 ? P.field[1] : P.field[0]; x.globalAlpha = 0.55; x.lineWidth = Math.max(1.5, H * 0.004);
    x.beginPath(); for (let px = -20; px <= W + 20; px += 10) { const u = px / W; x.lineTo(px, (y0 + 0.018 * Math.sin(u * 3.1 + k * 0.7) + k * 0.002 * Math.sin(u * 9)) * H); } x.stroke();
  }
  x.globalAlpha = 1;
  const sh = x.createLinearGradient(0, 0.8 * H, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = sh; x.fillRect(0, 0, W, H);
  out.push({ c: f, d: 34 });
  return out;
}
async function mountPaint(S) {
  const kb = root.querySelector('.sc-kb'); const P = PAINT[S.paint];
  const draw = () => {
    const d = fxLevel() === 'full' ? Math.min(devicePixelRatio || 1, 1.25) : 1, W = Math.round((innerWidth + 80) * d), H = Math.round((innerHeight + 80) * d);
    kb.querySelectorAll('canvas').forEach(c => c.remove());
    layers = paintScene(P, W, H).map(L => { L.c.className = 'sc-layer'; kb.appendChild(L.c); return L; });
    root.classList.add('ready');
  };
  draw();
  let tm; listen(window, 'resize', () => { clearTimeout(tm); tm = setTimeout(draw, 250); });
}
function paintParallax() {
  const sy = Math.min(pointer.sy, 1500);
  for (const L of layers) L.c.style.transform = `translate3d(${(-pointer.x * L.d).toFixed(1)}px, ${(-pointer.y * L.d * 0.5 - sy * L.d * 0.0025).toFixed(1)}px, 0)`;
}

/* ───── Mode WebGL 2.5D (Sakura) ───── */
const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision mediump float;
varying vec2 v; uniform sampler2D img, msk; uniform vec2 res, isz, mouse; uniform float t, gust, scroll;
void main(){
  // cover-fit + sedikit zoom agar tepi tidak terlihat saat bergeser
  float ra = res.x / res.y, ia = isz.x / isz.y; vec2 uv = vec2(v.x, 1.0 - v.y);
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  uv = (uv - 0.5) * s / 1.08 + 0.5; uv.y += scroll;
  vec4 m = texture2D(msk, uv); float tree = m.r, dep = m.g, sky = m.b;
  vec2 q = uv;
  q += mouse * (dep - 0.45) * 0.035;                                   // parallax per kedalaman
  float w = sin(t * 1.6 + uv.x * 6.0 + uv.y * 3.5) * 0.0055 + sin(t * 4.1 + uv.x * 23.0 + uv.y * 17.0) * 0.0016;
  q.x += tree * w * gust * (0.4 + uv.y * 0.8);                          // pohon bergoyang, makin kuat di pucuk
  q.y += tree * cos(t * 2.3 + uv.x * 9.0) * 0.0018 * gust;
  q.x += sky * (sin(t * 0.12 + uv.y * 4.0) * 0.006 + t * 0.0);          // awan bergeser pelan
  vec3 c = texture2D(img, q).rgb;
  c += tree * 0.035 * (0.5 + 0.5 * sin(t * 3.0 + uv.x * 40.0 + uv.y * 30.0)) * gust; // kilau kelopak
  gl_FragColor = vec4(c, 1.0);
}`;
async function mountGL(S) {
  const mobile = SMALL();
  const src = mobile && S.mob && await exists(S.mob) ? S.mob : S.img;
  const [img, msk] = await Promise.all([loadImg(src), loadImg(S.mask)]);
  if (!alive) return;
  const cv = document.createElement('canvas'); cv.className = 'sc-gl';
  const gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) { img.className = 'sc-img'; root.querySelector('.sc-kb').appendChild(img); root.classList.add('ready'); return; }
  root.querySelector('.sc-kb').appendChild(cv);
  const sh = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit, im) => { const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); };
  tex(0, img); tex(1, msk);
  const U = n => gl.getUniformLocation(pr, n);
  gl.uniform1i(U('img'), 0); gl.uniform1i(U('msk'), 1); gl.uniform2f(U('isz'), img.naturalWidth, img.naturalHeight);
  let last = 0;
  const size = () => { last = 0; const d = fxLevel() === 'full' ? Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5) : 1; cv.width = innerWidth * d; cv.height = innerHeight * d; gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U('res'), cv.width, cv.height); };
  size(); listen(window, 'resize', size);
  root.classList.add('ready');
  const t0 = performance.now();
  const draw = now => {
    if (!alive) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return; }
    requestAnimationFrame(draw);
    if (document.hidden || (last && now - last < (fxLevel() === 'off' ? 1e9 : fxLevel() === 'lite' ? 45 : mobile ? 40 : 28))) return; last = now;   // ±25–35 fps; hemat 22 fps; mati = diam
    const t = (now - t0) / 1000;
    gust = 0.75 + 0.35 * Math.sin(t * 0.33) + 0.2 * Math.sin(t * 0.91 + 1.3);       // hembusan angin naik-turun
    gl.uniform1f(U('t'), reduced ? 0 : t); gl.uniform1f(U('gust'), gust);
    gl.uniform2f(U('mouse'), pointer.x, -pointer.y);
    gl.uniform1f(U('scroll'), -Math.min(pointer.sy, 1200) / innerHeight * 0.03);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  requestAnimationFrame(draw);
}

/* ───── Partikel: debu cahaya (senja) / kelopak sakura ───── */
function startFx(cv, fx, lite = false) {
  if (reduced || !['dust', 'petals', 'fireflies', 'birds'].some(f => fx.includes(f))) return;
  const ctx = cv.getContext('2d'), petals = fx.includes('petals'), ff = fx.includes('fireflies'), birds = fx.includes('birds');
  let N = petals ? (SMALL() ? 16 : 34) : birds ? 6 : (SMALL() ? 18 : 42); let W, H, d;
  if (lite) N = Math.ceil(N * 0.45);
  const size = () => { d = lite ? 1 : Math.min(devicePixelRatio || 1, 1.5); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
  size(); listen(window, 'resize', size);
  const mk = () => ({ x: Math.random(), y: petals ? -Math.random() : Math.random(), r: petals ? 4 + Math.random() * 5 : 0.6 + Math.random() * 2.2,
    s: petals ? 0.0012 + Math.random() * 0.0016 : 0.00015 + Math.random() * 0.0005, w: Math.random() * 6.28, rot: Math.random() * 6.28, a: 0.35 + Math.random() * 0.55,
    c: ['#ffd6e5', '#ffc2d6', '#fff0f5', '#f9a8c9'][Math.floor(Math.random() * 4)] });
  const P = Array.from({ length: N }, mk); if (petals) P.forEach(p => (p.y = Math.random()));
  if (birds) P.forEach(p => (p.y = 0.08 + Math.random() * 0.3));
  if (ff) P.forEach(p => (p.y = 0.5 + Math.random() * 0.5));
  let last = 0;
  const loop = now => {
    if (!alive) return; requestAnimationFrame(loop);
    if (document.hidden || now - last < (lite ? 50 : 33)) return; last = now;
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.w += 0.03;
      if (petals) {
        p.y += p.s; p.x += (0.0009 + Math.sin(p.w) * 0.0012) * gust; p.rot += 0.04 * gust;
        if (p.y > 1.05 || p.x > 1.08) Object.assign(p, mk(), { y: -0.05, x: Math.random() * 0.9 - 0.15 });
        const x = p.x * W, y = p.y * H, r = p.r * d;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + Math.sin(p.w * 1.7) * 0.35);
        ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.bezierCurveTo(r, -r * 0.6, r * 0.8, r * 0.7, 0, r); ctx.bezierCurveTo(-r * 0.8, r * 0.7, -r, -r * 0.6, 0, -r); ctx.fill();
        ctx.restore();
      } else if (birds) {
        p.x += p.s * 1.4; if (p.x > 1.1) { p.x = -0.1; p.y = 0.08 + Math.random() * 0.3; }
        const x = p.x * W, y = (p.y + Math.sin(p.w * 0.5) * 0.01) * H, r = (6 + p.r * 2) * d, f = Math.sin(p.w * 3) * 0.6;
        ctx.strokeStyle = 'rgba(40,55,80,.55)'; ctx.lineWidth = 1.6 * d; ctx.beginPath();
        ctx.moveTo(x - r, y - r * f * 0.5); ctx.quadraticCurveTo(x - r * 0.4, y - r * 0.5, x, y); ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.5, x + r, y - r * f * 0.5); ctx.stroke();
      } else {
        p.y -= p.s * (ff ? 0.6 : 1); if (p.y < (ff ? 0.45 : -0.05)) { p.y = 1.05; p.x = Math.random(); }
        const x = (p.x + Math.sin(p.w) * 0.01) * W, y = p.y * H, r = p.r * d;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        const al = p.a * (ff ? Math.max(0, Math.sin(p.w * 1.3)) : 0.6 + Math.sin(p.w * 2) * 0.4);
        g.addColorStop(0, ff ? `rgba(220,255,140,${al})` : `rgba(255,224,170,${al})`); g.addColorStop(1, ff ? 'rgba(200,255,120,0)' : 'rgba(255,200,140,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 6.28); ctx.fill();
      }
    }
  };
  requestAnimationFrame(loop);
}

// halaman selain Beranda: pemandangan diburamkan agar teks mudah dibaca
export function sceneRoute(path) { document.body.classList.toggle('sc-dim', !!path && path !== 'login'); }

export function syncScene() {
  const k = document.documentElement.getAttribute('data-theme');
  if (k === cur) return;
  unmount();
  if (SCENES[k]) mount(k);
}
window.addEventListener('theme:change', syncScene);
window.addEventListener('fx:change', () => { const k = cur; unmount(); if (k) mount(k); });
