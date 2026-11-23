// Public content contract (master plan §7, extended).
// Everything the site, the Skills Constellation and PRIYANSHU.AI know comes from
// records validated by these schemas. Nothing private belongs in src/data.
import { z } from 'zod';
import { SKILL_CATEGORIES } from './constants';
import { DOMAIN_IDS, STATUSES, EVIDENCE_LEVELS, DEMO_KINDS } from './constants';

export { DOMAIN_IDS, STATUSES, EVIDENCE_LEVELS, DEMO_KINDS };
export type { DomainId, Status, EvidenceLevel, DemoKind } from './constants';

export const DomainIdSchema = z.enum(DOMAIN_IDS);

export const StatusSchema = z.enum(STATUSES);

export const EvidenceLevelSchema = z.enum(EVIDENCE_LEVELS);

const urlOrPath = z.string().refine((u) => u.startsWith('https://') || u.startsWith('/') || u.startsWith('mailto:'), {
  message: 'links must be https://, mailto: or a site-relative path',
});

export const OutcomeSchema = z.object({
  claim: z.string().min(8),
  /** verified = checked against an artefact; linked = stated in a linked public source; self-reported = owner statement */
  basis: z.enum(['verified', 'linked', 'self-reported']),
  url: urlOrPath.optional(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

export const LinkSchema = z.object({
  title: z.string(),
  url: urlOrPath,
  kind: z.enum(['source', 'documentation', 'demo', 'report', 'site']),
});
export type EvidenceLink = z.infer<typeof LinkSchema>;


export const ProjectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  index: z.number().int().positive(),
  title: z.string(),
  shortTitle: z.string().max(24),
  org: z.string().optional(),
  category: z.enum(['professional', 'academic', 'open-source', 'personal']),
  status: StatusSchema,
  evidence: EvidenceLevelSchema,
  tier: z.enum(['flagship', 'secondary']),
  domains: z.array(DomainIdSchema).min(1),
  role: z.string(),
  summary: z.string().min(40).max(280),
  problem: z.string().optional(),
  approach: z.array(z.string()).default([]),
  decisions: z.array(z.object({ decision: z.string(), why: z.string() })).default([]),
  outcomes: z.array(OutcomeSchema).default([]),
  limitations: z.array(z.string()).default([]),
  /** At least one, except for a 'pending' case study whose details are not cleared yet. */
  skills: z.array(z.string()),
  links: z.array(LinkSchema).default([]),
  demo: z.object({
    kind: z.enum(DEMO_KINDS),
    title: z.string(),
    disclosure: z.string(),
  }).optional(),
  confidentiality: z.string().optional(),
  /** Position on the Spatial Lab floor (world units, floor spans -5..5). */
  lab: z.object({ x: z.number().min(-4.6).max(4.6), z: z.number().min(-4.6).max(4.6) }),
  publishApproved: z.boolean(),
  /** needs-owner-review items are listed in CONTENT_APPROVAL.md and block production deploy. */
  review: z.enum(['confirmed', 'needs-owner-review']),
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const ProjectRecordSchema = ProjectSchema.refine((p) => p.skills.length > 0 || p.evidence === 'pending', {
  message: 'skills may only be empty for a project whose case study is pending', path: ['skills'],
});
export type Project = z.infer<typeof ProjectSchema>;

export const SkillSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  group: z.enum(['language', 'framework', 'data', 'systems', 'ai', 'security', 'iot', 'practice', 'platform']),
  domain: DomainIdSchema,
  /** Lower-case phrases used for job-description matching and search. */
  aliases: z.array(z.string()).default([]),
  /** Skills & technologies taxonomy (homepage, /skills/, résumé). Every evidenced skill needs one. */
  category: z.enum(SKILL_CATEGORIES).optional(),
  /** How the linked work evidences it, when that is not plain project work: a development tool,
   *  or learning/exploration (shown as such, never as an established competence). */
  basis: z.enum(['tool', 'exploration']).optional(),
  /** One honest line shown with the skill (e.g. what is real and what is simulated). */
  note: z.string().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const DomainSchema = z.object({
  id: DomainIdSchema,
  label: z.string(),
  short: z.string(),
  color: z.enum(['violet', 'bio', 'orange', 'paper']),
  blurb: z.string(),
});
export type Domain = z.infer<typeof DomainSchema>;
