# V3 design lab

Three new homepage directions for PRIYANSHU.EXE, built as working prototypes next to the unchanged V2.
**Local only:** the lab routes exist only in the lab build. `npm run build`, `dist/`, the sitemap and production are
unchanged (an e2e test checks that `/design-lab/` is a 404 in the production build).

```bash
npm run lab          # build the lab + serve it → http://127.0.0.1:4330/design-lab/
npm run lab:dev      # same routes with hot reload on :4330
npm run test:lab     # 34 Playwright checks against the lab build (layout ×4 widths, pet bot, axe, no-JS, reduced motion)
npm run lab:shots    # re-capture the gallery screenshots  (after npm run lab:build)
npm run lab:measure  # Lighthouse ×3 + bytes + axe → src/design-lab/metrics.json (set LIGHTHOUSE_BIN to skip npx)
```

| Route | What |
|---|---|
| `/design-lab/` | Comparison gallery: real screenshots (desktop + phone), live side-by-side frames, comparison table with measured numbers, recommendation |
| `/design-lab/monolith/` | **A · Monolith**: charcoal, platinum, one lime line; twisted graphite tower (WebGL) behind the portrait; projects as feature stories |
| `/design-lab/orbit/` | **B · Orbit**: portrait inside three project orbits with real depth; select an orbit to reveal the project |
| `/design-lab/signal/` | **C · Signal**: ivory magazine; name behind a monochrome cover portrait; features as spreads; no 3D |
| `/` | **D · V2**, unchanged baseline |

## What is shared (so the comparison is fair)

- `src/design-lab/content.ts`: the three flagships (Scheduler, SecureMed, FinBERT XAI), intro, capabilities and contact,
  all derived from `src/data` (unit-tested: no claim that is not in the approved records).
- `src/design-lab/visuals/`: one live, synthetic showcase per flagship, on the existing engines in `src/lib/sim`
  (reservation timeline + fault injection; real RFC 6238 TOTP + release gates; exact SHAP vs seeded LIME on the
  transparent lexicon model, labelled NOT FinBERT). Loaded with `client:visible`, themed per concept with `--viz-*` tokens.
- `src/islands/petbot/` (shared with the V2 site since the refinement): **Priyanshu's Pet Bot**, an original SVG tiger cub (≈3 KB) with three skins. The panel
  is a lazy chunk that reuses the deterministic guide (`src/lib/guide`): no model, no network, allowlisted links.
  One greeting per session, one offer per flagship per session, a farewell on close, reactions to project
  interactions, `/` and ⌘J open it, Escape closes it, focus is trapped and returned, nothing moves under reduced motion.
- `src/assets/portrait/` + `src/components/Portrait.astro` (shared with the V2 homepage): the portrait. `scripts/design-lab/portrait.mjs` regenerates both copies from your original
  (Vision person mask on-device + edge colour unmixing; sharp re-encode without metadata). The original stays
  untouched and git-ignored in the repo root.

## Changes outside `src/design-lab/`

- `src/islands/GlobalUI.tsx`: optional `guide="external"` prop so the pet bot (not the V2 drawer) answers `/`, ⌘J and
  the terminal on lab pages. Default unchanged: the V2 production HTML is byte-identical to before (commit hash aside).
- `src/lib/guide/index.ts`: “coolest / cool projects” synonyms → best-projects answer.
- `astro.lab.config.mjs`, `playwright.lab.config.ts`, `tests/lab/`, `tests/unit/petbot.test.ts`, one production e2e test.
- Dependency: `@fontsource/instrument-serif` (self-hosted serif for Signal; only loaded there).

## Verification (2026-11-19)

| Check | Result |
|---|---|
| `npm run check` · `npm test` | 0 errors · 111/111 (incl. 14 pet bot / content tests) |
| `npm run build` | ✔ + dist gate; no `/design-lab/` in `dist/` or the sitemap; V2 HTML identical to before except the commit hash |
| `npm run test:e2e` (production) | 108/108 (107 existing + “design lab never in the production build”) |
| `npm run test:lab` | 34/34: 3 concepts × 1440/820/390/320, pet bot (9 questions, keyboard, focus trap, Escape, once per session), disclosures, axe, no-JS, reduced motion, WebGL on/off, gallery |
| Lighthouse 12 mobile, median of 3 | Perf: Monolith 90 · Orbit 92 · Signal 90 · V2 91. A11y 100 · BP 100 on all. SEO 69 on lab pages only (deliberate noindex) |
| LCP (simulated slow 4G) | Monolith 3.32 s · Orbit 3.17 s · Signal 3.34 s · V2 3.17 s: **2.5 s target not met** by any page in this simulation |
| Network | 0 requests to other hosts; 0 console errors (R3F's known `THREE.Clock` deprecation warning aside, as in V2) |

Not verified: real phones, Safari, Firefox (Chrome with software WebGL only).

## Open decisions

- Choose a concept (or none). Nothing has been merged into the V2 branch; `/` is untouched.
- `CONTENT_APPROVAL.md` Part 3: portrait, new layout copy, pet bot voice, and **Kubernetes** for SecureMed (requested,
  but not in the approved record, so not shown).
