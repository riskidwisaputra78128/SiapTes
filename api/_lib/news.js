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

export async function fetchHeadlines(q, limit = 8) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=id&gl=ID&ceid=ID:id`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 SiapLolosBot' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = xml.split('<item>').slice(1).map(b => {
      const title = tag(b, 'title');
      const source = tag(b, 'source');
      return {
        title: source && title.endsWith(' - ' + source) ? title.slice(0, -(source.length + 3)) : title,
        link: tag(b, 'link'),
        source,
        date: Date.parse(tag(b, 'pubDate')) || Date.now(),
      };
    }).filter(i => i.title);
    return items.sort((a, b) => b.date - a.date).slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
