#!/usr/bin/env node
// Post-build Content-Security-Policy. GitHub Pages cannot send response headers, so every built HTML
// page gets a <meta http-equiv="Content-Security-Policy"> right after <meta charset>, with a SHA-256
// hash for each inline script Astro emitted on that page (theme bootstrap, island loader, directives).
//
// What it enforces: scripts only from this origin or the hashed inline blocks (no eval, no inline
// event handlers, no injected <script>); no plugins; no <base> hijacking; fetch/XHR only to this
// origin; frames only from this origin. Styles allow inline CSS because Astro inlines each page's
// stylesheet and components use style attributes.
// What a meta CSP cannot do (needs real headers): frame-ancestors, report-to, sandbox.
//   node scripts/csp.mjs [dir=dist]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });

/** Executable inline scripts only (JSON-LD and other data blocks are never executed). */
const INLINE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
const isData = (attrs) => /type\s*=\s*["']?(application\/(ld\+)?json|text\/plain)/i.test(attrs);

// Optional analytics (src/lib/analytics.ts): only the configured GoatCounter origin is allowed, and only
// when the build enables it. Without PUBLIC_GOATCOUNTER_CODE the policy stays same-origin only.
const gc = String(process.env.PUBLIC_GOATCOUNTER_CODE ?? '').trim().toLowerCase();
const GC = /^[a-z0-9][a-z0-9-]{1,49}$/.test(gc) ? ` https://${gc}.goatcounter.com` : '';

export function policy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self'${hashes.map((h) => ` '${h}'`).join('')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${GC}`,
    "font-src 'self'",
    `connect-src 'self'${GC}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join('; ');
}

let pages = 0, scripts = 0;
for (const file of walk(root)) {
  let html = readFileSync(file, 'utf8');
  if (!/<meta charset/i.test(html)) continue; // redirect stubs without a head are left alone
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(INLINE)) {
    if (isData(attrs) || !body.trim()) continue;
    hashes.add(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy([...hashes])}">`;
  html = html.replace(/(<meta charset[^>]*>)/i, `$1${meta}`);
  writeFileSync(file, html);
  pages++; scripts += hashes.size;
}
console.log(`✓ CSP: ${pages} pages, ${scripts} inline script hashes, no 'unsafe-inline' or 'unsafe-eval' for scripts`);
