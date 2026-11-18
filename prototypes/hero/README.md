# Phase 1 — Hero prototypes (PR-003 draft)

**Branch:** `feat/v2-hero-prototypes` · **Status:** Proposed, needs owner decision · **Date:** 2026-11-18
**Scope:** Master plan §10 Phase 1. These are isolated prototypes. Nothing here is linked from the live site, nothing is deployed, and `main` is untouched.

## How to run

```bash
# from the repo root
python3 -m http.server 8765
open http://localhost:8765/prototypes/hero/
```

Test switches, which work on every prototype:

| Query | Effect |
|---|---|
| `?motion=reduce` | Force the reduced-motion path. The OS `prefers-reduced-motion` setting is also honoured. |
| `?fallback=1` | Simulate no WebGL (prototype A shows its static SVG) |
| `?mode=recruiter` | Open in Recruiter Mode, a plain HTML single-page summary |
| `?theme=paper` | Light / print presentation. Fully styled only in prototype C. |

## What was built

All three prototypes share the same layer:
- `shared/tokens.css` holds the plan §4 tokens plus the global header from §3.
- `shared/projects.js` is one content model in the shape of plan §7. It drives every scene, readout, index and Recruiter Mode, which is the plan's "one coherent world" principle.
- `shared/proto.js` handles Recruiter Mode, motion preference and fallbacks.

| | A · Neural Core | B · Spatial Lab | C · Editorial Machine |
|---|---|---|---|
| Idea | Living 3D neural system. Four point-cloud clusters are the domains (Systems, AI, Security, Research), and cluster density scales with project count. | Isometric engineering workbench. Each project is a physical module, and **module height encodes evidence**: tall = verified, striped = in progress, dashed blueprint = case study pending. | Technical magazine cover: huge type, a masthead, and a 4-channel **signal monitor**. Each spike is a project and spike height is evidence. Below it sits a real index table. |
| Interaction | Domain chips or clicking a cluster rotates it forward, dims the others and lists its projects. Pointer parallax. Signal pulses travel along axons. | Click a module: it rises, its relationship traces light up, and the inspector shows the summary, stack, status and link. Pointer tilt. | Click a channel to filter the index. The cursor reads the nearest spike. A one-time name decode plays on load. Paper/print toggle. |
| Renderer | Three.js r160 with custom GLSL point shader | CSS 3D transforms + SVG traces | Canvas 2D + HTML table |
| JS shipped (gzip) | ~7 KB own + **166 KB Three.js** | ~6 KB | ~6 KB |
| No-WebGL path | Static SVG diagram that stays fully clickable | Not needed | Not needed |
| Reduced motion | One static frame, rendered on demand | No tilt, no sweep, no rise-in | Static trace, no decode, no blink |
| Offscreen | Paused via IntersectionObserver + `visibilitychange` | CSS only (sweep animation still runs) | Paused |
| Perf adaptation | Pixel ratio capped at 1.75, dropping to 1 if the first 90 frames average over 22 ms | — | Pixel ratio capped at 2 |

The hero copy is always real HTML: an `<h1>`, a headline and CTAs. No canvas holds the only copy of any text. There's no loader and no intro gate.

## Scorecard (1 = weak, 5 = strong)

| Criterion | A · Neural Core | B · Spatial Lab | C · Editorial Machine |
|---|:-:|:-:|:-:|
| Readability (30-second recruiter scan) | 4 | 4 | **5** |
| Distinctiveness / memorability | **5** | 4 | 3 |
| Mobile performance | 2 | 4 | **5** |
| Implementation cost (5 = cheapest) | 2 | 3 | **5** |
| Accessibility | 4 | 4 | **5** |
| Fit with the actual projects ("proof beats claims") | 3 | **5** | 4 |
| **Total / 30** | **20** | **24** | **27** |

**Why A scores lower on fit:** the clusters look impressive, but they don't *say* anything about the work. A pending course project looks as alive as production software. In B and C the visual encoding itself carries evidence status, which is the plan's first principle.

**Why A scores lower on mobile:** 166 KB gzip of Three.js plus continuous GPU work. In headless Chrome with software rendering (a rough proxy for low-end devices), A was by far the slowest page to capture.

## Recommendation (proposed contract correction, needs your call)

1. **Hero = B (Spatial Lab).** It's the only direction where the spectacle *is* the proof: height = evidence, traces = real relationships, modules = deep links. It's distinctive without WebGL, so §2's Three.js/R3F stack is no longer on the critical path for launch.
2. **Page system = C (Editorial Machine).** Lock C's typography (Space Grotesk display at large sizes, mono telemetry labels, index table) for everything below the hero, for `/work/`, and for paper/print Recruiter Mode.
3. **Neural Core moves to Phase 5** as the Skills Constellation (plan §5 already lists it as a "typed project-skill graph, D3/SVG or light 3D"). Its cluster → project interaction model transfers directly and would no longer cost LCP on the landing page.

This deviates from plan §5, which lists Neural Core as the MVP hero. If you'd rather keep A as the hero, the minimum conditions are: lazy-load Three.js after LCP, have Phase 3 replace the point-cloud metaphor with something that encodes evidence status, and treat the SVG fallback as the mobile default.

## Proposed performance budget (for the chosen direction)

- LCP element = the `<h1>` text (true in all three). Target LCP ≤ 2.5 s at p75 on mobile.
- Hero JS ≤ 30 KB gzip (B/C). If A is chosen: 3D chunk ≤ 180 KB gzip, loaded after first paint, never blocking text.
- Fonts: three families are currently loaded from Google Fonts. In Phase 2, self-host with `font-display: swap`, subset to Latin, and preload only the display weight.
- CLS ≤ 0.1: scene containers have fixed heights and no late layout shifts.

## Token contrast (WCAG 2.2 AA needs ≥ 4.5:1 for body text)

| Token | on Midnight `#090C12` | on Elevated `#151C29` |
|---|:-:|:-:|
| paper `#E9EEF6` | 16.80 | 14.65 |
| paper-soft `#B7C1D1` | 10.78 | 9.40 |
| paper-mute `#8C97AA` | 6.64 | 5.79 |
| bioelectric `#8BFFB0` | 15.87 | 13.84 |
| violet `#7A8CFF` | 6.55 | 5.71 |
| orange `#FF885E` | 8.33 | 7.26 |

Paper theme on `#F3F5F9`: ink 17.05 · soft 9.57 · mute 5.62 · bio `#0A7A3E` 4.98 · violet `#3F4FD8` 5.79 · orange `#B4441C` 5.08. Every pairing passes AA.

## Content safety

- Only facts already public on the live site, or named in the master plan, are used. **No metrics anywhere.** The live site's numbers ("77+ tests", "8-level", "17 test cases") wait for `CONTENT_APPROVAL.md`.
- FinBERT XAI and SecureMed are labelled **"Case study pending"** and have no links. SecureMed is explicitly described as a course project, not deployed patient software (plan §6).
- No private repo content, internal Nokia system names, endpoints or secrets.

## Audit notes (Phase 0 overlap, for Codex)

- The Worker keeps the system prompt server-side, has an origin allowlist, enforces a 500-char input cap, and uses KV rate limits (3/min, 10/h, 500/day global). As plan §2 notes, KV counters aren't atomic.
- I scanned git history and the working tree for `sk-ant-` key patterns and found **none**. I can't verify from the repo whether the previously pasted key was rotated in the Anthropic console. That's still open in `HANDOFF.md`.
- `terminal.js` duplicates the system prompt client-side for the `prompt` command. It's harmless (public text), but it will drift from the Worker copy, so it should be generated from the shared content model in Phase 4.
- The repo's `CLAUDE.md` still says "no frameworks / no build step". It needs the explicit revision the plan calls for before Phase 2 starts. This branch doesn't change it.

## Known prototype limitations

- These are vanilla HTML/JS, not Astro/React. The Phase 2/3 ports will be rewrites guided by these files, not lifted code.
- The "Ask AI" button is a stub that routes to the live terminal.
- B: in Safari, CSS 3D `preserve-3d` with `backdrop-filter` ancestors can flatten layers. That needs a real-device check, and I only tested in Chromium.
- A: hover labels are pointer-only duplicates. Keyboard users use the domain chips, which are the accessible control.
- None of the screenshots come from real phones yet. They use Chromium device emulation (390×844 @2x, 820×1180).
