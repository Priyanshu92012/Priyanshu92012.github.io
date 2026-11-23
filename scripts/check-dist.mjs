// Post-build gate for everything that would be published. Fails the build on:
//  - AI inference endpoints or API-key headers (the public site must not call any AI service)
//  - confidential internal names (hashed list in scripts/confidential.mjs)
//  - source maps, dotfiles, local filesystem paths, or e-mail addresses other than the owner's public one
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { findConfidential } from './confidential.mjs';

const all = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? all(p) : [p]; });
const DIR = process.argv[2] ?? 'dist';
const files = all(DIR);
const text = files.filter((f) => /\.(js|mjs|html|css|json|txt|xml|svg|webmanifest)$/.test(f));
const OWNER_EMAIL = (readFileSync('src/data/profile.ts', 'utf8').match(/mailto:([^'"\s]+)/) ?? [])[1];
const INFERENCE = [/api\.anthropic\.com/, /anthropic-version/, /openai\.com/, /generativelanguage\.googleapis/, /gateway\.ai\.cloudflare\.com/, /\/v2\/chat/, /workers\.dev/, /x-api-key/i];
const problems = [];

for (const f of files) {
  if (f.endsWith('.map')) problems.push(`${f}: source map`);
  if (basename(f).startsWith('.')) problems.push(`${f}: dotfile`);
}
for (const f of text) {
  const code = readFileSync(f, 'utf8');
  for (const re of INFERENCE) if (re.test(code)) problems.push(`${f}: inference endpoint ${re}`);
  const conf = findConfidential(code);
  if (conf.length) problems.push(`${f}: confidential term(s) ${conf.join(', ')}`);
  if (/(?:\/Users\/|\/home\/[a-z]|[A-Z]:\\Users\\)/.test(code)) problems.push(`${f}: local filesystem path`);
  for (const m of code.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    if (m[0] !== OWNER_EMAIL && !/@(example\.(com|org)|[0-9.]+x?\.(png|webp|jpg))$/.test(m[0])) problems.push(`${f}: unexpected e-mail address ${m[0]}`);
  }
}
if (problems.length) { console.error(`✗ dist gate failed:\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log(`✓ dist gate: ${files.length} files (${text.length} text) · no inference endpoints, confidential terms, source maps, dotfiles, local paths or unknown e-mail addresses`);
