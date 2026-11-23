// AI Systems Lab engines: retrieval pipeline (src/lib/ai/rag.ts) and the tool/agent/eval harness
// (src/lib/ai/agentlab.ts). These are the numbers and labels the page shows.
import { describe, expect, it } from 'vitest';
import { buildIndex, chunkDoc, retrieve, assemble, answer, evaluate, estTokens } from '../../src/lib/ai/rag';
import { plan, runTool, runCouncil, runEval, SAMPLE_JOB, EVAL_CASES } from '../../src/lib/ai/agentlab';
import { knowledge } from '../../src/lib/agent/knowledge';
import { isAllowedHref } from '../../src/lib/guide/links';

const ix = buildIndex();

describe('RAG pipeline', () => {
  it('chunks every record within the word budget, with overlap', () => {
    for (const d of knowledge()) for (const c of chunkDoc(d)) expect(c.text.split(/\s+/).length, c.id).toBeLessThanOrEqual(80);
    expect(ix.chunks.length).toBeGreaterThan(ix.docs);
  });
  it('retrieves the right record for each evaluation question (recall@5 = 1, MRR ≥ 0.8)', () => {
    const e = evaluate(ix);
    expect(e.recallAtK).toBe(1);
    expect(e.mrr).toBeGreaterThanOrEqual(0.8);
  });
  it('answers only with verbatim, cited sentences from allowlisted sources', () => {
    for (const q of ['How does GMRE skip duplicate archives?', 'Which MFA method does SecureMed use?', 'How were LIME and SHAP compared?']) {
      const ctx = assemble(retrieve(ix, q, 5).hits, 400);
      const a = answer(q, ctx.used);
      expect(a.sentences.length, q).toBeGreaterThan(0);
      expect(a.grounded).toBe(true);
      for (const s of a.sources) expect(isAllowedHref(s.url), s.url).toBe(true);
      expect(ctx.tokens).toBeLessThanOrEqual(400);
    }
  });
  it('says nothing rather than inventing when nothing matches', () => {
    const r = retrieve(ix, 'zzzz qqqq', 5);
    expect(answer('zzzz qqqq', assemble(r.hits).used).sentences).toEqual([]);
    expect(estTokens('abcd')).toBe(1);
  });
});

describe('tool calling, multi-role pipeline, evaluation', () => {
  it('plans each request onto the expected real tool', () => {
    for (const c of EVAL_CASES.filter((x) => x.kind === 'tool')) expect(plan(c.input).tool, c.id).toBe(c.expectTool);
  });
  it('refuses invalid input before execution', () => {
    const t = runTool('x', { tool: 'searchPortfolio', args: { query: '', domain: 'finance' } });
    expect(t.find((s) => s.step === 'validate')!.ok).toBe(false);
    expect(t.some((s) => s.step === 'execute')).toBe(false);
  });
  it('the role pipeline verifies every citation and never scores suitability', () => {
    const m = runCouncil(SAMPLE_JOB);
    expect(m.map((x) => x.from)).toEqual(['coordinator', 'specialist', 'verifier', 'reviewer', 'coordinator']);
    expect(m[2].text).toMatch(/every cited project is published/);
    expect(m[3].text).toMatch(/not a suitability score/);
  });
  it('the evaluation set passes and is reproducible', () => {
    const a = runEval(); const b = runEval();
    expect(a.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
    expect(a.map((r) => r.fingerprint)).toEqual(b.map((r) => r.fingerprint));
  });
});
