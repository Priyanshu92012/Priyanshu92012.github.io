// Concept B ring definitions, shared by the WebGL scene and the static SVG poster.
// Units are fractions of the portrait box (1 = portrait height). Ring centre sits at the
// upper chest, so orbits pass behind the head and in front of the shoulders.
import type { DomainId } from '../../data/index';

export type RingDef = { slug: string; domain: DomainId; r: number; rx: number; rz: number; speed: number };

export const RINGS: RingDef[] = [
  // negative rx: the upper half of every orbit passes BEHIND the head, the lower half in front of the chest
  { slug: 'test-resource-scheduler', domain: 'systems', r: 0.42, rx: -1.22, rz: 0.16, speed: 0.06 },
  { slug: 'securemed', domain: 'security', r: 0.5, rx: -1.33, rz: -0.32, speed: -0.045 },
  { slug: 'finbert-xai', domain: 'ai', r: 0.58, rx: -1.1, rz: 0.5, speed: 0.035 },
];
/** Ring centre, relative to the portrait box (0..1 from left / top). */
export const CENTER = { x: 0.5, y: 0.47 };

export const COLORS: Record<string, string> = { systems: '#9aa6ff', security: '#ff9a6b', ai: '#7dffc0' };

/** Point on a ring (unit circle rotated about X by rx, then Z by rz). Returns x right, y up, z towards the viewer. */
export function ringPoint(def: Pick<RingDef, 'rx' | 'rz'>, theta: number, r = 1): [number, number, number] {
  const x0 = Math.cos(theta) * r, y0 = Math.sin(theta) * r;
  const y1 = y0 * Math.cos(def.rx), z1 = y0 * Math.sin(def.rx);
  return [x0 * Math.cos(def.rz) - y1 * Math.sin(def.rz), x0 * Math.sin(def.rz) + y1 * Math.cos(def.rz), z1];
}

/** SVG path data for the back (z < 0) or front (z ≥ 0) half of a ring, in portrait-box units (y down). */
export function ringPath(def: RingDef, half: 'back' | 'front', steps = 160): string {
  const segs: string[] = [];
  let open = false;
  for (let i = 0; i <= steps; i++) {
    const [x, y, z] = ringPoint(def, (i / steps) * Math.PI * 2, def.r);
    const inHalf = half === 'front' ? z >= 0 : z < 0;
    const px = (CENTER.x + x).toFixed(4), py = (CENTER.y - y).toFixed(4);
    if (inHalf) { segs.push(`${open ? 'L' : 'M'}${px} ${py}`); open = true; } else open = false;
  }
  return segs.join('');
}
