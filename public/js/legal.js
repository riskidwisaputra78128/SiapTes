// 📄 Halaman legal: Syarat & Ketentuan, Kebijakan Privasi, Kebijakan Refund (bisa dibuka tanpa login)
import { session, getInfo } from './api.js';
import { esc } from './ui.js';

const UPDATED = '28 November 2026';
export const LEGAL = {
  syarat: { ico: '📜', title: 'Syarat & Ketentuan' },
  privasi: { ico: '🔒', title: 'Kebijakan Privasi' },
  refund: { ico: '💸', title: 'Kebijakan Refund' },
};

/** Tautan kecil ke tiga halaman legal (dipakai di halaman masuk, Langganan, Profil). */
export const legalLinks = (cls = '') => `<span class="legal-links ${cls}"><a href="#/syarat">Syarat & Ketentuan</a> · <a href="#/privasi">Privasi</a> · <a href="#/refund">Refund</a></span>`;

function contactHtml(c = {}) {
  const wa = String(c.wa || '').replace(/\D/g, '');
  const waIntl = wa.startsWith('0') ? '62' + wa.slice(1) : wa;
  const rows = [
    c.email ? `<li>📧 Email: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : '',
    wa ? `<li>💬 WhatsApp: <a href="https://wa.me/${waIntl}" target="_blank" rel="noopener">+${waIntl}</a></li>` : '',
    '<li>🗨️ Fitur <b>Kirim masukan</b> di menu Profil (setelah masuk)</li>',
  ].filter(Boolean).join('');
  return `<ul class="legal-contact">${rows}</ul><p class="dim" style="font-size:13px">Kami berusaha membalas dalam 1×24 jam pada hari kerja.</p>`;
}

const sec = (n, title, body) => `<section class="legal-sec"><h2><span>${n}</span>${title}</h2>${body}</section>`;

const BODY = {
  syarat: c => `
    <p class="legal-lead">Dengan membuat akun, memakai, atau membeli paket di SiapLolos, kamu dianggap telah membaca dan menyetujui ketentuan di bawah ini.</p>
    ${sec(1, 'Tentang SiapLolos', `<p>SiapLolos adalah platform latihan mandiri untuk persiapan tes seleksi (CPNS, BUMN, OJK, Bank Indonesia, Telkom, TKD, dan psikotes). SiapLolos <b>bukan</b> penyelenggara seleksi resmi dan <b>tidak berafiliasi</b> dengan BKN, KemenPAN-RB, Bank Indonesia, OJK, Telkom, Kementerian BUMN, maupun instansi lain. Hasil latihan dan simulasi bersifat perkiraan dan <b>tidak menjamin kelulusan</b>.</p>`)}
    ${sec(2, 'Akun', `<ul>
      <li>Isi nama dan email yang benar dan aktif. Email dipakai untuk masuk dan memulihkan kata sandi.</li>
      <li><b>Satu akun hanya untuk satu orang.</b> Kamu bertanggung jawab menjaga kerahasiaan kata sandi dan semua aktivitas di akunmu.</li>
      <li>Mode Tamu hanya untuk melihat-lihat; progres tamu tidak disimpan.</li>
      <li>Kami dapat menonaktifkan atau menghapus akun yang melanggar ketentuan ini.</li></ul>`)}
    ${sec(3, 'Paket & apa yang kamu dapat', `<ul>
      <li><b>Free</b> — gratis: latihan terbatas per hari (level Easy–Normal), materi inti, duel terbatas, dan Mentor AI terbatas.</li>
      <li><b>Plus</b> — latihan tanpa batas s.d. level Hard, esai & permainan interaktif, simulasi CPNS & Telkom tanpa batas, simulasi BI/OJK 2×/minggu, materi interaktif penuh, evaluasi detail, Mentor AI lebih banyak.</li>
      <li><b>Pro</b> — semua fitur Plus, level Prof, hingga 50 soal per sesi, semua simulasi tanpa batas, kuota Mentor AI terbesar, dan tanpa iklan.</li></ul>
      <p>Rincian fitur dan harga terbaru selalu tercantum di halaman <a href="#/langganan">Langganan</a>. Harga yang berlaku adalah harga yang tampil saat kamu membayar.</p>`)}
    ${sec(4, 'Pembayaran & masa aktif 30 hari', `<ul>
      <li>Pembayaran diproses oleh <b>Midtrans</b> (QRIS, Virtual Account bank, e-wallet, dan metode lain yang tersedia). SiapLolos tidak menerima maupun menyimpan data kartu atau rekeningmu.</li>
      <li>Paket <b>aktif otomatis</b> setelah pembayaran terkonfirmasi, biasanya dalam beberapa detik sampai beberapa menit.</li>
      <li>Setiap pembelian berlaku <b>30 hari</b> sejak paket aktif. Membeli lagi saat paket yang sama masih aktif akan <b>menambah 30 hari</b> dari tanggal berakhir sebelumnya.</li>
      <li><b>Tidak ada penagihan otomatis.</b> Kami mengirim pengingat di aplikasi 5 hari sebelum masa aktif berakhir; perpanjangan dilakukan secara manual olehmu.</li>
      <li>Setelah masa aktif habis, akun otomatis kembali ke paket Free. Riwayat latihan dan progresmu tetap tersimpan.</li></ul>`)}
    ${sec(5, 'Trial gratis lewat kode referal', `<p>Trial gratis hanya dapat dibuka dengan kode referal yang valid, <b>satu kali per akun</b>, dengan durasi sesuai kode (misalnya 3 hari). Setelah trial berakhir, akun kembali ke Free tanpa biaya apa pun. Kode referal dapat diubah, dibatasi kuotanya, atau dinonaktifkan sewaktu-waktu.</p>`)}
    ${sec(6, 'Hal yang dilarang', `<ul>
      <li><b>Berbagi, meminjamkan, atau menjual akun</b>, termasuk memakai satu akun berbayar bersama-sama oleh beberapa orang.</li>
      <li>Menyalin, merekam, atau menyebarluaskan soal, pembahasan, dan materi SiapLolos untuk dijual atau dipublikasikan ulang.</li>
      <li>Memakai bot, skrip, atau cara otomatis untuk mengambil data (scraping) atau memanipulasi skor, duel, dan peringkat.</li>
      <li>Mengganggu, membobol, atau membebani sistem, serta menyalahgunakan Mentor AI untuk hal di luar belajar.</li></ul>
      <p>Pelanggaran dapat berakibat pencabutan paket <b>tanpa pengembalian dana</b> dan/atau penghapusan akun.</p>`)}
    ${sec(7, 'Konten & Mentor AI', `<p>Soal dan materi disusun dari sumber publik serta kisi-kisi resmi yang tersedia, sebagian dibantu kecerdasan buatan (AI). Kami berusaha menjaga ketepatannya, namun kekeliruan tetap mungkin terjadi — laporkan lewat fitur Kirim masukan agar segera kami perbaiki. Jawaban Mentor AI bersifat bantuan belajar, bukan sumber resmi.</p>`)}
    ${sec(8, 'Perubahan layanan & ketentuan', `<p>Kami dapat menambah, mengubah, atau menghentikan fitur, serta memperbarui ketentuan ini. Perubahan penting diumumkan di aplikasi. Perubahan tidak mengurangi masa aktif paket yang sudah kamu bayar.</p>`)}
    ${sec(9, 'Kontak', contactHtml(c))}`,

  privasi: c => `
    <p class="legal-lead">Kami hanya mengumpulkan data yang dibutuhkan agar SiapLolos berjalan, dan <b>tidak pernah menjual data pribadimu</b> kepada siapa pun.</p>
    ${sec(1, 'Data yang kami simpan', `<ul>
      <li><b>Data akun:</b> nama, email, dan target tes. Kata sandi disimpan dalam bentuk acak (hash), bukan teks aslinya.</li>
      <li><b>Data belajar:</b> hasil latihan, skor, riwayat simulasi dan duel, progres materi, serta foto profil bila kamu mengunggahnya.</li>
      <li><b>Data langganan:</b> paket, masa aktif, nominal, metode, dan waktu pembayaran. Nomor kartu, rekening, atau PIN <b>tidak</b> kami terima — semuanya diproses langsung oleh Midtrans.</li>
      <li><b>Data penggunaan:</b> status online dan halaman yang sedang dibuka (untuk fitur "sedang online" dan duel), serta jumlah tayang/klik iklan tanpa identitas pribadi.</li>
      <li><b>Isi yang kamu kirim:</b> pertanyaan ke Mentor AI, jawaban esai yang dinilai, dan masukan/feedback.</li>
      <li><b>Di perangkatmu (browser):</b> sesi masuk, pilihan tema, dan tanda materi yang sudah dibaca.</li></ul>`)}
    ${sec(2, 'Untuk apa data dipakai', `<ul>
      <li>Membuat dan mengamankan akunmu, serta memulihkan kata sandi.</li>
      <li>Menyimpan progres, menampilkan evaluasi, papan peringkat, dan duel.</li>
      <li>Mengaktifkan paket setelah pembayaran dan mengirim pengingat masa aktif.</li>
      <li>Menjawab pertanyaan Mentor AI dan menilai esai.</li>
      <li>Memperbaiki soal, materi, dan kinerja layanan.</li></ul>`)}
    ${sec(3, 'Yang terlihat oleh pengguna lain', `<p>Nama dan skor ditampilkan di papan peringkat dan duel. Nama juga tampil di daftar pengguna yang sedang online — kamu dapat menyembunyikan status online di menu Profil. Email dan data pembayaranmu tidak pernah ditampilkan ke pengguna lain.</p>`)}
    ${sec(4, 'Layanan pihak ketiga', `<p>Untuk menjalankan SiapLolos, data diproses oleh penyedia berikut sesuai keperluannya masing-masing:</p><ul>
      <li><b>Google Firebase</b> — database progres, langganan, dan pengaturan.</li>
      <li><b>Google Apps Script & Google Sheets</b> — penyimpanan dan verifikasi akun.</li>
      <li><b>Google Gemini</b> — memproses pertanyaan Mentor AI dan penilaian esai.</li>
      <li><b>Midtrans</b> — pemrosesan pembayaran.</li>
      <li><b>Vercel</b> — hosting website.</li></ul>
      <p>Kami tidak menjual, menyewakan, atau membagikan data pribadimu untuk iklan pihak lain.</p>`)}
    ${sec(5, 'Keamanan & lama penyimpanan', `<p>Akses data dibatasi dan koneksi memakai HTTPS. Data akun dan progres disimpan selama akunmu aktif. Jika akun dihapus, data akun, riwayat latihan, dan peringkatnya ikut dihapus; catatan transaksi dapat tetap kami simpan seperlunya untuk keperluan administrasi dan pembukuan.</p>`)}
    ${sec(6, 'Hakmu', `<p>Kamu dapat meminta salinan data, memperbaiki data yang keliru, atau <b>menghapus akun</b> beserta datanya dengan menghubungi kami lewat kontak di bawah. Kata sandi dapat kamu ganti sendiri lewat "Lupa kata sandi".</p>`)}
    ${sec(7, 'Perubahan kebijakan', `<p>Kebijakan ini dapat diperbarui. Tanggal pembaruan terakhir selalu tertera di bagian atas halaman ini.</p>`)}
    ${sec(8, 'Kontak', contactHtml(c))}`,

  refund: c => `
    <p class="legal-lead">Paket SiapLolos adalah produk digital yang langsung aktif setelah dibayar. Karena itu, pembayaran pada dasarnya <b>tidak dapat dikembalikan</b>, kecuali dalam kondisi berikut.</p>
    ${sec(1, 'Kapan uang bisa dikembalikan', `<ul>
      <li><b>Paket gagal aktif:</b> pembayaran sudah berhasil, tetapi paket tidak aktif dalam 1×24 jam dan tidak dapat kami aktifkan secara manual.</li>
      <li><b>Pembayaran ganda:</b> kamu terbayar lebih dari sekali untuk tagihan atau periode yang sama.</li>
      <li><b>Nominal tidak sesuai:</b> jumlah yang terpotong lebih besar dari harga paket yang tertera saat pembelian.</li>
      <li><b>Gangguan layanan berat:</b> fitur berbayar tidak dapat dipakai lebih dari 3 hari berturut-turut karena kesalahan dari pihak kami. Untuk kondisi ini kami menawarkan perpanjangan masa aktif atau pengembalian dana sebanding sisa masa aktif.</li></ul>`)}
    ${sec(2, 'Yang tidak dapat dikembalikan', `<ul>
      <li>Berubah pikiran setelah paket aktif, atau paket tidak/jarang dipakai selama masa aktif.</li>
      <li>Salah memilih paket (Plus/Pro) — namun kamu dapat menghubungi kami dalam 1×24 jam sejak pembayaran untuk dibantu penyesuaian.</li>
      <li>Akun dinonaktifkan karena melanggar Syarat & Ketentuan, misalnya berbagi akun.</li>
      <li>Trial gratis dari kode referal (tidak ada pembayaran).</li>
      <li>Gangguan dari pihak luar di luar kendali kami, seperti jaringan internet atau perangkatmu.</li></ul>`)}
    ${sec(3, 'Cara mengajukan', `<ol>
      <li>Hubungi kami lewat kontak di bawah <b>paling lambat 7 hari</b> sejak tanggal pembayaran.</li>
      <li>Sertakan: email akun SiapLolos, <b>Order ID</b> (diawali <code>sl-</code>, tertera di email/bukti bayar dari Midtrans), bukti pembayaran, metode bayar, dan penjelasan singkat masalahnya.</li>
      <li>Kami memeriksa pengajuan dalam <b>1–3 hari kerja</b> dan mengabarkan hasilnya.</li>
      <li>Jika disetujui, dana dikembalikan ke metode pembayaran semula atau ke rekening/e-wallet atas nama pembayar dalam <b>7–14 hari kerja</b>, tergantung bank dan penyedia pembayaran.</li></ol>`)}
    ${sec(4, 'Catatan', `<ul>
      <li>Biaya transaksi dari pihak ketiga (misalnya biaya transfer antarbank) dapat tidak ikut dikembalikan.</li>
      <li>Setelah dana dikembalikan, paket terkait dinonaktifkan.</li>
      <li>Sebagai alternatif, kami dapat menawarkan perpanjangan masa aktif bila kamu lebih memilihnya.</li></ul>`)}
    ${sec(5, 'Kontak', contactHtml(c))}`,
};

export async function renderLegal(app, kind) {
  const meta = LEGAL[kind];
  let contact = {};
  try { contact = (await getInfo()).settings?.contact || {}; } catch {}
  const others = Object.entries(LEGAL).filter(([k]) => k !== kind).map(([k, v]) => `<a class="btn ghost sm" href="#/${k}">${v.ico} ${v.title}</a>`).join('');
  app.innerHTML = `
  <section class="stack fade-in legal">
    ${!session.loggedIn && !session.guest ? '<a href="#/login" class="link-btn" style="font-size:14px">← Kembali ke halaman masuk</a>' : ''}
    <div class="glass card legal-card">
      <span class="chip">${meta.ico} SiapLolos</span>
      <h1 class="h1" style="margin:10px 0 4px">${meta.title}</h1>
      <p class="dim" style="margin:0 0 6px;font-size:13px">Terakhir diperbarui: ${UPDATED}</p>
      ${BODY[kind](contact)}
    </div>
    <div class="row wrap" style="gap:8px;justify-content:center">${others}</div>
  </section>`;
}
