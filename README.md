# SiapLolos 🎯

Platform latihan soal untuk tes **OJK, Bank Indonesia, Telkom, CPNS (SKD), BUMN (Rekrutmen Bersama), dan TKD**.
Desain 3D modern, nyaman dipakai di HP.

## Fitur
| Fitur | Keterangan |
|---|---|
| **3 mode latihan** | 📝 Pilihan Ganda A–D (timer, navigasi soal, tandai ragu) · 🎮 Arena Game (3 nyawa, timer per soal, combo, 50:50, +10 detik) · ✍️ Esai (jawaban bebas, dikoreksi **maksudnya** oleh AI + poin terlewat + koreksi + jawaban yang diperbaiki) |
| **4 level** | Easy, Normal, Hard, Prof |
| **11 materi** | TWK, TIU, TKP, OJK, BI, BUMN/AKHLAK, Telkom & Digital, Perbankan & Keuangan, Bahasa Inggris, Isu Terkini, Campuran |
| **Soal selalu baru** | Setiap hari 06.00 WIB, Vercel Cron mengambil berita terbaru (Google News) lalu Gemini menyusun soal PG + esai lengkap dengan link sumber berita |
| **Evaluasi** | Ringkasan hari ini / minggu ini / bulan ini, grafik tren harian (14 hari), mingguan (8 minggu), bulanan (6 bulan), akurasi per materi/level/mode, streak, level & XP, rekomendasi otomatis, riwayat |
| **Peringkat** | Papan peringkat mingguan & bulanan |
| **Akun** | Daftar/masuk lewat Google Apps Script + Google Sheet (kata sandi di-hash, kunci sementara setelah 5x gagal). Ada mode tamu |

## Arsitektur
```
Browser (HTML/CSS/JS + Three.js + Chart.js)
   │  fetch /api/*
   ▼
Vercel Serverless Functions (/api)
   ├─ /api/auth ─────────► Google Apps Script ──► Google Sheet (Users, LoginLog)
   ├─ /api/questions, attempt, stats, leaderboard ──► Firebase Firestore
   ├─ /api/grade ────────► Gemini (koreksi esai)
   └─ /api/generate (cron) ► Google News RSS + Gemini ──► Firestore
```
Firestore dikunci total untuk klien (`firestore.rules`); semua akses lewat API Vercel dengan token HMAC.

## Struktur
```
api/            Serverless functions (+ _lib: auth, db, ai, news, seed soal awal)
apps-script/    Code.gs untuk Google Apps Script
public/         Frontend (index.html, css, js)
dev-server.js   Server dev lokal (npm run dev)
vercel.json     Konfigurasi Vercel + cron harian
```

## Panduan setup (±20 menit)

### 1. GitHub
```bash
git init && git add . && git commit -m "SiapLolos v1"
git branch -M main
git remote add origin https://github.com/USERNAME/siaplolos.git
git push -u origin main
```

### 2. Google Sheet + Apps Script (akun)
1. Buat Google Sheet baru → **Extensions → Apps Script**.
2. Hapus isi `Code.gs`, tempel isi `apps-script/Code.gs`.
3. **Project Settings (⚙️) → Script Properties → Add**: `API_KEY` = string acak panjang (simpan, nanti dipakai di Vercel).
4. Pilih fungsi `setup` → **Run** → izinkan akses. Sheet `Users` & `LoginLog` akan dibuat.
5. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → salin URL `.../exec`.
   > Setiap kali kode Apps Script diubah, buat versi deployment baru (Manage deployments → Edit → New version).

### 3. Firebase (database)
1. [console.firebase.google.com](https://console.firebase.google.com) → Add project.
2. **Build → Firestore Database → Create database** (mode production, region `asia-southeast2` Jakarta).
3. Tab **Rules** → tempel isi `firestore.rules` → Publish.
4. **Project settings → Service accounts → Generate new private key** → file JSON terunduh.
5. Ubah JSON itu jadi satu baris base64 (paling aman untuk env Vercel):
   - Mac/Linux: `base64 -i serviceAccount.json | tr -d '\n'`
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))`

### 4. Gemini API (koreksi esai + soal dari berita)
Buat API key di [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Default model `gemini-3.6-flash`; bila Google merilis model baru, cukup ganti env `GEMINI_MODEL`.

### 5. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import repo GitHub.
2. Framework Preset: **Other** (pengaturan build otomatis dibaca dari `vercel.json`).
3. **Environment Variables**:

| Nama | Isi |
|---|---|
| `AUTH_SECRET` | string acak ≥32 karakter |
| `GAS_URL` | URL Web App Apps Script (`.../exec`) |
| `GAS_API_KEY` | sama persis dengan `API_KEY` di Script Properties |
| `FIREBASE_SERVICE_ACCOUNT` | base64 dari JSON service account |
| `GEMINI_API_KEY` | API key Gemini |
| `GEMINI_MODEL` | (opsional) `gemini-3.6-flash` |
| `CRON_SECRET` | string acak — Vercel mengirimnya otomatis saat menjalankan cron |
| `ADMIN_EMAILS` | email kamu, mis. `risky@email.com` (boleh dipisah koma) |

4. **Deploy**. Selesai — buka URL `*.vercel.app`.
5. Daftar akun dengan email admin → menu **Profil → ✨ Generate soal sekarang** untuk mengisi soal berita pertama kali (setelah itu otomatis setiap hari).

> String acak bisa dibuat dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Jalankan lokal
```bash
npm install
cp .env.example .env   # isi seperlunya; boleh dikosongkan untuk mode dev
npm run dev            # http://localhost:3000
```
Tanpa env, data tersimpan di memori (akun & riwayat hilang saat server mati) dan esai dikoreksi dengan pencocokan kata kunci. Alternatif: `npx vercel dev`.

## Catatan
- **Kuota**: Vercel Hobby mengizinkan cron 1x/hari (sudah sesuai). Koreksi esai AI hanya untuk pengguna yang login agar hemat kuota Gemini; tamu memakai koreksi kata kunci.
- **Akurasi soal berita**: soal dibuat AI dari judul berita dan selalu menampilkan link sumber. Periksa sesekali; soal di Firestore koleksi `questions` bisa dihapus/diedit langsung dari Firebase Console.
- **Menambah soal manual**: tambahkan ke `api/_lib/seed.js` dengan format `P(...)` (pilihan ganda) atau `E(...)` (esai).
- Soal TKP memakai jawaban terbaik sebagai kunci (di tes asli skornya bertingkat 1–5).
