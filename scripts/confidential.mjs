// Confidential-term detector shared by the source gate (check-content) and the build gate (check-dist).
// Only SHA-256 prefixes are stored, so this public repository never spells out the terms it blocks
// (internal project/team names, record types and module names). To add a term:
//   node -e "console.log(require('crypto').createHash('sha256').update('<term>').digest('hex').slice(0,24))"
import { createHash } from 'node:crypto';

const BLOCKED = new Set(["83ffc30ffcde4c3488ecbfa2","26c03644ed4e72f183e4da02","6ac5efadc81e8a9261ae85eb","8091aaffa78859b062532ae3","d8d6004c43aa0881a2c3f904","11e74850959a58a843bea93e","1c01f0d57d2215a84d688eb2","f9edc086f9d0d0e5ef12a5e8","d2a26f1ac3ae9eb9528be1d2","f70a0c8ef1aded8f9c6dccd1"]);
const TOKEN = /[a-z0-9_]+(?:-[a-z0-9_]+)*/g;
const hash = (t) => createHash('sha256').update(t).digest('hex').slice(0, 24);

/** Returns the distinct blocked tokens found in the text (as hashes plus a 3-character hint). */
export function findConfidential(text) {
  const hits = new Map();
  for (const m of text.toLowerCase().matchAll(TOKEN)) {
    const tok = m[0];
    // also test each hyphen part and the joined form, so "x-y" and "y" are both caught
    for (const t of new Set([tok, ...tok.split('-')])) {
      const h = hash(t);
      if (BLOCKED.has(h) && !hits.has(h)) hits.set(h, `${t.slice(0, 3)}… (${h.slice(0, 8)})`);
    }
  }
  return [...hits.values()];
}
