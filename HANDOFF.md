# HANDOFF — Portfolio Project

> **Read this at the start of every new session (chat or terminal).**
> **Update this at the end of every session before closing.**

---

## Current phase

**BUILD** — AI terminal widget complete locally; Worker not yet deployed to Cloudflare.

## Last session

**Date:** 2026-05-03
**Where:** Claude Code (VS Code extension)
**What happened:**
- Renamed `index (3).html` → `index.html`
- Fixed all placeholder links: LinkedIn → `linkedin.com/in/priyanshu-priyanshu-/`, email → `priyanshu240105@gmail.com`
- Changed name throughout to "Priyanshu" only (no surname)
- Added terminal section HTML + CSS to `index.html` (between socials band and #work)
- Built full `terminal.js`: input handling, up/down history, Tab completion, all local commands, AI streaming via `fetch` + `ReadableStream`, mobile overlay toggle
- Built `worker/src/index.js`: CORS, KV rate-limiting (3/min · 10/hr · 500/day global), Anthropic streaming proxy, system prompt hardcoded
- Created `worker/wrangler.toml`: needs real KV namespace ID filled in
- Created `PLAN.md` in repo root

## Next concrete tasks (in priority order)

1. **Create GitHub repo** — name it to match GitHub Pages URL, push all files
2. **Set up Cloudflare account** — free plan at cloudflare.com
3. **Deploy the Worker:**
   ```bash
   npm install -g wrangler
   wrangler login
   cd "Personal Portfolio/worker"
   wrangler kv:namespace create RATE_LIMIT
   # paste the returned id into wrangler.toml replacing PASTE_KV_NAMESPACE_ID_HERE
   wrangler secret put ANTHROPIC_API_KEY
   wrangler deploy
   ```
4. **Update WORKER_URL** in `terminal.js` line 7 with the deployed Worker URL
5. **Push to GitHub** → GitHub Pages auto-deploys
6. **Test live:** open the site, try `help`, `whoami`, `cat gmre`, ask a freeform question
7. **Add portrait** — drop `assets/portrait.jpg`, uncomment the `<img>` in the hero
8. **Build project pages** — `projects/gmre.html`, `projects/powerbi-4ls.html`, `projects/iot-midlog.html`

## Open decisions

- [ ] Custom domain (`priyanshu.dev`) vs free `*.github.io`?
- [ ] LinkedIn integration: link only (current) or embed badge?
- [ ] Contact form vs email-only (current)?
- [ ] Add `about.html` as a standalone page?

## Locked decisions

- Static HTML only, no build step
- Cloudflare Worker as API proxy (key never in browser)
- Rate limits: 3/min · 10/hr · 500 global/day
- Model: `claude-haiku-4-5-20251001`
- Name: "Priyanshu" only throughout
- English-only content

## Files modified this session

- renamed:  `index (3).html` → `index.html`
- modified: `index.html` — links, name, terminal section, terminal CSS
- created:  `terminal.js`
- created:  `worker/src/index.js`
- created:  `worker/wrangler.toml`
- created:  `PLAN.md`
- updated:  `HANDOFF.md` (this file)

## One thing to know for next session

The terminal widget is fully wired up but the Worker URL in `terminal.js` line 7 is a placeholder (`portfolio-ai.priyanshugupta.workers.dev`). The AI fallthrough won't work until the Worker is deployed and that URL is updated. Local commands (`help`, `whoami`, `projects`, etc.) work without the Worker.
