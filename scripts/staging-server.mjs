// Access-protected local staging server for the V2 build.
//   node scripts/staging-server.mjs [siteDir=.staging/site] [--port 4400] [--host 0.0.0.0|127.0.0.1]
// - HTTP Basic Auth on every request (random password unless STAGING_USER / STAGING_PASS are set),
//   credentials saved to .staging/credentials.txt (git-ignored).
// - Reachable from this machine and devices on the same network only; never deployed anywhere.
// - noindex, no-store, no framing, no referrer; path-traversal safe; failed-login lockout per IP.
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const ROOT = resolve(args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a) && !/^\d+\.\d+/.test(a)) ?? '.staging/site');
const PORT = Number(opt('port', '4400'));
const HOST = opt('host', '0.0.0.0');
const USER = process.env.STAGING_USER || 'staging';
const PASS = process.env.STAGING_PASS || randomBytes(9).toString('base64url');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon' };
const SECURITY = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const fails = new Map(); // ip -> { n, until }

function authorised(header) {
  if (!header?.startsWith('Basic ')) return false;
  const given = Buffer.from(Buffer.from(header.slice(6), 'base64').toString('utf8'));
  const want = Buffer.from(`${USER}:${PASS}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function file(path) {
  try { const s = await stat(path); return s.isFile() ? path : s.isDirectory() ? file(join(path, 'index.html')) : null; } catch { return null; }
}

const server = createServer(async (req, res) => {
  const ip = req.socket.remoteAddress ?? '?';
  const f = fails.get(ip);
  if (f && f.until > Date.now()) { res.writeHead(429, { ...SECURITY, 'Retry-After': '600' }); return res.end('Too many failed logins. Try again in 10 minutes.'); }
  if (!authorised(req.headers.authorization)) {
    if (req.headers.authorization) {
      const n = (f?.n ?? 0) + 1;
      fails.set(ip, { n, until: n >= 10 ? Date.now() + 600_000 : 0 });
    }
    res.writeHead(401, { ...SECURITY, 'WWW-Authenticate': 'Basic realm="PRIYANSHU.EXE staging", charset="UTF-8"' });
    return res.end('Authentication required.');
  }
  fails.delete(ip);
  if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405, SECURITY); return res.end(); }
  let path;
  try { path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname); } catch { res.writeHead(400, SECURITY); return res.end(); }
  const target = resolve(ROOT, `.${path}`);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) { res.writeHead(403, SECURITY); return res.end(); }
  const found = await file(target);
  const servePath = found ?? (await file(join(ROOT, '404.html')));
  if (!servePath) { res.writeHead(404, SECURITY); return res.end('Not found'); }
  const body = await readFile(servePath);
  res.writeHead(found ? 200 : 404, { ...SECURITY, 'Content-Type': TYPES[extname(servePath)] ?? 'application/octet-stream', 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
});

await stat(join(ROOT, 'index.html')).catch(() => { console.error(`No build at ${ROOT}. Run: npm run staging:build`); process.exit(1); });
await mkdir('.staging', { recursive: true });
const lan = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
server.listen(PORT, HOST, async () => {
  const urls = [`http://localhost:${PORT}/`, ...(HOST === '0.0.0.0' ? lan.map((a) => `http://${a}:${PORT}/`) : [])];
  await writeFile('.staging/credentials.txt', `user: ${USER}\npassword: ${PASS}\n${urls.join('\n')}\n`, { mode: 0o600 });
  console.log(`PRIYANSHU.EXE staging (access-protected) serving ${ROOT}`);
  console.log(`  desktop: ${urls[0]}`);
  for (const u of urls.slice(1)) console.log(`  phone (same Wi-Fi): ${u}`);
  console.log(`  user: ${USER}   password: ${PASS}   (also in .staging/credentials.txt)`);
  console.log('  Stop with Ctrl+C. Nothing is uploaded or deployed.');
});
