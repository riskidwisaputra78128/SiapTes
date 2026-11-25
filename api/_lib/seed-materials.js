// Materi Inti (selalu tersedia). Materi harian dari berita dibuat otomatis oleh /api/generate.
const M = (category, title, summary, sections, keyPoints, glossary, tips) => ({
  id: 'core-' + category, core: true, category, title, summary, sections, keyPoints, glossary, tips,
  readMin: Math.max(2, Math.round((summary + sections.map(s => s.body).join(' ')).split(/\s+/).length / 180)),
});

export const CORE_MATERIALS = [
  M('twk', 'Pilar Kebangsaan, Konstitusi & Lembaga Negara',
    'TWK menguji pemahaman dasar negara, UUD 1945, sejarah, dan sistem ketatanegaraan. Kuasai empat pilar kebangsaan, isi pasal-pasal penting, dan peran tiap lembaga negara.',
    [
      { heading: 'Empat pilar kebangsaan', body: 'Pancasila (dasar negara), UUD 1945 (konstitusi), NKRI (bentuk negara), dan Bhinneka Tunggal Ika (semboyan). Rumusan Pancasila tercantum di alinea keempat Pembukaan UUD 1945.' },
      { heading: 'Perubahan UUD 1945', body: 'UUD 1945 diubah empat kali (1999, 2000, 2001, 2002). Perubahan ketiga (2001) memuat pemilihan presiden langsung (Pasal 6A) dan pembentukan Mahkamah Konstitusi.' },
      { heading: 'Lembaga negara utama', body: 'MPR, DPR, DPD (legislatif); Presiden (eksekutif); Mahkamah Agung dan Mahkamah Konstitusi (yudikatif); Komisi Yudisial (pengawas perilaku hakim); BPK (pemeriksa keuangan negara). MK menguji UU terhadap UUD; MA menguji peraturan di bawah UU terhadap UU.' },
      { heading: 'Hierarki peraturan (UU 12/2011)', body: 'UUD 1945 → Tap MPR → UU/Perppu → PP → Perpres → Perda Provinsi → Perda Kabupaten/Kota. Peraturan yang lebih rendah tidak boleh bertentangan dengan yang lebih tinggi.' },
    ],
    ['Pancasila di alinea IV Pembukaan UUD 1945', 'UUD diubah 4 kali (1999–2002)', 'MK menguji UU terhadap UUD', 'Tap MPR di bawah UUD, di atas UU'],
    [{ term: 'Judicial review', def: 'Pengujian peraturan terhadap peraturan yang lebih tinggi.' }, { term: 'Perppu', def: 'Peraturan Pemerintah Pengganti UU, dibuat presiden dalam kegentingan memaksa.' }, { term: 'Bhinneka Tunggal Ika', def: 'Berbeda-beda tetapi tetap satu; dari Kakawin Sutasoma karya Mpu Tantular.' }],
    ['Hafalkan pasal yang sering keluar: 1, 6A, 27, 28, 29, 31, 33, 34.', 'Soal sejarah sering menanyakan tanggal sidang BPUPKI/PPKI.', 'Untuk soal penerapan nilai Pancasila, cari sila yang paling spesifik.']),

  M('tiu', 'Strategi Cepat Tes Intelegensia Umum',
    'TIU mengukur kemampuan verbal, numerik, dan logika. Kuncinya mengenali pola dengan cepat dan tidak terjebak hitungan panjang.',
    [
      { heading: 'Deret angka', body: 'Cek berurutan: selisih tetap (aritmetika), rasio tetap (geometri), selisih bertingkat, pola Fibonacci (jumlah dua suku sebelumnya), faktorial, atau dua deret berselang-seling.' },
      { heading: 'Persen & perbandingan', body: 'Naik a% lalu turun a% selalu menghasilkan penurunan (a²/100)%. Pekerjaan bersama: 1/A + 1/B = 1/T. Kecepatan: jarak = kecepatan × waktu; susul-menyusul pakai selisih kecepatan.' },
      { heading: 'Silogisme', body: '"Semua A adalah B" + "C adalah A" → "C adalah B". Jika premis memakai "sebagian", kesimpulan juga harus "sebagian". Hati-hati dengan pilihan yang membalik hubungan (B adalah A).' },
      { heading: 'Analogi & sinonim/antonim', body: 'Tentukan hubungannya dulu (alat–pengguna, bahan–produk, bagian–keseluruhan, sebab–akibat), lalu cari pasangan dengan hubungan yang sama persis.' },
    ],
    ['Cari pola selisih dulu, baru rasio', 'Naik-turun persen yang sama = turun', '1/A + 1/B = 1/T', 'Kesimpulan tidak boleh melebihi premis'],
    [{ term: 'Deret aritmetika', def: 'Deret dengan selisih tetap antarsuku.' }, { term: 'Deret geometri', def: 'Deret dengan rasio (pengali) tetap.' }, { term: 'Silogisme', def: 'Penarikan kesimpulan dari dua premis.' }],
    ['Lewati soal yang lama, kembali di akhir.', 'Gunakan eliminasi pilihan untuk soal hitungan.', 'Latih 10 soal deret setiap hari untuk kecepatan.']),

  M('tkp', 'Memahami Pola Jawaban TKP',
    'TKP menilai karakter kerja. Setiap pilihan bernilai 1–5, jadi tujuannya memilih respons paling ideal, bukan yang paling "benar" secara aturan saja.',
    [
      { heading: 'Aspek yang diukur', body: 'Pelayanan publik, jejaring kerja, sosial budaya, teknologi informasi & komunikasi, profesionalisme, dan anti-radikalisme.' },
      { heading: 'Ciri jawaban terbaik', body: 'Proaktif dan berorientasi solusi, tetap sesuai aturan, mengutamakan kepentingan organisasi/publik, komunikatif, serta menjaga integritas (menolak dan melaporkan gratifikasi).' },
      { heading: 'Jebakan umum', body: 'Pilihan yang pasif ("menunggu instruksi"), emosional, menyalahkan orang lain, atau melanggar aturan demi kecepatan biasanya bernilai rendah.' },
    ],
    ['Pilih respons proaktif & solutif', 'Integritas di atas kenyamanan pribadi', 'Layani dengan empati lalu beri solusi', 'Kolaborasi lebih baik dari kerja sendiri'],
    [{ term: 'Gratifikasi', def: 'Pemberian dalam arti luas kepada pegawai terkait jabatannya; wajib ditolak atau dilaporkan.' }, { term: 'Jejaring kerja', def: 'Kemampuan membangun dan memelihara hubungan kerja yang produktif.' }],
    ['Tidak ada pengurangan nilai, jadi jawab semua soal.', 'Bayangkan dirimu sebagai pegawai teladan saat memilih.', 'Hindari jawaban ekstrem.']),

  M('ojk', 'OJK: Fungsi, Sektor & Perlindungan Konsumen',
    'OJK adalah lembaga independen yang mengatur dan mengawasi seluruh sektor jasa keuangan secara terintegrasi, dibentuk dengan UU No. 21 Tahun 2011.',
    [
      { heading: 'Ruang lingkup', body: 'Perbankan, pasar modal, dan industri keuangan nonbank (asuransi, dana pensiun, lembaga pembiayaan, fintech lending, dan lainnya). Pengawasan pasar modal & IKNB beralih dari Bapepam-LK pada 31 Desember 2012; perbankan dari BI pada 31 Desember 2013.' },
      { heading: 'Struktur', body: 'Dipimpin Dewan Komisioner beranggotakan 9 orang, termasuk 2 anggota ex-officio dari Bank Indonesia dan Kementerian Keuangan.' },
      { heading: 'UU P2SK (UU 4/2023)', body: 'Omnibus law sektor keuangan yang memperkuat kewenangan OJK, termasuk pengawasan aset keuangan digital dan aset kripto yang dialihkan dari Bappebti.' },
      { heading: 'Perlindungan konsumen', body: 'OJK melakukan edukasi, menangani pengaduan (Kontak OJK 157), dan bersama satgas memberantas aktivitas keuangan ilegal seperti pinjol dan investasi bodong.' },
    ],
    ['Dasar hukum UU 21/2011', 'Mengawasi perbankan, pasar modal, IKNB', 'DK OJK 9 anggota (2 ex-officio)', 'Kontak OJK 157'],
    [{ term: 'IKNB', def: 'Industri Keuangan Non-Bank: asuransi, dana pensiun, pembiayaan, dll.' }, { term: 'Mikroprudensial', def: 'Pengawasan kesehatan lembaga keuangan secara individu.' }, { term: 'SLIK', def: 'Sistem Layanan Informasi Keuangan, berisi riwayat kredit debitur.' }],
    ['Bedakan kewenangan OJK (mikroprudensial) dan BI (makroprudensial, moneter, sistem pembayaran).', 'Hafalkan tanggal peralihan pengawasan 2012 & 2013.']),

  M('bi', 'Bank Indonesia: Moneter, Sistem Pembayaran & Makroprudensial',
    'Bank Indonesia adalah bank sentral yang independen. Tugasnya mencakup kebijakan moneter, sistem pembayaran, dan stabilitas sistem keuangan.',
    [
      { heading: 'Tujuan', body: 'Berdasarkan UU P2SK: mencapai stabilitas nilai rupiah, memelihara stabilitas sistem pembayaran, dan turut menjaga stabilitas sistem keuangan dalam rangka mendukung pertumbuhan ekonomi yang berkelanjutan.' },
      { heading: 'Kebijakan moneter', body: 'BI menerapkan Inflation Targeting Framework. Instrumen utamanya suku bunga kebijakan (BI-Rate), operasi pasar terbuka, dan intervensi valas. Saat inflasi tinggi, BI cenderung menaikkan suku bunga (kebijakan kontraktif).' },
      { heading: 'Sistem pembayaran', body: 'BI-RTGS (transaksi nilai besar), SKNBI (kliring), BI-FAST (transfer ritel real-time 24/7), GPN (interkoneksi pemrosesan domestik), dan QRIS (standar QR pembayaran nasional).' },
      { heading: 'Makroprudensial', body: 'Menjaga stabilitas sistem keuangan secara menyeluruh, dengan instrumen seperti Rasio Intermediasi Makroprudensial, Countercyclical Capital Buffer, dan rasio LTV/FTV.' },
    ],
    ['Independen sejak UU 23/1999', 'Inflasi tinggi → suku bunga naik', 'QRIS & BI-FAST = sistem pembayaran BI', 'RIM, CCyB, LTV = makroprudensial'],
    [{ term: 'Inflasi', def: 'Kenaikan harga barang dan jasa secara umum dan terus-menerus.' }, { term: 'Transmisi moneter', def: 'Jalur pengaruh kebijakan BI ke ekonomi: suku bunga, kredit, nilai tukar, harga aset, ekspektasi.' }, { term: 'Apresiasi', def: 'Menguatnya nilai mata uang.' }],
    ['Pahami arah kebijakan: kontraktif vs ekspansif.', 'Bedakan instrumen moneter dan makroprudensial — sering jadi soal jebakan.']),

  M('bumn', 'BUMN: AKHLAK, Bentuk Usaha & Tata Kelola',
    'Rekrutmen BUMN menguji wawasan kebangsaan, core values AKHLAK, dan pemahaman dasar tentang BUMN serta tata kelola perusahaan.',
    [
      { heading: 'Core values AKHLAK', body: 'Amanah, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif — nilai inti yang wajib dihayati seluruh insan BUMN.' },
      { heading: 'Bentuk BUMN', body: 'Persero: modal terbagi atas saham, minimal 51% milik negara, bertujuan mengejar keuntungan. Perum: seluruh modal milik negara dan tidak terbagi atas saham, bertujuan kemanfaatan umum.' },
      { heading: 'Danantara', body: 'Badan Pengelola Investasi Daya Anagata Nusantara diluncurkan Februari 2025 untuk mengelola investasi dan aset BUMN.' },
      { heading: 'Good Corporate Governance', body: 'Prinsip TARIF: Transparansi, Akuntabilitas, Responsibilitas, Independensi, dan Kewajaran (fairness).' },
    ],
    ['AKHLAK: 6 nilai inti', 'Persero minimal 51% saham negara', 'Perum: modal tidak terbagi saham', 'GCG = TARIF'],
    [{ term: 'Holding BUMN', def: 'Pengelompokan BUMN sejenis di bawah satu induk.' }, { term: 'Independensi', def: 'Prinsip GCG: bebas dari benturan kepentingan dan tekanan pihak lain.' }],
    ['Soal AKHLAK sering berbentuk studi kasus — cocokkan perilaku dengan definisi nilai.', 'Ikuti berita BUMN terbaru karena sering jadi soal isu terkini.']),

  M('telkom', 'Telekomunikasi & Transformasi Digital',
    'Tes di perusahaan telekomunikasi dan digital banyak menyentuh dasar teknologi jaringan, cloud, keamanan siber, dan regulasi data.',
    [
      { heading: 'Jaringan', body: '2G → 3G → 4G LTE → 5G: setiap generasi menaikkan kecepatan dan menurunkan latensi. Palapa Ring adalah tulang punggung serat optik nasional yang menjangkau hingga wilayah 3T.' },
      { heading: 'Cloud computing', body: 'IaaS (sewa infrastruktur), PaaS (platform pengembangan), SaaS (aplikasi siap pakai). Edge computing memproses data dekat sumbernya untuk latensi rendah.' },
      { heading: 'Keamanan siber & data', body: 'Phishing, malware, dan ransomware adalah ancaman umum. UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi mengatur kewajiban pengendali data.' },
    ],
    ['5G = latensi sangat rendah', 'IaaS/PaaS/SaaS', 'Palapa Ring = backbone serat optik', 'UU PDP = UU 27/2022'],
    [{ term: 'Latensi', def: 'Jeda waktu pengiriman data.' }, { term: 'Phishing', def: 'Penipuan untuk mencuri data lewat pesan/tautan palsu.' }, { term: 'Bandwidth', def: 'Kapasitas maksimum aliran data.' }],
    ['Kaitkan konsep teknologi dengan manfaat bisnis/layanan publik.', 'Ikuti berita Telkom & Komdigi untuk soal isu terkini.']),

  M('keuangan', 'Dasar Perbankan & Literasi Keuangan',
    'Materi ini wajib untuk rekrutmen bank dan lembaga keuangan: rasio kesehatan bank, penjaminan simpanan, prinsip APU-PPT, dan matematika keuangan dasar.',
    [
      { heading: 'Rasio bank', body: 'CAR (kecukupan modal), NPL (kredit bermasalah), LDR (kredit ÷ DPK), ROA (laba ÷ total aset), NIM (margin bunga bersih), BOPO (efisiensi operasional).' },
      { heading: 'Penjaminan LPS', body: 'Simpanan dijamin hingga Rp2 miliar per nasabah per bank, dengan syarat 3T: tercatat di pembukuan bank, tingkat bunga tidak melebihi bunga penjaminan, dan tidak melakukan tindakan yang merugikan bank.' },
      { heading: 'APU-PPT', body: 'Anti Pencucian Uang dan Pencegahan Pendanaan Terorisme. Bank wajib melakukan Customer Due Diligence (prinsip Know Your Customer) dan melaporkan transaksi mencurigakan.' },
      { heading: 'Matematika keuangan', body: 'Bunga tunggal: bunga dihitung dari pokok awal. Bunga majemuk: bunga ikut berbunga, Mn = M0 × (1 + i)^n. Bunga riil ≈ bunga nominal − inflasi.' },
    ],
    ['LDR = kredit ÷ DPK', 'LPS: Rp2 miliar, syarat 3T', 'KYC/CDD bagian APU-PPT', 'Majemuk: M0 × (1+i)^n'],
    [{ term: 'DPK', def: 'Dana Pihak Ketiga: giro, tabungan, deposito.' }, { term: 'EDC', def: 'Electronic Data Capture, mesin pemroses transaksi kartu.' }, { term: 'QRIS', def: 'Standar QR Code pembayaran nasional dari BI.' }],
    ['Latih soal bunga majemuk dan LDR — sering keluar dalam bentuk hitungan.', 'Pahami beda QRIS (QR) dan EDC (kartu) untuk soal layanan merchant.']),

  M('english', 'English Essentials for Selection Tests',
    'Tes bahasa Inggris di BI, OJK, dan BUMN banyak menguji grammar dasar, kosakata bisnis, dan pemahaman bacaan.',
    [
      { heading: 'Tenses & passive', body: 'Simple present untuk kebiasaan (She goes…). Passive: be + V3 (The report was reviewed). Present perfect: have/has + V3 untuk pengalaman atau hasil yang masih relevan.' },
      { heading: 'Conditionals', body: 'Type 1: If + present, will + V1. Type 2: If + past, would + V1. Type 3: If + had + V3, would have + V3 (pengandaian masa lalu).' },
      { heading: 'Inversion', body: 'Hardly/Scarcely … when; No sooner … than. Contoh: Hardly had the meeting started when the power went out.' },
    ],
    ['Passive: be + V3', 'Type 3: had + V3 / would have + V3', 'Hardly … when, No sooner … than'],
    [{ term: 'Mitigate', def: 'Reduce the severity of something.' }, { term: 'Comply', def: 'Act according to a rule.' }, { term: 'Allocate', def: 'Distribute resources for a purpose.' }],
    ['Baca kalimat utuh sebelum memilih — cari penanda waktu (yesterday, since, by the time).', 'Untuk reading, baca pertanyaan dulu lalu scan teks.']),

  M('isu', 'Cara Menguasai Isu Terkini',
    'Soal isu terkini menguji apakah kamu mengikuti perkembangan ekonomi, kebijakan, dan sosial, serta mampu menganalisis dampaknya.',
    [
      { heading: 'Kerangka analisis', body: 'Untuk setiap berita, jawab: apa yang terjadi, siapa yang terlibat (lembaga & dasar hukumnya), mengapa terjadi, dan apa dampaknya bagi ekonomi, masyarakat, dan sektor tempatmu melamar.' },
      { heading: 'Agenda jangka panjang', body: 'SDGs (target 2030), Visi Indonesia Emas 2045, dan Net Zero Emission Indonesia 2060 atau lebih cepat sering menjadi konteks soal.' },
      { heading: 'Perkembangan penting', body: 'Indonesia menjadi anggota penuh BRICS pada Januari 2025. Program Makan Bergizi Gratis dikelola Badan Gizi Nasional. Ibu Kota Nusantara diatur UU No. 3 Tahun 2022.' },
    ],
    ['Analisis: apa, siapa, mengapa, dampak', 'SDGs 2030, Indonesia Emas 2045, NZE 2060', 'Baca Materi Update Harian setiap pagi'],
    [{ term: 'Kebijakan fiskal', def: 'Kebijakan pemerintah lewat pajak dan belanja negara.' }, { term: 'Kebijakan moneter', def: 'Kebijakan bank sentral lewat suku bunga dan jumlah uang beredar.' }],
    ['Biasakan membaca 3 berita ekonomi per hari.', 'Selalu kaitkan isu dengan lembaga & dasar hukumnya.']),
];
