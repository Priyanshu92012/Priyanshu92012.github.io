// Explainability lab engine. A small, fully transparent lexicon sentiment model
// (NOT FinBERT) plus real explanation algorithms:
//   - exact Shapley values (enumerates all 2^n coalitions; n ≤ 12)
//   - LIME (perturbation sampling, cosine-distance kernel, weighted ridge regression)
// Removing a token = masking it. The model is non-linear (negation, intensifiers,
// contrast, sigmoid), so the two methods genuinely disagree in instructive ways.
import { rng } from './rng';

export const LEXICON: Record<string, number> = {
  beat: 1.6, beats: 1.6, improved: 1.3, growth: 1.2, strong: 1.1, record: 1.2, gain: 1.0, gains: 1.0, rose: 1.0, raised: 0.9,
  upgrade: 1.3, profit: 0.8, exceeded: 1.5, resilient: 0.9, recovery: 0.9,
  weak: -1.4, fell: -1.3, warning: -1.5, loss: -1.4, losses: -1.4, debt: -0.7, miss: -1.5, missed: -1.5, decline: -1.2,
  downgrade: -1.4, cut: -1.0, cuts: -1.0, risk: -0.8, lawsuit: -1.3, slowed: -0.9, layoffs: -1.2,
};
const NEGATORS = new Set(['not', 'no', 'never', "didn't", "doesn't", 'without']);
const INTENSIFIERS: Record<string, number> = { sharply: 1.7, strongly: 1.6, significantly: 1.5, slightly: 0.5, heavily: 1.6 };
const CONTRAST = new Set(['but', 'however', 'despite', 'although', 'yet']);
const BIAS = 0.1;

export const SAMPLES = [
  'Revenue beat forecasts despite weak guidance',
  'Shares fell sharply after the profit warning',
  'Margins improved but debt remains high',
  'The company did not miss earnings expectations',
  'Growth slowed slightly yet the outlook stays strong',
];

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 12);
}

/** Raw score (logit) for the tokens present in `mask`. */
export function score(tokens: string[], mask: boolean[] = tokens.map(() => true)): number {
  const kept = tokens.filter((_, i) => mask[i]);
  let s = BIAS;
  const contrastAt = kept.findIndex((t) => CONTRAST.has(t));
  kept.forEach((t, i) => {
    const w = LEXICON[t];
    if (w === undefined) return;
    let v = w;
    const prev = kept.slice(Math.max(0, i - 2), i);
    if (prev.some((p) => NEGATORS.has(p))) v = -v * 0.8;
    const intens = prev.map((p) => INTENSIFIERS[p]).find((x) => x !== undefined);
    if (intens) v *= intens;
    if (contrastAt >= 0) {
      const contrastWord = kept[contrastAt];
      // "despite X": X is concessive and discounted; "A but B": B dominates.
      if (contrastWord === 'despite') v *= i > contrastAt ? 0.5 : 1.2;
      else v *= i > contrastAt ? 1.4 : 0.6;
    }
    s += v;
  });
  return s;
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export function predict(tokens: string[], mask?: boolean[]): number { return sigmoid(score(tokens, mask)); }

function maskFrom(bits: number, n: number): boolean[] { return Array.from({ length: n }, (_, i) => ((bits >> i) & 1) === 1); }

/** Exact Shapley values of P(positive) w.r.t. each token (feature absent = token removed). */
export function shapley(tokens: string[], f: (mask: boolean[]) => number = (m) => predict(tokens, m)): number[] {
  const n = tokens.length;
  if (n > 12) throw new Error('exact Shapley is limited to 12 tokens');
  const total = 1 << n;
  const values = new Float64Array(total);
  for (let b = 0; b < total; b++) values[b] = f(maskFrom(b, n));
  const fact = [1]; for (let i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;
  const phi = new Array(n).fill(0);
  for (let b = 0; b < total; b++) {
    let size = 0; for (let x = b; x; x &= x - 1) size++;
    for (let i = 0; i < n; i++) {
      if ((b >> i) & 1) continue;
      const wgt = (fact[size] * fact[n - size - 1]) / fact[n];
      phi[i] += wgt * (values[b | (1 << i)] - values[b]);
    }
  }
  return phi;
}

/** Solve (XᵀWX + λI) β = XᵀWy by Gaussian elimination. */
function weightedRidge(X: number[][], y: number[], w: number[], lambda = 0.01): number[] {
  const d = X[0].length;
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const bvec = new Array(d).fill(0);
  for (let r = 0; r < X.length; r++) {
    for (let i = 0; i < d; i++) {
      bvec[i] += w[r] * X[r][i] * y[r];
      for (let j = 0; j < d; j++) A[i][j] += w[r] * X[r][i] * X[r][j];
    }
  }
  for (let i = 1; i < d; i++) A[i][i] += lambda; // don't regularise the intercept
  for (let c = 0; c < d; c++) {
    let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [bvec[c], bvec[p]] = [bvec[p], bvec[c]];
    const piv = A[c][c] || 1e-12;
    for (let r = 0; r < d; r++) {
      if (r === c) continue;
      const k = A[r][c] / piv;
      for (let j = c; j < d; j++) A[r][j] -= k * A[c][j];
      bvec[r] -= k * bvec[c];
    }
  }
  return bvec.map((v, i) => v / (A[i][i] || 1e-12));
}

export type LimeOptions = { samples?: number; kernelWidth?: number; seed?: number };

/** LIME for text: random token masks, cosine-distance exponential kernel, weighted linear fit. */
export function lime(tokens: string[], opts: LimeOptions = {}, f: (mask: boolean[]) => number = (m) => predict(tokens, m)): number[] {
  const n = tokens.length;
  const samples = opts.samples ?? 500, width = opts.kernelWidth ?? 0.25;
  const r = rng(opts.seed ?? 42);
  const X: number[][] = [], y: number[] = [], w: number[] = [];
  const push = (mask: boolean[]) => {
    const k = mask.filter(Boolean).length;
    const cos = k === 0 ? 0 : Math.sqrt(k / n);
    const dist = 1 - cos;
    X.push([1, ...mask.map((m) => (m ? 1 : 0))]);
    y.push(f(mask));
    w.push(Math.sqrt(Math.exp(-(dist * dist) / (width * width))));
  };
  push(tokens.map(() => true));
  for (let s = 1; s < samples; s++) {
    const remove = r.int(1, n); // LIME: choose how many words to remove, then which
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } // seeded Fisher–Yates: unbiased, engine-independent
    const drop = new Set(order.slice(0, remove));
    push(tokens.map((_, i) => !drop.has(i)));
  }
  return weightedRidge(X, y, w).slice(1);
}

/** LIME across several seeds → mean and spread (instability is a known LIME weakness). */
export function limeStability(tokens: string[], seeds = [1, 2, 3, 4, 5], opts: LimeOptions = {}) {
  const runs = seeds.map((seed) => lime(tokens, { ...opts, seed }));
  return tokens.map((_, i) => {
    const v = runs.map((r) => r[i]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    return { mean, min: Math.min(...v), max: Math.max(...v) };
  });
}

/** Spearman rank correlation between two attribution vectors. */
export function spearman(a: number[], b: number[]): number {
  const rank = (v: number[]) => { const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); idx.forEach(([, i], k) => (r[i] = k)); return r; };
  const ra = rank(a), rb = rank(b), n = a.length;
  if (n < 2) return 1;
  const d2 = ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}
