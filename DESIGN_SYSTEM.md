# Design system

Direction: **Spatial Lab** (3D hero and project map) + **Editorial Machine** (type, rules, index tables) +
**Neural Core** (the Skills Constellation). Dark and cinematic by default, with a paper reading theme.
All tokens live in `src/styles/global.css`.

## Decision: custom CSS, not Tailwind

The system is a dozen colour tokens, a type scale and ~30 components with two themes. Plain CSS custom properties
express that directly, theme by swapping variables under `[data-theme='paper']`, and ship as one inlined stylesheet
per page. Tailwind would add a build dependency and long class strings without reducing what has to be designed.
Revisit only if several contributors start building pages.

## Tokens

| Token | Dark | Paper | Use |
|---|---|---|---|
| `--bg` | `#090C12` | `#F3F1EC` | page |
| `--surface` / `--surface-2` | `#151C29` / `#1C2536` | `#FFF` / `#F7F5F0` | panels, cards |
| `--fg` / `--fg-soft` / `--fg-mute` | `#E9EEF6` / `#B7C1D1` / `#8C97AA` | `#0E131C` / `#344055` / `#56627A` | text levels |
| `--line` / `--line-strong` | `#232C3E` / `#3A4660` | `#D9D5CB` / `#B9B3A5` | rules, borders |
| `--accent` (bio) | `#8BFFB0` | `#0A7A3E` | primary accent, AI domain |
| `--violet` | `#7A8CFF` | `#3F4FD8` | systems domain |
| `--orange` | `#FF885E` | `#B4441C` | security domain, warnings, disclosures |
| `--c-research` | `#C9D3E3` | `#4A556B` | research domain |

Every text/background pair used on the site passes WCAG 2.2 AA in both themes (axe runs on 16 routes × 2 themes in CI).
Domain colour is set with a class (`.d-systems`, `.d-ai`, `.d-security`, `.d-research`) that defines `--c`.

## Type

Space Grotesk Variable (display), Inter Variable (body), JetBrains Mono Variable (labels, data). Latin subsets only,
self-hosted (`src/styles/fonts.css`), the first two preloaded. Scale: `--fs-mega` (name), `--fs-display` (page titles),
`--fs-h2`, `--fs-h3`, `--fs-lede`, body 16 px, micro 11 px mono uppercase with 0.14–0.16 em tracking for labels.

## Components

`.masthead` (ruled top line), `.section-head`, `.eyebrow`, `.btn` (+ `-primary`, `-accent`, `-sm`), `.chip` (domain filter,
`aria-pressed`), `.tag`, `.status` (what the work is), `.evidence` (bars = public evidence), `.basis` (outcome source),
`.disclosure` (synthetic-data notice, required on every demo), `.panel`, `.index-table`, `.prose`, `PageHead`, `Resume` (recruiter mode and /resume/).
Labs share `src/islands/demos/demos.css` (`.demo-card`, `.demo-metric`, `.demo-log`, `.pill`).

## Data encodings (the same everywhere)

- **Colour = domain.** **Height / bar count = public evidence** (public 4, documented 3, reported 2, pending 1).
- **Striped cap = in progress. Dashed outline = case study pending.** Traces between lab modules = ≥2 shared skills.
- Constellation: ring = domain, bright core = project (size = evidence), small star = skill (size = number of projects).

## Motion

- Intro: headlines slide 0.12 em without fading (they are the LCP element); supporting text rises and fades.
- Scroll reveals and SVG stroke drawing via GSAP ScrollTrigger, loaded after idle; a safety timer reveals everything.
- Cross-document View Transitions between pages; project titles morph between the index and the case study.
- `prefers-reduced-motion` or the in-site toggle: all animation and transitions off, 3D renders on demand only.
- Recruiter mode: reveals and grain off, 3D off. Phones/touch: 3D is opt-in (“Load 3D”).

## Fallback ladder (every interactive visual)

3D scene → interactive SVG (same layout code) → static SVG/HTML with real links (no JS) → text index.
