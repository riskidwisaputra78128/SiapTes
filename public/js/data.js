export const CATEGORIES = [
  { key: 'campuran', name: 'Campuran Semua Materi', ico: '🎯', tags: 'Semua tes', color: '#818cf8' },
  { key: 'isu', name: 'Isu Terkini & Berita', ico: '📰', tags: 'Update harian', color: '#22d3ee', fresh: true },
  { key: 'twk', name: 'Wawasan Kebangsaan (TWK)', ico: '🇮🇩', tags: 'CPNS · BUMN', color: '#f87171' },
  { key: 'tiu', name: 'Intelegensia Umum (TIU)', ico: '🧠', tags: 'CPNS · BUMN · TKD', color: '#a78bfa' },
  { key: 'tkp', name: 'Karakteristik Pribadi (TKP)', ico: '🤝', tags: 'CPNS · BUMN', color: '#34d399' },
  { key: 'ojk', name: 'OJK & Regulasi Keuangan', ico: '🏛️', tags: 'OJK · Perbankan', color: '#fbbf24' },
  { key: 'bi', name: 'Bank Indonesia & Moneter', ico: '💱', tags: 'BI PCPM · Bank', color: '#38bdf8' },
  { key: 'bumn', name: 'BUMN & AKHLAK', ico: '🏢', tags: 'Rekrutmen Bersama', color: '#fb923c' },
  { key: 'telkom', name: 'Telkom & Digital', ico: '📡', tags: 'Telkom · IT', color: '#f472b6' },
  { key: 'keuangan', name: 'Perbankan & Keuangan', ico: '🏦', tags: 'Bank · Literasi', color: '#2dd4bf' },
  { key: 'english', name: 'Bahasa Inggris', ico: '🔤', tags: 'BI · OJK · BUMN', color: '#c084fc' },
];
export const catByKey = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

export const MODES = [
  { key: 'pg', name: 'Pilihan Ganda', ico: '📝', cls: 'mi-pg', desc: 'Simulasi ujian A–D dengan timer, navigasi soal, dan pembahasan.' },
  { key: 'game', name: 'Arena Game', ico: '🎮', cls: 'mi-game', desc: '3 nyawa, waktu per soal, combo poin, dan power-up 50:50.' },
  { key: 'essay', name: 'Esai + Koreksi', ico: '✍️', cls: 'mi-essay', desc: 'Jawab dengan kata-katamu sendiri, dikoreksi maksudnya otomatis.' },
  { key: 'interaktif', name: 'Interaktif Visual', ico: '🧩', cls: 'mi-visual', desc: 'Susun urutan & kalimat, cocokkan, kelompokkan, dan bangun grafik.' },
];
export const modeByKey = Object.fromEntries([...MODES, { key: 'duel', name: 'Duel', ico: '⚔️', cls: 'mi-game', desc: 'Duel multiplayer' }].map(m => [m.key, m]));

export const DIFFS = [
  { key: 'easy', name: 'Easy', sub: 'Dasar', sec: 60, gameSec: 30, pts: 10 },
  { key: 'normal', name: 'Normal', sub: 'Standar tes', sec: 50, gameSec: 22, pts: 15 },
  { key: 'hard', name: 'Hard', sub: 'Menantang', sec: 45, gameSec: 16, pts: 20 },
  { key: 'prof', name: 'Prof', sub: 'Analisis lanjut', sec: 40, gameSec: 12, pts: 30 },
];
export const diffByKey = Object.fromEntries(DIFFS.map(d => [d.key, d]));

export const TARGETS = ['CPNS', 'BUMN', 'OJK (PCS)', 'Bank Indonesia (PCPM)', 'Telkom', 'Bank BUMN/Swasta', 'Lainnya'];
