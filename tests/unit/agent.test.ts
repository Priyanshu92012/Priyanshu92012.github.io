import { describe, expect, it } from 'vitest';
import { search, detectSkills } from '../../src/lib/agent/search';
import { executeTool, toolDefinitions, ToolError, TOOL_NAMES } from '../../src/lib/agent/tools';
import { compareToJob, splitRequirements } from '../../src/lib/agent/jobmatch';
import { UIActionSchema } from '../../src/lib/agent/protocol';


describe('retrieval', () => {
  it('finds the right project for direct and alias queries', () => {
    expect(search('nested archive ingestion sha256')[0].projectSlug).toBe('gmre-log-parser');
    expect(search('explainability shap lime').find((h) => h.projectSlug)?.projectSlug).toBe('finbert-xai'); // the skill record may rank first
    expect(search('multi-factor authentication threat model').find((h) => h.projectSlug)?.projectSlug).toBe('securemed');
    expect(search('power bi dax kpi reporting')[0].projectSlug).toBe('ticket-reporting-pipeline');
    // projects outside the public set are never retrieved
    expect(search('asset administration shell importer').map((h) => h.projectSlug)).not.toContain('basyx-aasx-importer');
  });
  it('detects skills by alias with word boundaries', () => {
    expect(detectSkills('Experience with RAG and vector search')).toContain('rag');
    expect(detectSkills('We use Kubernetes')).not.toContain('rag');
    expect(detectSkills('strong SQL skills (PostgreSQL)')).toContain('sql');
  });
  it('returns nothing for unrelated queries', () => {
    expect(search('banana bread recipe')).toHaveLength(0);
  });
});

describe('tools', () => {
  it('exposes JSON-schema tool definitions for every tool', () => {
    const defs = toolDefinitions();
    expect(defs.map((d) => d.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const d of defs) expect(d.input_schema.type).toBe('object');
  });
  it('rejects unknown tools, invalid input and unknown slugs', () => {
    expect(() => executeTool('deleteEverything', {})).toThrow(ToolError);
    expect(() => executeTool('searchPortfolio', { query: '' })).toThrow(ToolError);
    expect(() => executeTool('openProject', { slug: 'not-a-project' })).toThrow(ToolError);
    expect(() => executeTool('focusVisualization', { target: 'lab', id: 'https://evil.example' })).toThrow(ToolError);
  });
  it('openProject returns a typed, schema-valid UI action', () => {
    const r = executeTool('openProject', { slug: 'securemed' });
    expect(UIActionSchema.parse(r.actions[0])).toEqual({ type: 'open_project', slug: 'securemed' });
  });
  it('showSkillEvidence is honest about missing evidence', () => {
    const r = executeTool('showSkillEvidence', { skill: 'COBOL' });
    expect((r.output as { found: boolean }).found).toBe(false);
    const ok = executeTool('showSkillEvidence', { skill: 'threat modelling' });
    expect((ok.output as { found: boolean }).found).toBe(true);
  });
  it('generateBrief contains only published projects and labelled outcomes', () => {
    const r = executeTool('generateBrief', { audience: 'AI engineering role' });
    const md = r.artifact?.kind === 'brief' ? r.artifact.data.markdown : '';
    expect(md).toMatch(/# Priyanshu: evidence brief/);
    expect(md).not.toMatch(/sk-ant|password/i);
    for (const m of md.matchAll(/Outcome \(([a-z-]+)\)/g)) expect(['verified', 'linked', 'self-reported']).toContain(m[1]);
  });
});

describe('job matching', () => {
  const JD = `Backend Engineer
Requirements:
- 3+ years of Python and SQL
- Experience building data pipelines and ETL
- Familiarity with Terraform and AWS
- Excellent communication skills
Nice to have:
- Experience with LLM agents or RAG
Benefits:
- 30 days vacation`;
  it('extracts requirements, ignores benefits, marks nice-to-haves', () => {
    const reqs = splitRequirements(JD);
    expect(reqs.some((r) => /vacation/.test(r.text))).toBe(false);
    expect(reqs.find((r) => /LLM agents/.test(r.text))?.priority).toBe('nice');
  });
  it('maps strengths honestly, including gaps and non-assessable items', () => {
    const m = compareToJob(JD);
    const by = (re: RegExp) => m.requirements.find((r) => re.test(r.text))!;
    expect(by(/Python and SQL/).strength).toBe('strong');
    expect(by(/Terraform/).strength).toBe('gap');
    // Kubernetes is evidenced since the 2026-11-20 audit (SecureMed’s k3d deployment)
    expect(compareToJob('Requirements:\n- Experience deploying to Kubernetes').requirements[0].strength).not.toBe('gap');
    expect(by(/communication/).strength).toBe('not-assessable');
    expect(m.caveats.join(' ')).toMatch(/not a suitability score/);
  });
});
