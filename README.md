# PRIYANSHU.EXE

Engineering portfolio of **Priyanshu**, software engineer (Nokia Optics, Stuttgart; dual CS student at DHBW).
Live: https://priyanshu92012.github.io (production still serves v1 until V2 is deployed; see [DEPLOY.md](DEPLOY.md)).

V2 is a static Astro site with React islands, a 3D project lab, four interactive case-study laboratories, a
Skills Constellation, and **Priyanshu’s pet bot**: a tiger cub that opens a scripted, in-browser portfolio guide answering
from the approved records. There is no backend and no AI service; nothing a visitor does costs API credits.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:4321
npm run build        # content gate + schema validation + static build → dist/
npm run preview      # serve dist/ on :4321
npm run staging      # noindex staging build behind HTTP Basic Auth on :4400 (LAN only)
npm run lab          # V3 design lab (local only): http://127.0.0.1:4330/design-lab/  → DESIGN_LAB.md
```

Node 22+. Everything runs in the browser; the site makes no requests to other hosts (enforced by the browser tests).

## What is where

| Path | What |
|---|---|
| `src/data/` | The only source of public claims: projects, skills, profile. Zod-validated at build time. |
| `src/pages/` | `/`, `/work/`, `/work/<slug>/`, `/skills/`, `/lab/`, `/xray/`, `/about/`, `/recruiter/`, `/resume/`, `404` |
| `src/islands/` | React islands: hero lab, constellation, demos, portfolio guide drawer, command palette, terminal |
| `src/lib/sim/` | Deterministic simulation engines behind the demos (scheduler, GMRE, TOTP, STRIDE/CI gates, BaSyx, LIME/SHAP) |
| `src/lib/guide/` | The portfolio guide: curated intents, synonym matching, link allowlist, honest fallbacks |
| `src/lib/agent/` | Shared data layer for the guide (BM25 retrieval, job matcher, brief) and the experimental Worker (tools, protocol, policy) |
| `worker/` | **Experimental, not deployed** LLM agent Worker, kept tested for later (`worker/README.md`) |
| `tests/` | `unit/` + `worker/` (Vitest), `e2e/` (Playwright + axe) |
| `public/v1/`, `public/gmre_architecture_v3.html` | `noindex` redirect stubs for retired legacy URLs (no archived content) |

## Quality gates

| Command | Checks |
|---|---|
| `npm run check` | TypeScript / Astro diagnostics |
| `npm test` | 123 unit tests: guide answers/synonyms/fallbacks/allowlist, sims, data, Worker (mocked provider) |
| `npm run build` | Content gate (secrets, private hosts, hashed confidential terms), schema validation, static build, **dist gate** (no AI endpoints, confidential terms, source maps, local paths, unknown e-mails) |
| `npm run worker:bundle` | Worker bundles; no key-like strings or private hosts in it |
| `npm run test:e2e` | 118 browser tests: every route at 1440/390/320 px, axe (WCAG 2.2 AA) in both themes, the guide (all 9 questions, synonyms, fallbacks, keyboard, mobile), all labs, modes, shortcuts, 3D resize regression, no-JS/no-WebGL, and **no request to any other host** |
| `npm run ci` | All of the above |
| `npm run test:lab` | V3 design lab (local only): 34 browser checks against the lab build (`DESIGN_LAB.md`) |

## Ground rules

1. No invented achievements: every outcome carries a basis (`verified`, `linked`, `self-reported`); new claims go
   through [CONTENT_APPROVAL.md](CONTENT_APPROVAL.md).
2. No private data: no Nokia internals, customer data, private-repo content or credentials. Demos use labelled synthetic data.
3. No paid inference in the public site. The guide answers only from `src/data`; links pass an allowlist.
4. Nothing reaches `main` or production without the owner.

More: [PROJECT_STATE.md](PROJECT_STATE.md) (status and verified results), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md),
and [DEPLOY.md](DEPLOY.md).
