import { expect, type Page } from '@playwright/test';

export const ROUTES = [
  '/', '/work/', '/skills/', '/lab/', '/xray/', '/about/', '/recruiter/', '/resume/',
  '/work/test-resource-scheduler/', '/work/gmre-log-parser/', '/work/securemed/', '/work/finbert-xai/',
  '/work/opticlab/', '/work/ticket-reporting-pipeline/', '/work/priyanshu-exe/', '/work/infrastructure-capacity/', '/security-lab/', '/ai-lab/',
  '/de/', '/de/work/', '/de/work/securemed/', '/de/skills/', '/de/lab/', '/de/about/', '/de/recruiter/', '/de/resume/', '/de/security-lab/', '/de/ai-lab/', '/de/xray/',
];

// Library noise that is not ours (React Three Fiber still references THREE.Clock).
const IGNORED = [/THREE\.Clock/, /WebGL.*(context|software)/i, /GPU stall/i, /Automatic fallback to software WebGL/i];

/**
 * Collect console errors/warnings, page errors and ANY request to another host.
 * The V2 site must be fully self-contained: no CDN, no analytics, no inference service.
 * The pet bot's one-time greeting is pre-acknowledged (it would otherwise cover bottom-right
 * controls for a few seconds); pass { greet: true } to test the greeting itself.
 */
export async function guard(page: Page, opts: { greet?: boolean } = {}) {
  const problems: string[] = [];
  if (!opts.greet) await page.addInitScript(() => { try { sessionStorage.setItem('pexe:pet-greeted', '1'); } catch { /* about:blank */ } });
  page.on('console', (m) => {
    if (!['error', 'warning'].includes(m.type()) || IGNORED.some((r) => r.test(m.text()))) return;
    problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) problems.push(`external request: ${r.method()} ${u.host}${u.pathname}`);
  });
  return problems;
}

export async function noHorizontalOverflow(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth,
    wide: [...document.querySelectorAll('body *')].filter((e) => {
      const b = e.getBoundingClientRect();
      if (!(b.width > 0 && b.right > window.innerWidth + 1) || getComputedStyle(e).position === 'fixed') return false;
      if (e.closest('.sr-only, [data-allow-overflow], .lab-canvas, .cst-canvas, .term-root, .ag')) return false;
      // content inside a horizontal scroll container is reachable, not clipped
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && a.getBoundingClientRect().right <= window.innerWidth + 1) return false;
      }
      return true;
    })
      .slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} → ${Math.round(e.getBoundingClientRect().right)}px`) }));
  expect(r.sw, `document wider than viewport (${r.vw}px)`).toBeLessThanOrEqual(r.vw);
  expect(r.wide, 'elements extending past the viewport (clipped content)').toEqual([]);
}

/** Wait until the site-wide React layer (shortcuts, palette, agent) has hydrated. */
export async function ready(page: Page) {
  await page.waitForFunction(() => { const i = document.querySelector('astro-island[component-url*="GlobalUI"]'); return !!i && !i.hasAttribute('ssr'); });
}
