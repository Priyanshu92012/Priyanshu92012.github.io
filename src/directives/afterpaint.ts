// client:afterpaint: hydrate once the page has loaded AND the browser has reported a contentful paint,
// then on idle. `client:idle` fires as soon as the main thread is free, which on this site is just before
// the first paint, so the islands' JavaScript (React, chat, tiger, GSAP) competed with the hero portrait
// for bandwidth and pushed out the Largest Contentful Paint. Waiting for the paint keeps the first screen first.
import type { ClientDirective } from 'astro';

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };

/** Resolves after the browser has reported a (largest) contentful paint, or after `max` ms. */
function contentfulPaint(max = 2500): Promise<void> {
  return new Promise((done) => {
    const types = (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes) || [];
    const type = types.includes('largest-contentful-paint') ? 'largest-contentful-paint' : types.includes('paint') ? 'paint' : null;
    if (!type) return done();
    const timer = setTimeout(finish, max);
    let po: PerformanceObserver | undefined;
    function finish() { clearTimeout(timer); po?.disconnect(); done(); }
    try {
      po = new PerformanceObserver((list) => {
        if (list.getEntries().some((e) => type !== 'paint' || e.name === 'first-contentful-paint')) finish();
      });
      po.observe({ type, buffered: true });
    } catch { finish(); }
  });
}

/** Runs `cb` after the load event (eager images included), a reported contentful paint, one more frame and an idle period. */
export function afterPaint(cb: () => void, timeout = 1500): void {
  const idle = () => {
    const ric = (window as IdleWindow).requestIdleCallback;
    if (ric) ric(cb, { timeout }); else setTimeout(cb, 120);
  };
  const go = () => contentfulPaint().then(() => requestAnimationFrame(() => requestAnimationFrame(idle)));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

const afterPaintDirective: ClientDirective = (load) => {
  afterPaint(async () => { const hydrate = await load(); await hydrate(); });
};

export default afterPaintDirective;
