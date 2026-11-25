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
      case 'ping': return json({ ok: true });
      default: return json({ ok: false, error: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    return json({ ok: false, error: 'Kesalahan server akun: ' + err.message });
  } finally {
    lock.releaseLock();
  }
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
