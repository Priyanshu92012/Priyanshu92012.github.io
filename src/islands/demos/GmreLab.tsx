// GMRE ingestion laboratory on the tested engine in src/lib/sim/gmre.ts.
// Synthetic nested archives; real SHA-256 (Web Crypto) for archive fingerprints
// and record dedup; per-plugin ledger with failure and targeted backfill.
import { useCallback, useEffect, useRef, useState } from 'react';
import { STAGES, PLUGINS, generateDumps, emptyDb, ingest, corruptOne, repair, dashboard, type Dump, type Db, type Member, type StageId, type PipelineEvent } from '../../lib/sim/gmre';
import { reducedMotion } from '../../lib/prefs';
import './demos.css';

type DumpState = 'pending' | 'running' | 'done' | 'skipped' | 'partial';
type Log = { kind: 'ok' | 'err' | 'info' | 'retry'; text: string };

function flatten(m: Member, out: Member[] = []): Member[] { out.push(m); for (const c of m.children ?? []) flatten(c, out); return out; }
const short = (p: string) => p.split('/').pop()!;

export default function GmreLab() {
  const [seed, setSeed] = useState(42);
  const [depth, setDepth] = useState(4);
  const [dup, setDup] = useState(0.4);
  const dumpsRef = useRef<Dump[]>([]);
  const dbRef = useRef<Db>(emptyDb());
  const [states, setStates] = useState<DumpState[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [stage, setStage] = useState<StageId | null>(null);
  const [doneStages, setDoneStages] = useState<Set<StageId>>(new Set());
  const [member, setMember] = useState<string | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState(0);
  const [corrupted, setCorrupted] = useState<Set<number>>(new Set());
  const [, setV] = useState(0);
  const cancel = useRef(false);

  const push = useCallback((kind: Log['kind'], text: string) => setLog((l) => [{ kind, text }, ...l].slice(0, 60)), []);

  const generate = useCallback(() => {
    cancel.current = true;
    dumpsRef.current = generateDumps(seed, { count: 3, depth, dupRate: dup });
    dbRef.current = emptyDb();
    setStates(dumpsRef.current.map(() => 'pending'));
    setCurrent(null); setStage(null); setDoneStages(new Set()); setMember(null); setDropped(0); setCorrupted(new Set());
    setLog([{ kind: 'info', text: `generated ${dumpsRef.current.length} synthetic dumps (seed ${seed}, nesting depth ${depth}); the last one is a re-upload of the first` }]);
    setV((v) => v + 1);
  }, [seed, depth, dup]);

  useEffect(() => { generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const consume = async (gen: AsyncGenerator<PipelineEvent>, i: number) => {
    const slow = !reducedMotion();
    const wait = (ms: number) => (slow ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
    const seen = new Set<StageId>();
    for await (const e of gen) {
      if (cancel.current) return;
      switch (e.type) {
        case 'stage':
          setStage(e.stage); seen.add(e.stage); setDoneStages(new Set(seen));
          if (['startup', 'plan', 'stream'].includes(e.stage)) push('info', e.text);
          if (e.stage === 'commit') push('ok', e.text);
          await wait(e.stage === 'parse' || e.stage === 'route' ? 90 : 160);
          break;
        case 'member': setMember(e.path); await wait(e.plugin ? 110 : 60); break;
        case 'skip-archive': setStage('commit'); push('ok', e.text); await wait(300); break;
        case 'ledger': if (e.entry.state === 'FAILED') push('err', `${e.entry.plugin} FAILED on ${short(e.entry.dump)}: ${e.entry.error}`); setV((v) => v + 1); break;
        case 'rows': setV((v) => v + 1); break;
        case 'done': {
          setDropped((d) => d + e.duplicates);
          const failed = dbRef.current.ledger.some((l) => l.dump === dumpsRef.current[i].name && l.state === 'FAILED');
          setStates((s) => s.map((x, k) => (k === i ? (e.skipped ? 'skipped' : failed ? 'partial' : 'done') : x)));
          if (!e.skipped) push(failed ? 'err' : 'ok', `${short(dumpsRef.current[i].name)}: +${e.inserted} rows, ${e.duplicates} duplicate record(s) dropped · sha256 ${e.fingerprint.slice(0, 12)}…`);
          break;
        }
      }
    }
  };

  const ingestNext = async () => {
    const i = states.findIndex((s) => s === 'pending');
    if (i < 0) return false;
    cancel.current = false; setBusy(true); setCurrent(i); setDoneStages(new Set());
    setStates((s) => s.map((x, k) => (k === i ? 'running' : x)));
    await consume(ingest(dumpsRef.current[i], dbRef.current), i);
    setBusy(false); setMember(null);
    return true;
  };

  const ingestAll = async () => {
    cancel.current = false;
    for (let i = states.indexOf('pending'); i >= 0 && i < dumpsRef.current.length; i++) {
      if (cancel.current) break;
      setBusy(true); setCurrent(i); setDoneStages(new Set());
      setStates((s) => s.map((x, k) => (k === i ? 'running' : x)));
      await consume(ingest(dumpsRef.current[i], dbRef.current), i);
    }
    setBusy(false); setMember(null);
  };

  const corrupt = () => {
    const i = states.findIndex((s, k) => s === 'pending' && !corrupted.has(k) && !dumpsRef.current[k].name.includes('reupload'));
    if (i < 0) return;
    const path = corruptOne(dumpsRef.current[i]);
    if (path) { setCorrupted((c) => new Set(c).add(i)); push('err', `fault injected: ${short(path)} in ${short(dumpsRef.current[i].name)} will be truncated mid-stream`); }
  };

  const backfill = async () => {
    const failed = dbRef.current.ledger.filter((l) => l.state === 'FAILED');
    if (!failed.length) return;
    cancel.current = false; setBusy(true);
    for (const f of failed) {
      const i = dumpsRef.current.findIndex((d) => d.name === f.dump);
      repair(dumpsRef.current[i]);
      setCurrent(i); setDoneStages(new Set());
      push('retry', `backfill: re-running only ${f.plugin} on ${short(f.dump)} (other plugins stay DONE, nothing re-imported)`);
      await consume(ingest(dumpsRef.current[i], dbRef.current, { onlyPlugin: f.plugin }), i);
    }
    setBusy(false); setMember(null);
  };

  const db = dbRef.current;
  const dash = dashboard(db);
  const cur = current !== null ? dumpsRef.current[current] : null;
  const tree = cur ? flatten(cur.root) : [];
  const anyFailed = db.ledger.some((l) => l.state === 'FAILED');
  const pending = states.some((s) => s === 'pending');

  return (
    <div className="demo d-systems">
      <div className="demo-bar">
        <div className="demo-ctrls">
          <button type="button" className="btn btn-sm btn-run" onClick={ingestNext} disabled={busy || !pending}>Ingest next dump</button>
          <button type="button" className="btn btn-sm" onClick={ingestAll} disabled={busy || !pending}>Ingest all</button>
          <button type="button" className="btn btn-sm" onClick={corrupt} disabled={busy || !pending}>Corrupt a member</button>
          <button type="button" className="btn btn-sm" onClick={backfill} disabled={busy || !anyFailed}>Backfill failed plugin</button>
        </div>
        <div className="demo-ctrls">
          <label className="demo-lab">Seed <input className="demo-num" type="number" value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} /></label>
          <label className="demo-lab">Nesting
            <select className="demo-select" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>{[2, 3, 4, 5, 6, 7, 8].map((d) => <option key={d} value={d}>{d} levels</option>)}</select>
          </label>
          <label className="demo-lab">Duplicates
            <select className="demo-select" value={dup} onChange={(e) => setDup(Number(e.target.value))}>{[0, 0.2, 0.4, 0.7].map((d) => <option key={d} value={d}>{Math.round(d * 100)}%</option>)}</select>
          </label>
          <button type="button" className="btn btn-sm" onClick={generate}>Regenerate</button>
        </div>
      </div>

      <ol className="gm-rail" aria-label="Pipeline stages">
        {STAGES.map((s) => (
          <li key={s.id} className={`${stage === s.id && busy ? 'on' : ''}${doneStages.has(s.id) ? ' done' : ''}`} aria-current={stage === s.id && busy ? 'step' : undefined}>
            <b>{s.label}</b><span>{s.detail}</span>
          </li>
        ))}
      </ol>

      <div className="demo-metrics">
        <div className="demo-metric"><span>Archives fingerprinted</span><b>{dash.archives}</b></div>
        <div className="demo-metric good"><span>Rows stored</span><b>{dash.rows}</b></div>
        <div className="demo-metric warn"><span>Duplicates dropped</span><b>{dropped}</b></div>
        <div className="demo-metric"><span>Alarms</span><b>{dash.byKind.alarm}</b></div>
        <div className="demo-metric"><span>Nodes</span><b>{dash.byKind.node}</b></div>
        <div className="demo-metric"><span>Links · perf</span><b>{dash.byKind.link}<small>· {dash.byKind.perf}</small></b></div>
      </div>

      <div className="gm-grid">
        <section className="demo-card" aria-label="Upload queue">
          <header><span><b>Upload queue</b></span><span>{states.filter((s) => s !== 'pending').length}/{states.length}</span></header>
          <ul className="body gm-dumps">
            {dumpsRef.current.map((d, i) => (
              <li key={d.name} className={`gm-d s-${states[i]}${current === i ? ' cur' : ''}`}>
                <span className="mono">{d.name}</span>
                <span className={`pill ${states[i] === 'done' ? 'ok' : states[i] === 'partial' ? 'bad' : states[i] === 'skipped' ? 'warn' : ''}`}>
                  {states[i] === 'skipped' ? 'skipped · same sha256' : states[i] === 'partial' ? 'partial · plugin failed' : states[i]}
                </span>
                {corrupted.has(i) && <span className="pill bad">fault injected</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="demo-card" aria-label="Archive tree">
          <header><span><b>Archive chain</b> · streamed, never extracted</span><span>{cur ? short(cur.name) : '—'}</span></header>
          <div className="body">
            {!cur ? <p className="demo-note">Ingest a dump to stream its nested archive chain member by member.</p> : (
              <ul className="gm-tree">
                {tree.map((m) => {
                  const plugin = m.kind === 'file' ? PLUGINS.find((p) => p.match.test(m.path)) : undefined;
                  return (
                    <li key={m.path} className={`${m.kind}${member === m.path ? ' on' : ''}${m.corrupt ? ' corrupt' : ''}`} style={{ paddingLeft: m.depth * 14 }}>
                      <span className="gm-ic" aria-hidden="true">{m.kind === 'archive' ? '▣' : '·'}</span>
                      <span className="mono">{short(m.path)}</span>
                      {plugin ? <span className="gm-pl">{plugin.name.replace('Plugin', '')}</span> : m.kind === 'file' ? <span className="gm-pl none">no plugin</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="demo-card" aria-label="Plugin ledger">
          <header><span><b>Plugin ledger</b> · per dump × plugin</span><span>{db.ledger.length} entries</span></header>
          <div className="body" style={{ overflowX: 'auto' }}>
            {db.ledger.length === 0 ? <p className="demo-note">Each (dump, plugin) pair gets a ledger row: PENDING → RUNNING → DONE or FAILED. A failure only blocks that plugin, and backfill re-runs just that pair.</p> : (
              <table className="gm-ledger">
                <thead><tr><th>Dump</th>{PLUGINS.map((p) => <th key={p.name}>{p.name.replace('Plugin', '')}</th>)}</tr></thead>
                <tbody>
                  {[...new Set(db.ledger.map((l) => l.dump))].map((d) => (
                    <tr key={d}>
                      <td className="mono">{short(d).replace('.tgz', '')}</td>
                      {PLUGINS.map((p) => {
                        const e = db.ledger.find((l) => l.dump === d && l.plugin === p.name);
                        return <td key={p.name}>{e ? <span className={`gm-st ${e.state}`} title={e.error}>{e.state}{e.records ? ` · ${e.records}` : ''}</span> : <span className="muted">—</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="demo-card" aria-label="Pipeline log">
          <header><span><b>Pipeline log</b></span><span>newest first</span></header>
          <div className="body">
            <ol className="demo-log" aria-live="polite">
              {log.map((l, i) => <li key={log.length - i} className={`k-${l.kind}`}><span className="t">{String(log.length - i).padStart(2, '0')}</span><span>{l.text}</span></li>)}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
