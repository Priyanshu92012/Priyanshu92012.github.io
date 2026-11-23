// Should a design-lab hero start its WebGL scene? Same outcomes as the V2 HeroLab, but the cheap checks
// run first: probing WebGL creates a GPU context (tens of ms, far more on slow GPUs), so phones,
// touch screens, reduced motion and recruiter mode never pay for it unless the visitor opts in.
import { lowPower, webglAvailable } from '../../lib/prefs';

export type Decision = { auto: boolean; allowed: boolean; why: string };

export function decide3d(): Decision {
  const root = document.documentElement;
  if (new URLSearchParams(location.search).get('3d') === '0') return { auto: false, allowed: false, why: '3D disabled by URL.' };
  if (root.dataset.mode === 'recruiter') return { auto: false, allowed: false, why: 'Recruiter mode: static version.' };
  if (root.dataset.motion === 'reduce') return { auto: false, allowed: true, why: 'Reduced motion: static version.' };
  if (matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches) return { auto: false, allowed: true, why: 'Phone or touch screen: static version loads instantly.' };
  if (lowPower()) return { auto: false, allowed: true, why: 'Low-power device: static version.' };
  if (!webglAvailable()) return { auto: false, allowed: false, why: 'WebGL unavailable: static version.' };
  return { auto: true, allowed: true, why: '' };
}

/** Run `fn` when the browser is idle (after first paint), with a fallback timeout. */
export function whenIdle(fn: () => void, timeout = 1600): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) { const id = w.requestIdleCallback(fn, { timeout }); return () => w.cancelIdleCallback?.(id); }
  const id = window.setTimeout(fn, 500);
  return () => clearTimeout(id);
}
