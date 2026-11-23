// Concept C: the cover's signal line. A sum of sines drawn as one SVG path; the pointer raises a
// local pulse where it crosses the line. ~30 fps, paused off-screen and under reduced motion.
export function wavePath(phase: number, width: number, height: number, bump = -1, bumpAmp = 0, step = 6): string {
  const mid = height / 2;
  let d = '';
  for (let x = 0; x <= width; x += step) {
    const u = x / width;
    let y = Math.sin(u * 22 + phase) * 0.18 + Math.sin(u * 61 - phase * 1.7) * 0.06 + Math.sin(u * 7 + phase * 0.4) * 0.22;
    y *= mid * 0.55 * (0.35 + 0.65 * Math.sin(Math.PI * u));
    if (bump >= 0) { const g = Math.exp(-((x - bump) ** 2) / (2 * 40 ** 2)); y += Math.sin(x * 0.22 + phase * 6) * mid * 0.8 * g * bumpAmp; }
    d += `${x === 0 ? 'M' : 'L'}${x} ${(mid + y).toFixed(1)}`;
  }
  return d;
}

export function bootWave(svg: SVGSVGElement | null): void {
  if (!svg) return;
  const path = svg.querySelector('path');
  if (!path) return;
  const reduce = document.documentElement.dataset.motion === 'reduce' || document.documentElement.dataset.mode === 'recruiter';
  if (reduce) return;
  const W = Number(svg.dataset.w), H = Number(svg.dataset.h);
  let phase = 0, bump = -1, amp = 0, ampTarget = 0, visible = true, last = 0, raf = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(performance.now()); }).observe(svg);
  window.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const inside = e.clientY > r.top - 80 && e.clientY < r.bottom + 80;
    bump = ((e.clientX - r.left) / r.width) * W;
    ampTarget = inside ? 1 : 0;
  }, { passive: true });
  function loop(t: number) {
    cancelAnimationFrame(raf);
    if (!visible) return;
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    phase += dt * 0.9;
    amp += (ampTarget - amp) * Math.min(1, dt * 4);
    path!.setAttribute('d', wavePath(phase, W, H, bump, amp));
  }
  loop(performance.now());
}

/** A decorative barcode (Code-39-like widths) generated from a string. */
export function barcodeBars(text: string): { x: number; w: number }[] {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    for (let b = 0; b < 5; b++) {
      const w = (c >> b) & 1 ? 2.4 : 1;
      if (b % 2 === 0) bars.push({ x, w });
      x += w + 1.2;
    }
    x += 2;
  }
  return bars;
}
