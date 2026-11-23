// Wire protocol between the Worker (or the offline agent) and the browser.
// Every event is validated with these schemas on the client before it can
// change the UI. UI actions are a closed set; ids are checked against the data.
import { z } from 'zod';
z.config({ jitless: true }); // no `new Function` probe: the site's CSP forbids eval
import { projects, skillList, domainList } from '../../data/index';

const projectSlugs = new Set(projects.map((p) => p.slug));
const skillIds = new Set(skillList.map((s) => s.id));
const domainIds = new Set(domainList.map((d) => d.id));

export function isKnownFocusId(id: string): boolean {
  if (projectSlugs.has(id)) return true;
  const [kind, rest] = id.split(':');
  if (kind === 'project') return projectSlugs.has(rest);
  if (kind === 'skill') return skillIds.has(rest);
  if (kind === 'domain') return domainIds.has(rest as never);
  return false;
}

export const UIActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open_project'), slug: z.string().refine((s) => projectSlugs.has(s), 'unknown project') }),
  z.object({
    type: z.literal('focus'),
    target: z.enum(['lab', 'constellation']),
    id: z.string().refine(isKnownFocusId, 'unknown visualization node'),
  }),
]);
export type UIAction = z.infer<typeof UIActionSchema>;

export const SourceSchema = z.object({
  id: z.string().max(120),
  title: z.string().max(160),
  url: z.string().refine((u) => u.startsWith('/') || u.startsWith('https://'), 'source urls must be site paths or https'),
});
export type Source = z.infer<typeof SourceSchema>;

export const JobMatchSchema = z.object({
  requirements: z.array(z.object({
    text: z.string(),
    priority: z.enum(['must', 'nice']),
    strength: z.enum(['strong', 'partial', 'gap', 'not-assessable']),
    skills: z.array(z.object({ id: z.string(), label: z.string() })),
    evidence: z.array(z.object({ slug: z.string(), title: z.string(), status: z.string(), evidence: z.string(), url: z.string() })),
    note: z.string(),
  })),
  coverage: z.object({ strong: z.number(), partial: z.number(), gap: z.number(), notAssessable: z.number() }),
  readFirst: z.array(z.object({ slug: z.string(), title: z.string(), url: z.string(), reason: z.string() })),
  caveats: z.array(z.string()),
});
export type JobMatch = z.infer<typeof JobMatchSchema>;

export const BriefSchema = z.object({ title: z.string(), filename: z.string().regex(/^[a-z0-9-]+\.md$/), markdown: z.string().max(20000) });
export type Brief = z.infer<typeof BriefSchema>;

const ArtifactEventSchema = z.discriminatedUnion('kind', [
  z.object({ t: z.literal('artifact'), kind: z.literal('job_match'), data: JobMatchSchema }),
  z.object({ t: z.literal('artifact'), kind: z.literal('brief'), data: BriefSchema }),
]);

const CoreEventSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('meta'), mode: z.enum(['llm', 'offline']), requestId: z.string(), model: z.string().optional(), note: z.string().optional() }),
  z.object({ t: z.literal('text'), delta: z.string() }),
  z.object({ t: z.literal('tool_call'), id: z.string(), name: z.string(), input: z.record(z.string(), z.unknown()) }),
  z.object({ t: z.literal('tool_result'), id: z.string(), name: z.string(), summary: z.string(), ms: z.number().optional() }),
  z.object({ t: z.literal('ui_action'), action: UIActionSchema }),
  z.object({ t: z.literal('sources'), sources: z.array(SourceSchema).max(12) }),
  z.object({ t: z.literal('done'), ms: z.number(), usage: z.object({ input: z.number(), output: z.number() }).optional() }),
  z.object({ t: z.literal('error'), code: z.string(), message: z.string() }),
]);

export const AgentEventSchema = z.union([CoreEventSchema, ArtifactEventSchema]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const ChatMessageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(6000) });
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(12),
  page: z.string().max(120).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export { MAX_USER_CHARS, MAX_JOB_CHARS } from './constants';
