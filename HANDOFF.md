# HANDOFF — Portfolio Project

> **Read this at the start of every new session (chat or terminal).**
> **Update this at the end of every session before closing.**

---

## Current phase

**V1 LIVE + REDESIGN BRANCH** — Site live on `main`. Visual redesign complete on branch `redesign/faang-minimal`, pending merge + push.

## Last session

**Date:** 2026-05-04
**Where:** Claude Code (VS Code extension)
**What happened:**
- Wrote and approved `REDESIGN_PLAN.md` (15-step build plan)
- Created branch `redesign/faang-minimal`
- Applied full FAANG-recruiter-clean minimal redesign to `index.html` in 14 commits:
  - Fonts → Inter + JetBrains Mono only; removed Bricolage Grotesque + Geist
  - CSS tokens → light/dark via `prefers-color-scheme`; accent #2563eb (light) / #3b82f6 (dark)
  - Nav → plain Inter 600, no decorated logo dot
  - Hero → single-column block (eyebrow + name + sub + 2 links); removed 3-column grid + portrait + glow
  - Removed socials icon band
  - Section heads → plain h2 "Work / About / Contact"; no decorative numbers or italic em
  - Work rows → 2-column grid, hover accent border instead of padding shift
  - About → single column max-width 680px, stack groups in horizontal flex-wrap
  - Contact → removed "Let's build something good" display; added `.contact-intro` plain text
  - Terminal → removed macOS chrome dots; header now reads "Ask anything about Priyanshu"
  - Footer → Inter body font, tighter spacing
  - Layout → page max-width 960px, sections 96px padding
  - Mobile → two breakpoints: 768px tablet + 480px phone
  - Animations → simplified to 600ms reveal, single-block hero rise

## Next concrete tasks (in priority order)

1. **Merge redesign branch** — `git checkout main && git merge redesign/faang-minimal && git push origin main`. Pages will redeploy in ~30s.
2. **Add Anthropic credits** — console.anthropic.com → Billing → Add credits ($5 minimum). AI freeform responses will start working immediately after.
3. **Regenerate Anthropic API key** — the key was pasted in chat history. Go to console.anthropic.com → API Keys → delete the old one → create a new one → run:
   ```
   cd "Personal Portfolio/worker"
   wrangler secret put ANTHROPIC_API_KEY
   ```
4. **Test AI terminal** — once credits are added, visit https://priyanshu92012.github.io and ask a freeform question. Verify streaming works.
5. **Build project pages** — `projects/gmre.html`, `projects/powerbi-4ls.html`, `projects/iot-midlog.html`. Use `projects/_template.html` as starting point.
6. **Decide on custom domain** — `priyanshu.dev` (~€12/yr) vs keeping the free `.github.io`.

## Open decisions

- [ ] Custom domain: `priyanshu.dev` vs `priyanshu92012.github.io`?
- [ ] Portrait photo: now that hero is single-column, a small circular avatar (64px) beside the eyebrow could work — decide when portrait is ready
- [ ] Contact form vs email-only (current)?
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

- created:  `REDESIGN_PLAN.md` — full 15-step redesign plan
- modified: `index.html` — complete visual redesign (Steps 1–14)
- updated:  `HANDOFF.md` (this file)
