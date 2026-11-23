// Agent Arena: the protocol, an honest (empty) results table, and a local replay
// viewer for transcripts in the arena-run/1 format. Nothing is simulated.
import { useEffect, useRef, useState } from 'react';
import { APPROVED_RUNS, parseTranscript, type ArenaRun } from '../../lib/arena';
import { reducedMotion } from '../../lib/prefs';
import './demos.css';

const KIND_LABEL = { prompt: 'Prompt', message: 'Agent', tool_call: 'Tool call', tool_result: 'Tool result', test: 'Tests', note: 'Note' } as const;

export default function ArenaLab() {
  const [run, setRun] = useState<ArenaRun | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!playing || !run) return;
    const id = setInterval(() => setPos((p) => { if (p >= run.events.length - 1) { setPlaying(false); return p; } return p + 1; }), reducedMotion() ? 900 : 450);
    return () => clearInterval(id);
  }, [playing, run]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [pos]);

  const open = async (f: File | undefined) => {
    if (!f) return;
    const res = parseTranscript(await f.text());
    if (res.ok) { setRun(res.run); setErrors([]); setPos(0); setPlaying(false); } else { setRun(null); setErrors(res.errors); }
  };

  const ev = run?.events[pos];
  return (
    <div className="demo d-ai">
      <section className="demo-card" aria-label="Approved results">
        <header><span><b>Results</b> · approved runs only</span><span>{APPROVED_RUNS.length} published</span></header>
        <div className="body" style={{ overflowX: 'auto' }}>
          <table className="gm-ledger">
            <thead><tr><th>Task</th><th>Agent</th><th>Tests passed</th><th>Rubric</th><th>Transcript</th></tr></thead>
            <tbody>
              {APPROVED_RUNS.length === 0 ? (
                <tr><td colSpan={5} className="demo-empty">No approved runs yet. Results appear here only after full transcripts, including failures, are approved for publication.</td></tr>
              ) : APPROVED_RUNS.map((r) => (
                <tr key={`${r.task.id}-${r.agent.name}`}>
                  <td>{r.task.title}</td><td>{r.agent.name}</td>
                  <td>{r.score ? `${r.score.testsPassed}/${r.score.testsTotal}` : '—'}</td>
                  <td>{r.score?.rubric !== undefined ? `${r.score.rubric}/${r.score.rubricMax ?? '?'}` : '—'}</td>
                  <td><button type="button" className="linkish" onClick={() => { setRun(r); setPos(0); }}>Replay</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="demo-card" aria-label="Replay viewer">
        <header><span><b>Replay viewer</b> · arena-run/1</span>
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>Open transcript (.json)
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => open(e.target.files?.[0])} />
          </label>
        </header>
        <div className="body">
          {errors.length > 0 && (
            <div className="disclosure" role="alert" style={{ marginBottom: 12 }}><strong>Invalid</strong><span>{errors.join(' · ')}</span></div>
          )}
          {!run ? (
            <p className="demo-note">Opens a transcript from your own disk, validates it against the schema and replays it step by step. The file is parsed in this tab and <b>never uploaded</b>. Use it to review a run before approving it for publication.</p>
          ) : (
            <div className="ar-view">
              {!run.approved && <p className="disclosure"><strong>Local preview</strong><span>This transcript is not marked as approved. It is shown only in your browser.</span></p>}
              <div className="ar-head">
                <div><p className="demo-lab">Task</p><b>{run.task.title}</b></div>
                <div><p className="demo-lab">Agent</p><b>{run.agent.name}{run.agent.version ? ` ${run.agent.version}` : ''}</b></div>
                <div><p className="demo-lab">Condition</p><b className="mono" style={{ fontSize: '0.8rem' }}>{run.condition.repoSnapshot} · {run.condition.timeBudgetMin} min</b></div>
                <div><p className="demo-lab">Score</p><b>{run.score ? `${run.score.testsPassed}/${run.score.testsTotal} tests` : 'unscored'}</b></div>
              </div>
              <div className="demo-ctrls">
                <button type="button" className="btn btn-sm btn-run" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : pos >= run.events.length - 1 ? 'Replay' : 'Play'}</button>
                <button type="button" className="btn btn-sm" onClick={() => setPos((p) => Math.max(0, p - 1))}>◀ Prev</button>
                <button type="button" className="btn btn-sm" onClick={() => setPos((p) => Math.min(run.events.length - 1, p + 1))}>Next ▶</button>
                <label className="demo-lab ar-scrub">Event {pos + 1}/{run.events.length} · t+{Math.round(ev!.t)}s
                  <input type="range" min={0} max={run.events.length - 1} value={pos} onChange={(e) => { setPlaying(false); setPos(Number(e.target.value)); }} />
                </label>
              </div>
              <ol className="ar-events" ref={listRef}>
                {run.events.slice(0, pos + 1).map((e, i) => (
                  <li key={i} className={`ar-e k-${e.kind}${e.ok === false ? ' bad' : ''}`} aria-current={i === pos}>
                    <span className="mono t">t+{Math.round(e.t)}s</span>
                    <span className="pill">{KIND_LABEL[e.kind]}{e.actor ? ` · ${e.actor}` : ''}</span>
                    <pre>{e.text.length > 1600 ? `${e.text.slice(0, 1600)}…` : e.text}</pre>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
