// Worker tests with a mocked model provider and an in-memory KV. No network, no spend.
import { describe, expect, it } from 'vitest';
import { handle, type Env } from '../../worker/src/app';
import { runAgentLoop, type StreamFn } from '../../worker/src/agent';
import { checkLimits, costUsd, recordSpend, DEFAULT_LIMITS } from '../../worker/src/limits';
import { AgentEventSchema, type AgentEvent } from '../../src/lib/agent/protocol';
import { buildSystemPrompt } from '../../src/lib/agent/prompt';
import { AGENT_RULES } from '../../src/lib/agent/policy';

class MemKV {
  m = new Map<string, string>();
  async get(k: string) { return this.m.get(k) ?? null; }
  async put(k: string, v: string) { this.m.set(k, v); }
}

type Turn = { text?: string; tools?: { name: string; input: unknown }[]; stop?: string };
/** Fake provider: replays scripted assistant turns and records every request it receives. */
function fakeProvider(turns: Turn[]) {
  const calls: Record<string, unknown>[] = [];
  let i = 0;
  const fn: StreamFn = (params) => {
    calls.push(params as unknown as Record<string, unknown>);
    const turn = turns[Math.min(i++, turns.length - 1)];
    let onText: ((d: string) => void) | null = null;
    const content: unknown[] = [];
    if (turn.text) content.push({ type: 'text', text: turn.text, citations: null });
    (turn.tools ?? []).forEach((t, k) => content.push({ type: 'tool_use', id: `toolu_${i}_${k}`, name: t.name, input: t.input }));
    return {
      on(_e: 'text', cb: (d: string) => void) { onText = cb; return this; },
      async finalMessage() {
        if (turn.text) onText?.(turn.text);
        return {
          id: `msg_${i}`, type: 'message', role: 'assistant', model: String(params.model), content,
          stop_reason: turn.stop ?? (turn.tools?.length ? 'tool_use' : 'end_turn'), stop_sequence: null,
          usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 },
        } as never;
      },
    };
  };
  return { fn, calls };
}

const ctx = () => { const ps: Promise<unknown>[] = []; return { ps, c: { waitUntil: (p: Promise<unknown>) => ps.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext }; };
const env = (over: Partial<Env> = {}): Env => ({ RATE_LIMIT: new MemKV() as unknown as KVNamespace, ANTHROPIC_API_KEY: 'test-key-not-real', AGENT_ENABLED: 'true', ...over });
const ORIGIN = 'https://priyanshu92012.github.io';
const post = (path: string, body: unknown, origin = ORIGIN) => new Request(`https://w.example${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify(body) });
async function ndjson(res: Response): Promise<AgentEvent[]> {
  return (await res.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

describe('system prompt', () => {
  it('is built only from the public policy and approved data, and is deterministic', () => {
    const p = buildSystemPrompt();
    for (const r of AGENT_RULES) expect(p).toContain(r);
    expect(p).toContain('gmre-log-parser');
    expect(p).toBe(buildSystemPrompt());
    expect(p).not.toMatch(/sk-ant|ANTHROPIC_API_KEY/);
    expect(buildSystemPrompt('plain')).toContain('plain text only');
  });
});

describe('agent loop', () => {
  it('runs tools, streams text, validates every event and returns usage', async () => {
    const { fn, calls } = fakeProvider([
      { tools: [{ name: 'searchPortfolio', input: { query: 'ingestion pipeline' } }, { name: 'focusVisualization', input: { target: 'lab', id: 'gmre-log-parser' } }] },
      { text: 'He built **GMRE**, a plugin-based ingestion engine.' },
    ]);
    const events: AgentEvent[] = [];
    const usage = await runAgentLoop(fn, [{ role: 'user', content: 'What did he build at Nokia?' }], { model: 'claude-haiku-5-5', effort: 'medium', format: 'markdown', maxRounds: 4, maxTokens: 4096 }, (e) => events.push(e));
    for (const e of events) expect(AgentEventSchema.safeParse(e).success, JSON.stringify(e)).toBe(true);
    expect(events.map((e) => e.t)).toEqual(['tool_call', 'tool_result', 'tool_call', 'tool_result', 'ui_action', 'text', 'sources']);
    expect(usage).toEqual({ input: 2000, output: 400, cacheRead: 6000, cacheWrite: 0 });
    // request shape: cached system prompt, eager tools, effort, NO cross-model fallback, tool results fed back
    const first = calls[0] as { model: string; system: { cache_control: unknown }[]; tools: { eager_input_streaming: boolean }[]; output_config: unknown; fallbacks?: unknown; betas?: string[] };
    expect(first.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(first.tools.every((t) => t.eager_input_streaming)).toBe(true);
    expect(first.output_config).toEqual({ effort: 'medium' });
    expect(first.model).toBe('claude-haiku-5-5');
    expect(first.fallbacks).toBeUndefined();
    expect(first.betas).toBeUndefined();
    const second = calls[1] as { messages: { role: string; content: unknown }[] };
    const lastMsg = second.messages[second.messages.length - 1] as { role: string; content: { type: string; tool_use_id: string }[] };
    expect(lastMsg.role).toBe('user');
    expect(lastMsg.content.map((b) => b.type)).toEqual(['tool_result', 'tool_result']);
  });

  it('returns invalid tool input to the model as an error instead of running it', async () => {
    const { fn, calls } = fakeProvider([{ tools: [{ name: 'openProject', input: { slug: 'not-a-project' } }] }, { text: 'That project does not exist.' }]);
    const events: AgentEvent[] = [];
    await runAgentLoop(fn, [{ role: 'user', content: 'open the secret project' }], { model: 'm', effort: 'low', format: 'markdown', maxRounds: 2, maxTokens: 1000 }, (e) => events.push(e));
    expect(events.find((e) => e.t === 'ui_action')).toBeUndefined();
    const res = (calls[1] as { messages: { content: { is_error?: boolean }[] }[] }).messages.at(-1)!.content[0];
    expect(res.is_error).toBe(true);
  });

  it('never runs tools from a refused turn, and stops after the round limit with tools disabled', async () => {
    const refused = fakeProvider([{ tools: [{ name: 'getProject', input: { slug: 'securemed' } }], stop: 'refusal' }]);
    const ev1: AgentEvent[] = [];
    await runAgentLoop(refused.fn, [{ role: 'user', content: 'x' }], { model: 'm', effort: 'low', format: 'markdown', maxRounds: 3, maxTokens: 1000 }, (e) => ev1.push(e));
    expect(ev1.some((e) => e.t === 'tool_call')).toBe(false);
    expect(ev1.some((e) => e.t === 'text')).toBe(true);

    const looping = fakeProvider([{ tools: [{ name: 'searchPortfolio', input: { query: 'a' } }] }]);
    await runAgentLoop(looping.fn, [{ role: 'user', content: 'x' }], { model: 'm', effort: 'low', format: 'markdown', maxRounds: 2, maxTokens: 1000 }, () => undefined);
    expect(looping.calls).toHaveLength(3);
    expect((looping.calls[2] as { tool_choice: unknown }).tool_choice).toEqual({ type: 'none' });
  });

});

describe('worker routes', () => {
  it('is disabled unless AGENT_ENABLED is exactly "true" (kill switch, default off)', async () => {
    for (const v of [undefined, 'false', '1', 'TRUE']) {
      const r = await handle(post('/v2/chat', { messages: [{ role: 'user', content: 'hi' }] }), env({ AGENT_ENABLED: v }), ctx().c, fakeProvider([{ text: 'x' }]).fn);
      expect(r.status, String(v)).toBe(503);
      expect(await r.json()).toMatchObject({ error: 'disabled' });
    }
    const legacy = await handle(post('/', { message: 'hi' }), env({ AGENT_ENABLED: undefined }), ctx().c);
    expect(legacy.status).toBe(503);
  });

  it('health reports configuration without secrets', async () => {
    const res = await handle(new Request('https://w.example/v2/health'), env(), ctx().c);
    const j = await res.json() as Record<string, unknown>;
    expect(j).toMatchObject({ ok: true, llm: true, model: 'claude-haiku-5-5' });
    expect(JSON.stringify(j)).not.toContain('test-key');
  });

  it('rejects foreign origins, bad bodies and assistant-last conversations', async () => {
    expect((await handle(post('/v2/chat', { messages: [{ role: 'user', content: 'hi' }] }, 'https://evil.example'), env(), ctx().c)).status).toBe(403);
    expect((await handle(post('/v2/chat', { nope: true }), env(), ctx().c)).status).toBe(400);
    expect((await handle(post('/v2/chat', { messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }), env(), ctx().c)).status).toBe(400);
    const big = new Request('https://w.example/v2/chat', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Length': String(200_000) }, body: 'x' });
    expect((await handle(big, env(), ctx().c)).status).toBe(413);
  });

  it('answers 503 without a key so the browser falls back to offline mode', async () => {
    const res = await handle(post('/v2/chat', { messages: [{ role: 'user', content: 'hi' }] }), env({ ANTHROPIC_API_KEY: undefined }), ctx().c);
    expect(res.status).toBe(503);
  });

  it('streams validated NDJSON for /v2/chat and records spend', async () => {
    const e = env();
    const { fn } = fakeProvider([{ text: 'Hello from the portfolio.' }]);
    const { c, ps } = ctx();
    const res = await handle(post('/v2/chat', { messages: [{ role: 'user', content: 'hi' }] }), e, c, fn);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const events = await ndjson(res);
    await Promise.all(ps);
    expect(events.map((x) => x.t)).toEqual(['meta', 'text', 'done']);
    for (const ev of events) expect(AgentEventSchema.safeParse(ev).success).toBe(true);
    const kv = e.RATE_LIMIT as unknown as MemKV;
    expect([...kv.m.keys()].some((k) => k.startsWith('spend:'))).toBe(true);
  });

  it('serves the legacy v1 terminal format from the same agent', async () => {
    const { fn, calls } = fakeProvider([{ text: 'Plain answer.' }]);
    const res = await handle(post('/', { message: 'who is priyanshu' }), env(), ctx().c, fn);
    const body = await res.text();
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(body).toContain('"text":"Plain answer."');
    expect(body.trim().endsWith('data: [DONE]')).toBe(true);
    expect(JSON.stringify((calls[0] as { system: unknown }).system)).toContain('plain text only');
    expect((await handle(post('/', { message: 'x'.repeat(501) }), env(), ctx().c, fn)).status).toBe(400);
  });

  it('rate-limits per IP and enforces the daily budget', async () => {
    const e = env({ RL_PER_MINUTE: '2' });
    const { fn } = fakeProvider([{ text: 'ok' }]);
    const codes: number[] = [];
    for (let i = 0; i < 3; i++) { const r = await handle(post('/v2/chat', { messages: [{ role: 'user', content: 'hi' }] }), e, ctx().c, fn); codes.push(r.status); await r.text(); }
    expect(codes).toEqual([200, 200, 429]);

    const kv = new MemKV() as unknown as KVNamespace;
    await recordSpend(kv, DEFAULT_LIMITS.dailyBudgetUsd + 0.01);
    expect((await checkLimits(kv, '198.51.100.1', DEFAULT_LIMITS)).ok).toBe(false);
  });

  it('prices unknown models conservatively', () => {
    const u = { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 };
    expect(costUsd('claude-haiku-5-5', u)).toBeCloseTo(0.6);   // $0.10 in + $0.50 out per MTok
    expect(costUsd('claude-opus-5-5', u)).toBeCloseTo(24);
    expect(costUsd('some-future-model', u)).toBeGreaterThan(costUsd('claude-opus-5-5', u));
  });
});
