// V3 design lab · shared homepage content for the three concepts (Monolith, Orbit, Signal).
// Every claim is derived from the approved content model in src/data. The only new strings
// are layout labels and honesty notes, listed in CONTENT_APPROVAL.md (Part 3, design lab).
import {
  profile, projects, getProject, getSkill, domainList, projectsInDomain, evidencedSkills,
  STATUS_LABEL, EVIDENCE_LABEL, type Project, type DomainId,
} from '../data/index';

export type ShowcaseVisual = 'scheduler' | 'securemed' | 'xai';
export type Flagship = {
  slug: string;
  no: string;
  title: string;
  shortTitle: string;
  domain: DomainId;
  /** “Professional · Nokia” etc. */
  kicker: string;
  status: string;
  evidence: string;
  /** One compelling sentence: the first sentence of the approved summary. */
  line: string;
  /** Three or four evidenced technologies from the record. */
  tech: string[];
  /** Separates the real work from the portfolio demo. Always rendered. */
  honesty: string;
  problem?: string;
  approach: string[];
  /** One more approved sentence for the expanded view (confidentiality or limitation). */
  note?: string;
  visual: ShowcaseVisual;
  demoTitle: string;
  caseHref: string;
  labHref: string;
};

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

const SHOWCASE: { slug: string; visual: ShowcaseVisual; tech: string[]; honesty: string }[] = [
  {
    slug: 'test-resource-scheduler', visual: 'scheduler', tech: ['scheduling', 'state-machines', 'reliability', 'testing'],
    honesty: 'Demo: a synthetic simulator generated in your browser. Not Nokia code, data or configuration.',
  },
  {
    slug: 'securemed', visual: 'securemed', tech: ['auth-mfa', 'threat-modeling', 'devsecops', 'ci-cd'],
    honesty: 'Academic course project, not deployed patient software. The lab is a portfolio simulation, not the course application; only the TOTP algorithm is real.',
  },
  {
    slug: 'finbert-xai', visual: 'xai', tech: ['xai', 'nlp', 'python', 'experiment-design'],
    honesty: 'Study results are not published. The demo explains a small transparent lexicon model, NOT FinBERT.',
  },
];

function kicker(p: Project): string {
  return [p.category === 'professional' ? 'Professional' : 'Academic', p.org].filter(Boolean).join(' · ');
}

export const flagships: Flagship[] = SHOWCASE.map((s, i) => {
  const p = getProject(s.slug);
  if (!p) throw new Error(`design lab: flagship ${s.slug} is not a published project`);
  const tech = s.tech.filter((id) => p.skills.includes(id)).map((id) => getSkill(id)?.label ?? id);
  return {
    slug: p.slug,
    no: String(i + 1).padStart(2, '0'),
    title: p.title,
    shortTitle: p.shortTitle,
    domain: p.domains[0],
    kicker: kicker(p),
    status: STATUS_LABEL[p.status],
    evidence: EVIDENCE_LABEL[p.evidence],
    line: firstSentence(p.summary),
    tech,
    honesty: s.honesty,
    problem: p.problem,
    approach: p.approach.slice(0, 3),
    note: p.confidentiality ?? p.limitations[0],
    visual: s.visual,
    demoTitle: p.demo?.title ?? 'Case study',
    caseHref: `/work/${p.slug}/`,
    labHref: `/work/${p.slug}/#demo`,
  };
});

/** Section 2. Approved sentences only (profile lede, headline, principles). */
export const intro = {
  name: profile.name,
  role: profile.role,
  affiliation: 'Nokia · DHBW Stuttgart',
  location: profile.location,
  headline: profile.headline,
  headlineParts: ((h) => [h[0], h.slice(1).join(' ')])(profile.headline.split(/(?<=\.)\s+/)), // two lines in every concept
  lede: profile.lede,
  ledeParts: profile.lede.split(/(?<=\.)\s+/),
  principles: profile.principles.map((p) => ({ title: p.title, body: p.body })),
};

/** Section 4. Counts come from the data, so they stay true when projects are added. */
export const explore = {
  projects: projects.length,
  labs: projects.filter((p) => p.demo && p.demo.kind !== 'xray').length,
  href: '/work/',
};

/** Section 5. Disciplines = the four content domains, with their most-evidenced skills. */
export const capabilities = domainList.map((d) => {
  const skills = evidencedSkills()
    .filter((s) => s.domain === d.id)
    .map((s) => ({ s, n: projects.filter((p) => p.skills.includes(s.id)).length }))
    .sort((a, b) => b.n - a.n || a.s.label.localeCompare(b.s.label))
    .slice(0, 4)
    .map((x) => x.s.label);
  return { id: d.id, label: d.label, short: d.short, blurb: d.blurb, projects: projectsInDomain(d.id).length, skills, href: `/skills/#domain-${d.id}` };
});

/** Section 6. */
export const contact = {
  email: profile.links.email,
  emailLabel: profile.links.emailLabel,
  linkedin: profile.links.linkedin,
  github: profile.links.github,
  location: profile.location,
};

/** Minimal navigation shared by all concepts (destinations are the existing V2 pages). */
export const nav = [
  { href: '/work/', label: 'Work' },
  { href: '/lab/', label: 'Labs' },
  { href: '/about/', label: 'About' },
];
export const moreNav = [
  { href: '/skills/', label: 'Skills' },
  { href: '/xray/', label: 'X-Ray' },
  { href: '/recruiter/', label: 'Recruiter mode' },
];

export { PORTRAIT_ALT } from '../data/index';

export type ConceptId = 'monolith' | 'orbit' | 'signal';
export const CONCEPTS: { id: ConceptId | 'v2'; letter: string; name: string; tagline: string; href: string }[] = [
  { id: 'monolith', letter: 'A', name: 'Monolith', tagline: 'The quiet future', href: '/design-lab/monolith/' },
  { id: 'orbit', letter: 'B', name: 'Orbit', tagline: 'Spatial intelligence', href: '/design-lab/orbit/' },
  { id: 'signal', letter: 'C', name: 'Signal', tagline: 'Future editorial', href: '/design-lab/signal/' },
  { id: 'v2', letter: 'D', name: 'Current V2', tagline: 'Baseline, unchanged', href: '/' },
];
