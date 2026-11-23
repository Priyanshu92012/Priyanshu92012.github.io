// Shared page behaviour for the design-lab concepts (static HTML + this small script).
import { emit } from '../../lib/bus';
import { emitPet } from '../../islands/petbot/events';

/** Flagship disclosures: [data-fs] item, [data-fs-toggle] button, details region via aria-controls. */
export function bootShowcases(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-fs-toggle]').forEach((b) => {
    b.addEventListener('click', () => {
      const item = b.closest<HTMLElement>('[data-fs]');
      if (!item) return;
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      item.classList.toggle('is-open', open);
      const label = b.querySelector<HTMLElement>('[data-fs-label]');
      if (label) label.textContent = open ? (b.dataset.close ?? 'Close') : (b.dataset.open ?? 'Read more');
      if (open) emitPet({ kind: 'project', slug: item.dataset.fs! });
    });
  });
  document.querySelectorAll<HTMLAnchorElement>('[data-fs] a[href^="/work/"]').forEach((a) =>
    a.addEventListener('click', () => emitPet({ kind: 'project', slug: a.closest<HTMLElement>('[data-fs]')!.dataset.fs! })));
}

/** Buttons that open the Pet Bot, optionally with a question. */
export function bootAsk(): void {
  document.querySelectorAll<HTMLElement>('[data-ask]').forEach((b) =>
    b.addEventListener('click', () => emit('pexe:agent-open', { prompt: b.dataset.ask || undefined, send: !!b.dataset.ask })));
}

/** Minimal mobile menu: [data-menu-btn] toggles [data-menu]. */
export function bootMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!btn || !menu) return;
  const set = (open: boolean) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); document.documentElement.classList.toggle('menu-open', open); };
  btn.addEventListener('click', () => set(Boolean(menu.hidden)));
  menu.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
}

export const reducedMotion = () => document.documentElement.dataset.motion === 'reduce' || document.documentElement.dataset.mode === 'recruiter';

/** Load GSAP + ScrollTrigger after idle (never under reduced motion). */
export async function loadGsap() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

export function afterLoad(fn: () => void): void {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const go = () => (ric ? ric(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
}

/** Reveal-on-scroll without GSAP: [data-rv] gains .in when it enters (content is visible without JS). */
export function bootReveal(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-rv]');
  if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  document.documentElement.classList.add('rv-ready');
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
  setTimeout(() => els.forEach((e) => e.classList.add('in')), 4000); // safety: never leave content hidden
}
