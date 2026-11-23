// Prepares the V3 design-lab portrait copies from the owner's original photograph.
//   node scripts/design-lab/portrait.mjs "<original.png>"
//
// - The original is never modified or committed.
// - Person mask: macOS Vision (on-device, no network), compiled from segment.swift on first run.
// - Only the alpha channel is generated. Facial pixels are copied unchanged; edge pixels get
//   standard colour unmixing (F = (C - (1-a)B) / a) so the old background does not glow on dark pages.
// - Outputs are re-encoded by sharp without any metadata (no EXIF/XMP/ICC/text chunks).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../src/assets/portrait');
const original = process.argv[2];
if (!original || !existsSync(original)) { console.error('usage: node scripts/design-lab/portrait.mjs <original image>'); process.exit(1); }

const work = mkdtempSync(join(tmpdir(), 'pexe-portrait-'));
const bin = join(work, 'segment');
execFileSync('swiftc', ['-O', join(here, 'segment.swift'), '-o', bin], { stdio: 'inherit' });
const maskPath = join(work, 'mask.png');
execFileSync(bin, [original, maskPath], { stdio: 'inherit' });

const { data: rgb, info } = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const mask = await sharp(maskPath).greyscale().resize(w, h).raw().toBuffer();

// Local background colour via normalised convolution: blur(C·(1-m)) / blur(1-m).
const bgOnly = Buffer.alloc(w * h * 3);
const inv = Buffer.alloc(w * h);
for (let i = 0; i < w * h; i++) {
  const k = 1 - mask[i] / 255;
  inv[i] = Math.round(k * 255);
  for (let c = 0; c < 3; c++) bgOnly[i * 3 + c] = Math.round(rgb[i * 3 + c] * k);
}
// Local foreground colour the same way: blur(C·m) / blur(m) (used where alpha is too faint to unmix).
const fgOnly = Buffer.alloc(w * h * 3);
for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) fgOnly[i * 3 + c] = Math.round((rgb[i * 3 + c] * mask[i]) / 255);
const raw3 = { raw: { width: w, height: h, channels: 3 } };
const raw1 = { raw: { width: w, height: h, channels: 1 } };
const bgBlur = await sharp(bgOnly, raw3).blur(24).raw().toBuffer();
const invBlur = await sharp(inv, raw1).blur(24).extractChannel(0).raw().toBuffer(); // sharp returns 3 channels otherwise
const fgBlur = await sharp(fgOnly, raw3).blur(5).raw().toBuffer();
const mBlur = await sharp(mask, raw1).blur(5).extractChannel(0).raw().toBuffer();

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const out = Buffer.alloc(w * h * 4);
let edge = 0;
for (let i = 0; i < w * h; i++) {
  const a0 = mask[i] / 255;
  const a = Math.min(1, Math.max(0, (a0 - 0.04) / 0.96)); // trims the faint outer halo
  const edgePx = a0 > 0.02 && a0 < 0.98;
  if (edgePx) edge++;
  for (let c = 0; c < 3; c++) {
    const C = rgb[i * 3 + c];
    let F = C;
    if (edgePx) {
      const B = invBlur[i] > 4 ? (bgBlur[i * 3 + c] * 255) / invBlur[i] : C;
      const U = Math.min(255, Math.max(0, (C - (1 - a0) * B) / a0));
      const Fg = mBlur[i] > 4 ? Math.min(255, (fgBlur[i * 3 + c] * 255) / mBlur[i]) : U;
      const t = smooth(0.3, 0.7, a0); // faint pixels take the local foreground colour, solid ones the unmixed colour
      F = t * U + (1 - t) * Fg;
    }
    out[i * 4 + c] = Math.round(F);
  }
  out[i * 4 + 3] = Math.round(a * 255);
}

const cut = sharp(out, { raw: { width: w, height: h, channels: 4 } });
// Sources for astro:assets (it generates the responsive AVIF/WebP variants at build time).
await cut.clone().webp({ quality: 92, alphaQuality: 95, effort: 6 }).toFile(join(OUT, 'portrait-cutout.webp'));
await sharp(original).removeAlpha().jpeg({ quality: 90, mozjpeg: true }).toFile(join(OUT, 'portrait-studio.jpg'));

for (const f of ['portrait-cutout.webp', 'portrait-studio.jpg']) {
  const m = await sharp(join(OUT, f)).metadata();
  if (m.exif || m.xmp || m.iptc || m.icc) throw new Error(`${f} still carries metadata`);
  console.log(`✓ ${f} ${m.width}×${m.height} ${m.channels}ch · no metadata`);
}
console.log(`✓ edge pixels unmixed: ${edge}`);
