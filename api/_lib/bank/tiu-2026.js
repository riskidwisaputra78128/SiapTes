// TIU 2026 — mengikuti kisi-kisi Kepmen PANRB 674/2026:
// verbal (silogisme, penalaran induktif, analitis), numerik (berhitung, deret angka,
// perbandingan kuantitatif, soal cerita), dan figural (serial, analogi, penalaran matriks).
const PQ = ['P > Q', 'P < Q', 'P = Q', 'Hubungan P dan Q tidak dapat ditentukan'];
export default {
  pg: [
    // ── Verbal: silogisme ──
    ['n', 'Semua ASN wajib menaati kode etik. Rina adalah ASN. Kesimpulan yang tepat adalah…', ['Rina mungkin menaati kode etik', 'Rina wajib menaati kode etik', 'Rina tidak wajib menaati kode etik', 'Tidak dapat disimpulkan'], 1, 'Silogisme kategoris: semua A adalah B, Rina adalah A, maka Rina adalah B.'],
    ['h', 'Semua peserta yang lulus SKD mengikuti SKB. Sebagian peserta yang mengikuti SKB berasal dari Medan. Kesimpulan yang pasti benar adalah…', ['Semua peserta dari Medan lulus SKD', 'Sebagian peserta dari Medan lulus SKD', 'Peserta dari Medan tidak lulus SKD', 'Tidak dapat ditarik kesimpulan yang pasti'], 3, 'Premis tidak menyatakan bahwa semua peserta SKB lulus SKD, jadi tidak ada kesimpulan yang pasti tentang peserta dari Medan.'],
    ['n', 'Jika server penuh, situs menampilkan pemberitahuan. Situs tidak menampilkan pemberitahuan. Kesimpulannya…', ['Server penuh', 'Server tidak penuh', 'Situs rusak', 'Server mungkin penuh'], 1, 'Modus tollens: p → q, ~q, maka ~p.'],
    ['h', 'Ingkaran dari "Semua pegawai hadir tepat waktu" adalah…', ['Semua pegawai tidak hadir tepat waktu', 'Ada pegawai yang tidak hadir tepat waktu', 'Tidak ada pegawai yang hadir tepat waktu', 'Beberapa pegawai hadir tepat waktu'], 1, 'Ingkaran "semua" adalah "ada/beberapa … tidak".'],
    ['n', 'Jika rajin berlatih, nilai TIU meningkat. Jika nilai TIU meningkat, peluang lolos SKD besar. Kesimpulannya…', ['Jika rajin berlatih, peluang lolos SKD besar', 'Jika peluang lolos SKD besar, rajin berlatih', 'Jika tidak rajin berlatih, tidak lolos SKD', 'Nilai TIU meningkat'], 0, 'Silogisme hipotetis: p → q, q → r, maka p → r.'],
    ['h', 'Tidak ada pejabat yang korupsi yang dipercaya rakyat. Sebagian kepala dinas dipercaya rakyat. Kesimpulan yang tepat adalah…', ['Semua kepala dinas tidak korupsi', 'Sebagian kepala dinas bukan pejabat yang korupsi', 'Sebagian kepala dinas adalah pejabat yang korupsi', 'Tidak dapat disimpulkan'], 1, 'Kepala dinas yang dipercaya rakyat pasti bukan pejabat yang korupsi; karena itu hanya "sebagian" yang dapat disimpulkan.'],
    ['n', 'Pernyataan yang setara dengan "Jika dokumen lengkap, maka berkas diproses" adalah…', ['Jika berkas diproses, maka dokumen lengkap', 'Jika dokumen tidak lengkap, maka berkas tidak diproses', 'Jika berkas tidak diproses, maka dokumen tidak lengkap', 'Dokumen lengkap dan berkas tidak diproses'], 2, 'Kontraposisi (~q → ~p) setara dengan implikasi p → q.'],
    ['p', 'Ingkaran dari "Jika harga naik, maka permintaan turun" adalah…', ['Harga naik dan permintaan tidak turun', 'Harga tidak naik atau permintaan turun', 'Jika harga tidak naik, maka permintaan tidak turun', 'Harga tidak naik dan permintaan turun'], 0, 'Ingkaran p → q adalah p ∧ ~q.'],
    // ── Verbal: penalaran induktif ──
    ['n', 'Selama lima tahun, jumlah pelamar CPNS di suatu kabupaten selalu naik setiap kali formasi guru dibuka. Tahun depan formasi guru dibuka lagi. Perkiraan yang paling mungkin adalah…', ['Jumlah pelamar akan turun drastis', 'Jumlah pelamar kemungkinan besar naik', 'Pasti tidak ada pelamar', 'Formasi guru akan ditutup'], 1, 'Penalaran induktif: pola berulang menghasilkan perkiraan yang paling berpeluang benar, bukan kepastian.'],
    ['n', 'Besi, tembaga, dan aluminium memuai ketika dipanaskan. Generalisasi yang paling tepat adalah…', ['Semua benda pasti memuai', 'Logam cenderung memuai bila dipanaskan', 'Logam menyusut bila dipanaskan', 'Hanya besi yang memuai'], 1, 'Generalisasi dibatasi pada kelompok yang diamati (logam) dan tidak berlebihan.'],
    ['h', 'Data historis menunjukkan setiap kali suku bunga acuan naik, pertumbuhan kredit konsumsi melambat beberapa bulan kemudian. Bulan ini suku bunga acuan naik. Pernyataan yang paling berpeluang benar adalah…', ['Kredit konsumsi pasti naik bulan ini', 'Pertumbuhan kredit konsumsi cenderung melambat beberapa bulan ke depan', 'Inflasi pasti menjadi nol', 'Suku bunga akan turun besok'], 1, 'Mengikuti pola historis, dengan bahasa peluang ("cenderung").'],
    ['h', 'Generalisasi yang PALING LEMAH adalah…', ['Survei 5.000 responden di seluruh provinsi menunjukkan mayoritas mendukung layanan daring', 'Tiga teman saya tidak suka kopi, jadi orang Indonesia tidak suka kopi', 'Data BPS sepuluh tahun menunjukkan tren urbanisasi naik', 'Uji klinis pada ribuan pasien menunjukkan obat itu efektif'], 1, 'Sampel tiga orang terlalu kecil dan tidak mewakili populasi.'],
    ['n', 'Kantor A menerapkan antrean daring dan keluhan warga turun 40%. Kantor B memiliki karakteristik serupa dan akan menerapkan antrean daring. Kesimpulan yang paling masuk akal adalah…', ['Keluhan di kantor B kemungkinan juga menurun', 'Keluhan di kantor B pasti naik', 'Kantor B akan ditutup', 'Antrean daring tidak berpengaruh'], 0, 'Analogi induktif: kondisi serupa cenderung menghasilkan akibat serupa.'],
    ['h', 'Setelah jaringan internet masuk ke beberapa desa, transaksi daring UMKM di desa tersebut meningkat. Desa yang belum terjangkau internet tidak mengalami peningkatan serupa. Penjelasan yang paling mungkin adalah…', ['Akses internet mendorong peningkatan transaksi daring UMKM', 'UMKM tidak membutuhkan internet', 'Peningkatan disebabkan musim hujan', 'Desa tanpa internet lebih maju'], 0, 'Perbandingan dua kelompok menunjukkan faktor pembeda yang paling mungkin menjadi penyebab.'],
    ['p', 'Peserta pelatihan memperoleh nilai SKD lebih tinggi daripada yang tidak ikut, sehingga disimpulkan "pelatihan meningkatkan nilai SKD". Pernyataan yang paling MEMPERLEMAH kesimpulan itu adalah…', ['Peserta pelatihan dipilih dari pelamar yang nilai awalnya memang sudah tinggi', 'Pelatihan berlangsung selama tiga bulan', 'Materi pelatihan sesuai kisi-kisi', 'Peserta puas dengan pelatihan'], 0, 'Jika peserta sudah unggul sejak awal, perbedaan nilai belum tentu disebabkan pelatihan.'],
    // ── Verbal: analitis ──
    ['n', 'Lima pegawai A, B, C, D, dan E duduk berderet. A duduk di ujung kiri, C tepat di tengah, B di sebelah kanan C, dan E tidak duduk di samping A. Siapa yang duduk di samping A?', ['B', 'C', 'D', 'E'], 2, 'Posisi 1 = A, 3 = C, 4 = B. E tidak boleh di posisi 2, jadi E di posisi 5 dan D di posisi 2.'],
    ['h', 'P, Q, R, S, dan T masing-masing piket satu hari dari Senin sampai Jumat. Q piket hari Rabu. S piket tepat sehari setelah T. P piket sebelum R. R tidak piket hari Jumat. Siapa yang piket hari Jumat?', ['P', 'R', 'S', 'T'], 2, 'T–S hanya bisa Senin–Selasa atau Kamis–Jumat. Jika Senin–Selasa, P dan R menempati Kamis–Jumat sehingga R jatuh di Jumat (tidak boleh). Jadi T Kamis, S Jumat, P Senin, R Selasa.'],
    ['n', 'Andi lebih tinggi dari Budi. Citra lebih pendek dari Budi. Dodi lebih tinggi dari Andi. Siapa yang paling pendek?', ['Andi', 'Budi', 'Citra', 'Dodi'], 2, 'Urutan: Dodi > Andi > Budi > Citra.'],
    ['h', 'Dari lima kandidat K, L, M, N, dan O akan dipilih tiga orang. Syarat: K dan L tidak boleh dipilih bersamaan; jika M dipilih maka N juga dipilih; O wajib dipilih. Susunan yang memenuhi syarat adalah…', ['K, L, O', 'K, M, O', 'L, N, O', 'L, M, O'], 2, 'K, L, O melanggar syarat pertama; K, M, O dan L, M, O memilih M tanpa N.'],
    ['n', 'Dalam lomba lari, Ita finis sebelum Joko tetapi setelah Kiki. Lala finis setelah Joko. Siapa juara pertama?', ['Ita', 'Joko', 'Kiki', 'Lala'], 2, 'Urutan finis: Kiki, Ita, Joko, Lala.'],
    ['n', 'Kotak merah, biru, dan hijau masing-masing berisi satu benda: pena, buku, atau penggaris. Kotak merah tidak berisi pena dan kotak biru berisi buku. Isi kotak hijau adalah…', ['Pena', 'Buku', 'Penggaris', 'Tidak dapat ditentukan'], 0, 'Biru = buku. Merah bukan pena, jadi merah = penggaris, dan hijau = pena.'],
    ['h', 'Enam berkas (1–6) diproses berurutan. Berkas 5 diproses pertama, berkas 6 terakhir, berkas 1 tepat sebelum berkas 3, dan berkas 4 sebelum berkas 2. Pernyataan yang PASTI benar adalah…', ['Berkas 4 diproses kedua', 'Berkas 2 diproses sebelum berkas 6', 'Berkas 3 diproses keempat', 'Berkas 1 diproses sebelum berkas 4'], 1, 'Kemungkinan urutan: 5-1-3-4-2-6, 5-4-1-3-2-6, atau 5-4-2-1-3-6. Hanya "berkas 2 sebelum berkas 6" yang selalu benar.'],
    // ── Numerik: berhitung ──
    ['e', '0,25 × 480 + 15% × 200 = …', ['130', '140', '150', '160'], 2, '120 + 30 = 150.'],
    ['n', '3/4 dari 2/5 dari 600 adalah…', ['160', '180', '200', '240'], 1, '2/5 × 600 = 240; 3/4 × 240 = 180.'],
    ['n', '√1.369 + 13² = …', ['196', '206', '216', '226'], 1, '√1.369 = 37 dan 13² = 169, jadi 37 + 169 = 206.'],
    ['n', '12,5% dari 64 ditambah 2³ × 5 adalah…', ['40', '44', '48', '52'], 2, '8 + 40 = 48.'],
    ['h', '(2¹⁰ − 2⁸) ÷ 2⁶ = …', ['8', '12', '16', '24'], 1, '(1.024 − 256) ÷ 64 = 768 ÷ 64 = 12.'],
    ['n', '1/8 + 0,375 + 50% = …', ['0,75', '0,875', '1', '1,125'], 2, '0,125 + 0,375 + 0,5 = 1.'],
    ['h', '999 × 25 = …', ['24.875', '24.975', '25.025', '24.995'], 1, '1.000 × 25 − 25 = 24.975.'],
    // ── Numerik: deret angka ──
    ['e', '3, 7, 11, 15, … Bilangan berikutnya adalah…', ['17', '18', '19', '21'], 2, 'Bertambah 4.'],
    ['n', '2, 6, 18, 54, … Bilangan berikutnya adalah…', ['108', '144', '162', '216'], 2, 'Dikali 3.'],
    ['n', '1, 4, 9, 16, 25, … Bilangan berikutnya adalah…', ['30', '35', '36', '49'], 2, 'Bilangan kuadrat: 6² = 36.'],
    ['h', '2, 3, 5, 9, 17, … Bilangan berikutnya adalah…', ['31', '33', '34', '35'], 1, 'Selisih 1, 2, 4, 8, 16 → 17 + 16 = 33.'],
    ['h', '5, 10, 8, 16, 14, 28, … Bilangan berikutnya adalah…', ['26', '30', '56', '24'], 0, 'Pola bergantian: × 2 lalu − 2 → 28 − 2 = 26.'],
    ['n', '1, 1, 2, 3, 5, 8, … Bilangan berikutnya adalah…', ['11', '12', '13', '14'], 2, 'Fibonacci: 5 + 8 = 13.'],
    ['h', '4, 6, 9, 13, 18, 24, … Bilangan berikutnya adalah…', ['29', '30', '31', '32'], 2, 'Selisih 2, 3, 4, 5, 6, 7 → 24 + 7 = 31.'],
    // ── Numerik: perbandingan kuantitatif ──
    ['n', 'P = 30% dari 150; Q = 45% dari 100. Hubungan P dan Q adalah…', PQ, 2, 'P = 45 dan Q = 45.'],
    ['n', 'P = 7²; Q = 2⁶. Hubungan P dan Q adalah…', PQ, 1, 'P = 49 dan Q = 64.'],
    ['h', 'x > 0; P = x; Q = x². Hubungan P dan Q adalah…', PQ, 3, 'x = 0,5 → P > Q; x = 2 → P < Q; x = 1 → P = Q. Hubungannya berubah-ubah.'],
    ['n', 'P = 3/7; Q = 4/9. Hubungan P dan Q adalah…', PQ, 1, 'Kali silang: 3 × 9 = 27 < 4 × 7 = 28, jadi P < Q.'],
    ['h', 'x + y = 10 dan x − y = 4; P = x; Q = 2y. Hubungan P dan Q adalah…', PQ, 0, 'x = 7 dan y = 3, jadi P = 7 dan Q = 6.'],
    ['n', 'P = rata-rata dari 12, 15, dan 18; Q = median dari 10, 15, 20, dan 25. Hubungan P dan Q adalah…', PQ, 1, 'P = 15; Q = (15 + 20) ÷ 2 = 17,5.'],
    ['h', 'Harga suatu barang naik 20% lalu turun 20%. P = harga akhir; Q = harga awal. Hubungan P dan Q adalah…', PQ, 1, 'P = 1,2 × 0,8 × Q = 0,96Q, jadi P < Q.'],
    ['p', 'P = banyaknya bilangan prima di antara 10 dan 30; Q = 6. Hubungan P dan Q adalah…', PQ, 2, 'Bilangan prima: 11, 13, 17, 19, 23, 29 → 6 buah.'],
    // ── Numerik: soal cerita ──
    ['n', 'Sebuah pekerjaan dapat diselesaikan 12 orang dalam 15 hari. Jika dikerjakan 18 orang, pekerjaan itu selesai dalam…', ['8 hari', '9 hari', '10 hari', '12 hari'], 2, 'Berbalik nilai: 12 × 15 = 180 hari-orang; 180 ÷ 18 = 10 hari.'],
    ['n', 'Harga sebuah barang setelah diskon 25% adalah Rp300.000. Harga sebelum diskon adalah…', ['Rp375.000', 'Rp400.000', 'Rp425.000', 'Rp450.000'], 1, '300.000 ÷ 0,75 = 400.000.'],
    ['h', 'Jarak kota P dan Q adalah 360 km. Mobil A berangkat dari P dengan kecepatan 70 km/jam dan mobil B dari Q dengan 50 km/jam, bersamaan dan saling menuju. Keduanya bertemu setelah…', ['2 jam', '2,5 jam', '3 jam', '3,5 jam'], 2, '360 ÷ (70 + 50) = 3 jam.'],
    ['n', 'Rata-rata nilai 5 peserta adalah 76. Satu peserta keluar sehingga rata-ratanya menjadi 75. Nilai peserta yang keluar adalah…', ['78', '79', '80', '81'], 2, '5 × 76 = 380; 4 × 75 = 300; 380 − 300 = 80.'],
    ['h', 'Keran A dapat mengisi bak dalam 6 jam dan keran B dalam 3 jam. Jika keduanya dibuka bersamaan, bak penuh dalam…', ['1,5 jam', '2 jam', '2,5 jam', '4,5 jam'], 1, '1/6 + 1/3 = 1/2 bak per jam, jadi 2 jam.'],
    ['n', 'Perbandingan uang Ani dan Budi adalah 3 : 5 dengan selisih Rp60.000. Jumlah uang mereka adalah…', ['Rp180.000', 'Rp200.000', 'Rp240.000', 'Rp300.000'], 2, 'Selisih 2 bagian = 60.000, jadi 1 bagian = 30.000; jumlah 8 bagian = 240.000.'],
    ['h', 'Pedagang membeli 40 kg beras seharga Rp12.000/kg. Sebanyak 30 kg dijual Rp14.000/kg dan sisanya Rp11.000/kg. Pedagang tersebut…', ['Untung Rp50.000', 'Rugi Rp50.000', 'Untung Rp70.000', 'Impas'], 0, 'Modal 480.000; penjualan 420.000 + 110.000 = 530.000; untung 50.000.'],
    // ── Figural: serial ──
    ['n', 'Perhatikan urutan gambar berikut:\n▲  ▶  ▼  ◀  ▲  ▶  ?\nGambar yang tepat untuk mengisi tanda tanya adalah…', ['▲', '▶', '▼', '◀'], 2, 'Segitiga berputar 90° searah jarum jam setiap langkah: atas → kanan → bawah → kiri.'],
    ['n', 'Perhatikan urutan gambar berikut:\n■   □□   ■■■   □□□□   ?\nGambar yang tepat untuk mengisi tanda tanya adalah…', ['□□□□□', '■■■■■', '■■■■', '□□□'], 1, 'Jumlah kotak bertambah satu dan warnanya berselang-seling hitam–putih.'],
    ['h', 'Perhatikan urutan anak panah berikut:\n↑  ↗  →  ↘  ↓  ?\nAnak panah berikutnya adalah…', ['↙', '←', '↖', '↑'], 0, 'Panah berputar 45° searah jarum jam setiap langkah.'],
    // ── Figural: analogi ──
    ['n', 'Analogi gambar:\n▲ : ▼  =  ◀ : ?', ['▲', '▼', '▶', '◀'], 2, 'Gambar kedua adalah gambar pertama yang diputar 180°.'],
    ['h', 'Analogi gambar:\n□ : ■  =  ○ : ?', ['◎', '●', '◇', '○'], 1, 'Bentuknya tetap, warnanya berubah dari kosong menjadi terisi penuh.'],
    ['h', 'Analogi gambar:\n△ (segitiga) : □ (segi empat)  =  ⬠ (segi lima) : ?', ['△ (segitiga)', '□ (segi empat)', '⬡ (segi enam)', '○ (lingkaran)'], 2, 'Jumlah sisi bertambah satu.'],
    // ── Figural: penalaran matriks ──
    ['h', 'Lengkapi matriks gambar berikut:\nBaris 1:  ○   △   □\nBaris 2:  △   □   ○\nBaris 3:  □   ○   ?', ['○', '△', '□', '◇'], 1, 'Setiap baris dan setiap kolom memuat lingkaran, segitiga, dan persegi tepat satu kali.'],
    ['h', 'Lengkapi matriks gambar berikut:\nBaris 1:  ●     ●●     ●●●\nBaris 2:  ●●    ●●●    ●●●●\nBaris 3:  ●●●   ●●●●   ?', ['●●●', '●●●●', '●●●●●', '●●●●●●'], 2, 'Setiap langkah ke kanan atau ke bawah, jumlah titik bertambah satu.'],
    ['p', 'Lengkapi matriks gambar berikut:\nBaris 1:  ★     ★★    ★★★\nBaris 2:  ★★    ★★    ★★★★\nBaris 3:  ★★★   ★     ?', ['★★', '★★★', '★★★★', '★★★★★'], 2, 'Kolom ketiga = jumlah bintang kolom pertama + kolom kedua: 3 + 1 = 4.'],
  ],
};
