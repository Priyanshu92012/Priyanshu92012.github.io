// Bundle the Worker exactly as wrangler would (esbuild, ESM, workerd conditions) and
// gate it: size budget, no embedded credentials, no private hosts. Used by `npm run ci`.
import { build } from 'esbuild';
import { readFileSync, statSync, mkdirSync } from 'node:fs';

mkdirSync('worker/dist', { recursive: true });
const out = 'worker/dist/worker.js';
await build({
  entryPoints: ['worker/src/index.ts'],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  conditions: ['workerd', 'worker', 'browser'],
  mainFields: ['module', 'main'],
  minify: true,
  legalComments: 'none',
  external: ['node:*'], // provided by workerd's nodejs_compat; only reached by unused credential loaders
  logLevel: 'warning',
});
const code = readFileSync(out, 'utf8');
const kb = statSync(out).size / 1024;
const problems = [];
if (kb > 1024) problems.push(`bundle is ${kb.toFixed(0)} KB (budget 1024 KB)`);
if (/sk-ant-[a-z0-9]{3,}/i.test(code)) problems.push('bundle contains something that looks like an Anthropic key');
if (/\b(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+/.test(code.replace(/\d+\.\d+\.\d+(?=['"])/g, ''))) problems.push('bundle contains a private IP address');
if (/\.(int\.nokia|nsn-net|nokia\.net)\b/i.test(code)) problems.push('bundle contains an internal hostname');
console.log(`worker bundle: ${out} · ${kb.toFixed(1)} KB`);
if (problems.length) { console.error(problems.map((p) => `✗ ${p}`).join('\n')); process.exit(1); }
console.log('✓ size, credential and private-host checks passed');
