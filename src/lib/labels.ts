// Screen-space label placement shared by the 3D scenes. Greedy and deterministic:
// labels are placed in priority order, then front-to-back; a label that would overlap
// an already placed one is lifted just above it. Cheap enough to run every frame.
export type LabelBox = { id: string; x: number; y: number; w: number; h: number; priority: number; depth: number };

export function declutter(items: LabelBox[], gap = 3): Map<string, number> {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const out = new Map<string, number>();
  const order = [...items].sort((a, b) => b.priority - a.priority || a.depth - b.depth || a.id.localeCompare(b.id));
  for (const it of order) {
    let y = it.y;
    for (let guard = 0; guard < 12; guard++) {
      const hit = placed.find((p) => Math.abs(p.x - it.x) < (p.w + it.w) / 2 + gap && Math.abs(p.y - y) < (p.h + it.h) / 2 + gap);
      if (!hit) break;
      y = hit.y - (hit.h + it.h) / 2 - gap;
    }
    placed.push({ x: it.x, y, w: it.w, h: it.h });
    out.set(it.id, y);
  }
  return out;
}
