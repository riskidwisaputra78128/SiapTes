// Ambil berita terbaru dari Google News RSS (bahasa Indonesia)
export const NEWS_TOPICS = {
  bi: ['Bank Indonesia kebijakan', 'BI-Rate rupiah inflasi'],
  ojk: ['OJK regulasi', 'OJK pinjol perlindungan konsumen'],
  bumn: ['BUMN Danantara', 'Kementerian BUMN'],
  telkom: ['Telkom Indonesia', 'transformasi digital Indonesia Komdigi'],
  keuangan: ['perbankan Indonesia kredit', 'LPS QRIS pembayaran digital'],
  isu: ['ekonomi Indonesia hari ini', 'kebijakan pemerintah Indonesia terbaru'],
  twk: ['DPR undang-undang disahkan', 'Mahkamah Konstitusi putusan'],
};

function decode(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/<[^>]+>/g, '').trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
}

async function fetchRSS(url, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiapLolosBot/1.0)', Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!r.ok) { console.warn('[news]', url, r.status); return null; }
    return await r.text();
  } catch (e) { console.warn('[news]', url, e.name); return null; }
  finally { clearTimeout(t); }
}
function parseItems(xml, defaultSource) {
  return xml.split('<item>').slice(1).map(b => {
    const title = tag(b, 'title'); const source = tag(b, 'source') || defaultSource;
    return {
      title: source && title.endsWith(' - ' + source) ? title.slice(0, -(source.length + 3)) : title,
      link: tag(b, 'link') || tag(b, 'guid'), source, date: Date.parse(tag(b, 'pubDate')) || Date.now(),
    };
  }).filter(i => i.title && i.link);
}

// Sumber cadangan bila Google News tidak bisa diakses
const BACKUP_FEEDS = [
  { url: 'https://www.antaranews.com/rss/ekonomi.xml', source: 'ANTARA' },
  { url: 'https://www.cnbcindonesia.com/news/rss', source: 'CNBC Indonesia' },
  { url: 'https://www.cnbcindonesia.com/market/rss', source: 'CNBC Indonesia' },
  { url: 'https://www.antaranews.com/rss/terkini.xml', source: 'ANTARA' },
];
export const CAT_KEYWORDS = {
  bi: ['bank indonesia', 'bi-rate', 'bi rate', 'rupiah', 'inflasi', 'suku bunga', 'qris', 'moneter', 'cadangan devisa'],
  ojk: ['ojk', 'otoritas jasa keuangan', 'pinjol', 'pinjaman online', 'asuransi', 'pasar modal', 'fintech', 'investasi ilegal', 'kripto'],
  bumn: ['bumn', 'danantara', 'persero', 'pertamina', 'pln', 'bri', 'mandiri', 'bni', 'garuda', 'holding'],
  telkom: ['telkom', 'telkomsel', 'digital', 'internet', 'komdigi', '5g', 'siber', 'data pribadi', 'satelit'],
  keuangan: ['bank', 'kredit', 'lps', 'qris', 'perbankan', 'tabungan', 'pinjaman', 'deposito', 'kartu'],
  twk: ['dpr', 'undang-undang', 'ruu', 'mahkamah', 'presiden', 'menteri', 'pemerintah', 'pancasila', 'konstitusi'],
  isu: [],
};
let backupCache = null;
export async function fetchBackup(cat, limit = 10) {
  if (!backupCache || Date.now() - backupCache.at > 10 * 60 * 1000) {
    const lists = await Promise.all(BACKUP_FEEDS.map(async f => { const x = await fetchRSS(f.url); return x ? parseItems(x, f.source) : []; }));
    const seen = new Set();
    backupCache = { at: Date.now(), items: lists.flat().filter(i => (seen.has(i.title) ? false : seen.add(i.title))).sort((a, b) => b.date - a.date) };
  }
  const kw = CAT_KEYWORDS[cat] || [];
  const recent = backupCache.items.filter(i => Date.now() - i.date < 7 * 86400000);
  const match = kw.length ? recent.filter(i => kw.some(k => i.title.toLowerCase().includes(k))) : recent;
  return (match.length >= 3 ? match : kw.length ? match : recent).slice(0, limit);
}

export async function fetchHeadlines(q, limit = 8) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=id&gl=ID&ceid=ID:id`;
  const xml = await fetchRSS(url);
  if (!xml) return [];
  return parseItems(xml, '').sort((a, b) => b.date - a.date).slice(0, limit);
}
