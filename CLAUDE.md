# Personal Portfolio — Context for Claude

> This file is auto-read by Claude Code from the repo root. Anything in here is treated as system context for every session. Edit deliberately.

---

## Who I am

Priyanshu Gupta — dual student at DHBW Stuttgart (CS), software engineer at Nokia Stuttgart (Optics, 4LS team). Praxisphase #3 window: **01.06.2026 – 27.09.2026**.

## What this repo is

Static personal portfolio hosted on **GitHub Pages**. Purpose: a linkable proof-of-work URL for Praxisphase outreach, freelance leads, and applications.

## Tech stack — locked, do not change without explicit ask

- Plain static HTML, one file per page
- Tailwind CSS via CDN (no build step, no node_modules)
- Inter + JetBrains Mono via Google Fonts CDN
- Tiny vanilla JS only when needed, no frameworks
- Deployed from `main` branch root via GitHub Pages

Rationale: zero-friction maintenance. Adding a project should take <15 minutes end-to-end.

## Design system (mirrors GMRE log parser doc)

- Base background: `bg-slate-950`, body text `text-white`
- Accent palette: cyan-500, blue-500, purple-500, emerald-500, amber-500, orange-500, rose-500
- Signature gradient text: `linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)` — used on h1
- Glow effects: `box-shadow: 0 0 20px rgba(<color>, 0.3)` per accent
- Card pattern: `bg-slate-900/50` or `/70`, `border-slate-700`, `hover:border-<color>-500/60`
- Inline code chips: `bg-slate-800 border-slate-700 rounded-lg px-2.5 py-1 font-mono`
- Section headers: gradient-text on h1, `text-slate-300` on h2/h3

## File structure

```
/
├── CLAUDE.md          ← this file (AI context)
├── HANDOFF.md         ← cross-session continuity log
├── DECISIONS.md       ← locked design/content decisions
├── README.md          ← repo readme
├── index.html         ← landing: hero + project tile grid
├── about.html         ← longer bio + skills + contact
├── cv.pdf             ← downloadable, mirrors about page
├── projects/
│   ├── _template.html ← starting point for new project pages
│   ├── gmre.html      ← log parser architecture (existing)
│   ├── powerbi-4ls.html
│   └── iot-midlog.html
└── assets/
    ├── images/
    └── downloads/
```

## Project pages — status

- [ ] `index.html` — landing
- [ ] `about.html` — bio
- [x] `projects/gmre.html` — already exists, drop in unchanged
- [ ] `projects/powerbi-4ls.html` — Praxisphase #1 writeup
- [ ] `projects/iot-midlog.html` — IoT Seminararbeit (after 19.05.2026 submission)
- [ ] `cv.pdf` — generate from about.html

## Page conventions

Every project page has, in order:
1. Hero: title (gradient), one-line subtitle, tag chips for stack
2. Problem statement (2–3 sentences, what the team needed)
3. Architecture / approach (diagram or structured breakdown)
4. Results / impact (concrete numbers where possible)
5. Tech detail callouts
6. Footer link back to `/`

External links: `target="_blank" rel="noopener"`.

## My working preferences

- Copy-paste-ready deliverables — no "fill in here" placeholders
- Terse correction style; assume I'll nudge if I want changes
- English content for international reach (recruiters, non-DE managers)
- Don't over-engineer — every added complexity has to justify itself
- Lean on the existing GMRE design language, don't reinvent

## What "done" looks like for v1

- Live at `https://<username>.github.io` (or custom domain)
- Landing page + GMRE project page + about page + CV PDF
- Linkable in Praxisphase emails by the time we're ready to send them
