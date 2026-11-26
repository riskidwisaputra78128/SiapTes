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
  if (!cfg.sfx || !SFX[name] || !ac()) return;
  try { SFX[name](ctx.currentTime + 0.01); } catch {}
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
export function setMood(name) {
  if (!MOODS[name] || name === mood) return;
  mood = name;
  if (!ctx || !timer) { M = MOODS[name]; return; }
  const id = ++moodSwap, now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now); musicBus.gain.setValueAtTime(musicBus.gain.value, now); musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.6);
  setTimeout(() => {
    if (id !== moodSwap || !ctx) return;
    M = MOODS[name]; step = 0; nextT = ctx.currentTime + 0.05;
    if (lp) lp.frequency.setTargetAtTime(M.lp, ctx.currentTime, 0.2);
    if (timer) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.linearRampToValueAtTime(M.gain, ctx.currentTime + 1.2); }
  }, 650);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (timer) { stopMusic(); cfg._resume = true; } } else if (cfg._resume && cfg.music) { cfg._resume = false; startMusic(); } });

export const sound = {
  get music() { return cfg.music; }, get sfx() { return cfg.sfx; }, get vol() { return cfg.vol; },
  get mood() { return mood; },
  setMood,
  toggleMusic(on = !cfg.music) { cfg.music = on; save(); on ? startMusic() : stopMusic(); },
  toggleSfx(on = !cfg.sfx) { cfg.sfx = on; save(); if (on) sfx('click'); },
  setVol(v) { cfg.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = cfg.vol; save(); },
};
