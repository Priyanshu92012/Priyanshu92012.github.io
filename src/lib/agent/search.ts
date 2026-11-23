// Lexical retrieval (BM25) over the knowledge documents, with skill-alias expansion.
// Plan §8: start lexical; add embeddings only if evaluation shows the need.
import { skillList } from '../../data/index';
import { knowledge, type KDoc } from './knowledge';

const STOP = new Set('a an and are as at be but by can could did do does for from has have he her his how i if in into is it its me my of on or our she so than that the their them then there these they this to was we were what when where which who why will with would you your about tell show give any some does doing much many more most also just very really please whats stuttgart germany weather'.split(' '));

export function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

/** Skills whose alias phrases occur in the text (word-boundary match). */
export function detectSkills(text: string): string[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9+#./ -]+/g, ' ').replace(/\s+/g, ' ')} `;
  const hits: string[] = [];
  for (const s of skillList) {
    const phrases = [s.label.toLowerCase(), ...s.aliases];
    if (phrases.some((ph) => {
      const p = ph.toLowerCase().trim();
      if (p.length < 2) return false;
      const re = new RegExp(`[\\s(,;:/]${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s),;:./]`);
      return re.test(t);
    })) hits.push(s.id);
  }
  return hits;
}

type Indexed = { doc: KDoc; tf: Map<string, number>; len: number };
/** Prefer primary evidence (projects, profile) over derived summaries (skill index pages). */
const KIND_WEIGHT: Record<KDoc['kind'], number> = { project: 1, profile: 1, site: 0.9, skill: 0.75 };
let index: { docs: Indexed[]; df: Map<string, number>; avg: number } | null = null;

function build() {
  const docs = knowledge().map<Indexed>((doc) => {
    const toks = tokenize(`${doc.title} ${doc.title} ${doc.text} ${doc.keywords}`);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { doc, tf, len: toks.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length;
  index = { docs, df, avg };
  return index;
}

export type SearchHit = { id: string; title: string; url: string; snippet: string; score: number; projectSlug?: string; kind: KDoc['kind'] };

export function search(query: string, opts: { limit?: number; domain?: string; kinds?: KDoc['kind'][] } = {}): SearchHit[] {
  const { docs, df, avg } = index ?? build();
  const N = docs.length;
  const base = tokenize(query);
  // alias expansion: "explainability" also searches the xai skill vocabulary
  const expanded = [...base];
  for (const id of detectSkills(query)) {
    const s = skillList.find((x) => x.id === id)!;
    expanded.push(...tokenize(s.label));
  }
  const terms = [...new Set(expanded)];
  if (!terms.length) return [];
  const k1 = 1.4, b = 0.75;
  const scored = docs
    .filter((d) => !opts.kinds || opts.kinds.includes(d.doc.kind))
    .filter((d) => !opts.domain || !d.doc.projectSlug || d.doc.keywords.includes(opts.domain))
    .map((d) => {
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg)));
      }
      return { d, score: score * KIND_WEIGHT[d.doc.kind] };
    })
    .filter((x) => x.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 6);
  return scored.map(({ d, score }) => ({
    id: d.doc.id, title: d.doc.title, url: d.doc.url, kind: d.doc.kind, projectSlug: d.doc.projectSlug,
    score: Math.round(score * 100) / 100, snippet: snippet(d.doc.text, base),
  }));
}

function snippet(text: string, terms: string[]): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const best = sentences
    .map((s, i) => ({ s, i, hits: tokenize(s).filter((t) => terms.includes(t)).length }))
    .sort((a, b) => b.hits - a.hits || a.i - b.i)[0];
  const out = best && best.hits ? best.s : sentences.slice(0, 2).join(' ');
  return out.length > 260 ? `${out.slice(0, 257)}…` : out;
}
