// Shared geometry for the Monolith sculpture: a stack of thin graphite plates twisted about the
// vertical axis. Used by the WebGL scene and by the static SVG poster (same numbers, same shape).
export const PLATES = 46;
export const PLATE = { w: 1.9, h: 0.084, d: 0.46, pitch: 0.104 };
export const TWIST = 2.5; // radians, bottom to top: the ends turn almost edge-on
export const SCAN_AT = 0.7; // the lime signal line rests at 70 % of the height

export function plateAngle(i: number, twist = TWIST, phase = 0): number {
  return twist * (i / (PLATES - 1) - 0.5) + phase;
}

/** Orthographic silhouette of plate i: front-face width and side-face width (signed: side on the right if > 0). */
export function plateFaces(i: number, twist = TWIST, phase = 0) {
  const a = plateAngle(i, twist, phase);
  return { front: PLATE.w * Math.abs(Math.cos(a)), side: PLATE.d * Math.sin(a) };
}

/** Camera framing shared by scene and poster: visible height at z = 0 (world units). */
export const VIEW_H = 3.86;
export const CAMERA_Z = VIEW_H / 2 / Math.tan((30 / 2) * (Math.PI / 180));
