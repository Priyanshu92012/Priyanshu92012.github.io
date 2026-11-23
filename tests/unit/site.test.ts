import { describe, expect, it } from 'vitest';
import { constellationLayout, neighbourhood, VIEW } from '../../src/lib/constellation';
import { parseTranscript, APPROVED_RUNS } from '../../src/lib/arena';
import { projects, evidencedSkills, domainList } from '../../src/data/index';

describe('constellation layout', () => {
  const L = constellationLayout();
  it('contains every domain, project and evidenced skill exactly once', () => {
    expect(L.nodes.filter((n) => n.kind === 'domain')).toHaveLength(domainList.length);
    expect(L.nodes.filter((n) => n.kind === 'project')).toHaveLength(projects.length);
    expect(L.nodes.filter((n) => n.kind === 'skill')).toHaveLength(evidencedSkills().length);
    expect(new Set(L.nodes.map((n) => n.id)).size).toBe(L.nodes.length);
  });
  it('keeps every node inside the view box', () => {
    for (const n of L.nodes) {
      expect(n.x).toBeGreaterThan(20); expect(n.x).toBeLessThan(VIEW.w - 20);
      expect(n.y).toBeGreaterThan(20); expect(n.y).toBeLessThan(VIEW.h - 20);
    }
  });
  it('does not stack nodes on top of each other', () => {
    for (let i = 0; i < L.nodes.length; i++) for (let j = i + 1; j < L.nodes.length; j++) {
      const a = L.nodes[i], b = L.nodes[j];
      expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} vs ${b.id}`).toBeGreaterThan(14);
    }
  });
  it('is deterministic (server and client render the same graph)', async () => {
    const again = JSON.stringify(constellationLayout().nodes.map((n) => [n.id, n.x, n.y]));
    expect(again).toBe(JSON.stringify(L.nodes.map((n) => [n.id, n.x, n.y])));
  });
  it('neighbourhood of a skill is the skill, its projects and its domain', () => {
    const hood = neighbourhood('skill:python')!;
    expect(hood.has('skill:python')).toBe(true);
    expect(hood.has('project:gmre-log-parser')).toBe(true);
    expect(hood.has('domain:systems')).toBe(true);
    expect(neighbourhood(null)).toBeNull();
  });
});

describe('agent arena transcripts', () => {
  const valid = {
    schema: 'arena-run/1', task: { id: 't1', title: 'Fix a bug', statement: 'x' }, agent: { name: 'A' },
    condition: { repoSnapshot: 'abc123', timeBudgetMin: 30 }, startedAt: '2026-11-18T10:00:00Z', approved: false,
    events: [{ t: 0, kind: 'prompt', text: 'go' }, { t: 5, kind: 'test', text: '3 passed', ok: true }],
    score: { testsPassed: 3, testsTotal: 3 },
  };
  it('publishes no runs until they are approved', () => { expect(APPROVED_RUNS).toHaveLength(0); });
  it('accepts a well-formed transcript', () => { expect(parseTranscript(JSON.stringify(valid)).ok).toBe(true); });
  it('rejects malformed JSON, wrong schema and impossible scores', () => {
    expect(parseTranscript('{nope').ok).toBe(false);
    expect(parseTranscript(JSON.stringify({ ...valid, schema: 'other' })).ok).toBe(false);
    expect(parseTranscript(JSON.stringify({ ...valid, score: { testsPassed: 4, testsTotal: 3 } })).ok).toBe(false);
    expect(parseTranscript(JSON.stringify({ ...valid, events: [{ t: 5, kind: 'note', text: 'a' }, { t: 1, kind: 'note', text: 'b' }] })).ok).toBe(false);
  });
});
