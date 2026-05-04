# HANDOFF — Portfolio Project

> **Read this at the start of every new session (chat or terminal).**
> **Update this at the end of every session before closing.**

---

## Current phase

**V1 LIVE — fully polished** — Site is deployed with portrait, 4 projects, green terminal, and side-by-side hero layout.

## Current session

**Date:** 2026-05-04
**What changed:** Added a richer light theme, a manual light/dark toggle with persistence, wider terminal layout, and darker green terminal text.

## Current session 2

**Date:** 2026-05-04
**What changed:** Rebalanced the hero layout again to keep the terminal clear of the name, and added the new in-progress `AI Incident Copilot` project to the work list.

## Current session 3

**Date:** 2026-05-04
**What changed:** Fixed the hero collision by giving the name column protected desktop width, capping the terminal at 460px, stacking earlier on narrow screens, and placing the About text/skills inside a theme-aware panel.

## Last session

**Date:** 2026-05-04
**Where:** Claude Code (VS Code extension)
**What happened (Session 2 — polish pass):**

### Terminal
- Overrode all terminal CSS to always-dark green hacker look (ignores `prefers-color-scheme`)
- Terminal bg: `#0d1117`, text: `#4ade80` / `#86efac`, dimmed elements: `#2d6a2d`
- Replaced boot message with ASCII box art banner (╔══ priyanshu@portfolio v1.0 ══╗)

### Theme
- Light-mode background changed from flat white to `linear-gradient(160deg, #f5f7ff, #eef1ff, #f8f5ff)` fixed
- CSS tokens: `--bg #f5f7ff`, `--fg-soft #44506b`, `--line #dde1f0` (all slightly blue-tinted)
- 3px gradient strip across the very top of page (blue → purple → cyan)
- Hero name: dark→blue gradient text in light mode; plain `--fg` in dark mode
- Work-row hover: faint blue background wash added

### Layout
- Hero + terminal now side-by-side (CSS grid `1fr 1fr`) in a `.hero-layout` wrapper
- Removed the "Software Engineer · Nokia Optics · Stuttgart" eyebrow text above the name
- Mobile (≤768px): `.hero-layout` collapses to single column, terminal shows mobile toggle as before

### Content
- Nav logo: "Priyanshu" → "My Portfolio"
- Portrait photo added (`portrait.png`, renamed from `ChatGPT Image May 4, 2026, 01_51_49 PM.png`)
  → 88px circular avatar at top of hero
- **New project added:** BaSyx AASX ConceptDescription Importer (2nd slot)
  - Eclipse BaSyx · DHBW Stuttgart · Vue 3 / TypeScript
  - Links to: https://github.com/DHBW-TINF24F/Team1-basyx-aas-web-ui
- GMRE Log Parser link updated → `gmre_architecture_v3.html` (architecture doc, now live on Pages)
- 4LS Ticket Pipeline and MidLog IoT: changed from `<a>` to `<div>` (no link, no arrow — no dedicated pages exist)
- `gmre_architecture_v3.html` added to git and pushed → live at https://priyanshu92012.github.io/gmre_architecture_v3.html

### Previous session (Session 1 — redesign)
- Applied FAANG-recruiter-clean redesign on branch `redesign/faang-minimal` (15 commits), merged to main
- Fonts: Inter + JetBrains Mono only (dropped Bricolage Grotesque + Geist)
- Light/dark via `prefers-color-scheme`, accent #2563eb / #3b82f6
- Page max-width 960px, section padding 96px, two mobile breakpoints (768px + 480px)

## Next concrete tasks (in priority order)

1. **Add Anthropic credits** — console.anthropic.com → Billing → Add credits ($5 minimum). AI freeform responses will work immediately after.
2. **Regenerate Anthropic API key** — the key was pasted in an earlier chat. Delete the old one at console.anthropic.com → API Keys, create a new one, then run:
   ```
   cd "Personal Portfolio/worker"
   wrangler secret put ANTHROPIC_API_KEY
   ```
3. **Test AI terminal** — once credits are added, visit https://priyanshu92012.github.io, ask a freeform question, verify green text streams token by token.
4. **Decide on custom domain** — `priyanshu.dev` (~€12/yr) vs keeping `.github.io`.
5. **About page** — `about.html` not built yet; currently the `#about` section is inline on the landing page.

## Open decisions

- [ ] Custom domain: `priyanshu.dev` vs `priyanshu92012.github.io`?
- [ ] Contact form vs email-only (current)?
- [ ] About page as separate `about.html`?
- [ ] MidLog IoT and 4LS Ticket Pipeline: build dedicated pages eventually so they can have links?

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

## Files modified — Session 2 (2026-05-04 polish)

- modified: `index.html` — terminal CSS, layout, hero, nav, projects, GMRE link
- modified: `terminal.js` — ASCII art boot message
- created:  `portrait.png` — portrait photo (renamed from ChatGPT image)
- added:    `gmre_architecture_v3.html` — architecture doc, now served by Pages

## Files modified — Session 1 (2026-05-04 redesign)

- created:  `REDESIGN_PLAN.md` — 15-step redesign plan
- modified: `index.html` — complete visual redesign
- updated:  `HANDOFF.md` (this file)
