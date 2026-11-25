/**
 * SiapLolos — Server Akun (Google Apps Script + Google Sheet)
 * ------------------------------------------------------------
 * 1. Buat Google Sheet baru → Extensions → Apps Script → tempel file ini.
 * 2. Project Settings → Script Properties → tambah:
 *      API_KEY = (string acak panjang, SAMA dengan GAS_API_KEY di Vercel)
 * 3. Jalankan fungsi setup() sekali (izinkan akses).
 * 4. Deploy → New deployment → Web app
 *      Execute as: Me | Who has access: Anyone
 *    Salin URL /exec → isi GAS_URL di Vercel.
 *
 * Password disimpan sebagai hash SHA-256 bersalt (iterasi), bukan teks asli.
 */

var SHEET_USERS = 'Users';
var SHEET_LOG = 'LoginLog';
var SHEET_FEEDBACK = 'Kritik & Saran';
var HEADERS = ['uid', 'name', 'email', 'salt', 'hash', 'target', 'createdAt', 'lastLogin', 'loginCount', 'status'];
var ITER = 300;

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_USERS) || ss.insertSheet(SHEET_USERS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }
  var lg = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  if (lg.getLastRow() === 0) {
    lg.appendRow(['time', 'email', 'action', 'result']);
    lg.setFrozenRows(1);
  }
  if (!PropertiesService.getScriptProperties().getProperty('API_KEY')) {
    Logger.log('PERINGATAN: Script Property API_KEY belum diisi!');
  }
}

function doGet() {
  return json({ ok: true, service: 'SiapLolos Auth', time: new Date().toISOString() });
}

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json({ ok: false, error: 'Body tidak valid' }); }

  var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || req.apiKey !== key) return json({ ok: false, error: 'Unauthorized' });

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json({ ok: false, error: 'Server sibuk, coba lagi' }); }
  try {
    switch (req.action) {
      case 'register': return json(register(req));
      case 'login': return json(login(req));
      case 'forgot': return json(forgot(req));
      case 'reset': return json(resetPassword(req));
      case 'ping': return json({ ok: true });
      case 'feedback': return json(feedback(req));
      default: return json({ ok: false, error: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    return json({ ok: false, error: 'Kesalahan server akun: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

// Kritik & saran dari website → tab "Kritik & Saran"
function feedback(req) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_FEEDBACK);
  if (!sh) {
    sh = ss.insertSheet(SHEET_FEEDBACK);
    sh.appendRow(['Waktu', 'Nama', 'Email', 'Jenis', 'Rating', 'Pesan', 'Halaman', 'Status']);
    sh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sh.setFrozenRows(1); sh.setColumnWidth(6, 420);
  }
  sh.appendRow([new Date(), String(req.name || '').substring(0, 60), String(req.email || '').substring(0, 80), String(req.type || ''),
    Number(req.rating) || '', String(req.message || '').substring(0, 1500), String(req.page || '').substring(0, 40), 'Baru']);
  return { ok: true };
}

function register(req) {
  var email = String(req.email || '').trim().toLowerCase();
  var name = String(req.name || '').trim().substring(0, 60);
  var password = String(req.password || '');
  if (!email || password.length < 6 || name.length < 2) return { ok: false, error: 'Data pendaftaran tidak lengkap' };
  var sh = sheet();
  if (findRow(sh, email) > 0) { log(email, 'register', 'duplicate'); return { ok: false, error: 'Email sudah terdaftar. Silakan masuk.' }; }

  var salt = Utilities.getUuid().replace(/-/g, '');
  var uid = 'u_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  var now = new Date();
  sh.appendRow([uid, name, email, salt, hash(password, salt), String(req.target || ''), now, now, 1, 'active']);
  log(email, 'register', 'ok');
  return { ok: true, user: { uid: uid, name: name, email: email, target: String(req.target || '') } };
}

function login(req) {
  var email = String(req.email || '').trim().toLowerCase();
  var password = String(req.password || '');
  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + email;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) return { ok: false, error: 'Terlalu banyak percobaan gagal. Coba lagi 10 menit lagi.' };

  var sh = sheet();
  var row = findRow(sh, email);
  if (row < 0) { cache.put(failKey, String(fails + 1), 600); log(email, 'login', 'notfound'); return { ok: false, error: 'Email atau kata sandi salah' }; }

  var v = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  if (v[9] && v[9] !== 'active') return { ok: false, error: 'Akun dinonaktifkan. Hubungi admin.' };
  if (hash(password, v[3]) !== v[4]) {
    cache.put(failKey, String(fails + 1), 600);
    log(email, 'login', 'wrongpass');
    return { ok: false, error: 'Email atau kata sandi salah' };
  }
  cache.remove(failKey);
  sh.getRange(row, 8, 1, 2).setValues([[new Date(), Number(v[8] || 0) + 1]]);
  log(email, 'login', 'ok');
  return { ok: true, user: { uid: v[0], name: v[1], email: v[2], target: v[5] } };
}

/* ───────── Lupa kata sandi (kode 6 digit via email, berlaku 15 menit) ───────── */
function forgot(req) {
  var email = String(req.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Email wajib diisi' };
  var cache = CacheService.getScriptCache();
  var rk = 'fg_' + email;
  var n = Number(cache.get(rk) || 0);
  if (n >= 3) return { ok: false, error: 'Terlalu sering meminta kode. Coba lagi 15 menit lagi.' };
  cache.put(rk, String(n + 1), 900);

  var sh = sheet();
  var row = findRow(sh, email);
  // Selalu jawab "ok" agar orang lain tidak bisa mengecek email mana yang terdaftar
  if (row < 0) { log(email, 'forgot', 'notfound'); return { ok: true }; }

  var code = String(100000 + Math.floor(Math.random() * 900000));
  cache.put('rc_' + email, hash(code, email), 900);
  cache.remove('rt_' + email);
  var name = sh.getRange(row, 2).getValue();
  MailApp.sendEmail({
    to: email,
    name: 'SiapLolos',
    subject: 'Kode reset kata sandi SiapLolos: ' + code,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">' +
      '<h2 style="margin:0 0 8px">Halo, ' + name + '</h2>' +
      '<p>Kami menerima permintaan reset kata sandi akun SiapLolos kamu. Masukkan kode berikut di website:</p>' +
      '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;background:#eef2ff;padding:16px;border-radius:10px">' + code + '</div>' +
      '<p style="color:#6b7280;font-size:13px">Kode berlaku 15 menit. Jika kamu tidak meminta reset, abaikan email ini — kata sandimu tetap aman.</p></div>',
  });
  log(email, 'forgot', 'sent');
  return { ok: true };
}

function resetPassword(req) {
  var email = String(req.email || '').trim().toLowerCase();
  var code = String(req.code || '').trim();
  var password = String(req.password || '');
  if (password.length < 6) return { ok: false, error: 'Kata sandi baru minimal 6 karakter' };
  var cache = CacheService.getScriptCache();
  var tries = Number(cache.get('rt_' + email) || 0);
  var stored = cache.get('rc_' + email);
  if (!stored) return { ok: false, error: 'Kode sudah kedaluwarsa atau belum diminta. Minta kode baru.' };
  if (tries >= 5) { cache.remove('rc_' + email); return { ok: false, error: 'Terlalu banyak percobaan. Minta kode baru.' }; }
  if (hash(code, email) !== stored) {
    cache.put('rt_' + email, String(tries + 1), 900);
    log(email, 'reset', 'wrongcode');
    return { ok: false, error: 'Kode salah. Sisa percobaan: ' + (4 - tries) };
  }
  var sh = sheet();
  var row = findRow(sh, email);
  if (row < 0) return { ok: false, error: 'Akun tidak ditemukan' };
  var salt = Utilities.getUuid().replace(/-/g, '');
  sh.getRange(row, 4, 1, 2).setValues([[salt, hash(password, salt)]]);
  ['rc_', 'rt_', 'fail_'].forEach(function (p) { cache.remove(p + email); });
  log(email, 'reset', 'ok');
  var v = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  return { ok: true, user: { uid: v[0], name: v[1], email: v[2], target: v[5] } };
}

/* ───────── Menu admin di Google Sheet ───────── */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SiapLolos')
    .addItem('Reset kata sandi user (baris terpilih)', 'adminResetSelected')
    .addItem('Setup sheet', 'setup')
    .addToUi();
}

function adminResetSelected() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEET_USERS) return ui.alert('Buka sheet "Users" lalu klik salah satu baris user.');
  var row = sh.getActiveRange().getRow();
  if (row < 2) return ui.alert('Pilih baris user (bukan baris judul).');
  var v = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  var ok = ui.alert('Reset kata sandi', 'Buat kata sandi sementara untuk ' + v[1] + ' (' + v[2] + ') dan kirim ke email-nya?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var temp = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
  var salt = Utilities.getUuid().replace(/-/g, '');
  sh.getRange(row, 4, 1, 2).setValues([[salt, hash(temp, salt)]]);
  try {
    MailApp.sendEmail({ to: v[2], name: 'SiapLolos', subject: 'Kata sandi sementara SiapLolos',
      htmlBody: '<p>Halo ' + v[1] + ',</p><p>Admin telah mereset kata sandimu. Kata sandi sementara: <b style="font-size:20px">' + temp + '</b></p><p>Segera masuk lalu gunakan fitur "Lupa kata sandi" untuk menggantinya.</p>' });
  } catch (e) {}
  log(v[2], 'adminReset', 'ok');
  ui.alert('Berhasil. Kata sandi sementara: ' + temp + '\n(Sudah dikirim ke email user)');
}

function sheet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS); }
  return sh;
}

function findRow(sh, email) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var f = sh.getRange(2, 3, last - 1, 1).createTextFinder(email).matchEntireCell(true).findNext();
  return f ? f.getRow() : -1;
}

function hash(password, salt) {
  var h = salt + '|' + password;
  for (var i = 0; i < ITER; i++) {
    h = toHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

function toHex(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function log(email, action, result) {
  try {
    var lg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
    if (lg) lg.appendRow([new Date(), email, action, result]);
  } catch (e) {}
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
