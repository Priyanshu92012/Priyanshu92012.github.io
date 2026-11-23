// Tool calling, multi-role pipeline and evaluation panels of the AI Systems Lab.
import { useState } from 'react';
import { runTool, runCouncil, runEval, percentile, plan, SAMPLE_JOB, EVAL_CASES, type TraceStep, type Msg, type EvalResult } from '../../lib/ai/agentlab';
import { TOOL_NAMES, type ToolName } from '../../lib/agent/tools';

// ── tool calling ─────────────────────────────────────────────────────
const REQUESTS = ['What evidence is there for Python?', 'Tell me about OpticLab', 'Open the GMRE case study', 'Write a brief for a security team', 'deduplication by fingerprint'];

export function ToolLab() {
  const [req, setReq] = useState(REQUESTS[0]);
  const [trace, setTrace] = useState<TraceStep[] | null>(null);
  const [edit, setEdit] = useState<{ tool: ToolName; args: string } | null>(null);
  const [argErr, setArgErr] = useState<string | null>(null);
  const go = (r: string) => { setTrace(runTool(r)); const p = plan(r); setEdit({ tool: p.tool, args: JSON.stringify(p.args, null, 2) }); setArgErr(null); };
  const rerun = () => {
    if (!edit) return;
    try { setTrace(runTool(req, { tool: edit.tool, args: JSON.parse(edit.args) })); setArgErr(null); }
    catch (e) { setArgErr(`Not valid JSON: ${(e as Error).message}`); }
  };
  return (
    <div className="ai-mod">
      <p className="ai-lede">The same seven read-only tools and Zod contracts as this site’s LLM Worker (built, tested with a mocked model, not deployed). Here a transparent rule planner picks the tool instead of a model, so every decision can be shown.</p>
      <form className="ai-ask" onSubmit={(e) => { e.preventDefault(); if (req.trim()) go(req); }}>
        <label htmlFor="ai-req" className="sr-only">Request</label>
        <input id="ai-req" value={req} onChange={(e) => setReq(e.target.value)} maxLength={300} autoComplete="off" />
        <button type="submit" className="btn btn-primary btn-sm">Run</button>
      </form>
      <div className="demo-ctrls">{REQUESTS.map((r) => <button key={r} type="button" className="btn btn-sm btn-quiet" onClick={() => { setReq(r); go(r); }}>{r}</button>)}</div>
      {trace && (
        <div className="ai-grid" aria-live="polite">
          <section className="demo-card">
            <header><span><b>Event trace</b></span><span>{trace.reduce((s, x) => s + x.ms, 0).toFixed(2)} ms</span></header>
            <ol className="ai-trace">
              {trace.map((s, i) => (
                <li key={i} className={s.ok ? 'ok' : 'bad'}>
                  <b>{i + 1} · {s.step}</b><span>{s.detail}</span>
                  {s.data !== undefined && <details><summary>{s.step === 'result' ? 'structured result' : 'tool call'}</summary><pre>{JSON.stringify(s.data, null, 2).slice(0, 1600)}</pre></details>}
                </li>
              ))}
            </ol>
            <p className="demo-note">A trace of decisions and data, not a model’s “thoughts”: there is no hidden reasoning to show.</p>
          </section>
          {edit && (
            <section className="demo-card">
              <header><span><b>Edit the call</b> · try to break validation</span></header>
              <div className="body ai-edit">
                <label>Tool<select className="demo-select" value={edit.tool} onChange={(e) => setEdit({ ...edit, tool: e.target.value as ToolName })}>{TOOL_NAMES.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label>Arguments (JSON)<textarea value={edit.args} rows={6} spellCheck={false} onChange={(e) => setEdit({ ...edit, args: e.target.value })} /></label>
                <div className="demo-ctrls">
                  <button type="button" className="btn btn-sm btn-primary" onClick={rerun}>Validate &amp; run</button>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => setEdit({ ...edit, args: JSON.stringify({ slug: 'x'.repeat(80) }, null, 2) })}>Oversized slug</button>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => setEdit({ tool: 'searchPortfolio', args: JSON.stringify({ query: '', domain: 'finance' }, null, 2) })}>Empty query, bad enum</button>
                </div>
                {argErr && <p className="ai-err" role="status">{argErr}</p>}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ── multi-role pipeline ──────────────────────────────────────────────
const ROLE: Record<Msg['from'], string> = { coordinator: 'Coordinator', specialist: 'Skills specialist', verifier: 'Verifier', reviewer: 'Reviewer' };

export function CouncilLab() {
  const [job, setJob] = useState(SAMPLE_JOB);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [shown, setShown] = useState(0);
  const start = () => { const m = runCouncil(job); setMsgs(m); setShown(1); };
  return (
    <div className="ai-mod">
      <p className="ai-lede"><b>Deterministic simulation.</b> Four plain functions in your browser play the roles of a coordinator, a specialist, a verifier and a reviewer, passing structured messages. No autonomous agents and no model run; replaying gives the same result every time.</p>
      <div className="ai-grid">
        <section className="demo-card">
          <header><span><b>Task</b> · map a job description to evidence</span></header>
          <div className="body">
            <label htmlFor="ai-job" className="sr-only">Job description</label>
            <textarea id="ai-job" className="ai-job" value={job} rows={11} onChange={(e) => setJob(e.target.value)} maxLength={6000} />
            <div className="demo-ctrls">
              <button type="button" className="btn btn-sm btn-primary" onClick={start}>Start</button>
              <button type="button" className="btn btn-sm" disabled={!msgs || shown >= msgs.length} onClick={() => setShown((n) => n + 1)}>Next message</button>
              <button type="button" className="btn btn-sm" disabled={!msgs} onClick={() => setShown(msgs!.length)}>Show all</button>
            </div>
          </div>
        </section>
        <section className="demo-card">
          <header><span><b>Message log</b></span><span>{msgs ? `${shown}/${msgs.length}` : 'not started'}</span></header>
          <ol className="ai-msgs" aria-live="polite">
            {msgs?.slice(0, shown).map((m, i) => (
              <li key={i} className={`r-${m.from}`}>
                <b>{ROLE[m.from]} → {m.to === 'visitor' ? 'you' : ROLE[m.to]}</b>
                <span>{m.text}</span>
                {m.data !== undefined && <details><summary>payload</summary><pre>{JSON.stringify(m.data, null, 2).slice(0, 1600)}</pre></details>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

// ── evaluation ───────────────────────────────────────────────────────
export function EvalLab() {
  const [res, setRes] = useState<EvalResult[] | null>(null);
  const [repro, setRepro] = useState<boolean | null>(null);
  const [price, setPrice] = useState('');
  const run = () => { const a = runEval(); const b = runEval(); setRes(a); setRepro(a.map((x) => x.fingerprint).join() === b.map((x) => x.fingerprint).join()); };
  const ms = res?.map((r) => r.ms) ?? [];
  const tokens = res?.reduce((s, r) => s + r.tokens, 0) ?? 0;
  const p = Number(price);
  const byKind = (k: EvalResult['kind']) => res?.filter((r) => r.kind === k) ?? [];
  return (
    <div className="ai-mod">
      <p className="ai-lede">{EVAL_CASES.length} fixed cases against the site’s real guide engine and tool router: tasks, tool choices and adversarial inputs. Each check is a plain assertion; latency is measured in your browser right now.</p>
      <div className="demo-ctrls"><button type="button" className="btn btn-primary btn-sm" onClick={run}>{res ? 'Run again' : 'Run the evaluation'}</button></div>
      {res && (
        <div className="ai-evals" aria-live="polite">
          <div className="demo-metrics">
            <div className="demo-metric"><span>Passed</span><b>{res.filter((r) => r.pass).length}/{res.length}</b></div>
            <div className="demo-metric"><span>Tool correctness</span><b>{byKind('tool').filter((r) => r.pass).length}/{byKind('tool').length}</b></div>
            <div className="demo-metric"><span>Failure recovery</span><b>{byKind('adversarial').filter((r) => r.pass).length}/{byKind('adversarial').length}</b></div>
            <div className="demo-metric"><span>Latency p50 / p95</span><b>{percentile(ms, 50).toFixed(2)} / {percentile(ms, 95).toFixed(2)} ms</b></div>
            <div className="demo-metric"><span>Reproducible</span><b>{repro ? 'yes, identical outputs' : 'no'}</b></div>
          </div>
          <table className="ai-table">
            <thead><tr><th scope="col">Case</th><th scope="col">Kind</th><th scope="col">Checks</th><th scope="col">ms</th><th scope="col">Output hash</th></tr></thead>
            <tbody>{res.map((r) => <tr key={r.id} className={r.pass ? 'ok' : 'bad'}><th scope="row">{r.id}</th><td>{r.kind}</td><td>{r.checks.map((c) => `${c.ok ? '✓' : '✕'} ${c.name}`).join(' · ')}</td><td className="mono">{r.ms.toFixed(2)}</td><td className="mono">{r.fingerprint}</td></tr>)}</tbody>
          </table>
          <section className="demo-card">
            <header><span><b>Cost model</b></span></header>
            <div className="body ai-cost">
              <p>This run cost <b>$0</b>: no model, no server. The same {res.length} cases would move about <b>{tokens.toLocaleString()} tokens</b> (≈ 4 characters per token) through a hosted model.</p>
              <label>Your price per 1M tokens (USD) <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="enter a price" /></label>
              {p > 0 && <p>≈ <b>${((tokens / 1e6) * p).toFixed(4)}</b> per evaluation run, before system prompts and tool definitions.</p>}
              <p className="demo-note">No price is assumed: model prices change, so you enter one. The output hashes make regressions visible: a changed hash means a changed answer.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
