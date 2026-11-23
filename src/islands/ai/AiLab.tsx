// AI Systems Lab: retrieval, tool calling, a multi-role pipeline and an evaluation harness, all running
// in the browser on the portfolio's approved records. No language model, no network, no cost.
// Engines: src/lib/ai/rag.ts and src/lib/ai/agentlab.ts (unit-tested).
import { useEffect, useMemo, useState } from 'react';
import { buildIndex, retrieve, assemble, answer, evaluate, CHUNK_WORDS, EVAL_SET } from '../../lib/ai/rag';
import { ToolLab, CouncilLab, EvalLab } from './AgentPanels';
import '../demos/demos.css';
import './ai.css';

type Tab = 'rag' | 'tools' | 'council' | 'eval';
const TABS: { id: Tab; label: string; kind: string }[] = [
  { id: 'rag', label: 'RAG explorer', kind: 'real retrieval · extractive' },
  { id: 'tools', label: 'Tool calling', kind: 'real contracts · rule planner' },
  { id: 'council', label: 'Multi-agent', kind: 'deterministic simulation' },
  { id: 'eval', label: 'Evaluation', kind: 'real tests, your browser' },
];

export default function AiLab() {
  const [tab, setTab] = useState<Tab>('rag');
  return (
    <div className="demo ai">
      <div className="demo-tabs ai-tabs" role="tablist" aria-label="AI Systems Lab">
        {TABS.map((t) => (
          <button key={t.id} id={`ai-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`ai-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const i = TABS.findIndex((x) => x.id === tab);
              const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
              setTab(n.id); document.getElementById(`ai-tab-${n.id}`)?.focus();
            }}>{t.label}<small>{t.kind}</small></button>
        ))}
      </div>
      <div id={`ai-panel-${tab}`} role="tabpanel" aria-labelledby={`ai-tab-${tab}`} className="ai-panel">
        {tab === 'rag' && <RagExplorer />}
        {tab === 'tools' && <ToolLab />}
        {tab === 'council' && <CouncilLab />}
        {tab === 'eval' && <EvalLab />}
      </div>
    </div>
  );
}

const QUESTIONS = ['How does GMRE skip duplicate archives?', 'What happens when a boot image is tampered with?', 'Which MFA method does SecureMed use?', 'How were LIME and SHAP compared?'];

function RagExplorer() {
  const t0 = performance.now();
  const ix = useMemo(() => buildIndex(), []);
  const buildMs = useMemo(() => performance.now() - t0, [ix]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState(QUESTIONS[0]);
  const [k, setK] = useState(5);
  const [budget, setBudget] = useState(400);
  const [run, setRun] = useState<string | null>(null);
  const [ev, setEv] = useState<ReturnType<typeof evaluate> | null>(null);
  const [mounted, setMounted] = useState(false); // timings only after hydration (server and browser differ)
  useEffect(() => setMounted(true), []);
  const res = useMemo(() => {
    if (!run) return null;
    const s = performance.now();
    const r = retrieve(ix, run, k); const ctx = assemble(r.hits, budget); const a = answer(run, ctx.used);
    return { ...r, ctx, a, ms: performance.now() - s };
  }, [ix, run, k, budget]);
  const stages = [
    ['Ingest', `${ix.docs} approved records`],
    ['Chunk', `${ix.chunks.length} chunks · ≤${CHUNK_WORDS} words, 1-sentence overlap`],
    ['Vectorise', `TF-IDF · ${ix.df.size} terms (lexical, not neural)`],
    ['Retrieve', res ? `BM25 + cosine → RRF · top ${k}` : 'BM25 + cosine, fused'],
    ['Assemble', res ? `${res.ctx.used.length} chunks · ~${res.ctx.tokens}/${budget} tokens` : `budget ${budget} tokens`],
    ['Answer', res ? `${res.a.sentences.length} cited sentence(s), extractive` : 'extractive, cited'],
  ];
  return (
    <div className="ai-mod">
      <ol className="ai-pipe" aria-label="Pipeline">
        {stages.map(([s, d], i) => <li key={s} className={res || i < 3 ? 'on' : ''}><b>{i + 1} · {s}</b><span>{d}</span></li>)}
      </ol>
      <form className="ai-ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) setRun(q.trim()); }}>
        <label htmlFor="ai-q" className="sr-only">Question</label>
        <input id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} autoComplete="off" />
        <button type="submit" className="btn btn-primary btn-sm">Retrieve &amp; answer</button>
      </form>
      <div className="demo-ctrls">
        {QUESTIONS.map((x) => <button key={x} type="button" className="btn btn-sm btn-quiet" onClick={() => { setQ(x); setRun(x); }}>{x}</button>)}
      </div>
      <div className="demo-ctrls ai-knobs">
        <label>top-k <input type="range" min={1} max={8} value={k} onChange={(e) => setK(Number(e.target.value))} /> <b>{k}</b></label>
        <label>context budget <input type="range" min={100} max={800} step={50} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /> <b>{budget}</b> tokens</label>
        {mounted && <span className="mono muted">index built in {buildMs.toFixed(1)} ms</span>}
      </div>
      {res && (
        <div className="ai-grid" aria-live="polite">
          <section className="demo-card">
            <header><span><b>Retrieved chunks</b> · {res.ms.toFixed(1)} ms</span><span>query terms: {res.q.join(' ') || '—'}</span></header>
            <ol className="ai-hits">
              {res.hits.length === 0 && <li className="demo-empty">Nothing matched. The pipeline answers “not found” rather than guessing.</li>}
              {res.hits.map((h) => {
                const used = res.ctx.used.includes(h);
                return (
                  <li key={h.chunk.id} className={used ? 'used' : 'dropped'}>
                    <div className="ai-hit-head"><a href={h.chunk.url}>{h.chunk.title}</a><span className="mono">RRF {h.rrf.toFixed(4)} · BM25 #{h.rankBm25} · cos #{h.rankCos} ({h.cosine.toFixed(2)})</span></div>
                    <p>{h.chunk.text}</p>
                    <small className="mono">{used ? 'in context' : 'dropped: budget or per-source cap'}</small>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="demo-card">
            <header><span><b>Grounded answer</b></span><span className={`pill ${res.a.grounded ? 'ok' : 'bad'}`}>{res.a.grounded ? 'every sentence quoted from a source' : 'ungrounded'}</span></header>
            <div className="body">
              {res.a.sentences.length ? <ul className="ai-answer">{res.a.sentences.map((s, i) => <li key={i}>{s.text} <sup>[{s.source}]</sup></li>)}</ul> : <p className="demo-empty">No sentence in the retrieved context answers this. Not found, rather than invented.</p>}
              <ol className="ai-sources">{res.a.sources.map((s) => <li key={s.n}><span className="mono">[{s.n}]</span> <a href={s.url}>{s.title}</a></li>)}</ol>
              <p className="demo-note">Generation step: <b>extractive</b>. The answer is sentences selected from the retrieved context and cited. A language model would paraphrase here; this site uses none, so nothing can be invented.</p>
            </div>
          </section>
        </div>
      )}
      <section className="demo-card">
        <header><span><b>Retrieval evaluation</b> · {EVAL_SET.length} fixed questions with the source each must find</span><button type="button" className="btn btn-sm" onClick={() => setEv(evaluate(ix))}>Run evaluation</button></header>
        {ev && (
          <div className="body">
            <div className="demo-metrics">
              <div className="demo-metric"><span>Recall@1</span><b>{(ev.recallAt1 * 100).toFixed(0)}%</b></div>
              <div className="demo-metric"><span>Recall@5</span><b>{(ev.recallAtK * 100).toFixed(0)}%</b></div>
              <div className="demo-metric"><span>MRR</span><b>{ev.mrr.toFixed(2)}</b></div>
            </div>
            <ul className="ai-evrows">{ev.rows.map((r) => <li key={r.q} className={r.rank === 1 ? 'ok' : r.rank ? 'part' : 'bad'}><span>{r.q}</span><span className="mono">{r.rank ? `rank ${r.rank}` : 'missed'}{r.rank !== 1 ? ` · top: ${r.top}` : ''}</span></li>)}</ul>
            <p className="demo-note">Computed now, in your browser, on the live index. Misses are shown, not hidden.</p>
          </div>
        )}
      </section>
    </div>
  );
}
