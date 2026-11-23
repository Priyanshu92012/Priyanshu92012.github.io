// Shared Spatial Lab geometry: used by the SSR isometric poster AND the 3D scene,
// so both views show the same world. Height encodes public evidence.
import { projects, projectRelations, type EvidenceLevel, type DomainId, type Project } from '../data/index';

export const FOOTPRINT = 1.15;
export const HEIGHT: Record<EvidenceLevel, number> = { public: 1.75, documented: 1.35, reported: 0.85, pending: 0.3 };
export const DOMAIN_HEX: Record<DomainId, string> = { systems: '#7A8CFF', ai: '#8BFFB0', security: '#FF885E', research: '#C9D3E3' };

export type LabModule = { slug: string; x: number; z: number; h: number; color: string; project: Project };
export type LabTrace = { a: string; b: string; points: [number, number][]; shared: string[]; color: string };

export function labModules(): LabModule[] {
  return projects.map((p) => ({ slug: p.slug, x: p.lab.x, z: p.lab.z, h: HEIGHT[p.evidence], color: DOMAIN_HEX[p.domains[0]], project: p }));
}

/** Orthogonal floor routes between projects that share ≥2 skills (real relationships, not decoration). */
export function labTraces(limit = 10): LabTrace[] {
  const mods = new Map(labModules().map((m) => [m.slug, m]));
  return projectRelations(2).slice(0, limit).map((r) => {
    const A = mods.get(r.a)!, B = mods.get(r.b)!;
    return { a: r.a, b: r.b, shared: r.shared, color: A.color, points: [[A.x, A.z], [B.x, A.z], [B.x, B.z]] };
  });
}

// Isometric projection matching the 3D camera at (+x, +y, +z) looking at the origin.
const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
export function iso(x: number, y: number, z: number, scale = 40): [number, number] {
  return [(x - z) * C * scale, (x + z) * S * scale - y * scale];
}
