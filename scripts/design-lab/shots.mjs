// Captures the design-lab comparison screenshots from the BUILT lab (run `npm run lab:build` first).
//   node scripts/design-lab/shots.mjs            → src/design-lab/shots/<id>-{desktop,mobile,full,bot}.webp
// Starts `astro preview` on :4330 if nothing is listening there, and stops it afterwards.
// Uses the locally installed Chrome (software WebGL), like the e2e suite. No network access.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(root, 'src/design-lab/shots');
const BASE = 'http://127.0.0.1:4330';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { id: 'monolith', path: '/design-lab/monolith/', variant: 'monolith' },
  { id: 'orbit', path: '/design-lab/orbit/', variant: 'orbit' },
  { id: 'signal', path: '/design-lab/signal/', variant: 'signal' },
  { id: 'v2', path: '/', variant: null },
];

async function up() { try { return (await fetch(`${BASE}/design-lab/`)).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn('npx', ['astro', 'preview', '--config', 'astro.lab.config.mjs', '--ignore-lock'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up())) { server.kill(); throw new Error('lab preview did not start on :4330 (run npm run lab:build first)'); }
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'] });
const save = async (buf, name, width) => {
  await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(OUT, name));
  console.log(`✓ ${name}`);
};
// Quiet first visit: no greeting bubble in the comparison shots (the bot shot shows the panel instead).
// The variant is passed as an argument: init scripts are serialised, closures do not survive.
const quiet = (ctx, variant) => ctx.addInitScript((v) => { try { if (v) sessionStorage.setItem(`pexe:pet-greeted:${v}`, '1'); } catch { /* about:blank */ } }, variant);

try {
  for (const p of PAGES) {
    // desktop hero, live (3D where the concept has it)
    let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await quiet(ctx, p.variant);
    let page = await ctx.newPage();
    await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(6500);
    await save(await page.screenshot(), `${p.id}-desktop.webp`, 1440);

    // pet bot panel with an answer (new concepts only)
    if (p.variant) {
      await page.click('.pb-btn');
      await page.waitForSelector('.pbp-q');
      await page.click('.pbp-q >> nth=2');
      await page.waitForTimeout(900);
      await save(await page.screenshot(), `${p.id}-bot.webp`, 1440);
    }
    await ctx.close();

    // full page, reduced motion so every section is in its final, readable state
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await quiet(ctx, p.variant);
    page = await ctx.newPage();
    await page.goto(`${BASE}${p.path}?motion=reduce`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await page.waitForTimeout(1500);
    await save(await page.screenshot({ fullPage: true }), `${p.id}-full.webp`, 960);
    await ctx.close();

    // phone hero
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await quiet(ctx, p.variant);
    page = await ctx.newPage();
    await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await save(await page.screenshot(), `${p.id}-mobile.webp`, 390);
    await ctx.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
