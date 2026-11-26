// Penilaian esai cadangan (tanpa AI): pencocokan kata kunci per poin
const STOP = new Set('yang dan di ke dari untuk dengan pada adalah ini itu atau dalam oleh sebagai juga akan agar karena bahwa tidak dapat lebih serta secara para sudah telah bisa harus antara the of and to in a is for are'.split(' '));

function stem(w) {
  return w.replace(/(nya|kan|lah|kah|an|i)$/, '').replace(/^(meng|meny|mem|men|me|ber|be|di|ter|pe[mn]?g?|ke|se)/, '');
}
function words(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem).filter(w => w.length > 2);
}

export function keywordGrade(answer, keyPoints, modelAnswer) {
  const ans = new Set(words(answer));
  const covered = [], missed = [];
  for (const kp of keyPoints) {
    const kw = [...new Set(words(kp))];
    const hit = kw.filter(w => ans.has(w) || [...ans].some(a => a.length > 4 && (a.startsWith(w) || w.startsWith(a)))).length;
    (kw.length && hit / kw.length >= 0.45 ? covered : missed).push(kp);
  }
  const score = keyPoints.length ? Math.round((covered.length / keyPoints.length) * 100) : 0;
  return {
    score,
    verdict: score >= 75 ? 'benar' : score >= 40 ? 'sebagian' : 'kurang',
    summary: score >= 75
      ? 'Jawabanmu sudah mencakup sebagian besar poin penting.'
      : score >= 40 ? 'Maksud jawabanmu sebagian sudah tepat, tetapi masih ada poin penting yang belum dibahas.'
        : 'Jawabanmu belum menyentuh poin-poin utama. Pelajari jawaban acuan di bawah.',
    covered, missed,
    corrections: missed.map(m => ({ issue: 'Poin belum dibahas', fix: m })),
    improved: modelAnswer,
    engine: 'keyword',
  };
}

