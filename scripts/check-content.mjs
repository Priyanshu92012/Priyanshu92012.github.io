// Build gate: scans publishable sources for secrets and private identifiers,
// and reports content that still needs owner review (CONTENT_APPROVAL.md).
// Structural validation of the content model runs in src/data/index.ts (Zod) and Vitest.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { findConfidential } from './confidential.mjs';

const ROOTS = ['src', 'public', 'worker/src'];
const EXT = new Set(['.ts', '.tsx', '.astro', '.mdx', '.md', '.js', '.mjs', '.json', '.html', '.css', '.svg', '.txt', '.toml']);
const RULES = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Internal Nokia hostname', re: /\b[a-z0-9.-]+\.(?:nsn-net|nsn-intra|int\.nokia|ext\.net\.nokia)\.(?:net|com)\b/i },
  { name: 'Private IPv4 address', re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/ },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.has(extname(name))) yield p;
  }
}

let failures = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    for (const r of RULES) {
      const m = text.match(r.re);
      if (m) { failures++; console.error(`✖ ${r.name} in ${file}: "${m[0].slice(0, 12)}…"`); }
    }
  }
}

// Confidential internal names must not appear anywhere in the (public) repository's sources and docs.
const CONF_ROOTS = ['src', 'public', 'worker/src', 'prototypes', 'docs', 'tests', 'scripts'];
const ROOT_DOCS = readdirSync('.').filter((f) => f.endsWith('.md'));
const confFiles = [...CONF_ROOTS.flatMap((r) => [...walk(r)]), ...ROOT_DOCS];
for (const file of confFiles) {
  if (file.endsWith('confidential.mjs')) continue;
  const hits = findConfidential(readFileSync(file, 'utf8'));
  if (hits.length) { failures++; console.error(`✖ confidential term(s) in ${file}: ${hits.join(', ')}`); }
}

const projects = readFileSync('src/data/projects.ts', 'utf8');
const pending = [...projects.matchAll(/slug: '([a-z0-9-]+)'[\s\S]*?review: '([a-z-]+)'/g)].filter((m) => m[2] === 'needs-owner-review').map((m) => m[1]);
if (pending.length) console.warn(`⚠ ${pending.length} record(s) need owner review before production deploy: ${pending.join(', ')} (see CONTENT_APPROVAL.md)`);

if (failures) { console.error(`content check failed: ${failures} issue(s)`); process.exit(1); }
console.log(`✔ content check passed: no secrets, private identifiers or confidential terms (${confFiles.length} files)`);
