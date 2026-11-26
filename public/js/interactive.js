// Mode 4: Interaktif Visual — 8 cara: susun urutan, susun kalimat, pencocokan, kelompokkan, susun grafik, isi rumpang, benar/salah, cari yang berbeda
import { $, $$, esc, toast, confetti, vibrate, icons, fmt } from './ui.js';
import { sfx } from './sound.js';
import { diffByKey } from './data.js';

const KIND = {
  order: { ico: '🔢', name: 'Susun urutan', hint: 'Ketuk kartu sesuai urutan yang benar. Ketuk lagi kartu yang sudah tersusun untuk mengembalikannya.' },
  words: { ico: '🧱', name: 'Susun kalimat', hint: 'Ketuk kata-kata untuk menyusun kalimat yang benar.' },
  match: { ico: '🔗', name: 'Pencocokan', hint: 'Ketuk satu item di kiri, lalu pasangannya di kanan.' },
  sort: { ico: '🗂️', name: 'Kelompokkan', hint: 'Ketuk sebuah item, lalu ketuk kelompok tujuannya.' },
  chart: { ico: '📊', name: 'Susun grafik', hint: 'Geser batang ke atas/bawah atau pakai tombol − / + sampai nilainya tepat.' },
  fill: { ico: '✏️', name: 'Isi rumpang', hint: 'Ketuk kata di bawah untuk mengisi bagian kosong secara berurutan. Ketuk isian untuk menghapusnya.' },
  tf: { ico: '⚖️', name: 'Benar / Salah', hint: 'Tentukan setiap pernyataan benar atau salah.' },
  odd: { ico: '🕵️', name: 'Cari yang berbeda', hint: 'Ketuk satu item yang TIDAK sekelompok dengan yang lain.' },
};
const COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#fb7185', '#f472b6', '#38bdf8'];

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function shuffledNotSame(arr) {
  if (arr.length < 2) return arr.slice();
  let r; let guard = 0;
  do { r = shuffle(arr); } while (r.every((x, i) => x === arr[i]) && guard++ < 20);
  return r;
}
const round = (v, step) => Math.round(v / step) * step;
const fmtNum = (v, step) => (step < 1 ? v.toFixed(String(step).split('.')[1]?.length || 1).replace('.', ',') : fmt(v));

export const IX_KIND = KIND;
// dipakai Duel: pasang mesin interaktif ke elemen stage
export function mountEngine(stage, q, api) {
  return ({ order: orderEngine, words: orderEngine, match: matchEngine, sort: sortEngine, chart: chartEngine, fill: fillEngine, tf: tfEngine, odd: oddEngine }[q.kind] || orderEngine)(stage, q, api);
}

export function runInteractive(app, practice, { complete, metaHTML, srcHTML, confirmExit }) {
  const qs = practice.questions, n = qs.length;
  const st = { i: 0, results: [], start: Date.now() };

  app.innerHTML = `
  <div class="quiz-top">
    <button class="icon-btn" id="exitBtn" aria-label="Keluar">${icons.x}</button>
    <div class="progress"><i id="prog"></i></div>
    <span class="chip" id="qCount"></span>
  </div>
  <div id="qWrap"></div>`;
  $('#exitBtn').onclick = confirmExit;

  function draw() {
    const q = qs[st.i];
    const k = KIND[q.kind] || KIND.order;
    $('#prog').style.width = `${(st.i / n) * 100}%`;
    $('#qCount').textContent = `${st.i + 1}/${n}`;
    $('#qWrap').innerHTML = `
      <div class="glass q-card fade-in">
        ${metaHTML(q, st.i, n)}
        <div class="kind-tag">${k.ico} ${k.name}</div>
        <p class="q-text">${esc(q.question)}</p>
        <p class="dim" style="margin:8px 0 0">💡 ${k.hint}</p>
        <div id="stage" class="ix-stage"></div>
        <div class="row" style="margin-top:14px;gap:10px">
          <button class="btn ghost" id="resetBtn">↺ Ulang</button>
          <button class="btn" id="checkBtn" style="flex:1" disabled>Periksa</button>
        </div>
        <div id="fb"></div>
      </div>`;
    const stage = $('#stage');
    const api = { setReady: ok => { const b = $('#checkBtn'); if (b) b.disabled = !ok; } };
    const engine = ({ order: orderEngine, words: orderEngine, match: matchEngine, sort: sortEngine, chart: chartEngine, fill: fillEngine, tf: tfEngine, odd: oddEngine }[q.kind] || orderEngine)(stage, q, api);
    $('#resetBtn').onclick = () => { engine.reset(); api.setReady(false); };
    $('#checkBtn').onclick = () => {
      const res = engine.check(); // { ratio: 0..1, correctView: html }
      const ok = res.ratio >= 0.999;
      st.results[st.i] = { q, ok, ratio: res.ratio };
      $('#checkBtn').remove(); $('#resetBtn').remove();
      vibrate(ok ? 15 : [50, 30, 50]); sfx(ok ? 'correct' : 'wrong');
      if (ok) { confetti(60); window.dispatchEvent(new Event('bg:burst')); }
      const last = st.i === n - 1;
      $('#fb').innerHTML = `
        <div class="explain ${ok ? '' : 'bad'} fade-in">
          <b>${ok ? '✅ Sempurna!' : res.ratio >= 0.5 ? `◐ Hampir! ${Math.round(res.ratio * 100)}% tepat` : `❌ Baru ${Math.round(res.ratio * 100)}% tepat`}</b>
          ${!ok && res.correctView ? `<div style="margin-top:8px">${res.correctView}</div>` : ''}
          ${q.explanation ? `<div class="muted" style="margin-top:6px">${esc(q.explanation)}</div>` : ''}
          ${srcHTML(q)}
        </div>
        <button class="btn block" id="nextBtn" style="margin-top:12px">${last ? '🏁 Lihat hasil' : 'Soal berikutnya →'}</button>`;
      $('#nextBtn').onclick = () => { if (last) finish(); else { st.i++; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
      $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  function finish() {
    const res = st.results.filter(Boolean);
    const avg = res.length ? res.reduce((s, r) => s + r.ratio, 0) / res.length : 0;
    complete({
      total: res.length, correct: res.filter(r => r.ok).length, score: Math.round(avg * 100),
      points: res.reduce((s, r) => s + Math.round(r.ratio * (diffByKey[r.q.difficulty]?.pts || 10) * 1.5), 0),
      durationSec: (Date.now() - st.start) / 1000, review: res,
    });
  }
  draw();
}

/* ───────── Susun urutan & susun kalimat ───────── */
function orderEngine(stage, q, api) {
  const isWords = q.kind === 'words';
  const target = q.items;
  let pool, placed, locked = false;
  const reset = () => { pool = shuffledNotSame(target.map((t, i) => ({ t, i }))); placed = []; locked = false; render(); };
  function render(marks) {
    stage.innerHTML = `
      <div class="ix-answer ${isWords ? 'words' : 'order'}">
        ${placed.length ? placed.map((p, k) => `<button class="ix-chip placed ${marks ? (marks[k] ? 'right' : 'wrong') : ''}" data-k="${k}">
          ${isWords ? '' : `<span class="num">${k + 1}</span>`}<span>${esc(p.t)}</span></button>`).join('')
          : `<div class="ix-empty">${isWords ? 'Kalimatmu muncul di sini…' : 'Ketuk kartu di bawah sesuai urutan…'}</div>`}
      </div>
      <div class="ix-pool ${isWords ? 'words' : ''}">
        ${pool.map((p, k) => `<button class="ix-chip" data-p="${k}"><span>${esc(p.t)}</span></button>`).join('')}
      </div>`;
    if (locked) return;
    $$('[data-p]', stage).forEach(b => (b.onclick = () => { placed.push(pool.splice(+b.dataset.p, 1)[0]); vibrate(8); render(); api.setReady(!pool.length); }));
    $$('[data-k]', stage).forEach(b => (b.onclick = () => { pool.push(placed.splice(+b.dataset.k, 1)[0]); render(); api.setReady(false); }));
  }
  reset();
  return {
    reset,
    check() {
      locked = true;
      const seq = placed.map(p => p.t);
      const marks = seq.map((t, k) => t === target[k]);
      render(marks);
      const ratio = marks.filter(Boolean).length / target.length;
      return {
        ratio,
        correctView: `<b>Urutan benar:</b>${isWords
          ? `<div class="muted" style="margin-top:4px">${esc(target.join(' '))}</div>`
          : `<ol class="ix-ol">${target.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`}`,
      };
    },
  };
}

/* ───────── Pencocokan ───────── */
function matchEngine(stage, q, api) {
  const left = q.pairs.map(p => p.a);
  let right, links, sel, locked;
  const reset = () => { right = shuffledNotSame(q.pairs.map(p => p.b)); links = {}; sel = null; locked = false; render(); };
  function render(marks) {
    const colorOf = li => COLORS[Object.keys(links).map(Number).sort((a, b) => a - b).indexOf(li) % COLORS.length];
    const rightOwner = ri => { const e = Object.entries(links).find(([, r]) => r === ri); return e ? +e[0] : null; };
    stage.innerHTML = `
      <div class="ix-match">
        <svg class="ix-lines" aria-hidden="true"></svg>
        <div class="col">${left.map((t, li) => `<button class="ix-chip m ${sel === li ? 'sel' : ''} ${links[li] != null ? 'linked' : ''} ${marks ? (marks[li] ? 'right' : 'wrong') : ''}"
          data-l="${li}" style="${links[li] != null ? `--c:${colorOf(li)}` : ''}"><span>${esc(t)}</span></button>`).join('')}</div>
        <div class="col">${right.map((t, ri) => { const o = rightOwner(ri); return `<button class="ix-chip m ${o != null ? 'linked' : ''}"
          data-r="${ri}" style="${o != null ? `--c:${colorOf(o)}` : ''}"><span>${esc(t)}</span></button>`; }).join('')}</div>
      </div>`;
    requestAnimationFrame(() => drawLines(marks));
    if (locked) return;
    $$('[data-l]', stage).forEach(b => (b.onclick = () => {
      const li = +b.dataset.l;
      if (links[li] != null) { delete links[li]; sel = li; } else sel = sel === li ? null : li;
      render(); api.setReady(Object.keys(links).length === left.length);
    }));
    $$('[data-r]', stage).forEach(b => (b.onclick = () => {
      const ri = +b.dataset.r;
      if (sel == null) { toast('Ketuk dulu item di kolom kiri'); return; }
      for (const k of Object.keys(links)) if (links[k] === ri) delete links[k];
      links[sel] = ri; sel = null; vibrate(8);
      render(); api.setReady(Object.keys(links).length === left.length);
    }));
  }
  function drawLines(marks) {
    const box = $('.ix-match', stage); const svg = $('.ix-lines', stage); if (!box || !svg) return;
    const B = box.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${B.width} ${B.height}`);
    const keys = Object.keys(links).map(Number).sort((a, b) => a - b);
    svg.innerHTML = keys.map((li, idx) => {
      const L = $(`[data-l="${li}"]`, stage).getBoundingClientRect(), R = $(`[data-r="${links[li]}"]`, stage).getBoundingClientRect();
      const x1 = L.right - B.left, y1 = L.top + L.height / 2 - B.top, x2 = R.left - B.left, y2 = R.top + R.height / 2 - B.top;
      const c = marks ? (marks[li] ? '#34d399' : '#fb7185') : COLORS[idx % COLORS.length];
      const mx = (x1 + x2) / 2;
      return `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round" class="ix-path"/>
        <circle cx="${x1}" cy="${y1}" r="5" fill="${c}"/><circle cx="${x2}" cy="${y2}" r="5" fill="${c}"/>`;
    }).join('');
  }
  const onResize = () => { if (document.body.contains(stage)) drawLines(); else removeEventListener('resize', onResize); };
  addEventListener('resize', onResize);
  reset();
  return {
    reset,
    check() {
      locked = true;
      const marks = left.map((_, li) => right[links[li]] === q.pairs[li].b);
      render(marks);
      return {
        ratio: marks.filter(Boolean).length / left.length,
        correctView: `<b>Pasangan benar:</b><ul class="ix-ol">${q.pairs.map(p => `<li>${esc(p.a)} → <b>${esc(p.b)}</b></li>`).join('')}</ul>`,
      };
    },
  };
}

/* ───────── Kelompokkan ───────── */
function sortEngine(stage, q, api) {
  const all = q.buckets.flatMap((b, bi) => b.items.map(t => ({ t, bi })));
  let pool, placed, sel, locked;
  const reset = () => { pool = shuffle(all); placed = q.buckets.map(() => []); sel = null; locked = false; render(); };
  function render(check) {
    stage.innerHTML = `
      <div class="ix-pool">${pool.length ? pool.map((p, k) => `<button class="ix-chip ${sel === k ? 'sel' : ''}" data-p="${k}"><span>${esc(p.t)}</span></button>`).join('')
        : '<div class="ix-empty">Semua item sudah dikelompokkan ✓</div>'}</div>
      <div class="ix-buckets">${q.buckets.map((b, bi) => `
        <div class="ix-bucket ${sel != null ? 'armed' : ''}" data-b="${bi}" style="--c:${COLORS[bi % COLORS.length]}">
          <div class="ix-bucket-h">${esc(b.name)} <span class="dim">(${placed[bi].length})</span></div>
          <div class="ix-bucket-body">${placed[bi].map((p, k) => `<button class="ix-chip small ${check ? (p.bi === bi ? 'right' : 'wrong') : ''}" data-x="${bi}:${k}"><span>${esc(p.t)}</span></button>`).join('')
            || '<span class="dim" style="font-size:12px">Ketuk item, lalu ketuk di sini</span>'}</div>
        </div>`).join('')}</div>`;
    if (locked) return;
    $$('[data-p]', stage).forEach(b => (b.onclick = e => { e.stopPropagation(); const k = +b.dataset.p; sel = sel === k ? null : k; render(); }));
    $$('[data-b]', stage).forEach(b => (b.onclick = () => {
      if (sel == null) { toast('Ketuk dulu salah satu item'); return; }
      placed[+b.dataset.b].push(pool.splice(sel, 1)[0]); sel = null; vibrate(8);
      render(); api.setReady(!pool.length);
    }));
    $$('[data-x]', stage).forEach(b => (b.onclick = e => {
      e.stopPropagation(); const [bi, k] = b.dataset.x.split(':').map(Number);
      pool.push(placed[bi].splice(k, 1)[0]); render(); api.setReady(false);
    }));
  }
  reset();
  return {
    reset,
    check() {
      locked = true; render(true);
      const ok = placed.reduce((s, arr, bi) => s + arr.filter(p => p.bi === bi).length, 0);
      return {
        ratio: ok / all.length,
        correctView: `<b>Pengelompokan benar:</b>${q.buckets.map(b => `<div style="margin-top:4px"><b>${esc(b.name)}:</b> <span class="muted">${b.items.map(esc).join(', ')}</span></div>`).join('')}`,
      };
    },
  };
}

/* ───────── Susun grafik ───────── */
function chartEngine(stage, q, api) {
  const c = q.chart;
  const step = c.step || 1, max = c.max, tol = c.tol ?? 0;
  let vals, locked;
  const ticks = 5;
  const reset = () => { vals = c.values.map(() => round(max * 0.25, step)); locked = false; render(); api.setReady(true); };
  function render(marks) {
    stage.innerHTML = `
      <div class="ix-chart">
        <div class="ix-yaxis">${Array.from({ length: ticks + 1 }, (_, i) => `<span>${fmtNum(round((max * (ticks - i)) / ticks, step), step)}</span>`).join('')}</div>
        <div class="ix-plot">
          ${Array.from({ length: ticks + 1 }, (_, i) => `<i class="ix-grid" style="top:${(i / ticks) * 100}%"></i>`).join('')}
          ${c.labels.map((lb, k) => `
            <div class="ix-col" data-c="${k}">
              <div class="ix-bar ${marks ? (marks[k] ? 'right' : 'wrong') : ''}" style="height:${(vals[k] / max) * 100}%"><span class="ix-handle"></span><span class="ix-val">${fmtNum(vals[k], step)}</span></div>
              ${marks && !marks[k] ? `<i class="ix-target" style="bottom:${(c.values[k] / max) * 100}%" title="Jawaban: ${c.values[k]}"></i>` : ''}
            </div>`).join('')}
        </div>
      </div>
      <div class="ix-xaxis">${c.labels.map((lb, k) => `
        <div><div class="ix-lb">${esc(lb)}</div>
          ${locked ? '' : `<div class="ix-steppers"><button data-m="${k}" aria-label="Kurangi">−</button><button data-pl="${k}" aria-label="Tambah">+</button></div>`}</div>`).join('')}
      </div>
      <p class="dim" style="text-align:center;margin:6px 0 0">Satuan: ${esc(c.unit || '')}</p>`;
    if (locked) return;
    const set = (k, v) => { vals[k] = Math.max(0, Math.min(max, round(v, step))); const col = $(`[data-c="${k}"]`, stage); $('.ix-bar', col).style.height = `${(vals[k] / max) * 100}%`; $('.ix-val', col).textContent = fmtNum(vals[k], step); };
    $$('[data-m]', stage).forEach(b => (b.onclick = () => set(+b.dataset.m, vals[+b.dataset.m] - step)));
    $$('[data-pl]', stage).forEach(b => (b.onclick = () => set(+b.dataset.pl, vals[+b.dataset.pl] + step)));
    $$('.ix-col', stage).forEach(col => {
      const k = +col.dataset.c;
      const fromY = e => { const r = col.getBoundingClientRect(); return ((r.bottom - e.clientY) / r.height) * max; };
      col.onpointerdown = e => { col.setPointerCapture(e.pointerId); col.classList.add('drag'); set(k, fromY(e)); };
      col.onpointermove = e => { if (col.hasPointerCapture(e.pointerId)) set(k, fromY(e)); };
      col.onpointerup = col.onpointercancel = e => { col.classList.remove('drag'); try { col.releasePointerCapture(e.pointerId); } catch {} };
    });
  }
  reset();
  return {
    reset,
    check() {
      locked = true;
      const marks = vals.map((v, k) => Math.abs(v - c.values[k]) <= tol + 1e-9);
      render(marks);
      return {
        ratio: marks.filter(Boolean).length / vals.length,
        correctView: `<b>Nilai benar:</b> <span class="muted">${c.labels.map((lb, k) => `${esc(lb)} = ${fmtNum(c.values[k], step)}`).join(' · ')} ${esc(c.unit || '')}</span>`,
      };
    },
  };
}

/* ───────── Isi rumpang ───────── */
function fillEngine(stage, q, api) {
  const parts = String(q.text || '').split('___');
  const holes = parts.length - 1;
  let pool, slots, locked;
  const reset = () => { pool = shuffle([...q.blanks, ...(q.extras || [])].map((t, i) => ({ t, i }))); slots = Array(holes).fill(null); locked = false; render(); };
  function render(marks) {
    const next = slots.indexOf(null);
    stage.innerHTML = `
      <div class="ix-fill">${parts.map((p, k) => esc(p) + (k < holes ? `<button class="ix-blank ${slots[k] ? 'filled' : ''} ${k === next && !locked ? 'next' : ''} ${marks ? (marks[k] ? 'right' : 'wrong') : ''}" data-s="${k}">${slots[k] ? esc(slots[k].t) : `<span class="dim">(${k + 1})</span>`}</button>` : '')).join('')}</div>
      <div class="ix-pool">${pool.map((p, k) => `<button class="ix-chip" data-p="${k}"><span>${esc(p.t)}</span></button>`).join('')}</div>`;
    if (locked) return;
    $$('[data-p]', stage).forEach(b => (b.onclick = () => {
      const k = slots.indexOf(null); if (k < 0) return;
      slots[k] = pool.splice(+b.dataset.p, 1)[0]; vibrate(8); render(); api.setReady(!slots.includes(null));
    }));
    $$('[data-s]', stage).forEach(b => (b.onclick = () => {
      const k = +b.dataset.s; if (!slots[k]) return;
      pool.push(slots[k]); slots[k] = null; render(); api.setReady(false);
    }));
  }
  reset();
  return {
    reset,
    check() {
      locked = true;
      const marks = slots.map((s, k) => s && s.t.trim().toLowerCase() === String(q.blanks[k]).trim().toLowerCase());
      render(marks);
      return {
        ratio: marks.filter(Boolean).length / holes,
        correctView: `<b>Kalimat lengkap:</b><div class="muted" style="margin-top:4px">${parts.map((p, k) => esc(p) + (k < holes ? `<b style="color:var(--green,#34d399)">${esc(q.blanks[k])}</b>` : '')).join('')}</div>`,
      };
    },
  };
}

/* ───────── Benar / Salah ───────── */
function tfEngine(stage, q, api) {
  const list = q.statements || [];
  let ans, locked;
  const reset = () => { ans = list.map(() => null); locked = false; render(); };
  function render(check) {
    stage.innerHTML = `<div class="ix-tf">${list.map((s, k) => `
      <div class="ix-tf-row ${check ? (ans[k] === s.v ? 'right' : 'wrong') : ''}">
        <span class="ix-tf-n">${k + 1}</span><p>${esc(s.t)}</p>
        <div class="ix-tf-btns"><button class="${ans[k] === true ? 'on t' : ''}" data-t="${k}:1" aria-label="Benar">✓ Benar</button><button class="${ans[k] === false ? 'on f' : ''}" data-t="${k}:0" aria-label="Salah">✗ Salah</button></div>
        ${check && ans[k] !== s.v ? `<small class="ix-tf-key">Jawaban: ${s.v ? 'Benar' : 'Salah'}</small>` : ''}
      </div>`).join('')}</div>`;
    if (locked) return;
    $$('[data-t]', stage).forEach(b => (b.onclick = () => {
      const [k, v] = b.dataset.t.split(':'); ans[+k] = v === '1'; vibrate(8); render(); api.setReady(!ans.includes(null));
    }));
  }
  reset();
  return {
    reset,
    check() {
      locked = true; render(true);
      const ok = list.filter((s, k) => ans[k] === s.v).length;
      return { ratio: ok / list.length, correctView: '' };
    },
  };
}

/* ───────── Cari yang berbeda ───────── */
function oddEngine(stage, q, api) {
  let items, sel, locked;
  const reset = () => { items = shuffle(q.items.map((t, i) => ({ t, i }))); sel = null; locked = false; render(); };
  function render(check) {
    stage.innerHTML = `<div class="ix-odd">${items.map((it, k) => `
      <button class="ix-odd-card ${sel === k ? 'sel' : ''} ${check ? (it.i === q.odd ? 'right' : sel === k ? 'wrong' : 'dimmed') : ''}" data-o="${k}" style="--c:${COLORS[k % COLORS.length]}">
        <span class="ix-odd-mark">${check && it.i === q.odd ? '🎯' : sel === k ? '👆' : '❔'}</span><span>${esc(it.t)}</span></button>`).join('')}</div>`;
    if (locked) return;
    $$('[data-o]', stage).forEach(b => (b.onclick = () => { sel = +b.dataset.o; vibrate(8); render(); api.setReady(true); }));
  }
  reset();
  return {
    reset,
    check() {
      locked = true; render(true);
      return { ratio: items[sel]?.i === q.odd ? 1 : 0, correctView: `<b>Yang berbeda:</b> ${esc(q.items[q.odd])}` };
    },
  };
}
