// Skills & technologies taxonomy, derived from the same records as the Skills Constellation:
// every skill in src/data/skills.ts with a `category` that at least one published project lists.
// Nothing here is a free-standing claim: an item exists only through the projects behind it, and its
// evidence kind comes from those projects (or from the skill's `basis`: tool or exploration).
import { profile } from './profile';
import { projects, projectsWithSkill, skillList } from './index';
import { SKILL_CATEGORIES, SKILL_CATEGORY_LABEL, type SkillCategory } from './constants';
import type { Project, Skill } from './schema';

export type WorkKind = 'work' | 'study' | 'own' | 'tool' | 'exploring';
export const KIND_LABEL: Record<WorkKind, string> = { work: 'Nokia', study: 'DHBW', own: 'Own', tool: 'Tool', exploring: 'Exploring' };
export const KIND_NOTE: Record<WorkKind, string> = {
  work: 'professional work',
  study: 'academic project',
  own: 'personal project',
  tool: 'development tool',
  exploring: 'learning / exploration',
};
export const KIND_TITLE: Record<WorkKind, string> = {
  work: 'Professional work at Nokia',
  study: 'Academic project at DHBW Stuttgart',
  own: 'Personal project or open source',
  tool: 'A development tool used in the linked work',
  exploring: 'Learning and exploration: built as a demonstration, not an established competence',
};
export const KIND_ORDER: WorkKind[] = ['work', 'study', 'own', 'tool', 'exploring'];

export function workKind(p: Pick<Project, 'category'>): WorkKind {
  return p.category === 'professional' ? 'work' : p.category === 'academic' ? 'study' : 'own';
}

/** Display order inside each category (anything not listed follows in record order). */
const ORDER: Partial<Record<SkillCategory, string[]>> = {
  languages: ['python', 'c', 'cpp', 'bash', 'sql'],
  frontend: ['typescript', 'javascript', 'react', 'astro', 'threejs', 'accessibility'],
  backend: ['fastapi', 'rest-api', 'sqlalchemy', 'alembic', 'sqlite'],
  infrastructure: ['docker', 'linux', 'embedded-linux', 'kernel-drivers', 'kubernetes', 'git', 'github-actions', 'ci-cd'],
  'data-ai': ['pytorch', 'hf-transformers', 'nlp', 'xai', 'pandas', 'numpy', 'experiment-design'],
  agentic: ['claude-code', 'openai-codex', 'ai-assisted-se', 'llm-agents', 'evals', 'rag', 'multi-agent'],
  'testing-security': ['pytest', 'playwright', 'testing', 'devsecops', 'threat-modeling', 'auth-mfa', 'secure-boot', 'linux-security', 'mtls-pki', 'containers', 'fuzzing'],
  systems: ['scheduling', 'data-pipelines', 'idempotency', 'reliability', 'state-machines', 'plugin-architecture', 'automation', 'power-bi', 'dax'],
};

export type TaxonomyItem = { id: string; label: string; basis?: Skill['basis']; note?: string; projects: Project[]; kinds: WorkKind[]; href: string };
export type TaxonomyGroup = { id: SkillCategory; title: string; items: TaxonomyItem[] };

function item(s: Skill): TaxonomyItem {
  const ps = [...projectsWithSkill(s.id)].sort((a, b) => KIND_ORDER.indexOf(workKind(a)) - KIND_ORDER.indexOf(workKind(b)) || a.index - b.index);
  const kinds: WorkKind[] = s.basis === 'tool' ? ['tool'] : s.basis === 'exploration' ? ['exploring'] : KIND_ORDER.filter((k) => ps.some((p) => workKind(p) === k));
  return { id: s.id, label: s.label, basis: s.basis, note: s.note, projects: ps, kinds, href: `/skills/#skill-${s.id}` };
}

/** The authoritative taxonomy: categories in display order, only evidenced skills. */
export const taxonomy: TaxonomyGroup[] = SKILL_CATEGORIES.map((id) => {
  const order = ORDER[id] ?? [];
  const items = skillList
    .filter((s) => s.category === id && projectsWithSkill(s.id).length > 0)
    .sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99))
    .map(item);
  return { id, title: SKILL_CATEGORY_LABEL[id], items };
}).filter((g) => g.items.length > 0);

/** Candidate technologies checked in the 2026-11-21 audit and NOT shown: no evidence on this site. */
export const NOT_SHOWN = ['Grafana', 'Prometheus', 'Telegraf', 'OpenTelemetry', 'Azure', 'Vercel', 'Flask', 'TensorFlow', 'PostgreSQL', 'Google Gemini', 'MCP'];

/** Human languages, as stated by the owner. */
export const humanLanguages = profile.languages;

export const publishedSlugs = new Set(projects.map((p) => p.slug));
