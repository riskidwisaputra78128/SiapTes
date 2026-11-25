// Server dev lokal: `npm run dev` → http://localhost:3000
// Menjalankan /public sebagai statis dan /api/*.js seperti Vercel Functions.
// Tanpa env Firebase/GAS, data disimpan di memori (hilang saat server mati).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const pub = path.join(root, 'public');
const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    const file = path.join(root, 'api', name + '.js');
    if (!name || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Endpoint tidak ada"}'); }
    try {
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    } catch (e) {
      console.error(e); res.statusCode = 500; return res.end('{"error":"dev server error"}');
    }
  }
  let p = path.normalize(path.join(pub, decodeURIComponent(url.pathname)));
  if (!p.startsWith(pub)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) p = path.join(pub, 'index.html');
  res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => {
  console.log(`SiapLolos dev → http://localhost:${PORT}`);
  console.log(`  Firebase: ${process.env.FIREBASE_SERVICE_ACCOUNT ? 'aktif' : 'memori (dev)'} | Akun: ${process.env.GAS_URL ? 'Apps Script' : 'memori (dev)'} | AI: ${process.env.GEMINI_API_KEY ? 'aktif' : 'nonaktif (koreksi kata kunci)'}`);
});
