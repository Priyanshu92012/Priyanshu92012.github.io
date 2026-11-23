# AI Terminal Widget — Build Plan

Interactive terminal widget on the landing page: local commands run instantly, freeform questions stream through a Cloudflare Worker proxy to the Anthropic API. API key never in client code.

## Architecture

```
Browser (index.html + terminal.js)
    │  POST { message }
    ▼
Cloudflare Worker (worker/src/index.js)
    │  CORS · rate-limit (KV) · inject system prompt
    ▼
Anthropic API (claude-haiku-4-5, streaming SSE)
    │  tokens streamed back through Worker
    ▼
Browser reads ReadableStream → appends tokens to terminal
```

## File structure

```
/
├── index.html          ← landing page + terminal HTML/CSS
├── terminal.js         ← command parser, history, tab completion, SSE client
├── worker/
│   ├── src/index.js    ← Cloudflare Worker
│   └── wrangler.toml   ← Cloudflare config (KV binding, secret ref)
└── PLAN.md             ← this file
```

## Known commands (local, instant)

| Command | Returns |
|---------|---------|
| `help` | All commands |
| `whoami` | 3-line bio |
| `projects` / `ls` | Project list A/B/C |
| `cat gmre` / `cat powerbi` / `cat midlog` | Project detail |
| `stack` | Tech stack by category |
| `contact` | Email, GitHub, LinkedIn links |
| `github` | Opens GitHub in new tab |
| `social` | All social links |
| `prompt` | Prints the actual system prompt |
| `clear` | Clears output |

Anything else → AI fallthrough with streaming response.

## Rate limits (Worker KV)

| Scope | Limit |
|-------|-------|
| Per IP / minute | 3 requests |
| Per IP / hour | 10 requests |
| Global / day | 500 requests |

## Build order

1. ✅ `rename + terminal scaffold` — index.html with terminal HTML/CSS
2. `worker: scaffold` — stub Worker + wrangler.toml
3. `worker: rate limiting` — KV-backed counters
4. `worker: anthropic streaming proxy` — system prompt + SSE passthrough
5. `frontend: terminal core` — terminal.js (input, history, tab completion)
6. `frontend: local commands` — all known command handlers
7. `frontend: AI streaming` — SSE fallthrough to Worker
8. `frontend: mobile collapse` — overlay on mobile
9. `handoff update`

## Cloudflare one-time setup

```bash
npm install -g wrangler
wrangler login
wrangler kv:namespace create RATE_LIMIT   # copy ID into wrangler.toml
wrangler secret put ANTHROPIC_API_KEY     # paste key when prompted
wrangler deploy                           # from worker/ directory
```

## Cost estimate

~$0.30/month at 100 visitors × 3 AI turns. Global daily cap ($0.60 max/day) prevents surprises.
