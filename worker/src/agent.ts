// EXPERIMENTAL, NOT DEPLOYED. The public site uses the scripted guide (src/lib/guide).
// PRIYANSHU.AI agent loop: a manual, streaming tool-use loop over the official SDK.
// Tools are the same read-only functions the browser's offline mode uses
// (src/lib/agent/tools.ts), so both modes answer from identical evidence.
import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, executeTool, type ToolExecution } from '../../src/lib/agent/tools';
import { buildSystemPrompt, type ReplyFormat } from '../../src/lib/agent/prompt';
import type { AgentEvent, ChatMessage, Source } from '../../src/lib/agent/protocol';

type Params = Anthropic.Messages.MessageStreamParams;
type Message = Anthropic.Messages.Message;

/** The slice of the SDK stream the loop relies on (lets tests inject a fake provider). */
export interface StreamLike {
  on(event: 'text', cb: (delta: string) => void): unknown;
  finalMessage(): Promise<Message>;
}
export type StreamFn = (params: Params, opts?: { signal?: AbortSignal }) => StreamLike;

export function sdkStream(apiKey: string): StreamFn {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return (params, opts) => client.messages.stream(params, { signal: opts?.signal });
}

export type LoopOptions = {
  model: string;
  effort: 'low' | 'medium' | 'high';
  format: ReplyFormat;
  maxRounds: number;
  maxTokens: number;
  signal?: AbortSignal;
};

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

const MAX_TOOL_RESULT_CHARS = 9000;
const REFUSAL_TEXT = 'I can’t help with that one. I can answer questions about Priyanshu’s projects, skills and how to reach him.';

function toolResultText(exec: ToolExecution): string {
  const s = JSON.stringify(exec.output);
  return s.length > MAX_TOOL_RESULT_CHARS ? `${s.slice(0, MAX_TOOL_RESULT_CHARS)}… (truncated)` : s;
}

export async function runAgentLoop(stream: StreamFn, history: ChatMessage[], opts: LoopOptions, emit: (e: AgentEvent) => void): Promise<Usage> {
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const tools = toolDefinitions().map((t) => ({ ...t, eager_input_streaming: true })) as Params['tools'];
  // tools render before system, so one breakpoint on the system block caches tools + system
  const system: Params['system'] = [{ type: 'text', text: buildSystemPrompt(opts.format), cache_control: { type: 'ephemeral' } }];
  const messages: Params['messages'] = history.map((m) => ({ role: m.role, content: m.content }));
  const sources: Source[] = [];
  let unparsableRetries = 0;

  for (let round = 0; round <= opts.maxRounds; round++) {
    const lastRound = round === opts.maxRounds;
    const s = stream({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system,
      tools,
      tool_choice: lastRound ? { type: 'none' } : { type: 'auto' },
      messages,
      output_config: { effort: opts.effort },
      // No cross-model fallback: Claude Haiku 5.5 has no server-side fallback, and the release keeps one model.
    }, { signal: opts.signal });
    s.on('text', (delta) => { if (delta) emit({ t: 'text', delta }); });

    let msg: Message;
    try {
      msg = await s.finalMessage();
      unparsableRetries = 0;
    } catch (err) {
      // Only a tool input the SDK could not parse at all (or a dropped connection) is retried; API errors propagate.
      if (err instanceof Anthropic.APIError || opts.signal?.aborted || unparsableRetries++ >= 1) throw err;
      round--;
      continue;
    }
    usage.input += msg.usage.input_tokens ?? 0;
    usage.output += msg.usage.output_tokens ?? 0;
    usage.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += msg.usage.cache_creation_input_tokens ?? 0;

    if (msg.stop_reason === 'refusal') { emit({ t: 'text', delta: `\n\n${REFUSAL_TEXT}` }); break; }
    const content = msg.content;
    const toolUses = content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
    if (msg.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content }); continue; }
    if (msg.stop_reason !== 'tool_use' || toolUses.length === 0) {
      if (msg.stop_reason === 'max_tokens') emit({ t: 'text', delta: '…' });
      break;
    }

    messages.push({ role: 'assistant', content }); // thinking blocks are passed back unchanged
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input && typeof tu.input === 'object' ? tu.input : {}) as Record<string, unknown>;
      emit({ t: 'tool_call', id: tu.id, name: tu.name, input });
      const t0 = Date.now();
      try {
        const exec = executeTool(tu.name, input); // validates input with the tool's Zod schema
        sources.push(...exec.sources);
        emit({ t: 'tool_result', id: tu.id, name: tu.name, summary: exec.summary, ms: Date.now() - t0 });
        for (const action of exec.actions) emit({ t: 'ui_action', action });
        if (exec.artifact?.kind === 'job_match') emit({ t: 'artifact', kind: 'job_match', data: exec.artifact.data });
        if (exec.artifact?.kind === 'brief') emit({ t: 'artifact', kind: 'brief', data: exec.artifact.data });
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: toolResultText(exec) });
      } catch (e) {
        const message = (e as Error).message.slice(0, 300);
        emit({ t: 'tool_result', id: tu.id, name: tu.name, summary: `error: ${message}`, ms: Date.now() - t0 });
        results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: JSON.stringify({ error: message, INVALID_INPUT: JSON.stringify(input).slice(0, 500) }) });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  const seen = new Set<string>();
  const unique = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 8);
  if (unique.length) emit({ t: 'sources', sources: unique });
  return usage;
}
