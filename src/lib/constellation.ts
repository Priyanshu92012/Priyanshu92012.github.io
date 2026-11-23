// Deterministic layout for the Skills Constellation. Shared by the SSR SVG poster,
// the interactive 2D map and the 3D scene, so every view shows the same graph and
// switching views never moves a node. Pure function of the content model.
import { knowledgeGraph, type GraphEdge, type GraphNode, type DomainId } from '../data/index';
import { DOMAIN_HEX } from './lab';
import { rng } from './sim/rng';

export type CNode = GraphNode & { x: number; y: number; z: number; r: number; color: string; degree: number };
export type CLayout = { nodes: CNode[]; edges: GraphEdge[]; byId: Map<string, CNode>; neighbors: Map<string, Set<string>> };

const ORDER: DomainId[] = ['systems', 'ai', 'security', 'research'];
const W = 1000, H = 760;
const RING = { domain: [92, 64], project: [250, 190], skill: [395, 305] } as const; // ellipse radii (x, y) in px

let cache: CLayout | null = null;

const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
const angDist = (a: number, b: number) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, TAU - d); };
function circMean(angles: number[], weights: number[]): number {
  let x = 0, y = 0;
  angles.forEach((a, i) => { x += Math.cos(a) * weights[i]; y += Math.sin(a) * weights[i]; });
  return Math.atan2(y, x);
}

/**
 * Structured radial layout: domain hubs at the core, projects on a middle ring inside
 * their primary domain's sector, skills on the outer ring next to the projects that
 * evidence them. Deterministic and readable at every size; no physics needed.
 */
export function constellationLayout(): CLayout {
  if (cache) return cache;
  const { nodes, edges } = knowledgeGraph();
  const r = rng(2026);
  const degree = new Map<string, number>();
  for (const e of edges) { degree.set(e.source, (degree.get(e.source) ?? 0) + 1); degree.set(e.target, (degree.get(e.target) ?? 0) + 1); }

  const projectsOf = (d: DomainId) => nodes.filter((n) => n.kind === 'project' && n.domain === d);
  const skillsOf = (d: DomainId) => nodes.filter((n) => n.kind === 'skill' && n.domain === d);
  const weight = ORDER.map((d) => Math.max(1, projectsOf(d).length * 1.6 + skillsOf(d).length));
  const total = weight.reduce((a, b) => a + b, 0);
  const angle = new Map<string, number>();
  let a0 = -Math.PI * 0.92; // start at the left, go clockwise (screen y grows downwards)
  ORDER.forEach((d, i) => {
    const span = (weight[i] / total) * TAU;
    angle.set(`domain:${d}`, a0 + span / 2);
    const ps = projectsOf(d);
    ps.forEach((p, k) => angle.set(p.id, a0 + (span * (k + 0.5)) / ps.length));
    a0 += span;
  });

  // skills: target angle = weighted circular mean of their projects (+ a pull to their own domain)
  const skills = nodes.filter((n) => n.kind === 'skill');
  const target = new Map<string, number>();
  for (const s of skills) {
    const ps = edges.filter((e) => e.kind === 'project-skill' && e.target === s.id).map((e) => angle.get(e.source)!);
    target.set(s.id, circMean([...ps, angle.get(`domain:${s.domain}`)!], [...ps.map(() => 1), 0.6]));
  }
  // evenly spaced slots, assigned in target order with the rotation that minimises total displacement
  const sorted = [...skills].sort((x, y) => wrap(target.get(x.id)!) - wrap(target.get(y.id)!));
  const step = TAU / sorted.length;
  let best = 0, bestCost = Infinity;
  for (let k = 0; k < 72; k++) {
    const off = (k / 72) * step + wrap(target.get(sorted[0].id)!) - step / 2;
    const cost = sorted.reduce((c, n, i) => c + angDist(off + i * step, target.get(n.id)!) ** 2, 0);
    if (cost < bestCost) { bestCost = cost; best = off; }
  }
  sorted.forEach((n, i) => angle.set(n.id, best + i * step));

  const out: CNode[] = nodes.map((n) => {
    const a = angle.get(n.id)!;
    const [rx, ry] = RING[n.kind];
    const jitter = n.kind === 'skill' ? (sorted.indexOf(n) % 2) * 26 - 8 : 0; // alternate radius → label room
    const deg = degree.get(n.id) ?? 0;
    const depth = n.kind === 'domain' ? 0 : (r.next() - 0.5) * (n.kind === 'project' ? 0.6 : 1.2);
    return {
      ...n,
      x: Math.round(W / 2 + Math.cos(a) * (rx + jitter * (rx / ry) * 0.75)),
      y: Math.round(H / 2 + Math.sin(a) * (ry + jitter)),
      z: Math.round(depth * 1000) / 1000,
      r: n.kind === 'domain' ? 12 : n.kind === 'project' ? 4.5 + n.weight * 1.4 : 3 + Math.min(n.weight, 5) * 0.9,
      color: DOMAIN_HEX[n.domain],
      degree: deg,
    };
  });
  const byId = new Map(out.map((n) => [n.id, n]));
  const neighbors = new Map<string, Set<string>>();
  for (const n of out) neighbors.set(n.id, new Set());
  for (const e of edges) { neighbors.get(e.source)!.add(e.target); neighbors.get(e.target)!.add(e.source); }
  cache = { nodes: out, edges, byId, neighbors };
  return cache;
}

export const VIEW = { w: W, h: H };

/** Curved edge path (slight bow away from the centre) for the SVG views. */
export function edgePath(a: CNode, b: CNode): string {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const bow = 0.12;
  return `M${a.x} ${a.y} Q${(mx - dy * bow).toFixed(1)} ${(my + dx * bow).toFixed(1)} ${b.x} ${b.y}`;
}

/** Ids highlighted when `id` is focused: itself, its neighbours, and for skills the domains of their projects. */
export function neighbourhood(id: string | null): Set<string> | null {
  if (!id) return null;
  const { neighbors } = constellationLayout();
  const set = new Set<string>([id]);
  for (const n of neighbors.get(id) ?? []) set.add(n);
  return set;
}
