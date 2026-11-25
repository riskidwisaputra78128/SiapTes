// Tingkat animasi: 'full' (penuh) | 'lite' (hemat, default otomatis di HP) | 'off' (latar diam)
const KEY = 'sl_fx';
export const FX_LEVELS = [
  { key: 'full', name: 'Penuh', desc: 'Semua efek, untuk laptop/HP kencang' },
  { key: 'lite', name: 'Hemat', desc: 'Tanpa efek kaca & gerakan berat, tetap animasi ringan' },
  { key: 'off', name: 'Mati', desc: 'Latar diam, paling ringan & hemat baterai' },
];
export function autoFx() {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  return mobile || weak || navigator.connection?.saveData ? 'lite' : 'full';
}
export function fxChoice() { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } }
export function fxLevel() { const c = fxChoice(); return c === 'auto' ? autoFx() : c; }
export function applyFx() { document.documentElement.dataset.fx = fxLevel(); }
export function setFx(choice) {
  try { choice === 'auto' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, choice); } catch {}
  applyFx(); window.dispatchEvent(new CustomEvent('fx:change', { detail: fxLevel() }));
}
applyFx();
