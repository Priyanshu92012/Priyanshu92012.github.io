import { describe, expect, it } from 'vitest';
import { projects, skillList, knowledgeGraph, projectRelations, getProject, profile } from '../../src/data/index';
import { projectsRaw } from '../../src/data/projects';
import { validateContent } from '../../src/data/validate';

describe('content model', () => {
  it('passes schema validation (the same check every build runs)', () => { expect(() => validateContent()).not.toThrow(); });
  it('publishes only approved projects, with unique slugs and indices', () => {
    expect(projects.length).toBe(projectsRaw.filter((p) => p.publishApproved).length);
    expect(new Set(projects.map((p) => p.slug)).size).toBe(projects.length);
    expect(new Set(projects.map((p) => p.index)).size).toBe(projects.length);
  });
  it('every outcome declares its basis; linked outcomes carry a url', () => {
    for (const p of projects) for (const o of p.outcomes) {
      expect(['verified', 'linked', 'self-reported']).toContain(o.basis);
      if (o.basis === 'linked') expect(o.url).toBeTruthy();
    }
  });
  it('every demo carries a disclosure', () => {
    for (const p of projects) if (p.demo) expect(p.demo.disclosure.length).toBeGreaterThan(30);
  });
  it('lab positions do not overlap', () => {
    for (const a of projects) for (const b of projects) {
      if (a.slug >= b.slug) continue;
      expect(Math.hypot(a.lab.x - b.lab.x, a.lab.z - b.lab.z), `${a.slug} vs ${b.slug}`).toBeGreaterThan(1.3);
    }
  });
  it('contains no private or secret material', () => {
    const blob = JSON.stringify({ projectsRaw, profile, skillList });
    expect(blob).not.toMatch(/sk-ant-|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY/);
    expect(blob).not.toMatch(/\b(10|192\.168)\.\d+\.\d+\.\d+\b/);
  });
  it('knowledge graph edges reference existing nodes', () => {
    const { nodes, edges } = knowledgeGraph();
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) { expect(ids.has(e.source)).toBe(true); expect(ids.has(e.target)).toBe(true); }
  });
  it('relations share at least two skills', () => {
    for (const r of projectRelations(2)) expect(r.shared.length).toBeGreaterThanOrEqual(2);
    // GMRE's detailed architecture page was retired for confidentiality: no outbound evidence link, owner-reported evidence.
    expect(getProject('gmre-log-parser')?.links).toEqual([]);
    expect(getProject('gmre-log-parser')?.evidence).toBe('reported');
  });

  it('publishes exactly the owner-selected projects, in the owner’s order (the planned one last)', () => {
    expect(projects.map((p) => p.slug)).toEqual([
      'test-resource-scheduler', 'gmre-log-parser', 'securemed', 'finbert-xai', 'opticlab', 'ticket-reporting-pipeline', 'priyanshu-exe', 'infrastructure-capacity',
    ]);
  });

  it('keeps the planned project honest: no results, skills, lab or demo', () => {
    const p = projects.find((x) => x.slug === 'infrastructure-capacity')!;
    expect(p.status).toBe('planned');
    expect(p.evidence).toBe('pending');
    expect(p.tier).toBe('secondary');
    expect([p.outcomes.length, p.skills.length, p.decisions.length]).toEqual([0, 0, 0]);
    expect(p.demo).toBeUndefined();
    expect(p.limitations.join(' ')).toMatch(/none are claimed/);
  });

  it('uses the public-safe title for the allocation project (the internal name stays blocked)', () => {
    expect(projects.find((x) => x.slug === 'test-resource-scheduler')!.title).toBe('Dynamic Test-Resource Allocation');
  });

  it('describes OpticLab as the personal, fictional lab its own source says it is', () => {
    const p = projects.find((x) => x.slug === 'opticlab')!;
    expect(p.category).toBe('personal');
    expect(p.org).not.toMatch(/nokia/i);
    expect(p.limitations.join(' ')).toMatch(/fictional/);
    expect(p.limitations.join(' ')).toMatch(/no Nokia or other employer code/);
    expect(p.outcomes.every((o) => o.basis === 'verified')).toBe(true);
  });

  it('labels the site’s own guide honestly: scripted, with the LLM Worker disabled', () => {
    const p = projects.find((x) => x.slug === 'priyanshu-exe')!;
    expect(p.limitations.join(' ')).toMatch(/scripted/);
    expect(p.limitations.join(' ')).toMatch(/not deployed/);
    // the AI Systems Lab evidences retrieval and tool contracts; both are labelled for what they are
    const rag = skillList.find((s) => s.id === 'rag')!;
    expect(rag.basis).toBe('exploration');
    expect(rag.note).toMatch(/no language model/);
    expect(skillList.find((s) => s.id === 'llm-agents')!.note).toMatch(/not deployed/);
    expect(skillList.find((s) => s.id === 'multi-agent')!.note).toMatch(/No autonomous agents/);
  });

});
