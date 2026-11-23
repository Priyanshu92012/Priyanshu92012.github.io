// Measures the four homepages in the BUILT lab and writes src/design-lab/metrics.json.
//   node scripts/design-lab/measure.mjs [--runs 3]
// - Lighthouse (mobile emulation, simulated slow 4G, the default): median of N runs per page.
//   Uses LIGHTHOUSE_BIN if set, otherwise `npx lighthouse@12`.
// - Playwright (desktop 1440, local Chrome): JS bytes before any interaction, bytes after 6 s idle
//   (includes lazy 3D), requests to other hosts, console errors, axe WCAG 2.2 AA at reduced motion.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = 'http://127.0.0.1:4330';
const RUNS = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 3;
const BYTES_ONLY = process.argv.includes('--bytes-only'); // re-measure bytes/axe, keep the last Lighthouse medians
const previous = (() => { try { return JSON.parse(readFileSync(join(root, 'src/design-lab/metrics.json'), 'utf8')); } catch { return null; } })();
const PAGES = { monolith: '/design-lab/monolith/', orbit: '/design-lab/orbit/', signal: '/design-lab/signal/', v2: '/' };
const IGNORED = [/THREE\.Clock/, /GPU stall/i, /WebGL/i, /software WebGL/i];

async function up() { try { return (await fetch(`${BASE}/design-lab/`)).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn('npx', ['astro', 'preview', '--config', 'astro.lab.config.mjs', '--ignore-lock'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const lhBin = process.env.LIGHTHOUSE_BIN;
function lighthouse(url) {
  const dir = mkdtempSync(join(tmpdir(), 'pexe-lh-'));
  const out = join(dir, 'r.json');
  const args = [url, '--quiet', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --enable-unsafe-swiftshader'];
  if (lhBin) execFileSync(lhBin, args, { stdio: 'ignore', env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } });
  else execFileSync('npx', ['-y', 'lighthouse@12', ...args], { stdio: 'ignore' });
  const r = JSON.parse(readFileSync(out, 'utf8'));
  return {
    performance: Math.round(r.categories.performance.score * 100), accessibility: Math.round(r.categories.accessibility.score * 100),
    bestPractices: Math.round(r.categories['best-practices'].score * 100), seo: Math.round(r.categories.seo.score * 100),
    lcp: r.audits['largest-contentful-paint'].numericValue / 1000, cls: r.audits['cumulative-layout-shift'].numericValue, tbt: r.audits['total-blocking-time'].numericValue,
  };
}

const results = {};
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  for (const [id, path] of Object.entries(PAGES)) {
    const m = {};
    // bytes and hosts
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error' && !IGNORED.some((r) => r.test(msg.text()))) errors.push(msg.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const sizes = new Map(); const types = new Map(); let external = 0;
    cdp.on('Network.responseReceived', (e) => { types.set(e.requestId, e.type); const h = new URL(e.response.url).hostname; if (!['127.0.0.1', 'localhost'].includes(h) && !e.response.url.startsWith('data:')) external++; });
    cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));
    await page.goto(BASE + path, { waitUntil: 'load' });
    // concepts with WebGL: wait until the scene has actually taken over, so the 3D chunk is counted
    if (/monolith|orbit/.test(path)) await page.waitForSelector('.mono-stage.is-3d, .o-stage.is-3d', { timeout: 20000 }).catch(() => console.warn(`  ${id}: 3D did not start`));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    m.transferKB = [...sizes.values()].reduce((a, b) => a + b, 0) / 1024;
    m.requests = sizes.size;
    m.external = external;
    m.consoleErrors = errors.length;
    if (errors.length) console.warn(`  ${id} console errors:`, errors.slice(0, 3));
    await ctx.close();

    // JS a phone visitor downloads without interacting (no 3D on phones; idle islands included)
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pp = await pctx.newPage();
    const pcdp = await pctx.newCDPSession(pp);
    await pcdp.send('Network.enable');
    const psizes = new Map(); const ptypes = new Map();
    pcdp.on('Network.responseReceived', (e) => ptypes.set(e.requestId, e.type));
    pcdp.on('Network.loadingFinished', (e) => psizes.set(e.requestId, e.encodedDataLength));
    await pp.goto(BASE + path, { waitUntil: 'networkidle' });
    await pp.waitForTimeout(2500);
    let js = 0; for (const [rid, n] of psizes) if (ptypes.get(rid) === 'Script') js += n;
    m.jsInitialKB = js / 1024;
    m.phoneKB = [...psizes.values()].reduce((a, b) => a + b, 0) / 1024;
    await pctx.close();

    // axe at reduced motion (final, readable state)
    const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const ap = await actx.newPage();
    await ap.goto(`${BASE}${path}?motion=reduce&3d=0`, { waitUntil: 'networkidle' });
    await ap.evaluate(() => document.querySelectorAll('[data-reveal],[data-rv]').forEach((e) => e.classList.add('is-in', 'in')));
    const axe = await new AxeBuilder({ page: ap }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('canvas').analyze();
    const count = (lvl) => axe.violations.filter((v) => v.impact === lvl).reduce((a, v) => a + v.nodes.length, 0);
    m.axe = { serious: count('serious'), critical: count('critical'), moderate: count('moderate') };
    if (m.axe.serious + m.axe.critical) console.warn(`  ${id} axe:`, axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
    await actx.close();

    // lighthouse
    if (BYTES_ONLY && previous?.pages?.[id]?.lighthouse) { m.lighthouse = previous.pages[id].lighthouse; results[id] = m; console.log(`✓ ${id}`, JSON.stringify(m)); continue; }
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(lighthouse(BASE + path));
    const keys = ['performance', 'accessibility', 'bestPractices', 'seo', 'lcp', 'cls', 'tbt'];
    m.lighthouse = Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))]));
    m.lighthouse.runs = RUNS;
    results[id] = m;
    console.log(`✓ ${id}`, JSON.stringify(m));
  }
} finally {
  await browser.close();
  server?.kill();
}

const env = `Lighthouse 12 mobile emulation (simulated slow 4G, median of ${RUNS}) and local Chrome at 1440 px, served by astro preview on this Mac`;
const measuredAt = BYTES_ONLY && previous ? previous.measuredAt : `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
writeFileSync(join(root, 'src/design-lab/metrics.json'), `${JSON.stringify({ measuredAt, environment: env, pages: results }, null, 2)}\n`);
console.log('✓ src/design-lab/metrics.json');
