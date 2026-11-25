// Musik belajar (lo-fi) & efek suara — semuanya disintesis Web Audio, tanpa file audio.
const KEY = 'sl_sound';
const cfg = (() => { try { return { music: false, sfx: true, vol: 0.6, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { music: false, sfx: true, vol: 0.6 }; } })();
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
  levelup: t => [72, 76, 79, 84, 88].forEach((n, i) => tone(midi(n), t + i * 0.07, 0.25, { type: 'triangle', gain: 0.2 })),
};
export function sfx(name) {
  if (!cfg.sfx || !SFX[name] || !ac()) return;
  try { SFX[name](ctx.currentTime + 0.01); } catch {}
}

/* ───── Musik lo-fi (progresi akor + arpeggio + ketukan lembut) ───── */
const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]]; // Am7 · Fmaj7 · Cmaj7 · G7
const BPM = 72, BEAT = 60 / BPM;
let timer = null, nextT = 0, step = 0, lp = null;
function scheduleStep(t, s) {
  const bar = Math.floor(s / 16) % PROG.length, chord = PROG[bar], i = s % 16;
  if (i === 0) chord.forEach((n, k) => tone(midi(n), t, BEAT * 4, { type: 'triangle', gain: 0.045, attack: 0.4, release: BEAT * 4.2, detune: (k - 1.5) * 4, bus: lp }));
  if (i === 0 || i === 8) tone(midi(chord[0] - 12), t, BEAT * 2, { gain: 0.12, attack: 0.02, release: BEAT * 1.8, bus: lp });
  if (i % 2 === 0 && (s * 7 + i) % 5 !== 0) { const n = chord[(i / 2 + bar) % 4] + 12 + (i % 8 === 6 ? 12 : 0); tone(midi(n), t, 0.5, { gain: 0.035, attack: 0.005, release: 0.9, bus: lp }); }
  if (i === 0 || i === 10) tone(55, t, 0.25, { gain: 0.22, slide: 38, bus: musicBus });                 // kick lembut
  if (i === 4 || i === 12) noise(t, 0.12, { gain: 0.05, freq: 1800, type: 'bandpass', bus: musicBus });  // snare samar
  if (i % 2 === 1) noise(t, 0.04, { gain: 0.018, freq: 7000, bus: musicBus });                           // hi-hat
  if (Math.random() < 0.25) noise(t + Math.random() * BEAT / 4, 0.02, { gain: 0.012, freq: 3000, bus: musicBus }); // kresek piringan hitam
}
function startMusic() {
  if (!ac() || timer) return;
  if (!lp) { lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.4; lp.connect(musicBus); }
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.5);
  nextT = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    while (nextT < ctx.currentTime + 0.4) { scheduleStep(nextT, step++); nextT += BEAT / 4; }
  }, 100);
}
function stopMusic() {
  if (!timer) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  const t = timer; setTimeout(() => clearInterval(t), 900); timer = null;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (timer) { stopMusic(); cfg._resume = true; } } else if (cfg._resume && cfg.music) { cfg._resume = false; startMusic(); } });

export const sound = {
  get music() { return cfg.music; }, get sfx() { return cfg.sfx; }, get vol() { return cfg.vol; },
  toggleMusic(on = !cfg.music) { cfg.music = on; save(); on ? startMusic() : stopMusic(); },
  toggleSfx(on = !cfg.sfx) { cfg.sfx = on; save(); if (on) sfx('click'); },
  setVol(v) { cfg.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = cfg.vol; save(); },
};
