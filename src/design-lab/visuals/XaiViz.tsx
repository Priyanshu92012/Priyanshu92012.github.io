// Explainability showcase: exact Shapley values and seeded LIME (src/lib/sim/xai.ts) over a small,
// fully transparent lexicon sentiment model. NOT FinBERT, and not the study's results.
import { useMemo, useState } from 'react';
import { SAMPLES, tokenize, predict, shapley, lime, spearman } from '../../lib/sim/xai';

export default function XaiViz({ onInteract }: { onInteract?: () => void }) {
  const [i, setI] = useState(0);
  const [method, setMethod] = useState<'shap' | 'lime'>('shap');
  const tokens = useMemo(() => tokenize(SAMPLES[i]), [i]);
  const shap = useMemo(() => shapley(tokens), [tokens]);
  const lm = useMemo(() => lime(tokens, { seed: 7, samples: 600 }), [tokens]);
  const p = predict(tokens);
  const vals = method === 'shap' ? shap : lm;
  const max = Math.max(1e-6, ...vals.map(Math.abs));
  const rho = spearman(shap, lm);

  return (
    <div className="viz viz-xai">
      <div className="viz-tabs" role="group" aria-label="Explanation method">
        <button type="button" aria-pressed={method === 'shap'} onClick={() => { setMethod('shap'); onInteract?.(); }}>SHAP · exact</button>
        <button type="button" aria-pressed={method === 'lime'} onClick={() => { setMethod('lime'); onInteract?.(); }}>LIME · sampled</button>
      </div>
      <p className="viz-sentence" aria-label={`Sentence: ${SAMPLES[i]}. ${method === 'shap' ? 'Shapley' : 'LIME'} attribution per word.`}>
        {tokens.map((t, k) => {
          const v = vals[k] / max;
          return (
            <span key={k} className={`tok ${v >= 0 ? 'pos' : 'neg'}`} style={{ ['--w' as string]: Math.abs(v).toFixed(3) }} title={`${t}: ${vals[k] >= 0 ? '+' : ''}${vals[k].toFixed(3)}`}>
              {t}
            </span>
          );
        })}
      </p>
      <div className="viz-meter" aria-label={`Model output: ${(p * 100).toFixed(0)} percent positive`}>
        <span className="viz-k">P(positive)</span>
        <span className="viz-bar"><i style={{ width: `${(p * 100).toFixed(1)}%` }} /></span>
        <span className="viz-num">{(p * 100).toFixed(0)}%</span>
      </div>
      <p className="viz-note">SHAP and LIME rank these words with Spearman ρ = {rho.toFixed(2)}. {rho < 0.8 ? 'They disagree here: the kind of disagreement the study compares.' : 'Here the two methods mostly agree.'}</p>
      <div className="viz-controls">
        <button type="button" onClick={() => { setI((x) => (x + 1) % SAMPLES.length); onInteract?.(); }}>Next sentence</button>
      </div>
      <p className="viz-cap">Transparent lexicon model, <strong>NOT FinBERT</strong> · real LIME and exact Shapley in your browser · study results unpublished</p>
    </div>
  );
}
