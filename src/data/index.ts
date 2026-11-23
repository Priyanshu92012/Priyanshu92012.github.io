// Validated, read-only access to the public content model.
// Imported by Astro pages, React islands, the agent tools AND the Cloudflare Worker.
import type { Domain, DomainId, EvidenceLevel, Project, Skill, Status } from './schema';
import { projectsRaw } from './projects';
import { domainsRaw, skillsRaw } from './skills';
import { profile } from './profile';

// No Zod here: this module ships to the browser. The records are typed at compile time
// and validated with the Zod schemas at build time (src/data/validate.ts, called from
// BaseLayout and the unit tests), so an invalid record fails the build, not the visitor.
export type { Domain, DomainId, EvidenceLevel, Project, Skill, Status, Outcome, EvidenceLink, DemoKind } from './schema';
export { DOMAIN_IDS, STATUSES, EVIDENCE_LEVELS, DEMO_KINDS } from './constants';
export { profile };

/** Alt text for the owner’s portrait (homepage hero and design lab). */
export const PORTRAIT_ALT = `Portrait of ${profile.name}, a software engineer, in a dark suit and white open-collar shirt, smiling slightly at the camera.`;

const skills: Skill[] = skillsRaw;
const domains: Domain[] = domainsRaw;
const allProjects: Project[] = projectsRaw;

/** Only owner-approved records are ever published (plan §7). */
export const projects: readonly Project[] = allProjects.filter((p) => p.publishApproved).sort((a, b) => a.index - b.index);
export const skillList: readonly Skill[] = skills;
export const domainList: readonly Domain[] = domains;

export const STATUS_LABEL: Record<Status, string> = {
  production: 'Production',
  professional: 'Professional',
  'open-source': 'Open source',
  'in-progress': 'In progress',
  academic: 'Academic',
  research: 'Research',
  experiment: 'Lab experiment',
  planned: 'Planned · early research',
};

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  public: 'Public source',
  documented: 'Public write-up',
  reported: 'Owner-reported',
  pending: 'Case study pending',
};

export const EVIDENCE_RANK: Record<EvidenceLevel, number> = { public: 4, documented: 3, reported: 2, pending: 1 };

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
export function getSkill(id: string): Skill | undefined {
  return skills.find((s) => s.id === id);
}
export function getDomain(id: DomainId): Domain {
  return domains.find((d) => d.id === id)!;
}
export function projectsInDomain(id: DomainId): Project[] {
  return projects.filter((p) => p.domains.includes(id));
}
export function projectsWithSkill(id: string): Project[] {
  return projects.filter((p) => p.skills.includes(id));
}
export function projectUrl(p: Pick<Project, 'slug'>): string {
  return `/work/${p.slug}/`;
}

/** Skills that are actually evidenced by at least one published project. */
export function evidencedSkills(): Skill[] {
  return skills.filter((s) => projects.some((p) => p.skills.includes(s.id)));
}

/** Pairs of projects sharing at least `min` skills or a primary domain, strongest first. */
export function projectRelations(min = 2): { a: string; b: string; shared: string[] }[] {
  const out: { a: string; b: string; shared: string[] }[] = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const shared = projects[i].skills.filter((s) => projects[j].skills.includes(s));
      if (shared.length >= min) out.push({ a: projects[i].slug, b: projects[j].slug, shared });
    }
  }
  return out.sort((x, y) => y.shared.length - x.shared.length);
}

export type GraphNode = { id: string; kind: 'domain' | 'project' | 'skill'; label: string; domain: DomainId; weight: number };
export type GraphEdge = { source: string; target: string; kind: 'project-skill' | 'project-domain' | 'skill-domain' };

/** Knowledge graph for the Skills Constellation: domains, projects and evidenced skills. */
export function knowledgeGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const d of domains) nodes.push({ id: `domain:${d.id}`, kind: 'domain', label: d.label, domain: d.id, weight: projectsInDomain(d.id).length });
  for (const p of projects) {
    nodes.push({ id: `project:${p.slug}`, kind: 'project', label: p.shortTitle, domain: p.domains[0], weight: EVIDENCE_RANK[p.evidence] });
    for (const d of p.domains) edges.push({ source: `project:${p.slug}`, target: `domain:${d}`, kind: 'project-domain' });
    for (const s of p.skills) edges.push({ source: `project:${p.slug}`, target: `skill:${s}`, kind: 'project-skill' });
  }
  for (const s of evidencedSkills()) {
    nodes.push({ id: `skill:${s.id}`, kind: 'skill', label: s.label, domain: s.domain, weight: projectsWithSkill(s.id).length });
    edges.push({ source: `skill:${s.id}`, target: `domain:${s.domain}`, kind: 'skill-domain' });
  }
  return { nodes, edges };
}
