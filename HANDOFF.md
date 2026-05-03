# HANDOFF — Portfolio Project

> **Read this at the start of every new session (chat or terminal).**
> **Update this at the end of every session before closing.**

---

## Current phase

**V1 LIVE** — Site is deployed and reachable. AI terminal requires Anthropic credits to activate freeform responses.

## Last session

**Date:** 2026-05-03
**Where:** Claude Code (VS Code extension)
**What happened:**
- Installed Node.js v24.15.0 and Wrangler CLI v4.87.0
- Authenticated Wrangler with Cloudflare
- Created KV namespace `1af15787108945efa97b689186af1af7` for rate-limiting
- Stored Anthropic API key as Cloudflare Worker secret
- Deployed Cloudflare Worker → `https://portfolio-ai.priyanshu240105.workers.dev`
- Updated `terminal.js` with the live Worker URL
- Installed GitHub CLI, initialized git repo, committed all files
- Pushed to `Priyanshu92012/Priyanshu92012.github.io` → GitHub Pages auto-deployed
- **Site is live at https://priyanshu92012.github.io** ✓

## Next concrete tasks (in priority order)

1. **Add Anthropic credits** — console.anthropic.com → Billing → Add credits ($5 minimum). AI freeform responses will start working immediately after.
2. **Regenerate Anthropic API key** — the key was pasted in chat history. Go to console.anthropic.com → API Keys → delete the old one → create a new one → run:
   ```
   cd "Personal Portfolio/worker"
   wrangler secret put ANTHROPIC_API_KEY
   ```
3. **Add portrait photo** — drop `assets/portrait.jpg` (portrait orientation, dark/neutral bg), then in `index.html` replace the `.portrait-placeholder` block with `<img src="assets/portrait.jpg" alt="Priyanshu">` and commit + push.
4. **Build project pages** — `projects/gmre.html`, `projects/powerbi-4ls.html`, `projects/iot-midlog.html`. Use `projects/_template.html` as starting point. Add each and push.
5. **Test AI terminal** — once credits are added, visit https://priyanshu92012.github.io and ask a freeform question. Verify streaming works.
6. **Decide on custom domain** — `priyanshu.dev` (~€12/yr) vs keeping the free `.github.io`.

## Open decisions

- [ ] Custom domain: `priyanshu.dev` vs `priyanshu92012.github.io`?
- [ ] Contact form vs email-only (current)?
- [ ] LinkedIn badge vs link-only (current)?
- [ ] About page as separate `about.html`?

## Locked decisions

- Static HTML, no build step, Tailwind CDN
- Cloudflare Worker as API proxy (key never in client code)
- Rate limits: 3/min · 10/hr · 500 global/day
- Model: `claude-haiku-4-5-20251001`
- English-only content
- Name: "Priyanshu" only throughout

## Infrastructure reference

| Service | URL / ID |
|---------|----------|
| Live site | https://priyanshu92012.github.io |
| GitHub repo | https://github.com/Priyanshu92012/Priyanshu92012.github.io |
| Cloudflare Worker | https://portfolio-ai.priyanshu240105.workers.dev |
| KV namespace ID | `1af15787108945efa97b689186af1af7` |
| Cloudflare dashboard | https://dash.cloudflare.com |
| Anthropic console | https://console.anthropic.com |

## Files modified this session

- created:  `.gitignore`
- modified: `terminal.js` — WORKER_URL updated to live Worker
- modified: `worker/wrangler.toml` — KV namespace ID filled in
- updated:  `HANDOFF.md` (this file)
