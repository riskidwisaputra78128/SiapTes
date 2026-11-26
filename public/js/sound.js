// Musik latar per suasana (tenang/biasa/tegang/gembira) & efek suara — semuanya disintesis Web Audio, tanpa file audio.
const KEY = 'sl_sound';
const cfg = (() => { try { return { music: true, sfx: true, vol: 0.6, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { music: true, sfx: true, vol: 0.6 }; } })();
// v2: musik & suara default MENYALA (pengaturan lama yang mematikan musik direset sekali)
if (cfg.v !== 2) { cfg.music = true; cfg.sfx = true; cfg.v = 2; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} window.dispatchEvent(new Event('sound:change')); };

let ctx = null, master = null, musicBus = null, sfxBus = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = cfg.vol; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// browser hanya mengizinkan audio setelah interaksi pengguna
const unlock = () => { if (cfg.music) startMusic(); else if (ctx) ctx.resume(); };
['pointerdown', 'keydown'].forEach(e => addEventListener(e, unlock, { once: false, passive: true }));

const midi = n => 440 * 2 ** ((n - 69) / 12);
function tone(freq, t, dur, { type = 'sine', gain = 0.3, bus, attack = 0.01, release, detune = 0, slide } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + (release ?? dur) + 0.05);
}
let noiseBuf = null;
function noise(t, dur, { gain = 0.2, freq = 6000, type = 'highpass', bus } = {}) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

/* ───── Efek suara ───── */
const SFX = {
  click: t => tone(midi(84), t, 0.06, { type: 'triangle', gain: 0.12 }),
  correct: t => { tone(midi(76), t, 0.12, { type: 'triangle', gain: 0.28 }); tone(midi(83), t + 0.09, 0.22, { type: 'triangle', gain: 0.28 }); tone(midi(88), t + 0.09, 0.3, { gain: 0.1 }); },
  wrong: t => { tone(midi(52), t, 0.28, { type: 'sawtooth', gain: 0.12, slide: midi(45) }); tone(midi(51), t + 0.02, 0.3, { type: 'square', gain: 0.06, slide: midi(44) }); },
  win: t => { [72, 76, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.11, 0.35, { type: 'triangle', gain: 0.25 }));
    [84, 88, 91].forEach(n => tone(midi(n), t + 0.5, 0.9, { gain: 0.12, attack: 0.03 })); noise(t + 0.5, 0.6, { gain: 0.05, freq: 8000 }); },
  lose: t => { [67, 63, 60, 55].forEach((n, i) => tone(midi(n), t + i * 0.18, 0.4, { type: 'triangle', gain: 0.2 })); tone(midi(43), t + 0.72, 0.8, { gain: 0.18 }); },
  tick: t => tone(midi(81), t, 0.08, { type: 'square', gain: 0.07 }),
  go: t => { tone(midi(72), t, 0.15, { type: 'square', gain: 0.12 }); tone(midi(84), t + 0.12, 0.4, { type: 'square', gain: 0.12 }); noise(t, 0.25, { gain: 0.08, freq: 3000 }); },
  duel: t => { noise(t, 0.35, { gain: 0.12, freq: 2500 }); tone(midi(60), t, 0.5, { type: 'sawtooth', gain: 0.1, slide: midi(72) }); tone(midi(79), t + 0.32, 0.4, { type: 'triangle', gain: 0.2 }); },
  send: t => { tone(midi(79), t, 0.08, { type: 'triangle', gain: 0.14 }); tone(midi(86), t + 0.06, 0.12, { type: 'triangle', gain: 0.12 }); },
  nav: t => tone(midi(88), t, 0.05, { type: 'sine', gain: 0.05 }),
  pop: t => { tone(midi(79), t, 0.08, { type: 'triangle', gain: 0.16, slide: midi(91) }); tone(midi(91), t + 0.07, 0.18, { gain: 0.08 }); },
  notify: t => { [76, 81, 88].forEach((n, i) => tone(midi(n), t + i * 0.09, 0.3, { type: 'triangle', gain: 0.16 })); noise(t + 0.2, 0.3, { gain: 0.03, freq: 9000 }); },
  levelup: t => [72, 76, 79, 84, 88].forEach((n, i) => tone(midi(n), t + i * 0.07, 0.25, { type: 'triangle', gain: 0.2 })),
};
export function sfx(name) {
  const fn = PACK_SFX[pack]?.[name] || SFX[name];
  if (!cfg.sfx || !fn || !ac()) return;
  try { fn(ctx.currentTime + 0.01); } catch {}
}

/* ───── Musik latar: 4 suasana, berganti otomatis per halaman ───── */
const MOODS = {
  // tenang: pad lembut tanpa drum (profil, materi, evaluasi)
  calm: { bpm: 62, gain: 0.7, lp: 1300, prog: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], drums: 0, arp: 0.35, bass: 1 },
  // biasa: lo-fi santai & pelan (beranda, kantor)
  normal: { bpm: 72, gain: 0.5, lp: 1700, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]], drums: 1, arp: 0.7, bass: 1 },
  // tegang: minor, bass berdenyut, ketukan rapat (mengerjakan soal, duel)
  tense: { bpm: 116, gain: 0.55, lp: 2400, prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], drums: 2, arp: 0.9, bass: 2 },
  // gembira: mayor cerah, tepukan (peringkat, hasil bagus)
  happy: { bpm: 120, gain: 0.6, lp: 3600, prog: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], drums: 3, arp: 1, bass: 1 },
};
let mood = 'normal', M = MOODS.normal;
let timer = null, nextT = 0, step = 0, lp = null;
function scheduleStep(t, s) {
  if (M.step) return M.step(t, s);
  const beat = 60 / M.bpm, bar = Math.floor(s / 16) % M.prog.length, chord = M.prog[bar], i = s % 16;
  // pad akor
  if (i === 0) chord.forEach((n, k) => tone(midi(n), t, beat * 4, { type: M.drums >= 2 ? 'sawtooth' : 'triangle', gain: M.drums >= 2 ? 0.018 : 0.045, attack: M.drums >= 2 ? 0.05 : 0.4, release: beat * 4.2, detune: (k - 1.5) * 5, bus: lp }));
  // bass
  if (M.bass === 2) { if (i % 2 === 0) tone(midi(chord[0] - 24), t, beat * 0.45, { type: 'square', gain: 0.07, attack: 0.005, release: beat * 0.4, bus: lp }); }
  else if (i === 0 || i === 8) tone(midi(chord[0] - 12), t, beat * 2, { gain: 0.12, attack: 0.02, release: beat * 1.8, bus: lp });
  // arpeggio
  const arpOn = M.drums >= 2 ? i % 2 === 0 : i % 2 === 0 && (s * 7 + i) % 5 !== 0;
  if (arpOn && Math.random() < M.arp) { const n = chord[(i / 2 + bar) % chord.length] + 12 + (i % 8 === 6 ? 12 : 0); tone(midi(n), t, 0.5, { type: M.drums === 3 ? 'triangle' : 'sine', gain: M.drums === 3 ? 0.04 : 0.035, attack: 0.005, release: M.drums >= 2 ? 0.25 : 0.9, bus: lp }); }
  // drum
  if (M.drums === 1) {
    if (i === 0 || i === 10) tone(55, t, 0.25, { gain: 0.22, slide: 38, bus: musicBus });
    if (i === 4 || i === 12) noise(t, 0.12, { gain: 0.05, freq: 1800, type: 'bandpass', bus: musicBus });
    if (i % 2 === 1) noise(t, 0.04, { gain: 0.018, freq: 7000, bus: musicBus });
    if (Math.random() < 0.25) noise(t + Math.random() * beat / 4, 0.02, { gain: 0.012, freq: 3000, bus: musicBus });
  } else if (M.drums === 2) {
    if (i % 4 === 0) tone(60, t, 0.2, { gain: 0.26, slide: 40, bus: musicBus });
    noise(t, 0.03, { gain: i % 4 === 2 ? 0.03 : 0.014, freq: 8000, bus: musicBus });
    if (i === 12) tone(midi(84), t, 0.06, { type: 'square', gain: 0.03, bus: musicBus });   // detak jam
  } else if (M.drums === 3) {
    if (i % 4 === 0) tone(58, t, 0.22, { gain: 0.24, slide: 40, bus: musicBus });
    if (i === 4 || i === 12) { noise(t, 0.1, { gain: 0.08, freq: 1500, type: 'bandpass', bus: musicBus }); noise(t + 0.012, 0.08, { gain: 0.05, freq: 2500, type: 'bandpass', bus: musicBus }); }
    if (i % 2 === 1) noise(t, 0.04, { gain: 0.02, freq: 9000, bus: musicBus });
  }
}
function startMusic() {
  if (!ac() || timer) return;
  if (!lp) { lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4; lp.connect(musicBus); }
  lp.frequency.value = M.lp;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(M.gain, ctx.currentTime + 1.5);
  nextT = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    while (nextT < ctx.currentTime + 0.4) { scheduleStep(nextT, step++); nextT += 60 / M.bpm / 4; }
  }, 100);
}
function stopMusic() {
  if (!timer) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  const t = timer; setTimeout(() => clearInterval(t), 900); timer = null;
}
let moodSwap = 0;
// ganti suasana dengan crossfade (turun → ganti pola → naik)
const table = () => (pack !== 'default' && PACKS[pack]) || MOODS;
export function setMood(name, force = false) {
  if (!MOODS[name] || (name === mood && !force)) return;
  mood = name;
  if (!ctx || !timer) { M = table()[name]; return; }
  const id = ++moodSwap, now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now); musicBus.gain.setValueAtTime(musicBus.gain.value, now); musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.6);
  setTimeout(() => {
    if (id !== moodSwap || !ctx) return;
    M = table()[name]; step = 0; nextT = ctx.currentTime + 0.05;
    if (lp) lp.frequency.setTargetAtTime(M.lp, ctx.currentTime, 0.2);
    if (timer) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.linearRampToValueAtTime(M.gain, ctx.currentTime + 1.2); }
  }, 650);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (timer) { stopMusic(); cfg._resume = true; } } else if (cfg._resume && cfg.music) { cfg._resume = false; startMusic(); } });


/* ───── Paket suara per tema: Shinobi Senja (Jepang tradisional) & Pahlawan Kosmik (orkestra epik) ───── */
let pack = 'default';
const PACK_OF = { shinobi: 'shinobi', kosmik: 'kosmik' };
// alat musik sintetis
const koto = (n, t, g = 0.09, bus) => { tone(midi(n), t, 0.9, { type: 'triangle', gain: g, attack: 0.003, release: 0.9, bus }); tone(midi(n + 12), t, 0.4, { gain: g * 0.35, attack: 0.002, release: 0.35, bus }); };
const flute = (n, t, d, g = 0.05, bus) => { tone(midi(n) * 0.985, t, d, { gain: g, attack: 0.18, release: d, slide: midi(n), bus }); tone(midi(n) * 1.004, t + 0.05, d, { gain: g * 0.5, attack: 0.25, release: d, bus }); noise(t, 0.25, { gain: g * 0.5, freq: 1800, type: 'bandpass', bus }); };
const taiko = (t, g = 0.3, bus) => { tone(95, t, 0.5, { gain: g, attack: 0.002, slide: 48, bus }); noise(t, 0.08, { gain: g * 0.3, freq: 500, type: 'lowpass', bus }); };
const kane = (t, g = 0.04, bus) => { tone(2650, t, 0.12, { type: 'square', gain: g, attack: 0.001, bus }); tone(3720, t, 0.1, { gain: g * 0.6, attack: 0.001, bus }); };
const brass = (n, t, d, g = 0.035, bus) => [0, 7].forEach((iv, k) => { tone(midi(n + iv), t, d, { type: 'sawtooth', gain: g * (k ? 0.6 : 1), attack: 0.12, release: d, detune: k * 4, bus }); tone(midi(n + iv), t, d, { type: 'sawtooth', gain: g * 0.5, attack: 0.15, release: d, detune: -6, bus }); });
const choir = (ns, t, d, g = 0.02, bus) => ns.forEach((n, k) => [-8, 0, 8].forEach(dt => tone(midi(n), t, d, { type: 'triangle', gain: g, attack: 0.6, release: d, detune: dt + k, bus })));
const warDrum = (t, g = 0.3, bus) => { tone(70, t, 0.6, { gain: g, attack: 0.003, slide: 40, bus }); noise(t, 0.15, { gain: g * 0.25, freq: 300, type: 'lowpass', bus }); };
const snare = (t, g = 0.08, bus) => noise(t, 0.14, { gain: g, freq: 1700, type: 'bandpass', bus });
const IN = [62, 63, 67, 69, 70, 74, 75, 79];          // tangga nada Jepang miyako-bushi (D)
const YO = [62, 64, 67, 69, 71, 74, 76, 79];          // tangga nada yo (cerah)
const pick = (arr, s, k) => arr[(s * 7 + k * 3) % arr.length];
const shStep = (bpm, gain, lp, kind) => ({ bpm, gain, lp, step(t, s) {
  const beat = 60 / bpm, i = s % 16, bar = Math.floor(s / 16) % 4, sc = kind === 'happy' ? YO : IN, b = lpNode();
  if (i === 0) { tone(midi(38 + (bar === 2 ? -2 : 0)), t, beat * 4, { gain: 0.07, attack: 0.5, release: beat * 4.2, bus: b }); tone(midi(45), t, beat * 4, { gain: 0.03, attack: 0.6, release: beat * 4, bus: b }); }
  if (kind === 'calm') {
    if (i % 4 === 0 && Math.random() < 0.7) koto(pick(sc, s, bar), t, 0.07, b);
    if (i === 0 || (i === 8 && Math.random() < 0.6)) flute(pick(sc, s + 3, bar) + 12, t, beat * 3.5, 0.04, b);
  } else if (kind === 'normal') {
    if (i % 2 === 0 && Math.random() < 0.75) koto(pick(sc, s, bar), t, 0.07, b);
    if (i === 0) flute(pick(sc, s + 5, bar) + 12, t, beat * 3, 0.035, b);
    if (i === 0 || i === 10) taiko(t, 0.18, musicBus);
  } else if (kind === 'tense') {
    if (i % 2 === 0) koto(sc[(i / 2 + bar * 2) % 5], t, 0.06, b);
    if (i % 4 === 0) taiko(t, 0.28, musicBus); else if (i % 2 === 0) taiko(t, 0.1, musicBus);
    if (i === 14) tone(midi(81), t, 0.06, { type: 'square', gain: 0.025, bus: musicBus });
    if (i === 0 && bar % 2 === 0) flute(sc[4] + 12, t, beat * 2, 0.03, b);
  } else {
    if (i % 2 === 0) koto(pick(sc, s, bar), t, 0.08, b);
    if (i % 4 === 0) taiko(t, 0.24, musicBus);
    if (i % 4 === 2) kane(t, 0.035, musicBus);
    if (i === 0) flute(sc[(bar + 3) % 8] + 12, t, beat * 2, 0.04, b);
  }
} });
const KM = { dm: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]], dM: [[50, 54, 57], [55, 59, 62], [57, 61, 64], [47, 50, 54]] };
const koStep = (bpm, gain, lp, kind) => ({ bpm, gain, lp, step(t, s) {
  const beat = 60 / bpm, i = s % 16, bar = Math.floor(s / 16) % 4, ch = (kind === 'happy' ? KM.dM : KM.dm)[bar], b = lpNode();
  if (i === 0) { choir(ch.map(n => n + 12), t, beat * 4.2, kind === 'calm' ? 0.022 : 0.016, b); tone(midi(ch[0] - 12), t, beat * 4, { type: 'sawtooth', gain: 0.03, attack: 0.3, release: beat * 4, bus: b }); }
  if (kind === 'calm') {
    if (i === 8 && Math.random() < 0.6) tone(midi(ch[2] + 24), t, beat * 3, { gain: 0.03, attack: 0.4, release: beat * 3, bus: b });
  } else if (kind === 'normal') {
    if (i === 0) brass(ch[0], t, beat * 3, 0.022, b);
    if (i === 0 || i === 8) warDrum(t, 0.2, musicBus);
  } else if (kind === 'tense') {
    if (i % 2 === 0) tone(midi(ch[i % 4 === 0 ? 0 : 2] + 12), t, beat * 0.4, { type: 'square', gain: 0.025, release: beat * 0.35, bus: b });
    if ([0, 3, 6, 8, 11, 14].includes(i)) warDrum(t, i % 8 === 0 ? 0.3 : 0.16, musicBus);
    if (i === 4 || i === 12) snare(t, 0.08, musicBus);
    if (i === 0 && bar % 2 === 1) brass(ch[0] + 12, t, beat * 1.5, 0.03, b);
  } else {
    if (i === 0) brass(ch[0] + 12, t, beat * 1.8, 0.035, b);
    if (i === 8) brass(ch[1] + 12, t, beat * 1.6, 0.03, b);
    if (i % 4 === 0) warDrum(t, 0.24, musicBus);
    if (i % 2 === 1) snare(t, 0.045, musicBus);
    if (i === 12 || i === 14) tone(midi(ch[2] + 24), t, beat * 0.5, { type: 'triangle', gain: 0.05, bus: b });
  }
} });
const PACKS = {
  shinobi: { calm: shStep(60, 0.75, 2200, 'calm'), normal: shStep(76, 0.6, 2600, 'normal'), tense: shStep(118, 0.6, 3200, 'tense'), happy: shStep(112, 0.65, 3800, 'happy') },
  kosmik: { calm: koStep(58, 0.8, 1600, 'calm'), normal: koStep(74, 0.6, 2200, 'normal'), tense: koStep(124, 0.6, 2800, 'tense'), happy: koStep(116, 0.65, 3600, 'happy') },
};
const PACK_SFX = {
  shinobi: {
    click: t => { tone(1180, t, 0.05, { type: 'square', gain: 0.05, attack: 0.001 }); noise(t, 0.03, { gain: 0.05, freq: 2500, type: 'bandpass' }); },
    nav: t => noise(t, 0.35, { gain: 0.06, freq: 900, type: 'bandpass' }),
    pop: t => koto(74, t, 0.12),
    correct: t => { noise(t, 0.25, { gain: 0.09, freq: 6000 }); tone(2400, t + 0.02, 0.5, { gain: 0.06, slide: 3200 }); tone(3600, t + 0.05, 0.45, { gain: 0.03 }); koto(79, t + 0.05, 0.1); },
    wrong: t => { [180, 281, 395].forEach((f, k) => tone(f, t, 1.2, { gain: 0.09 / (k + 1), attack: 0.002, release: 1.2 })); },
    go: t => { taiko(t, 0.35); taiko(t + 0.18, 0.25); },
    tick: t => tone(1500, t, 0.04, { type: 'square', gain: 0.04 }),
    win: t => { YO.forEach((n, k) => koto(n, t + k * 0.08, 0.1)); [180, 270].forEach(f => tone(f, t + 0.7, 1.6, { gain: 0.08 })); },
    notify: t => [86, 91, 93, 98].forEach((n, k) => tone(midi(n), t + k * 0.11, 0.7, { gain: 0.05, attack: 0.002 })),
    send: t => koto(79, t, 0.1),
  },
  kosmik: {
    click: t => tone(midi(84), t, 0.07, { gain: 0.08, slide: midi(91) }),
    nav: t => { noise(t, 0.3, { gain: 0.05, freq: 1200, type: 'bandpass' }); tone(900, t, 0.3, { gain: 0.04, slide: 300 }); },
    pop: t => tone(midi(91), t, 0.12, { type: 'square', gain: 0.04, slide: midi(79) }),
    correct: t => { tone(220, t, 0.45, { type: 'sawtooth', gain: 0.06, slide: 880 }); [88, 93, 100].forEach((n, k) => tone(midi(n), t + 0.3 + k * 0.05, 0.4, { gain: 0.05 })); },
    wrong: t => { [0, 0.22].forEach(d => { tone(220, t + d, 0.18, { type: 'square', gain: 0.07 }); tone(165, t + d + 0.1, 0.12, { type: 'square', gain: 0.06 }); }); },
    go: t => { warDrum(t, 0.35); noise(t, 0.6, { gain: 0.08, freq: 400, type: 'lowpass' }); },
    tick: t => tone(midi(86), t, 0.05, { type: 'square', gain: 0.04 }),
    win: t => { [62, 69, 74, 78].forEach((n, k) => brass(n, t + k * 0.14, 0.5, 0.04)); brass(74, t + 0.6, 1.4, 0.045); warDrum(t + 0.6, 0.3); },
    notify: t => [79, 86, 91].forEach((n, k) => tone(midi(n), t + k * 0.08, 0.35, { gain: 0.06, slide: midi(n + 2) })),
    send: t => tone(midi(81), t, 0.1, { gain: 0.07, slide: midi(88) }),
  },
};
function lpNode() { return lp || musicBus; }
export function setPack(themeKey) {
  const p = PACK_OF[themeKey] || 'default';
  if (p === pack) return;
  pack = p;
  setMood(mood, true);   // ganti pola musik dengan crossfade
}
const syncPack = () => setPack(document.documentElement.getAttribute('data-theme') || 'dark');
window.addEventListener('theme:change', e => setPack(e.detail || 'dark'));
syncPack();

export const sound = {
  get music() { return cfg.music; }, get sfx() { return cfg.sfx; }, get vol() { return cfg.vol; },
  get mood() { return mood; },
  setMood,
  toggleMusic(on = !cfg.music) { cfg.music = on; save(); on ? startMusic() : stopMusic(); },
  toggleSfx(on = !cfg.sfx) { cfg.sfx = on; save(); if (on) sfx('click'); },
  setVol(v) { cfg.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = cfg.vol; save(); },
};
