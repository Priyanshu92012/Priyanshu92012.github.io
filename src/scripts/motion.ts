// Scroll choreography (GSAP + ScrollTrigger), loaded after the first painted frame on pages that opt in.
import { afterPaint } from '../directives/afterpaint';
// Content is visible without it: .js [data-reveal] starts hidden only while this
// module is expected, and a safety timer reveals everything if it never arrives.
const root = document.documentElement;

function revealAll() {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
}

export async function initMotion() {
  if (root.dataset.motion === 'reduce') return revealAll();
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 92%',
    once: true,
    onEnter: (els) => els.forEach((el, i) => setTimeout(() => el.classList.add('is-in'), i * 60)),
  });

  // draw SVG strokes when diagrams enter
  document.querySelectorAll<SVGSVGElement>('svg:has([data-draw])').forEach((svg) => {
    const parts = svg.querySelectorAll<SVGGeometryElement>('[data-draw]');
    parts.forEach((p) => {
      const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 300;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    gsap.to(parts, {
      strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', stagger: 0.04,
      scrollTrigger: { trigger: svg, start: 'top 85%', once: true },
      onComplete: () => parts.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }),
    });
  });

  // oversized feature numerals drift against the scroll
  gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
    gsap.fromTo(el, { yPercent: 18 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // hero name: subtle tracking change as the hero scrolls away
  const name = document.querySelector<HTMLElement>('[data-hero-name]');
  if (name) gsap.to(name, { letterSpacing: '-0.08em', opacity: 0.35, ease: 'none', scrollTrigger: { trigger: name, start: 'top top+=60', end: 'bottom top', scrub: true } });
}

export function bootMotion() {
  const safety = setTimeout(revealAll, 2500);
  const go = () => initMotion().then(() => clearTimeout(safety)).catch(revealAll);
  afterPaint(go, 1200); // GSAP loads after the first painted frame, never in competition with the hero
}
