// Zod-free vocabulary of the content model. Safe to ship to the browser.
export const DOMAIN_IDS = ['systems', 'ai', 'security', 'research'] as const;
export type DomainId = (typeof DOMAIN_IDS)[number];

/** What the work is. Labels are rendered literally (plan §6). */
export const STATUSES = ['production', 'professional', 'open-source', 'in-progress', 'academic', 'research', 'experiment', 'planned'] as const;
export type Status = (typeof STATUSES)[number];

/**
 * How much PUBLIC evidence stands behind it. Drives the Spatial Lab module height.
 *  public      – public source code or public artefact you can inspect
 *  documented  – a public technical write-up exists (e.g. architecture page)
 *  reported    – described by the owner; details withheld or private
 *  pending     – public case study / results not yet released
 */
export const EVIDENCE_LEVELS = ['public', 'documented', 'reported', 'pending'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const DEMO_KINDS = ['scheduler', 'gmre', 'securemed', 'xai', 'arena', 'basyx', 'xray', 'guide', 'opticlab'] as const;
export type DemoKind = (typeof DEMO_KINDS)[number];

/** Skills & technologies taxonomy, in display order. */
export const SKILL_CATEGORIES = ['languages', 'frontend', 'backend', 'infrastructure', 'data-ai', 'agentic', 'testing-security', 'systems'] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export const SKILL_CATEGORY_LABEL: Record<SkillCategory, string> = {
  languages: 'Languages',
  frontend: 'Frontend',
  backend: 'Backend',
  infrastructure: 'Cloud & infrastructure',
  'data-ai': 'Data & AI/ML',
  agentic: 'Agentic AI & developer tools',
  'testing-security': 'Testing & cybersecurity',
  systems: 'Systems & automation',
};
