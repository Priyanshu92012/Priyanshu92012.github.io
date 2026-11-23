// Synthetic model of the GMRE pipeline stages as described in the case study:
// plan → stream → dispatch → parse → route → commit, with SHA-256 archive
// fingerprints for idempotent re-runs and a per-plugin ledger (PENDING → RUNNING → DONE/FAILED).
// Archive contents, record types and values are invented; hashing is real (Web Crypto).
import { rng } from './rng';

export type Member = { path: string; kind: 'archive' | 'file'; depth: number; children?: Member[]; content?: string; corrupt?: boolean };
export type Dump = { name: string; root: Member; bytes: string };
export type RecordKind = 'node' | 'alarm' | 'link' | 'perf';
export type Row = { kind: RecordKind; key: string; values: Record<string, string | number>; hash: string; dump: string };
export type LedgerState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
export type LedgerEntry = { dump: string; plugin: string; state: LedgerState; records: number; error?: string };
export type Db = { fingerprints: Map<string, string>; rows: Row[]; recordHashes: Set<string>; ledger: LedgerEntry[] };
export type StageId = 'startup' | 'plan' | 'stream' | 'dispatch' | 'parse' | 'route' | 'commit';
export const STAGES: { id: StageId; label: string; detail: string }[] = [
  { id: 'startup', label: 'Startup', detail: 'config + logging' },
  { id: 'plan', label: 'Plan', detail: 'inspect archive chain' },
  { id: 'stream', label: 'Stream', detail: 'yield members, no extraction' },
  { id: 'dispatch', label: 'Dispatch', detail: 'match plugins by name' },
  { id: 'parse', label: 'Parse', detail: 'plugins → records' },
  { id: 'route', label: 'Route', detail: 'normalise + validate' },
  { id: 'commit', label: 'Commit', detail: 'sha256 dedup + ledger' },
];

export type PipelineEvent =
  | { type: 'stage'; stage: StageId; text: string }
  | { type: 'member'; path: string; depth: number; plugin?: string }
  | { type: 'skip-archive'; fingerprint: string; text: string }
  | { type: 'ledger'; entry: LedgerEntry }
  | { type: 'rows'; inserted: number; duplicates: number }
  | { type: 'done'; inserted: number; duplicates: number; skipped: boolean; fingerprint: string };

export const PLUGINS: { name: string; match: RegExp; kind: RecordKind }[] = [
  { name: 'NodeInventoryPlugin', match: /node_inventory\.log$/, kind: 'node' },
  { name: 'AlarmHistoryPlugin', match: /alarms\.log$/, kind: 'alarm' },
  { name: 'LinkStatePlugin', match: /links\.txt$/, kind: 'link' },
  { name: 'PerfCounterPlugin', match: /perf_.*\.csv$/, kind: 'perf' },
];

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SEVERITIES = ['critical', 'major', 'minor', 'warning'] as const;

function fileContent(name: string, r: ReturnType<typeof rng>, site: string): string {
  if (/node_inventory/.test(name)) return Array.from({ length: r.int(2, 4) }, (_, i) => `node=NE-${site}-${i + 1};version=R${r.int(20, 24)}.${r.int(0, 9)};ip=SIM-${r.int(1, 99)}`).join('\n');
  if (/alarms/.test(name)) return Array.from({ length: r.int(2, 6) }, () => `sev=${r.pick(SEVERITIES)};code=SIM-${r.int(100, 140)};ne=NE-${site}-${r.int(1, 3)}`).join('\n');
  if (/links/.test(name)) return Array.from({ length: r.int(1, 3) }, (_, i) => `link=L${i + 1};a=NE-${site}-1;b=NE-${site}-${i + 2};state=${r.pick(['up', 'up', 'down'])}`).join('\n');
  if (/perf_/.test(name)) return Array.from({ length: r.int(2, 4) }, (_, i) => `ne=NE-${site}-${i + 1},cpu=${r.int(5, 95)},temp=${r.int(30, 70)}`).join('\n');
  return 'unparsed vendor notes';
}

/** Generate a set of synthetic diagnostic dumps. The last one is an exact re-upload of the first. */
export function generateDumps(seed: number, opts: { count?: number; depth?: number; dupRate?: number } = {}): Dump[] {
  const r = rng(seed);
  const count = opts.count ?? 3, maxDepth = Math.min(8, Math.max(2, opts.depth ?? 4)), dupRate = opts.dupRate ?? 0.3;
  const dumps: Dump[] = [];
  let shared: string | null = null;
  for (let d = 0; d < count; d++) {
    const site = `S${r.int(10, 99)}`;
    const build = (path: string, depth: number): Member => {
      const children: Member[] = [];
      const files = ['node_inventory.log', 'alarms.log', 'links.txt', `perf_${r.int(1, 9)}.csv`, 'README.txt'].filter((_, i) => i < 2 || r.chance(0.7));
      for (const f of files) {
        let content = fileContent(f, r, site);
        if (/alarms/.test(f) && shared && r.chance(dupRate)) content = shared; // duplicate records across dumps
        if (/alarms/.test(f) && !shared) shared = content;
        children.push({ path: `${path}/${f}`, kind: 'file', depth: depth + 1, content });
      }
      if (depth + 1 < maxDepth) {
        const ext = r.pick(['.tgz', '.tar', '.zip']);
        children.push(build(`${path}/inner_${depth + 1}${ext}`, depth + 1));
      }
      return { path, kind: 'archive', depth, children };
    };
    const root = build(`dump_${site}_${String(d + 1).padStart(2, '0')}.tgz`, 0);
    dumps.push({ name: root.path, root, bytes: JSON.stringify(root) });
  }
  if (count >= 2) {
    const first = dumps[0];
    dumps.push({ name: first.name.replace('.tgz', '_reupload.tgz'), root: first.root, bytes: first.bytes });
  }
  return dumps;
}

export function emptyDb(): Db { return { fingerprints: new Map(), rows: [], recordHashes: new Set(), ledger: [] }; }

function* walk(m: Member): Generator<Member> {
  if (m.kind === 'file') { yield m; return; }
  yield m;
  for (const c of m.children ?? []) yield* walk(c);
}

function parseLine(kind: RecordKind, line: string): Record<string, string | number> {
  const sep = kind === 'perf' ? ',' : ';';
  return Object.fromEntries(line.split(sep).map((kv) => { const [k, v] = kv.split('='); return [k, Number.isFinite(Number(v)) && v !== '' ? Number(v) : v]; }));
}

/** Ingest one dump. Yields events for the visualisation; mutates `db`. */
export async function* ingest(dump: Dump, db: Db, opts: { onlyPlugin?: string } = {}): AsyncGenerator<PipelineEvent> {
  yield { type: 'stage', stage: 'startup', text: `config loaded · ${PLUGINS.length} plugins registered` };
  const fp = await sha256(dump.bytes);
  if (!opts.onlyPlugin && db.fingerprints.has(fp)) {
    yield { type: 'skip-archive', fingerprint: fp, text: `sha256 ${fp.slice(0, 12)}… already ingested as ${db.fingerprints.get(fp)}: skipped, zero writes` };
    yield { type: 'done', inserted: 0, duplicates: 0, skipped: true, fingerprint: fp };
    return;
  }
  const members = [...walk(dump.root)];
  const depth = Math.max(...members.map((m) => m.depth));
  yield { type: 'stage', stage: 'plan', text: `archive chain depth ${depth} · ${members.filter((m) => m.kind === 'file').length} files` };
  yield { type: 'stage', stage: 'stream', text: 'streaming members one at a time (never extracted to disk)' };
  const ledger = new Map<string, LedgerEntry>();
  for (const p of PLUGINS) {
    if (opts.onlyPlugin && p.name !== opts.onlyPlugin) continue;
    const existing = db.ledger.find((e) => e.dump === dump.name && e.plugin === p.name);
    const entry: LedgerEntry = existing ?? { dump: dump.name, plugin: p.name, state: 'PENDING', records: 0 };
    if (!existing) db.ledger.push(entry);
    if (entry.state === 'DONE') continue;
    entry.state = 'PENDING'; entry.error = undefined;
    ledger.set(p.name, entry);
    yield { type: 'ledger', entry: { ...entry } };
  }
  let inserted = 0, duplicates = 0;
  for (const m of members) {
    if (m.kind !== 'file') { yield { type: 'member', path: m.path, depth: m.depth }; continue; }
    const plugin = PLUGINS.find((p) => p.match.test(m.path));
    yield { type: 'member', path: m.path, depth: m.depth, plugin: plugin?.name };
    if (!plugin) continue;
    const entry = ledger.get(plugin.name);
    if (!entry || entry.state === 'FAILED') continue; // a failed plugin stays failed for this dump until backfilled
    yield { type: 'stage', stage: 'dispatch', text: `${m.path.split('/').pop()} → ${plugin.name}` };
    entry.state = 'RUNNING';
    yield { type: 'ledger', entry: { ...entry } };
    if (m.corrupt) {
      entry.state = 'FAILED'; entry.error = 'corrupt member: truncated stream';
      yield { type: 'ledger', entry: { ...entry } };
      continue;
    }
    yield { type: 'stage', stage: 'parse', text: `${plugin.name}.parse(stream)` };
    const lines = (m.content ?? '').split('\n').filter(Boolean);
    yield { type: 'stage', stage: 'route', text: `${lines.length} ${plugin.kind} record(s) normalised` };
    for (const line of lines) {
      const values = parseLine(plugin.kind, line);
      const key = String(values.node ?? values.code ?? values.link ?? values.ne ?? line);
      const hash = await sha256(`${plugin.kind}|${line}`);
      if (db.recordHashes.has(hash)) { duplicates++; continue; }
      db.recordHashes.add(hash);
      db.rows.push({ kind: plugin.kind, key, values, hash, dump: dump.name });
      inserted++; entry.records++;
    }
    yield { type: 'stage', stage: 'commit', text: `commit · +${inserted} rows · ${duplicates} duplicate(s) dropped` };
    yield { type: 'rows', inserted, duplicates };
  }
  for (const e of ledger.values()) if (e.state !== 'FAILED') { e.state = 'DONE'; yield { type: 'ledger', entry: { ...e } }; }
  if (!opts.onlyPlugin) db.fingerprints.set(fp, dump.name);
  yield { type: 'done', inserted, duplicates, skipped: false, fingerprint: fp };
}

/** Mark one member of a dump as corrupt (to demonstrate FAILED ledger entries and backfill). */
export function corruptOne(dump: Dump): string | null {
  for (const m of walk(dump.root)) if (m.kind === 'file' && /alarms\.log$/.test(m.path)) { m.corrupt = true; return m.path; }
  return null;
}
export function repair(dump: Dump) { for (const m of walk(dump.root)) m.corrupt = false; }

export function dashboard(db: Db) {
  const byKind: Record<RecordKind, number> = { node: 0, alarm: 0, link: 0, perf: 0 };
  const bySeverity: Record<string, number> = { critical: 0, major: 0, minor: 0, warning: 0 };
  for (const r of db.rows) {
    byKind[r.kind]++;
    if (r.kind === 'alarm' && typeof r.values.sev === 'string') bySeverity[r.values.sev] = (bySeverity[r.values.sev] ?? 0) + 1;
  }
  return { byKind, bySeverity, archives: db.fingerprints.size, rows: db.rows.length };
}
