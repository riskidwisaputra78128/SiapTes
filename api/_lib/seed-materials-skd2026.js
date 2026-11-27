// Materi Inti CPNS berdasarkan Keputusan Menteri PANRB Nomor 674 Tahun 2026
// tentang Mekanisme Seleksi Pengadaan PNS dan Nilai Ambang Batas SKD Tahun Anggaran 2026 (ditetapkan 20 November 2026).
const KEPMEN = 'Keputusan Menteri PANRB Nomor 674 Tahun 2026 tentang Mekanisme Seleksi Pengadaan PNS dan Nilai Ambang Batas SKD Tahun Anggaran 2026';
const sec = list => list.map(([heading, body]) => ({ heading, body }));
const gl = list => list.map(([term, def]) => ({ term, def }));
const readMin = m => Math.max(3, Math.round((m.summary + m.sections.map(s => s.body).join(' ')).split(/\s+/).length / 180));

const LIST = [
  {
    id: 'core-twk-skd2026', category: 'twk', basis: 'inti',
    title: 'SKD CPNS 2026: Kisi-kisi, Bobot Nilai & Nilai Ambang Batas',
    summary: 'Ringkasan resmi Kepmen PANRB 674/2026: SKD terdiri atas 110 soal (TWK 30, TIU 35, TKP 45) dalam 100 menit dengan nilai maksimal 550. Nilai ambang batas kebutuhan umum: TWK 65, TIU 80, TKP 166 — ketiganya wajib terpenuhi.',
    sections: sec([
      ['Arah pengadaan PNS 2026', 'Pengadaan ASN 2026 difokuskan pada pemenuhan SDM untuk program prioritas Presiden sesuai Asta Cita dalam RPJMN 2025–2029 (Perpres 12/2025). Kebutuhan PNS dibagi menjadi kebutuhan umum dan kebutuhan khusus. Kebutuhan khusus instansi pusat: lulusan terbaik cum laude, penyandang disabilitas, diaspora, putra/putri Papua, dan olahragawan berprestasi. Instansi daerah: cum laude, disabilitas, dan diaspora. Instansi wajib mengalokasikan paling sedikit 2% untuk penyandang disabilitas.'],
      ['Syarat umum pelamar', 'Usia 18–35 tahun saat melamar; batas 40 tahun berlaku untuk dokter/dokter gigi spesialis, dokter pendidik klinis, serta dosen, peneliti, dan perekayasa berkualifikasi doktor. Pelamar tidak pernah dipidana penjara 2 tahun atau lebih, bukan CPNS/PNS/TNI/Polri, bukan anggota atau pengurus partai politik, memiliki kualifikasi pendidikan sesuai jabatan (ijazah dari prodi/perguruan tinggi terakreditasi saat lulus), sehat jasmani-rohani, tidak sedang mengikuti seleksi ASN lain, tidak melanggar seleksi dalam 3 tahun terakhir, dan bersedia ditempatkan di seluruh wilayah NKRI. Pelamar JF Guru wajib minimal S1/D4 dan memiliki sertifikat pendidik yang linier.'],
      ['Materi TWK (30 soal)', 'TWK menilai lima aspek: (1) nasionalisme — cinta tanah air, kesadaran berbangsa, menghargai keberagaman, menjaga persatuan; (2) integritas — keselarasan pikiran, perkataan, sikap, dan tindakan berdasar kejujuran, tanggung jawab, konsistensi, dan keteguhan moral; (3) bela negara — cinta tanah air, sadar berbangsa dan bernegara, setia pada Pancasila, rela berkorban, dan kemampuan awal bela negara; (4) empat konsensus kebangsaan — Pancasila, UUD 1945, NKRI, dan Bhinneka Tunggal Ika; serta (5) Bahasa Indonesia — kebahasaan dan kemampuan berbahasa untuk memahami, menggunakan, mengevaluasi, dan merefleksi informasi.'],
      ['Materi TIU (35 soal)', 'TIU mencakup tiga kemampuan. Verbal: silogisme (penalaran deduktif, kesimpulan pasti benar tanpa asumsi tambahan), penalaran induktif (menemukan pola/generalisasi yang paling berpeluang benar), dan analitis (memetakan hubungan variabel serta menyusun keputusan yang valid berdasarkan syarat dan batasan). Numerik: berhitung, deret angka, perbandingan kuantitatif (membandingkan dua atau tiga data kuantitatif), dan soal cerita. Figural: serial (pola gambar berurutan), analogi (hubungan dua gambar diterapkan ke situasi lain), dan penalaran matriks.'],
      ['Materi TKP (45 soal)', 'TKP mengukur enam aspek: pelayanan publik (ramah, cekatan, tanpa pamrih, terus memperbaiki layanan), jejaring kerja (kolaborasi internal dan eksternal), sosial budaya (hubungan sosial positif dan menghargai keragaman), adaptasi teknologi informasi dan komunikasi (memanfaatkan TIK secara bijak dan etis), profesionalisme (keahlian, akuntabilitas, integritas, komitmen), serta antiradikalisme (menolak kekerasan dan pemaksaan kehendak, menerima perbedaan yang tidak bertentangan dengan ideologi bangsa).'],
      ['Waktu, bobot, dan nilai maksimal', 'SKD dikerjakan dengan CAT BKN selama 100 menit (130 menit bagi penyandang disabilitas sensorik netra pada formasi khusus disabilitas). Untuk TWK dan TIU, jawaban benar bernilai 5, salah atau kosong bernilai 0 — jadi tidak ada pengurangan nilai, sebaiknya semua soal diisi. Untuk TKP, setiap pilihan bernilai 1 sampai 5 dan tidak menjawab bernilai 0. Nilai maksimal: TWK 150, TIU 175, TKP 225, total 550.'],
      ['Nilai ambang batas (passing grade)', 'Kebutuhan umum: TWK minimal 65, TIU minimal 80, TKP minimal 166 — setiap subtes harus lolos, tidak cukup hanya total. Kebutuhan khusus cum laude dan diaspora: total SKD minimal 311 dan TIU minimal 85. Kebutuhan khusus penyandang disabilitas dan putra/putri Papua: total SKD minimal 286 dan TIU minimal 60. Olahragawan berprestasi memakai nilai terendah dari pelamar pada formasi tersebut.'],
      ['Nilai SKD 2024, SKB, dan pengisian formasi', 'Pelamar 2026 boleh memakai nilai SKD tahun anggaran 2024 jika memakai NIK dan jenjang pendidikan yang sama, memenuhi nilai ambang batas 2026, dan lulus administrasi; konsekuensinya tidak dapat ikut SKD 2026. Peserta yang lolos ambang batas dan berperingkat terbaik maksimal 3 kali jumlah kebutuhan jabatan maju ke SKB. SKB berlangsung 90 menit dengan 80 soal (jabatan dominan perhitungan) atau 100 soal; benar 5, salah 0. Peserta seleksi SDM Koperasi Desa/Kelurahan Merah Putih dan Kampung Nelayan Merah Putih dengan nilai TPK ≥ 120 mendapat tambahan 10% dari nilai maksimal SKB.'],
    ]),
    keyPoints: ['110 soal: TWK 30 · TIU 35 · TKP 45 — 100 menit', 'Bobot TWK/TIU: benar 5, salah/kosong 0 → isi semua soal', 'TKP: tiap opsi bernilai 1–5, kosong 0', 'Maksimal 550 = TWK 150 + TIU 175 + TKP 225', 'NAB umum: TWK 65 · TIU 80 · TKP 166 (semua wajib lolos)', 'Khusus cum laude/diaspora: total ≥ 311 & TIU ≥ 85', 'Khusus disabilitas/Papua: total ≥ 286 & TIU ≥ 60'],
    stats: [
      { value: '110', unit: 'soal', label: 'TWK 30 · TIU 35 · TKP 45' },
      { value: '100', unit: 'menit', label: 'durasi SKD (CAT BKN)' },
      { value: '550', unit: 'poin', label: 'nilai maksimal SKD' },
      { value: '65/80/166', unit: '', label: 'ambang batas TWK/TIU/TKP' },
    ],
    flow: [
      { icon: '📝', title: 'Daftar di SSCASN', desc: 'Pilih jabatan dan jenis kebutuhan (umum atau khusus), unggah dokumen sesuai persyaratan.' },
      { icon: '🗂️', title: 'Seleksi administrasi', desc: 'Instansi memverifikasi persyaratan; pengguna nilai SKD 2024 diumumkan bersama hasil administrasi.' },
      { icon: '💻', title: 'SKD (CAT BKN)', desc: '110 soal dalam 100 menit. Harus memenuhi nilai ambang batas sesuai jenis kebutuhan.' },
      { icon: '🏅', title: 'Peringkat 3× formasi', desc: 'Yang lolos ambang batas dan berperingkat terbaik maksimal 3 kali kebutuhan jabatan maju ke SKB.' },
      { icon: '🎯', title: 'SKB', desc: '90 menit, 80 atau 100 soal sesuai jabatan; benar 5, salah 0.' },
      { icon: '✅', title: 'Hasil akhir', desc: 'Diolah sesuai Permen PANRB 18/2026; formasi kosong dapat diisi dari pelamar lain sesuai urutan ketentuan.' },
    ],
    glossary: gl([
      ['SKD', 'Seleksi Kompetensi Dasar: TWK, TIU, dan TKP.'],
      ['SKB', 'Seleksi Kompetensi Bidang sesuai kebutuhan jabatan.'],
      ['Nilai Ambang Batas', 'Nilai paling rendah kelulusan yang wajib dipenuhi setiap pelamar.'],
      ['CAT BKN', 'Tes berbasis komputer yang diselenggarakan Badan Kepegawaian Negara.'],
      ['SSCASN', 'Portal pelamaran terintegrasi pengadaan ASN.'],
      ['Kebutuhan khusus', 'Alokasi formasi untuk cum laude, disabilitas, diaspora, putra/putri Papua, dan olahragawan berprestasi.'],
    ]),
    tips: ['Karena salah tidak dikurangi, jangan biarkan soal TWK/TIU kosong.', 'Targetkan nilai jauh di atas ambang batas: peringkat menentukan siapa yang maju ke SKB.', 'Latih manajemen waktu: rata-rata ±54 detik per soal untuk 110 soal dalam 100 menit.', 'Coba mode Simulasi SKD CAT 2026 di halaman Latihan.'],
    quiz: [
      { q: 'Berapa jumlah soal TIU dalam SKD 2026?', options: ['30 soal', '35 soal', '45 soal', '50 soal'], answer: 1, why: 'Rincian SKD: TWK 30, TIU 35, TKP 45 (total 110).' },
      { q: 'Nilai ambang batas TKP untuk kebutuhan umum adalah…', options: ['65', '80', '156', '166'], answer: 3, why: 'NAB kebutuhan umum: TWK 65, TIU 80, TKP 166.' },
      { q: 'Peserta menjawab salah pada soal TIU. Nilainya…', options: ['−1', '0', '1', '2'], answer: 1, why: 'TWK dan TIU: benar 5, salah atau tidak menjawab 0.' },
      { q: 'Nilai maksimal SKD adalah…', options: ['500', '525', '550', '600'], answer: 2, why: 'TWK 150 + TIU 175 + TKP 225 = 550.' },
    ],
    refs: [KEPMEN, 'Peraturan Menteri PANRB Nomor 18 Tahun 2026 tentang Pengadaan Pegawai ASN', 'Undang-Undang Nomor 20 Tahun 2023 tentang Aparatur Sipil Negara'],
  },
  {
    id: 'core-twk-bahasa', category: 'twk', basis: 'inti',
    title: 'TWK Bahasa Indonesia: Ejaan, Kata Baku, Kalimat Efektif & Bacaan',
    summary: 'Mulai SKD 2026, Bahasa Indonesia menjadi salah satu aspek resmi TWK: pengetahuan kebahasaan dan kemampuan berbahasa untuk memahami, menggunakan, mengevaluasi, dan merefleksi informasi. Pelajari kaidah EYD, kata baku, kalimat efektif, dan cara membaca teks dengan cepat.',
    sections: sec([
      ['Kedudukan bahasa Indonesia', 'Bahasa Indonesia adalah bahasa persatuan (Sumpah Pemuda 1928) dan bahasa negara (Pasal 36 UUD 1945). Penggunaannya diatur dalam UU Nomor 24 Tahun 2009 tentang Bendera, Bahasa, dan Lambang Negara, serta Lagu Kebangsaan — antara lain wajib digunakan dalam peraturan perundang-undangan, dokumen resmi negara, pidato resmi pejabat, dan pelayanan administrasi publik. Pedoman ejaan yang berlaku adalah Ejaan Bahasa Indonesia yang Disempurnakan (EYD) Edisi V.'],
      ['Kaidah ejaan yang sering diuji', 'Huruf kapital: awal kalimat, nama orang, nama geografi yang diikuti nama diri (Sungai Musi, tetapi "mandi di sungai"), nama lembaga, judul (kecuali kata tugas seperti di, ke, dari, dan, yang), serta gelar yang diikuti nama orang. Kata depan di/ke ditulis terpisah dari kata yang menunjukkan tempat (di rumah, ke kantor), sedangkan awalan di- ditulis serangkai dengan kata kerja (ditulis, dikirim). Partikel "pun" ditulis terpisah kecuali pada kata penghubung baku: adapun, bagaimanapun, meskipun, walaupun, sekalipun (= meskipun). Gabungan kata yang mendapat awalan dan akhiran sekaligus ditulis serangkai (dipertanggungjawabkan, menyebarluaskan). Unsur terikat seperti antar-, pasca-, multi-, dan non- ditulis serangkai (antarwilayah, pascapanen, nonformal).'],
      ['Kata baku yang sering keluar', 'Bentuk baku: aktivitas, analisis, apotek, efektif, frekuensi, hakikat, ijazah, izin, jadwal, kualitas, kuitansi, nasihat, objek, praktik, risiko, sistem, standardisasi, subjek, teknik, telanjur, zaman, lembap, karier, kategori, survei, silakan, imbau, embus, sekadar, persentase. Bentuk tidak baku: aktifitas, analisa, apotik, efektip, frekwensi, hakekat, ijasah, ijin, jadual, kwalitas, kwitansi, nasehat, obyek, praktek, resiko, sistim, standarisasi, subyek, tehnik, terlanjur, jaman, lembab, karir, katagori, survey, silahkan, himbau, hembus, sekedar, prosentase.'],
      ['Kalimat efektif', 'Ciri kalimat efektif: kesatuan gagasan (minimal subjek dan predikat), kehematan (tidak boros: "para hadirin" → "hadirin", "sangat indah sekali" → "sangat indah", "naik ke atas" → "naik"), kecermatan (tidak ambigu), kepaduan, kesejajaran bentuk (pemanasan, penyiraman, pemupukan — bukan campuran), dan kelogisan ("Kepada Bapak Camat, waktu dan tempat kami persilakan" tidak logis). Hindari subjek yang tertutup kata depan: "Dalam rapat itu membahas anggaran" salah karena tidak bersubjek; seharusnya "Rapat itu membahas anggaran".'],
      ['Membaca teks: ide pokok, simpulan, dan evaluasi', 'Ide pokok biasanya terletak pada kalimat utama di awal (deduktif), akhir (induktif), atau keduanya (campuran). Simpulan harus didukung isi teks, bukan pendapat pribadi. Untuk soal evaluasi, bedakan fakta (dapat dibuktikan, sering memuat data) dan opini (penilaian, memakai kata seperti sebaiknya, menurut saya, tampaknya). Untuk soal refleksi, pilih tanggapan yang relevan, logis, dan santun terhadap isi teks.'],
      ['Imbuhan, makna kata, dan konjungsi', 'Peluluhan: kata dasar berawalan k, p, t, s luluh bila diberi meN- (kirim → mengirim, pukul → memukul, tulis → menulis, sapu → menyapu), kecuali kluster konsonan (mempraktikkan, mentransfer). Sinonim, antonim, dan makna kias sering diuji dalam konteks kalimat. Konjungsi antarkalimat diikuti koma: oleh karena itu, dengan demikian, akan tetapi, selain itu. "Sehingga" dan "sedangkan" adalah konjungsi intrakalimat, jadi tidak tepat dipakai di awal kalimat.'],
    ]),
    keyPoints: ['Bahasa negara: Pasal 36 UUD 1945; diatur UU 24/2009', 'Pedoman ejaan: EYD Edisi V', 'di- (awalan) serangkai, di (kata depan) terpisah', 'K-P-T-S luluh dengan meN- (kecuali kluster)', 'Kalimat efektif: hemat, logis, sejajar, bersubjek', 'Baku: analisis, praktik, risiko, izin, silakan, imbau'],
    stats: [
      { value: 'Pasal 36', unit: '', label: 'UUD 1945: bahasa negara' },
      { value: 'EYD V', unit: '', label: 'pedoman ejaan yang berlaku' },
      { value: '1928', unit: '', label: 'bahasa persatuan (Sumpah Pemuda)' },
    ],
    glossary: gl([
      ['Kata baku', 'Kata yang sesuai kaidah dan KBBI.'],
      ['Kalimat efektif', 'Kalimat yang hemat, jelas, logis, dan tepat menyampaikan gagasan.'],
      ['Ide pokok', 'Gagasan utama yang menjadi inti suatu paragraf.'],
      ['Paragraf deduktif', 'Paragraf dengan kalimat utama di awal.'],
      ['Paragraf induktif', 'Paragraf dengan kalimat utama di akhir.'],
      ['Pleonasme', 'Pemakaian kata berlebihan yang maknanya sudah terkandung, misalnya "naik ke atas".'],
    ]),
    tips: ['Untuk soal kata baku, ingat pola: "-isa" → "-isis" (analisis), "-ek" → "-ik" (praktik).', 'Cari subjek dan predikat dulu untuk menilai kalimat efektif.', 'Pada soal bacaan, baca pertanyaan terlebih dulu baru teksnya.'],
    quiz: [
      { q: 'Kata yang baku adalah…', options: ['Analisa', 'Resiko', 'Praktik', 'Ijin'], answer: 2, why: 'Bentuk baku: analisis, risiko, praktik, izin.' },
      { q: 'Penulisan yang benar adalah…', options: ['di kirim', 'dikantor', 'di rumah', 'kesana'], answer: 2, why: 'Kata depan "di" terpisah dari tempat: di rumah; awalan di- serangkai: dikirim; "ke sana" terpisah.' },
      { q: 'Kalimat yang efektif adalah…', options: ['Para hadirin dimohon berdiri.', 'Hadirin dimohon berdiri.', 'Para hadirin-hadirin dimohon berdiri.', 'Kepada hadirin dimohon berdiri.'], answer: 1, why: '"Hadirin" sudah jamak, jadi "para" berlebihan; "kepada" menghilangkan subjek.' },
    ],
    refs: [KEPMEN, 'Undang-Undang Nomor 24 Tahun 2009', 'Ejaan Bahasa Indonesia yang Disempurnakan (EYD) Edisi V', 'Kamus Besar Bahasa Indonesia (KBBI) daring'],
  },
  {
    id: 'core-tiu-figural', category: 'tiu', basis: 'inti',
    title: 'TIU 2026: Penalaran Induktif, Perbandingan Kuantitatif & Figural',
    summary: 'Kepmen PANRB 674/2026 merinci TIU menjadi verbal (silogisme, induktif, analitis), numerik (berhitung, deret, perbandingan kuantitatif, soal cerita), dan figural (serial, analogi, matriks). Materi ini fokus pada bagian yang sering terlewat: induktif, perbandingan kuantitatif, dan figural.',
    sections: sec([
      ['Penalaran induktif', 'Berbeda dengan silogisme yang menuntut kesimpulan pasti benar, penalaran induktif mencari pola, tren, atau prinsip umum dari beberapa informasi untuk memilih generalisasi atau perkiraan yang paling berpeluang benar. Contoh: data menunjukkan penjualan payung naik setiap musim hujan selama lima tahun → perkiraan paling kuat: penjualan payung akan naik pada musim hujan berikutnya. Waspadai pilihan yang terlalu mutlak ("pasti", "selalu", "semua") karena induksi hanya menghasilkan peluang.'],
      ['Penalaran analitis', 'Soal analitis memberi seperangkat syarat (urutan, posisi duduk, jadwal, pengelompokan). Langkahnya: tulis informasi yang pasti, buat tabel atau diagram, lalu uji setiap pilihan jawaban terhadap semua syarat. Pilihan yang melanggar satu syarat saja langsung gugur.'],
      ['Perbandingan kuantitatif', 'Soal memberi dua (atau tiga) besaran, misalnya P dan Q, lalu meminta hubungan: P > Q, P < Q, P = Q, atau hubungan tidak dapat ditentukan. Hitung kedua besaran secara terpisah dan sederhanakan. Jika besaran memuat variabel tanpa batasan (misalnya x bilangan real), uji beberapa nilai: bila hasil perbandingan berubah-ubah, jawabannya "tidak dapat ditentukan".'],
      ['Figural: serial', 'Serial gambar berubah mengikuti aturan tertentu: rotasi (misalnya 45° atau 90° searah jarum jam), penambahan atau pengurangan elemen, perpindahan posisi, perubahan warna atau arsiran, maupun pola berulang. Amati satu unsur dalam satu waktu: bentuk, jumlah, posisi, lalu warna.'],
      ['Figural: analogi', 'Analogi figural memakai pola "gambar A berhubungan dengan B, maka C berhubungan dengan …". Tentukan perubahan dari A ke B (dicerminkan, diputar, ukurannya diperbesar, warnanya dibalik, atau sisinya bertambah), lalu terapkan perubahan yang sama pada C.'],
      ['Figural: penalaran matriks', 'Matriks 3×3 berisi gambar yang mengikuti aturan per baris dan per kolom, satu sel kosong harus diisi. Aturan umum: setiap baris memuat ketiga jenis bentuk tepat sekali, jumlah elemen bertambah ke kanan, atau sel ketiga merupakan gabungan/selisih dua sel sebelumnya. Periksa baris dan kolom sekaligus agar jawaban konsisten.'],
    ]),
    keyPoints: ['Silogisme = pasti benar; induktif = paling mungkin benar', 'Analitis: tulis syarat, buat tabel, uji tiap pilihan', 'Perbandingan kuantitatif: uji beberapa nilai variabel', 'Serial: rotasi, jumlah, posisi, warna', 'Analogi: A→B, terapkan ke C', 'Matriks: cek aturan baris dan kolom sekaligus'],
    stats: [
      { value: '35', unit: 'soal', label: 'TIU dalam SKD 2026' },
      { value: '80', unit: 'poin', label: 'ambang batas TIU (umum)' },
      { value: '175', unit: 'poin', label: 'nilai maksimal TIU' },
    ],
    flow: [
      { icon: '🔍', title: 'Amati', desc: 'Lihat unsur yang berubah: bentuk, jumlah, posisi, rotasi, atau warna.' },
      { icon: '🧩', title: 'Temukan aturan', desc: 'Rumuskan satu aturan yang berlaku untuk semua langkah, bukan hanya satu.' },
      { icon: '🧪', title: 'Uji', desc: 'Terapkan aturan ke pilihan jawaban; gugurkan yang melanggar.' },
      { icon: '✅', title: 'Pilih', desc: 'Pilih jawaban yang konsisten di baris dan kolom (untuk matriks).' },
    ],
    glossary: gl([
      ['Induksi', 'Penarikan kesimpulan umum dari kasus-kasus khusus; hasilnya berupa peluang.'],
      ['Deduksi', 'Penarikan kesimpulan khusus dari premis umum; hasilnya pasti benar bila premis benar.'],
      ['Rotasi', 'Perputaran gambar dengan sudut tertentu.'],
      ['Matriks figural', 'Susunan gambar dalam baris dan kolom yang mengikuti aturan tertentu.'],
    ]),
    tips: ['Untuk figural, tutup pilihan jawaban dulu dan tebak sendiri gambarnya, baru cocokkan.', 'Perbandingan kuantitatif: jangan menghitung terlalu detail jika urutan besar sudah jelas.', 'Hafalkan kuadrat 1–25 untuk mempercepat numerik.'],
    quiz: [
      { q: 'P = 25% dari 80, Q = 40% dari 50. Hubungan P dan Q adalah…', options: ['P > Q', 'P < Q', 'P = Q', 'Tidak dapat ditentukan'], answer: 2, why: 'P = 20 dan Q = 20.' },
      { q: 'Penalaran induktif menghasilkan kesimpulan yang…', options: ['Pasti benar', 'Paling berpeluang benar', 'Selalu salah', 'Tidak memerlukan data'], answer: 1, why: 'Induksi merumuskan generalisasi atau perkiraan yang paling mungkin.' },
      { q: 'Jika x bilangan real, P = x² dan Q = x, maka…', options: ['P > Q', 'P < Q', 'P = Q', 'Tidak dapat ditentukan'], answer: 3, why: 'x = 2 → P > Q; x = 0,5 → P < Q; x = 1 → P = Q.' },
    ],
    refs: [KEPMEN],
  },
];

export const SKD2026_MATERIALS = LIST.map(m => ({ core: true, ...m, readMin: readMin(m) }));
