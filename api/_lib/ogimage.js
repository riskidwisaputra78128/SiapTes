// Ambil foto asli dari artikel berita (og:image), termasuk membuka link Google News.
import { backupAll } from './news.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function get(url, { ms = 4000, method = 'GET', body, headers = {}, max = 300000 } = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method, body, signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9', ...headers } });
    if (!r.ok) return null;
    const txt = await r.text();
    return { text: txt.slice(0, max), url: r.url || url };
  } catch { return null; } finally { clearTimeout(t); }
}

// Link Google News (news.google.com/rss/articles/…) → URL artikel asli
export async function decodeGoogleNews(link) {
  const m = String(link).match(/news\.google\.com\/(?:rss\/)?articles\/([^?/#]+)/);
  if (!m) return link;
  const id = m[1];
  try { // format lama: URL tersimpan di base64
    const raw = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    const u = raw.match(/https?:\/\/[\x21-\x7e]+/);
    if (u) return u[0];
  } catch {}
  const page = await get(`https://news.google.com/rss/articles/${id}`, { ms: 3500 });
  const sg = page?.text.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = page?.text.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;
  const req = [[['Fbv4je', `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`]]];
  const r = await get('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    ms: 3500, method: 'POST', body: 'f.req=' + encodeURIComponent(JSON.stringify(req)),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  });
  try {
    const part = r.text.split('\n\n')[1];
    const url = JSON.parse(JSON.parse(part)[0][2])[1];
    return /^https?:\/\//.test(url) ? url : null;
  } catch { return null; }
}

function metaImage(html, base) {
  const pats = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of pats) {
    const m = html.match(re);
    if (m) {
      try {
        const u = new URL(m[1].replace(/&amp;/g, '&').trim(), base).href;
        if (/^https:\/\//.test(u) && !/logo|favicon|default|placeholder/i.test(u)) return u;
      } catch {}
    }
  }
  return null;
}

const words = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9à-ÿ ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
// Cadangan: foto dari berita ANTARA/CNBC dengan judul paling mirip
export async function similarImage(title, pool) {
  const list = pool || (await backupAll().catch(() => []));
  const a = words(title); let best = null, score = 1;
  for (const it of list) {
    if (!it.image) continue;
    let n = 0; for (const w of words(it.title)) if (a.has(w)) n++;
    if (n > score) { score = n; best = it; }
  }
  return best ? { image: best.image, from: best } : null;
}

// Satu berita → foto artikelnya
export async function imageForNews(item, pool) {
  if (item.image) return item.image;
  const real = await decodeGoogleNews(item.link).catch(() => null);
  if (real) {
    const page = await get(real, { ms: 4000, max: 250000 });
    const img = page && metaImage(page.text, page.url);
    if (img) return img;
  }
  return (await similarImage(item.title, pool))?.image || null;
}

// Lengkapi materi lama/baru dengan foto dari sumber beritanya (dalam batas waktu)
export async function enrichMaterial(m, budgetMs = 7000) {
  if (!m || m.core || m.imgTried) return null;
  const pool = await backupAll().catch(() => []);
  const srcs = (m.sources || []).slice(0, 5);
  const timer = new Promise(r => setTimeout(() => r('timeout'), budgetMs));
  const found = await Promise.all(srcs.map(s => Promise.race([imageForNews({ title: s.title, link: s.link, image: s.image }, pool).catch(() => null), timer.then(() => null)])));
  const sources = (m.sources || []).map((s, i) => ({ ...s, image: s.image || found[i] || null }));
  const seen = new Set((m.images || []).map(x => x.url));
  const images = [...(m.images || [])];
  sources.forEach(s => { if (s.image && !seen.has(s.image)) { seen.add(s.image); images.push({ url: s.image, title: s.title, link: s.link, source: s.publisher }); } });
  const fields = { sources, images: images.slice(0, 6), cover: m.cover || images[0]?.url || null, imgTried: true };
  return fields;
}
