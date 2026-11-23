// Read-only agent tools. Pure functions over the approved content model, shared by
// the Cloudflare Worker (LLM mode) and the browser (offline mode). Tools never
// touch the network, the filesystem or any secret; UI effects are returned as
// typed actions that the client validates again before applying.
import { z } from 'zod';
z.config({ jitless: true }); // no `new Function` probe: the site's CSP forbids eval
import {
  DOMAIN_IDS, getProject, getSkill, projects, projectsWithSkill, skillList,
  STATUS_LABEL, EVIDENCE_LABEL, EVIDENCE_RANK,
} from '../../data/index';
import { search, detectSkills } from './search';
import { compareToJob } from './jobmatch';
import { generateBrief } from './brief';
import { isKnownFocusId, MAX_JOB_CHARS, type Brief, type JobMatch, type Source, type UIAction } from './protocol';

export const ToolInputs = {
  searchPortfolio: z.object({
    query: z.string().min(1).max(300).describe('What to look for, in natural language or keywords.'),
    domain: z.enum(DOMAIN_IDS).optional().describe('Optionally restrict to one domain.'),
  }),
  getProject: z.object({ slug: z.string().max(60).describe('Project slug from search results, e.g. "gmre-log-parser".') }),
  openProject: z.object({ slug: z.string().max(60).describe('Project slug to open for the visitor.') }),
  focusVisualization: z.object({
    target: z.enum(['lab', 'constellation']).describe('lab = the Spatial Lab on the home page, constellation = the Skills Constellation.'),
    id: z.string().max(80).describe('A project slug, "skill:<id>" or "domain:<systems|ai|security|research>".'),
  }),
  showSkillEvidence: z.object({ skill: z.string().min(1).max(60).describe('A skill name or id, e.g. "Python", "threat modelling", "rag".') }),
  compareToJob: z.object({ description: z.string().min(20).max(MAX_JOB_CHARS).describe('The full job description text pasted by the visitor.') }),
  generateBrief: z.object({
    audience: z.string().max(80).optional().describe('Who the brief is for, e.g. "AI engineering role" or "security team".'),
    focus: z.string().max(200).optional().describe('Optional extra focus keywords.'),
  }),
} as const;

export type ToolName = keyof typeof ToolInputs;
export const TOOL_NAMES = Object.keys(ToolInputs) as ToolName[];

const DESCRIPTIONS: Record<ToolName, string> = {
  searchPortfolio: 'Search approved portfolio evidence (projects, decisions, outcomes, profile). Returns snippets with source ids. Use before answering factual questions.',
  getProject: 'Get the full approved record for one project: role, status, evidence level, approach, decisions, outcomes with basis, limitations, links.',
  openProject: 'Navigate the visitor to a project case study. Only use when the visitor asks to see or open it.',
  focusVisualization: 'Highlight a project, skill or domain in the Spatial Lab or Skills Constellation while you discuss it.',
  showSkillEvidence: 'List the published projects that evidence a skill, with status and evidence level. Reports honestly when there is no evidence.',
  compareToJob: 'Map a job description to portfolio evidence: per requirement strong / partial / gap / not-assessable, plus what to read first. Not a suitability score.',
  generateBrief: 'Create a downloadable Markdown brief of the most relevant work for an audience, built only from approved records.',
};

/** Tool definitions in Anthropic Messages API format (JSON Schema generated from Zod). */
export function toolDefinitions(): { name: ToolName; description: string; input_schema: Record<string, unknown> }[] {
  return TOOL_NAMES.map((name) => {
    const schema = z.toJSONSchema(ToolInputs[name]) as Record<string, unknown>;
    delete schema.$schema;
    return { name, description: DESCRIPTIONS[name], input_schema: schema };
  });
}

export type ToolExecution = {
  output: unknown;
  summary: string;
  sources: Source[];
  actions: UIAction[];
  artifact?: { kind: 'job_match'; data: JobMatch } | { kind: 'brief'; data: Brief };
};

export class ToolError extends Error {}

function projectSource(slug: string): Source {
  const p = getProject(slug)!;
  return { id: `project:${slug}`, title: p.title, url: `/work/${slug}/` };
}

export function resolveSkill(name: string) {
  const n = name.trim().toLowerCase();
  return (
    skillList.find((s) => s.id === n || s.label.toLowerCase() === n) ??
    skillList.find((s) => s.aliases.includes(n)) ??
    (() => { const ids = detectSkills(name); return ids.length ? getSkill(ids[0]) : undefined; })()
  );
}

export function executeTool(name: string, rawInput: unknown): ToolExecution {
  if (!(name in ToolInputs)) throw new ToolError(`Unknown tool: ${name}`);
  const parsed = ToolInputs[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) throw new ToolError(`Invalid input for ${name}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  const input = parsed.data as Record<string, string | undefined>;

  switch (name as ToolName) {
    case 'searchPortfolio': {
      const hits = search(input.query!, { domain: input.domain, limit: 6 });
      return {
        output: hits.length ? hits.map((h) => ({ source_id: h.id, title: h.title, snippet: h.snippet, url: h.url })) : { results: [], note: 'No approved evidence matched this query.' },
        summary: hits.length ? `${hits.length} result(s): ${hits.slice(0, 3).map((h) => h.title).join(', ')}` : 'no matching evidence',
        sources: hits.map((h) => ({ id: h.id, title: h.title, url: h.url })),
        actions: [],
      };
    }
    case 'getProject': {
      const p = getProject(input.slug!);
      if (!p) return { output: { found: false, note: `No published project "${input.slug}". Known slugs: ${projects.map((x) => x.slug).join(', ')}` }, summary: 'unknown slug', sources: [], actions: [] };
      return {
        output: {
          found: true, slug: p.slug, title: p.title, org: p.org, status: STATUS_LABEL[p.status], public_evidence: EVIDENCE_LABEL[p.evidence],
          role: p.role, summary: p.summary, problem: p.problem, approach: p.approach, decisions: p.decisions,
          outcomes: p.outcomes.map((o) => ({ claim: o.claim, basis: o.basis })), limitations: p.limitations, confidentiality: p.confidentiality,
          skills: p.skills.map((s) => getSkill(s)?.label ?? s), links: p.links.map((l) => ({ title: l.title, url: l.url })),
          demo: p.demo ? { title: p.demo.title, disclosure: p.demo.disclosure } : undefined, url: `/work/${p.slug}/`,
        },
        summary: `${p.title} (${STATUS_LABEL[p.status]}, ${EVIDENCE_LABEL[p.evidence]})`,
        sources: [projectSource(p.slug)],
        actions: [{ type: 'focus', target: 'lab', id: p.slug }],
      };
    }
    case 'openProject': {
      const p = getProject(input.slug!);
      if (!p) throw new ToolError(`No published project "${input.slug}"`);
      return { output: { opened: p.slug, title: p.title }, summary: `open ${p.title}`, sources: [projectSource(p.slug)], actions: [{ type: 'open_project', slug: p.slug }] };
    }
    case 'focusVisualization': {
      const target = input.target as 'lab' | 'constellation';
      let id = input.id!;
      if (getProject(id) && target === 'constellation') id = `project:${id}`;
      if (target === 'lab' && id.startsWith('project:')) id = id.slice(8);
      if (!isKnownFocusId(id)) throw new ToolError(`Unknown visualization node "${input.id}"`);
      return { output: { focused: id, target }, summary: `focus ${target} → ${id}`, sources: [], actions: [{ type: 'focus', target, id }] };
    }
    case 'showSkillEvidence': {
      const s = resolveSkill(input.skill!);
      const ev = s ? projectsWithSkill(s.id).sort((a, b) => EVIDENCE_RANK[b.evidence] - EVIDENCE_RANK[a.evidence]) : [];
      if (!s || !ev.length) {
        return { output: { found: false, skill: input.skill, note: `No published project evidences "${input.skill}".` }, summary: `no evidence for ${input.skill}`, sources: [], actions: [] };
      }
      return {
        output: {
          found: true, skill: s.label,
          projects: ev.map((p) => ({ slug: p.slug, title: p.title, status: STATUS_LABEL[p.status], public_evidence: EVIDENCE_LABEL[p.evidence], role: p.role, outcomes: p.outcomes.map((o) => `${o.claim} [${o.basis}]`) })),
        },
        summary: `${s.label}: ${ev.length} project(s)`,
        sources: [{ id: `skill:${s.id}`, title: `Skill: ${s.label}`, url: `/skills/#skill-${s.id}` }, ...ev.slice(0, 4).map((p) => projectSource(p.slug))],
        actions: [{ type: 'focus', target: 'constellation', id: `skill:${s.id}` }],
      };
    }
    case 'compareToJob': {
      const m = compareToJob(input.description!);
      return {
        output: {
          coverage: m.coverage,
          requirements: m.requirements.map((r) => ({ requirement: r.text, priority: r.priority, strength: r.strength, evidence: r.evidence.map((e) => `${e.title} (${e.status}; ${e.evidence})`), note: r.note })),
          read_first: m.readFirst, caveats: m.caveats,
        },
        summary: `${m.requirements.length} requirements: ${m.coverage.strong} strong · ${m.coverage.partial} partial · ${m.coverage.gap} gap · ${m.coverage.notAssessable} n/a`,
        sources: m.readFirst.map((r) => projectSource(r.slug)),
        actions: [],
        artifact: { kind: 'job_match', data: m },
      };
    }
    case 'generateBrief': {
      const b = generateBrief({ audience: input.audience, focus: input.focus });
      const slugs = [...b.markdown.matchAll(/\/work\/([a-z0-9-]+)\//g)].map((m) => m[1]);
      return {
        output: { title: b.title, filename: b.filename, projects_included: slugs, note: 'The visitor can download the brief from the chat.' },
        summary: `brief "${b.title}" (${slugs.length} projects)`,
        sources: [...new Set(slugs)].map(projectSource),
        actions: [],
        artifact: { kind: 'brief', data: b },
      };
    }
  }
  throw new ToolError(`Unhandled tool: ${name}`);
}
