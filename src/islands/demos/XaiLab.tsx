// Explainability laboratory on src/lib/sim/xai.ts: a small, fully transparent lexicon
// sentiment model (NOT FinBERT) explained with exact Shapley values and LIME.
// The algorithms are real; the model and scores are a teaching instrument, not study results.
import { useMemo, useState } from 'react';
import { SAMPLES, tokenize, predict, shapley, limeStability, spearman, LEXICON } from '../../lib/sim/xai';
import './demos.css';

const SAMPLE_SIZES = [100, 250, 500, 1000, 2000];
const WIDTHS = [0.1, 0.25, 0.5, 1];
const fmt = (v: number, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);

export default function XaiLab() {
  const [text, setText] = useState(SAMPLES[0]);
  const [masked, setMasked] = useState<Set<number>>(new Set());
  const [samples, setSamples] = useState(500);
  const [width, setWidth] = useState(0.25);

  const raw = text.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const tokens = useMemo(() => tokenize(text), [text]);
  const truncated = raw.length > tokens.length;
  const p = useMemo(() => predict(tokens), [tokens]);
  const pMasked = useMemo(() => predict(tokens, tokens.map((_, i) => !masked.has(i))), [tokens, masked]);
  const empty = useMemo(() => predict(tokens, tokens.map(() => false)), [tokens]);
  const phi = useMemo(() => (tokens.length ? shapley(tokens) : []), [tokens]);
  const lime = useMemo(() => (tokens.length ? limeStability(tokens, [1, 2, 3, 4, 5], { samples, kernelWidth: width }) : []), [tokens, samples, width]);
  const rho = phi.length > 1 ? spearman(phi.map(Math.abs), lime.map((l) => Math.abs(l.mean))) : 1;
  const spread = lime.length ? Math.max(...lime.map((l) => l.max - l.min)) : 0;
  const maxAbs = Math.max(0.05, ...phi.map(Math.abs), ...lime.map((l) => Math.max(Math.abs(l.min), Math.abs(l.max))));
  const top = (vals: number[]) => vals.map((v, i) => [Math.abs(v), i] as const).sort((a, b) => b[0] - a[0])[0]?.[1];
  const topS = top(phi), topL = top(lime.map((l) => l.mean));

  const setSentence = (s: string) => { setText(s); setMasked(new Set()); };
  const toggle = (i: number) => setMasked((m) => { const n = new Set(m); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const label = (v: number) => (v >= 0.5 ? 'positive' : 'negative');

  return (
    <div className="demo d-ai">
      <div className="demo-bar">
        <div className="demo-ctrls" role="group" aria-label="Example sentences">
          {SAMPLES.map((s) => <button key={s} type="button" className="btn btn-sm" aria-pressed={text === s} onClick={() => setSentence(s)}>{s.split(' ').slice(0, 3).join(' ')}…</button>)}
        </div>
      </div>
      <label className="xa-input">
        <span className="demo-lab">Sentence (max 12 words, editable)</span>
        <input className="field" value={text} maxLength={140} onChange={(e) => setSentence(e.target.value)} />
        {truncated && <span className="demo-note warn">Only the first 12 words are explained (exact Shapley enumerates 2^n coalitions).</span>}
      </label>

      <div className="xa-pred">
        <div>
          <p className="demo-lab">Model output · P(positive)</p>
          <div className="xa-meter" role="img" aria-label={`P(positive) ${p.toFixed(3)}${masked.size ? `, with masked words ${pMasked.toFixed(3)}` : ''}`}>
            <i style={{ left: `${p * 100}%` }} className="full" />
            {masked.size > 0 && <i style={{ left: `${pMasked * 100}%` }} className="masked" />}
            <span>negative</span><span>0.5</span><span>positive</span>
          </div>
        </div>
        <div className="xa-pv">
          <b>{p.toFixed(3)}</b><span className="demo-note">{label(p)}</span>
          {masked.size > 0 && <><b className="warn">{pMasked.toFixed(3)}</b><span className="demo-note">with {masked.size} word{masked.size > 1 ? 's' : ''} removed ({fmt(pMasked - p)})</span></>}
        </div>
      </div>

      <div>
        <p className="demo-lab" style={{ marginBottom: 6 }}>Click words to remove them and watch the prediction move (counterfactual)</p>
        <div className="xa-tokens">
          {tokens.map((t, i) => (
            <button key={`${t}-${i}`} type="button" className={`xa-tok${masked.has(i) ? ' off' : ''}`} aria-pressed={masked.has(i)} onClick={() => toggle(i)}
              style={{ ['--w' as string]: String(Math.min(1, Math.abs(phi[i] ?? 0) / maxAbs)), ['--h' as string]: (phi[i] ?? 0) >= 0 ? 'var(--bio)' : 'var(--orange)' }}>
              {t}{LEXICON[t] !== undefined && <sup aria-hidden="true">•</sup>}
            </button>
          ))}
        </div>
      </div>

      <section className="demo-card" aria-label="Attributions">
        <header><span><b>Attributions</b> · <span style={{ color: 'var(--bio)' }}>Shapley (exact)</span> vs <span style={{ color: 'var(--violet)' }}>LIME (mean of 5 seeds, min–max)</span></span>
          <span className="demo-ctrls">
            <label className="demo-lab">Samples <select className="demo-select" value={samples} onChange={(e) => setSamples(Number(e.target.value))}>{SAMPLE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="demo-lab">Kernel <select className="demo-select" value={width} onChange={(e) => setWidth(Number(e.target.value))}>{WIDTHS.map((w) => <option key={w} value={w}>{w}</option>)}</select></label>
          </span>
        </header>
        <div className="body">
          <table className="xa-chart">
            <caption className="sr-only">Per-word attribution towards P(positive): Shapley value and LIME coefficient</caption>
            <thead className="sr-only"><tr><th>Word</th><th>Shapley</th><th>LIME mean (min to max)</th></tr></thead>
            <tbody>
              {tokens.map((t, i) => (
                <tr key={`${t}-${i}`}>
                  <th scope="row" className="mono">{t}</th>
                  <td className="xa-bars">
                    <span className="axis" aria-hidden="true" />
                    <Bar v={phi[i]} max={maxAbs} cls="s" />
                    <Bar v={lime[i]?.mean ?? 0} max={maxAbs} cls="l" lo={lime[i]?.min} hi={lime[i]?.max} />
                  </td>
                  <td className="xa-num mono"><span className="s">{fmt(phi[i] ?? 0)}</span><span className="l">{fmt(lime[i]?.mean ?? 0)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="demo-metrics">
        <div className="demo-metric good"><span>Σ Shapley</span><b>{fmt(phi.reduce((a, b) => a + b, 0))}</b></div>
        <div className="demo-metric"><span>f(x) − f(∅)</span><b>{fmt(p - empty)}</b></div>
        <div className="demo-metric"><span>Rank agreement ρ</span><b>{rho.toFixed(2)}</b></div>
        <div className="demo-metric"><span>Top word</span><b style={{ fontSize: '1rem' }}>{tokens[topS!] ?? '—'}{topL !== topS && tokens[topL!] ? <small> / LIME: {tokens[topL!]}</small> : null}</b></div>
        <div className={`demo-metric${spread > 0.05 ? ' warn' : ''}`}><span>LIME seed spread</span><b>{spread.toFixed(3)}</b></div>
      </div>
      <p className="demo-note"><b>Read it like this:</b> Shapley values always add up exactly to f(x) − f(∅) (efficiency), so the first two tiles match. LIME fits a local linear surrogate to random perturbations, so it can disagree with Shapley on this non-linear model (negation, “despite”, “but”) and it moves between seeds. Fewer samples or a narrow kernel make that instability visible.</p>
    </div>
  );
}

function Bar({ v, max, cls, lo, hi }: { v: number; max: number; cls: string; lo?: number; hi?: number }) {
  const w = (Math.abs(v) / max) * 50;
  const left = v >= 0 ? 50 : 50 - w;
  return (
    <span className={`bar ${cls}`} aria-hidden="true">
      <i style={{ left: `${left}%`, width: `${w}%` }} />
      {lo !== undefined && hi !== undefined && <b style={{ left: `${50 + (lo / max) * 50}%`, width: `${((hi - lo) / max) * 50}%` }} />}
    </span>
  );
}
