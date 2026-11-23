// EXPERIMENTAL, NOT DEPLOYED: the public site never calls this Worker (see worker/README.md).
// Request handling for the PRIYANSHU.AI Worker (entry: index.ts).
//   GET  /v2/health  liveness + whether a model key is configured (no secrets)
//   POST /v2/chat    V2 agent: NDJSON event stream (protocol in src/lib/agent/protocol.ts)
//   POST /           legacy v1 terminal: same agent, plain text, Anthropic-style SSE text deltas
// The API key lives only in Worker secrets (`wrangler secret put ANTHROPIC_API_KEY`).
import Anthropic from '@anthropic-ai/sdk';
import { ChatRequestSchema, MAX_USER_CHARS, type AgentEvent, type ChatMessage } from '../../src/lib/agent/protocol';
import { runAgentLoop, sdkStream, type StreamFn, type Usage } from './agent';
import { checkLimits, costUsd, limitsFrom, recordSpend } from './limits';

export interface Env {
  RATE_LIMIT: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  /** Kill switch: the agent refuses every chat request unless this is exactly "true". */
  AGENT_ENABLED?: string;
  AGENT_MODEL?: string;
  AGENT_EFFORT?: string;
  ALLOWED_ORIGINS?: string;
  RL_PER_MINUTE?: string; RL_PER_HOUR?: string; RL_PER_DAY?: string; DAILY_BUDGET_USD?: string;
}

export const VERSION = '2.0.0';
export const DEFAULT_MODEL = 'claude-haiku-5-5';
const DEFAULT_ORIGINS = [
  'https://priyanshu92012.github.io',
  'http://localhost:4321', 'http://127.0.0.1:4321', // astro dev / preview
  'http://localhost:8000', 'http://127.0.0.1:8000', // v1 local server
];
const MAX_BODY_BYTES = 64 * 1024;

function origins(env: Env): string[] {
  return env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
function cors(origin: string, env: Env): Record<string, string> {
  const list = origins(env);
  return {
    'Access-Control-Allow-Origin': list.includes(origin) ? origin : list[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
function rid(): string { return crypto.randomUUID().slice(0, 8); }
function effortOf(env: Env): 'low' | 'medium' | 'high' {
  return env.AGENT_EFFORT === 'low' || env.AGENT_EFFORT === 'high' ? env.AGENT_EFFORT : 'medium';
}

async function readBody(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('Content-Length') ?? '0');
  if (len > MAX_BODY_BYTES) throw new Error('too_large');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('too_large');
  return JSON.parse(text);
}

function errorCode(e: unknown): { code: string; message: string } {
  if (e instanceof Anthropic.RateLimitError) return { code: 'upstream_busy', message: 'The model provider is busy right now.' };
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { code: 'config', message: 'The live model is misconfigured.' };
  if (e instanceof Anthropic.APIError) return { code: 'upstream', message: 'The model provider returned an error.' };
  return { code: 'internal', message: 'Something went wrong while answering.' };
}

/** Run the agent and pipe events into a streamed response body. */
function streamResponse(
  ctx: ExecutionContext, env: Env, stream: StreamFn, messages: ChatMessage[], format: 'markdown' | 'plain',
  encode: (e: AgentEvent) => string | null, contentType: string, headers: Record<string, string>, tail?: string,
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const abort = new AbortController();
  const model = env.AGENT_MODEL || DEFAULT_MODEL;
  const t0 = Date.now();
  let closed = false;
  const write = (e: AgentEvent) => {
    const s = encode(e);
    if (!s || closed) return;
    writer.write(enc.encode(s)).catch(() => { closed = true; abort.abort(); }); // visitor went away: stop spending
  };
  const work = (async () => {
    let usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    write({ t: 'meta', mode: 'llm', requestId: rid(), model });
    try {
      usage = await runAgentLoop(stream, messages, { model, effort: effortOf(env), format, maxRounds: 4, maxTokens: 4096, signal: abort.signal }, write);
      write({ t: 'done', ms: Date.now() - t0, usage: { input: usage.input + usage.cacheRead + usage.cacheWrite, output: usage.output } });
    } catch (e) {
      if (!abort.signal.aborted) write({ t: 'error', ...errorCode(e) });
    } finally {
      await recordSpend(env.RATE_LIMIT, costUsd(model, usage)).catch(() => undefined);
      if (!closed) { if (tail) await writer.write(enc.encode(tail)).catch(() => undefined); await writer.close().catch(() => undefined); }
    }
  })();
  ctx.waitUntil(work);
  return new Response(readable, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...headers } });
}

export async function handle(req: Request, env: Env, ctx: ExecutionContext, streamFn?: StreamFn): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get('Origin') ?? '';
  const h = cors(origin, env);
  const enabled = env.AGENT_ENABLED === 'true';
  const llm = enabled && (!!env.ANTHROPIC_API_KEY || !!streamFn);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method === 'GET' && url.pathname === '/v2/health') {
    return json({ ok: true, version: VERSION, enabled, llm, model: llm ? env.AGENT_MODEL || DEFAULT_MODEL : null }, 200, h);
  }
  if (req.method !== 'POST' || !['/', '/v2/chat'].includes(url.pathname)) return json({ error: 'not_found' }, 404, h);
  if (!enabled) return json({ error: 'disabled', message: 'The AI agent is disabled.' }, 503, h);
  if (!origins(env).includes(origin)) return json({ error: 'forbidden_origin', message: 'This endpoint only serves the portfolio site.' }, 403, h);

  let body: unknown;
  try { body = await readBody(req); } catch (e) {
    return (e as Error).message === 'too_large' ? json({ error: 'too_large', message: 'Request too large.' }, 413, h) : json({ error: 'invalid_json', message: 'Invalid JSON.' }, 400, h);
  }

  const legacy = url.pathname === '/';
  let messages: ChatMessage[];
  if (legacy) {
    const message = typeof (body as { message?: unknown })?.message === 'string' ? (body as { message: string }).message.trim() : '';
    if (!message) return json({ error: 'empty_message' }, 400, h);
    if (message.length > 500) return json({ error: 'too_long', message: 'input too long - max 500 characters' }, 400, h);
    messages = [{ role: 'user', content: message }];
  } else {
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'invalid_request', message: 'Request does not match the chat schema.' }, 400, h);
    messages = parsed.data.messages;
    const last = messages[messages.length - 1];
    if (last.role !== 'user') return json({ error: 'invalid_request', message: 'The last message must come from the visitor.' }, 400, h);
    const looksLikeJob = last.content.length > MAX_USER_CHARS;
    if (looksLikeJob && last.content.length > 6000) return json({ error: 'too_long', message: 'Message too long.' }, 400, h);
    if (messages.reduce((n, m) => n + m.content.length, 0) > 24_000) return json({ error: 'too_long', message: 'Conversation too long. Start a new one.' }, 400, h);
  }

  if (!llm) return json({ error: 'no_model', message: 'The live model is not configured.' }, 503, h);

  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const lim = await checkLimits(env.RATE_LIMIT, ip, limitsFrom(env));
  if (!lim.ok) return json({ error: 'rate_limit', message: lim.message, retryAfter: lim.retryAfter }, 429, { ...h, 'Retry-After': String(lim.retryAfter) });

  const stream = streamFn ?? sdkStream(env.ANTHROPIC_API_KEY!);
  if (legacy) {
    // v1 terminal reads `data: {...delta.text...}` lines and stops at [DONE]
    const sse = (e: AgentEvent) => (e.t === 'text' ? `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: e.delta } })}\n\n`
      : e.t === 'error' ? `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `\n${e.message}` } })}\n\n` : null);
    return streamResponse(ctx, env, stream, messages, 'plain', sse, 'text/event-stream', h, 'data: [DONE]\n\n');
  }
  return streamResponse(ctx, env, stream, messages, 'markdown', (e) => `${JSON.stringify(e)}\n`, 'application/x-ndjson; charset=utf-8', h);
}
