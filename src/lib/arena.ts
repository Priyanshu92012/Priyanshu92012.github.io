// Agent Arena transcript format + validation. The replay viewer only ever shows
// (a) runs listed in APPROVED_RUNS (none yet) or (b) a file the visitor opens
// locally, which is parsed in the browser and never uploaded.
import { z } from 'zod';
z.config({ jitless: true }); // no `new Function` probe: the site's CSP forbids eval

export const ArenaEventSchema = z.object({
  t: z.number().min(0).max(86_400),
  kind: z.enum(['prompt', 'message', 'tool_call', 'tool_result', 'test', 'note']),
  actor: z.string().max(40).optional(),
  text: z.string().max(20_000),
  ok: z.boolean().optional(),
});

export const ArenaRunSchema = z.object({
  schema: z.literal('arena-run/1'),
  task: z.object({ id: z.string().max(60), title: z.string().max(140), statement: z.string().max(4000) }),
  agent: z.object({ name: z.string().max(60), version: z.string().max(60).optional() }),
  condition: z.object({ repoSnapshot: z.string().max(120), timeBudgetMin: z.number().positive().max(600) }),
  startedAt: z.string().max(40),
  events: z.array(ArenaEventSchema).min(1).max(5000),
  score: z.object({ testsPassed: z.number().int().min(0), testsTotal: z.number().int().positive(), rubric: z.number().min(0).optional(), rubricMax: z.number().positive().optional() }).optional(),
  approved: z.boolean(),
}).refine((r) => !r.score || r.score.testsPassed <= r.score.testsTotal, { message: 'testsPassed cannot exceed testsTotal' })
  .refine((r) => r.events.every((e, i) => i === 0 || e.t >= r.events[i - 1].t), { message: 'events must be in chronological order' });

export type ArenaRun = z.infer<typeof ArenaRunSchema>;
export type ArenaEvent = z.infer<typeof ArenaEventSchema>;

/** Owner-approved runs that may be published. Empty until transcripts are approved (CONTENT_APPROVAL.md). */
export const APPROVED_RUNS: ArenaRun[] = [];

export const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;

export function parseTranscript(raw: string): { ok: true; run: ArenaRun } | { ok: false; errors: string[] } {
  if (raw.length > MAX_TRANSCRIPT_BYTES) return { ok: false, errors: ['File is larger than 5 MB.'] };
  let json: unknown;
  try { json = JSON.parse(raw); } catch (e) { return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }; }
  const r = ArenaRunSchema.safeParse(json);
  if (r.success) return { ok: true, run: r.data };
  return { ok: false, errors: r.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}
