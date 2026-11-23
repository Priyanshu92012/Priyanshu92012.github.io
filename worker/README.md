# Experimental PRIYANSHU.AI Worker — NOT DEPLOYED

The public portfolio does **not** use this Worker. Visitors get the scripted, in-browser portfolio guide
(`src/lib/guide`), which never calls an AI service. `npm run build` fails if an inference endpoint ever reaches the
site bundle (`scripts/check-dist.mjs`), and no GitHub workflow deploys this Worker.

This code is kept, tested and type-checked as a future option and as engineering evidence (tool calling, streaming,
abuse protection). It is excluded from the site's runtime: the SDK and wrangler are dev dependencies only.

## What it is

- `POST /v2/chat`: streaming tool loop on the official `@anthropic-ai/sdk` (stable Messages API), the same seven
  read-only tools as the guide's data layer, NDJSON events validated by `src/lib/agent/protocol.ts`.
- Model `claude-haiku-5-5`, effort `medium`, **no cross-model fallback** (Haiku 5.5 has no server-side fallback; a
  refusal is answered with a fixed message and no tool runs from a refused turn). Verified against
  platform.claude.com models, pricing and prompt-caching docs on 2026-11-18 (512-token minimum cacheable prompt,
  $0.10 / $0.50 per MTok input / output for prompts up to 100K tokens).
- Guards: origin allowlist, 64 KB body cap, Zod request schema, per-IP and daily request limits, daily USD budget.

## Known limitation: the budget is not a hard cap

Counters live in Workers KV, which is eventually consistent, and are updated read-modify-write. Concurrent requests,
or requests served in different locations, can all pass the same check, so `DAILY_BUDGET_USD` is a **soft guard**.
Before any deployment, add:

1. An atomic admission point: one Durable Object that serialises admission and reserves each request's worst-case
   cost (`maxRounds+1` calls × (input ceiling × input price + `max_tokens` × output price)) before calling the model,
   settling the real cost afterwards and counting expired reservations as spent.
2. A provider-side backstop: a dedicated Anthropic workspace for this key with a low monthly spend limit.

## If it is ever trialled (owner decision; not planned)

- Deploy only as a separate service (`name = "priyanshu-ai-v2-experimental"` or a staging env), never over the v1
  `portfolio-ai` Worker, with a freshly created key in that dedicated workspace (`wrangler secret put` reads it from a
  prompt, so it never lands in shell history or the repo).
- Test first without spending: `npm run worker:dev` (no key → 503), the 11 Worker tests (`npm test`), and
  `npm run worker:bundle`.
