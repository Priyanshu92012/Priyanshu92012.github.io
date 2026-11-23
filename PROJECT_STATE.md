# PROJECT_STATE

Branch: `release/v2.1-rc` (local; based on published `main` 0b41360; development history on `feat/v2-master`) · Production (`main`, GitHub Pages) still serves **v1**, untouched.
Safety tag: `portfolio-v1-backup` → `953f03b` (local tag; push it before any production switch).

## Phase log

### Phase 1: Audit & baseline ✅
- Audited v1: static `index.html` + `terminal.js` + Cloudflare Worker (`portfolio-ai`), with a server-side system prompt, origin allowlist, 500-char cap and KV rate limits (3/min, 10/h, 500/day).
- Secret scan of git history and tree: no `sk-ant-` keys. Whether the previously pasted key was rotated can't be verified from the repo (owner action).
- Found: the Worker prompt is stale (availability Jun–Sep 2026); `terminal.js` duplicates the prompt; GMRE metrics conflict between the v1 homepage and the architecture page (see `CONTENT_APPROVAL.md`).
- Tagged `portfolio-v1-backup`.

### Phase 2: Astro migration foundation ✅
- Astro 7 + React 19 + MDX + sitemap; TypeScript 6 (`@astrojs/check` does not support TS 7 yet).
- Legacy URLs preserved: `/gmre_architecture_v3.html` (same path), full v1 site at `/v1/`, `/portrait.png`.
- Typed content model (`src/data`, Zod-validated at import) + content safety gate (`scripts/check-content.mjs`, runs before every build).
- Global layer: header, footer, SEO/JSON-LD, mode script (theme/motion/recruiter, no flash), command palette (⌘K), terminal (`), PRIYANSHU.AI drawer (/ or ⌘J), X-Ray overlay (X), Konami easter egg.
- Agent core (`src/lib/agent`): knowledge index from approved data, BM25 retrieval with skill aliases, 7 read-only tools (Zod → JSON Schema), job matcher, brief generator, offline agent, NDJSON client with schema validation and fallback.
- Docs: CONTENT_APPROVAL.md and the public project documentation.
- Verified: `npm run build` ✔ · `check:content` ✔ (8 records flagged for owner review).

### Phase 3: Homepage + signature graphics 🟡 (in progress, `7382950`)
- Done: homepage sections (work index, feature visuals, lab poster, mini constellation), HeroLab island with lazy R3F `LabScene` behind a static poster, motion script.
- Done: deterministic sim engines in `src/lib/sim` (gmre, basyx, securemed, xai, scheduler, totp) + 41 Vitest unit tests (agent, data, sim).
- Agent protocol gained a `focus` UI action; `Terminal.tsx` fixed to narrow the `open_project` slug before deferred navigation.
- Verified: `npm run check` 0 errors · `npm test` 41/41 · `npm run build` ✔.
- Done: `/work/[slug]/` case-study pages for all 13 approved projects, rendered only from `src/data/projects.ts` (problem, approach, decisions, outcomes with basis, limits, confidentiality, skills, evidence links, prev/next). Demo projects show the static `FeatureVisual` labelled "Static preview" plus the demo disclosure until the islands land.
- Verified (CDP device emulation, reduced motion): no horizontal overflow at 390 px on any case page, no console errors; long titles wrap at 320 px.
- Known issue (pre-existing, global): at 320 px the header actions (`div.actions`, menu button) overflow to 339 px on every page, failing WCAG 1.4.10 Reflow. Fix in the header.
- Known gap: header/footer link to `/about/`, `/lab/`, `/recruiter/`, `/skills/`, `/xray/`, which are not built yet.
- Next: demo islands in `src/islands/demos/` (Scheduler Explorer, SecureMed pipeline on the existing sim engines), mounted in place of the static preview; MDX prose collection (no `content.config` yet); FinBERT attribution viewer needs verified/public precomputed attributions (owner input). Secondary projects have thin records; richer copy goes through `CONTENT_APPROVAL.md`.

### Phase A: frontend completion ✅ (2026-11-18)
- Fixed WCAG 1.4.10 reflow at 320 px: header (theme toggle moves into the menu below 420 px), hero grid (`minmax(0,1fr)`), lab poster width.
- Fixed duplicated title suffix on case pages ("X · PRIYANSHU.EXE · PRIYANSHU.EXE").
- New pages: `/work/` (index + status/evidence legend), `/skills/` (constellation + evidence index with `#skill-<id>` anchors), `/lab/` (simulator index, Agent Arena, bench), `/xray/` (architecture, agent lifecycle, live diagnostics, security boundaries, decisions), `/about/` (`#principles`, `#contact`, optimised portrait 536 KB → 13 KB webp), `/recruiter/`, `/resume/` (print CSS), `404`, `robots.txt`.
- Recruiter mode: global banner with exit, reveal animations and grain off, 3D views stay static; `/recruiter/` turns it on.
- Skills Constellation: deterministic radial layout shared by SSR SVG, interactive 2D map and lazy 3D orbit (R3F, one LineSegments draw call); search, domain filter, inspector, agent focus via bus/pending focus/URL hash.

### Phase B: interactive laboratories ✅ (2026-11-18)
- `src/islands/demos/`: SchedulerLab (fault injection, lifecycle diagram with live transitions, invariants, 240-tick strategy comparison), SecureMedLab (real TOTP enrol/login, replay/stale/guess attacks, lockout, session rotation, audit log; STRIDE model; CI/CD gates), GmreLab (nested archives, real SHA-256 re-upload skip, record dedup, corrupt member → FAILED ledger → targeted backfill), BasyxLab (5-step import with safe defaults, idempotent re-import), XaiLab (exact Shapley + LIME stability, counterfactual masking, efficiency check), ArenaLab (empty approved-results table + local, schema-validated transcript replay; `src/lib/arena.ts`).
- LIME sampling now uses a seeded Fisher–Yates shuffle (the old sort-based shuffle was biased and engine-dependent, which caused a React hydration mismatch).
- FinBERT: real results exist in the owner's local study repo but are not approved for publication (lecturer + owner). Nothing committed; requirement recorded in `CONTENT_APPROVAL.md`.
- Verified: `astro check` 0 errors · 49/49 unit tests · 22 pages built · screenshots of every lab at 1440 px, no console errors except the known R3F `THREE.Clock` deprecation warning.

### Phase C: PRIYANSHU.AI backend — **superseded in RC1**: kept as an experimental, undeployed Worker (2026-11-18)
- `worker/src` rewritten in TypeScript on the official `@anthropic-ai/sdk`: `GET /v2/health`, `POST /v2/chat` (NDJSON, protocol-validated), legacy `POST /` for the v1 terminal (same agent, plain text, SSE text deltas + `[DONE]`).
- Agent loop (`worker/src/agent.ts`): manual streaming tool loop, the same 7 read-only tools as offline mode (Zod-validated inputs; invalid input goes back to the model as an error result), max 4 tool rounds then a forced text turn (`tool_choice: none`), `eager_input_streaming` on tools, cached system+tools prefix, server-side refusal fallback (`fallbacks: "default"`), refusal turns never run tools, fallback-boundary echo rules.
- System prompt built only from `policy.ts` + approved data (`src/lib/agent/prompt.ts`); the stale v1 prompt (availability dates, conflicting GMRE numbers) is gone.
- Protection: origin allowlist (403), 64 KB body cap (413), Zod request schema, per-IP minute/hour limits, global daily request cap, **daily USD budget computed from real token usage** (fails closed → 429 → browser offline mode), stops spending when the visitor disconnects. No conversation storage.
- Config in `wrangler.toml` `[vars]`: `AGENT_MODEL` (default `claude-opus-5-5`), `AGENT_EFFORT` (`medium`), `DAILY_BUDGET_USD` (3), rate limits. Key only via `wrangler secret put ANTHROPIC_API_KEY`.
- Client: a live failure before any substantive event now falls back to offline mode with the reason.
- Verified: 12 Worker tests with a mocked provider + in-memory KV (61/61 total) · `npm run worker:bundle` (926 KB, no key-like strings or private hosts) · **booted in local workerd via `wrangler dev --local`**: health, 403, 503-without-key and legacy route behave as specified. A real model call was **not** made (it would spend your API budget).
- RC1: the owner decided visitors must not consume API credits. The Worker is not deployed and not used by the site.

### Phase D: polish, performance, social ✅ (2026-11-18)
- Content model no longer ships Zod to the browser: records are typed at compile time and validated at build time
  (`src/data/validate.ts`, called from BaseLayout and tests). Removed a 92 KB chunk from every page.
- All CSS inlined (no render-blocking requests); Latin-only self-hosted fonts with the two first-screen faces preloaded;
  headline intro animates without opacity (LCP); 3D is opt-in on phones/touch; recruiter mode applied before paint (CLS 0).
- Terminal: `cd <page>`, `sims`. Palette already covered every page. Social card `public/og.png` from `/og-card/`.

### Phase E: verification ✅ (2026-11-18)
- `npm run check` 0 errors · `npm test` **62/62** · `npm run build` 23 pages · `npm run worker:bundle` ✔.
- Playwright (`tests/e2e`, local Chrome): **101/101** — 16 routes × {1440, 390, 320 px} with no clipped or overflowing
  content, metadata on every page, legacy URLs, 404; axe WCAG 2.2 AA on 16 routes × {dark, paper}: 0 serious/critical;
  agent offline fallback, job matcher, mocked live NDJSON stream (validated focus action applied; unknown slug,
  non-allowlisted action and external link dropped), early live failure → offline; terminal; all six labs; paper and
  recruiter modes; palette, `g` chords, X-Ray, Konami; constellation deep link/search/agent focus; no-JS; no-WebGL.
  Stress run of interactive specs ×4: 72/72.
- Defects found and fixed by these suites: 320 px overflow in the work index, home lab stage/inspector, BaSyx package
  buttons and repository table, Arena card header; label-in-name (⌘K button, lab modules, scheduler cards);
  `aria-label` on role-less spans; links nested in a `role="img"` SVG; home constellation preview link.
- Lighthouse 12 (mobile emulation, simulated slow 4G, median of runs): Performance 93–98, Accessibility 100,
  Best Practices 100, SEO 100 on `/`, `/work/`, `/skills/`, `/lab/`, `/xray/`, `/about/`, `/recruiter/`, case pages.
  CLS ≤ 0.02, TBT ≤ 90 ms. LCP 2.1–3.0 s in the lab simulation (target 2.5 s; the remaining gap is the 450 ms simulated
  TTFB plus HTML transfer on slow 4G; real devices on 4G/Wi-Fi will be faster but have not been field-measured).
- Security: secrets scan in the build and Worker bundle gate; Worker origin allowlist, schema validation, body cap,
  rate limits and fail-closed budget covered by Worker tests; the browser validates every agent event and drops
  unknown actions and non-site links (e2e). Live model calls were not exercised (no spend without owner approval).
- CI: `.github/workflows/ci.yml` (check, unit, build, worker bundle, Playwright with bundled Chromium) on every non-main
  push/PR. `.github/workflows/deploy.yml` is manual-only, main-only, and requires typing `deploy`.

### RC1: free portfolio guide, reliability, performance, release prep ✅ (2026-11-19)
- **No paid AI.** PRIYANSHU.AI is now a scripted, in-browser *Portfolio Guide* (`src/lib/guide`): 9 curated intents
  (Who / Nokia / best projects / AI / security / tech / education / approach / contact) built from `src/data`, synonym
  phrases + keyword scoring, named project/skill routes, job-description evidence map, brief, privacy/injection guards,
  “no published evidence” for known unevidenced tech, and an honest “not covered” fallback with the closest questions.
  Links pass an allowlist in the engine and again at render. Drawer: suggestion cards, answer cards, action buttons,
  sources, follow-ups. Terminal and archived `/v1/` terminal route questions to the guide; network client, offline
  agent and live-model copy removed. `scripts/check-dist.mjs` fails the build on any inference endpoint; every e2e page
  test fails on any request to another host.
- **Worker isolated**: not deployed, Haiku 5.5 default (verified against platform.claude.com docs 2026-11-18), no
  cross-model fallback (unsupported on Haiku 5.5), KV budget documented as a soft guard (not a hard cap); SDK and
  wrangler are dev dependencies only; no workflow deploys it.
- **3D crash root cause fixed**: drei `<Html>` labels (one React root each) threw `removeChild` when unmounted while
  crossing the 760 px breakpoint (reproduced 5/5 by resizing; 3D fell back to the poster). Replaced by a projected DOM
  overlay + greedy decluttering in both scenes; resize stress test 0 errors; e2e regression test added.
- **Visual polish**: hero framing clear of the inspector; copy column above the canvas (canvas covered the CTA at
  1280 px); poster labels decluttered at build time in a top layer; guide Markdown lists; X-Ray SSR states and copy.
- **Performance** (profiled before changing): global UI hydrates on idle with a queued event bus; intro text visible
  from the first frame. Lighthouse mobile medians: `/` 2.41 s, `/skills/` 2.26 s, `/work/` 2.26 s, `/lab/` 1.96 s,
  case pages 2.25 s, `/recruiter/` 2.25 s, `/about/` 2.71 s, `/xray/` 2.56 s (Lighthouse simulation; real throttled
  runs: `/about/` 0.63 s, `/xray/` 0.49 s). Perf 96–99, A11y/BP/SEO 100, CLS 0, TBT ≤ 5 ms.
- **Release prep**: workflows validated and actions bumped to current majors; staging = separate Cloudflare Pages
  project with `PUBLIC_STAGING=1` (noindex); DEPLOY.md reflects the real production state (Pages legacy build from
  `main`, PR #1 merged as `92a2ee6`, remote feature branch deleted, V2 commits local only).
- **Content gate**: CONTENT_APPROVAL.md rewritten as a decision table with the exact public text (A1–A10, B1–B4).
- Verified: `astro check` 0 errors · 96/96 unit · 107/107 e2e · build + dist gate ✔ · worker bundle ✔.
- Not verified: real devices, Safari/Firefox (only Chrome via Playwright), CI on GitHub (branch not pushed).

### Staging preparation ✅ (2026-11-19)
- Conservative public content (see CONTENT_APPROVAL.md Part 1): GMRE architecture page and v1 archive retired to
  `noindex` redirect stubs; unapproved GMRE metrics removed and GMRE evidence lowered to owner-reported; neutral
  scheduler name and URL (`/work/test-resource-scheduler/`); public-facing Nokia wording (no unit or team names;
  `/work/ticket-reporting-pipeline/`); Agent Arena, experiments, SecureMed and Copilot wording distinguishes research
  design, simulations and achievements; the site's own record no longer lists LLM/RAG/Workers skills.
- Repository hygiene (public repo): internal planning doc removed from the branch (still in local history, see
  CONTENT_APPROVAL A8); prototype sources sanitised and their screenshots removed; unused `public/portrait.png` removed.
- Gates: `scripts/confidential.mjs` (hashed term list) in the content gate (src, public, worker, prototypes, docs,
  tests, scripts, root docs) and the dist gate; the dist gate also fails on source maps, dotfiles, local paths and
  unknown e-mail addresses. Experimental Worker gained a default-off `AGENT_ENABLED` kill switch (+ test).
- Staging: `npm run staging` builds `.staging/site` (noindex, badge) and serves it behind HTTP Basic Auth on :4400
  (LAN only). Verified: 401 without/with wrong credentials, 200 with, 403 on encoded traversal, 405 on POST,
  noindex/no-store/DENY headers, LAN address protected; Chrome smoke over 6 URLs with 0 external requests.
- Verified: `astro check` 0 errors · 97/97 unit · build + both gates ✔ · 107/107 e2e.

### V3 design lab 🧪 (2026-11-19, branch `feat/v3-design-lab`, local commit only)
- Three working homepage concepts next to the unchanged V2, at `/design-lab/` (local-only build, `npm run lab`; see
  `DESIGN_LAB.md`): **A · Monolith** (charcoal + lime, twisted graphite tower in WebGL behind the portrait, feature
  stories), **B · Orbit** (portrait inside three project orbits with depth occlusion; select to reveal), **C · Signal**
  (ivory magazine, name behind a monochrome cover portrait, spreads, no 3D). Gallery with real screenshots, live frames,
  measured comparison and a recommendation (Orbit; Monolith as the calmer fallback). Nothing selected or merged.
- Homepage reduced to exactly three flagships (Scheduler, SecureMed, FinBERT XAI), each with a live synthetic showcase on
  the existing sim engines, honest demo labels, progressive “read more”, and **Explore All Projects ↗** → `/work/`.
- **Priyanshu’s Pet Bot**: original SVG tiger cub (3 skins), greeting once per session, contextual offers, farewell;
  lazy panel on the existing deterministic guide (9 owner questions, compact summaries + “More details”, allowlisted
  actions). No model, no network. `/` and ⌘J open it on lab pages (`GlobalUI guide="external"`; V2 default unchanged).
- Portrait: owner-selected studio headshot; on-device Vision mask + edge unmixing (`scripts/design-lab/portrait.mjs`),
  metadata-free AVIF/WebP via astro:assets; original untouched and git-ignored.
- Verified: `astro check` 0 errors · 111/111 unit · production build + dist gate ✔ and **V2 HTML byte-identical to before
  except the build commit** (25 pages) · 108/108 production e2e (incl. new “design lab never in dist”) · 34/34 lab
  e2e (1440/820/390/320 without overflow, pet bot keyboard/focus/Escape/once-per-session, disclosures, axe 0
  serious/critical, no-JS, reduced motion = no loops and no WebGL, WebGL fallback) · 0 external requests, 0 console errors.
- Lighthouse 12 mobile (median of 3, same run): performance Monolith 90 · Orbit 92 · Signal 90 · V2 91; accessibility
  100 on all; SEO 69 on lab pages only because of their deliberate noindex. **LCP 3.2–3.3 s (V2 3.2 s): target 2.5 s not
  met by any page in this simulation**; the concepts’ LCP element is the portrait (≈0.4 s unthrottled).
- Fixed along the way: WebGL probe moved after the cheap checks (phones never create a GPU context); scroll “reading”
  effect switched from opacity to compliant colours (contrast); Signal notes used CSS columns that overflowed while
  collapsed; label-in-name on the lab pill and Signal brand.
- Not verified: real phones, Safari, Firefox. Kubernetes for SecureMed is **not shown** (not in the approved record).

### V2 refinement ✅ (2026-11-19, branch `feat/v2-refinement` from `feat/v3-design-lab`, local commit only)
- Kept V2 (structure, labs, case studies, recruiter mode, guide logic, tests) and refined it; V3 concepts stay in the
  local design lab.
- **Six public projects** (owner list, in order): Test Simulator Allocator · GMRE Log Parser · SecureMed · FinBERT
  Explainability Study · Optics Controller (new, details pending) · Support Ticket Reporting Pipeline. Eight records
  unpublished (kept in code). Stronger, fact-preserving wording: `CONTENT_APPROVAL.md` Part 4 (R1–R9).
- **Homepage**: portrait hero (monochrome cut-out in front of the giant name, faint lab grid, scan line behind the
  portrait) → introduction → three featured projects + the other three → the Spatial Lab (now below the fold, 3D
  starts only when scrolled near) as “Explore all projects” → skills → footer contact. Guide and X-Ray teasers removed.
- **Tiger pet bot on every page** (`src/islands/petbot`, V2 skin from the theme tokens): greets once per session (on
  phones only after the hero is scrolled past; never in recruiter mode), opens the existing guide drawer, which now
  carries the tiger, short summaries with “More details” and contextual actions; farewell on close; reacts when a
  lab is reached or a lab module is selected. Still scripted, local, no network.
- Schema: `skills` may be empty only for a `pending` case study (Optics Controller). Case pages say so.
- Verified: `astro check` 0 errors · 113/113 unit · build + dist gate (16 pages) · production e2e (incl. new pet bot,
  portrait at 1440/820/390/320, six-project and retired-page checks) · design-lab e2e 34/34. Lighthouse mobile,
  homepage, 3 runs: perf 90 · a11y 100 · BP 100 · SEO 100 · CLS 0 · TBT 0 · **LCP 3.32 s** (portrait; V2 was 3.17 s in
  the same environment, target 2.5 s not met). Other pages not re-measured.

### Chat companion, seventh project, source audit ✅ (2026-11-20, branch `feat/v2-chat-and-audit` from `feat/v2-refinement`, local commit only)
- **Pet bot → small messaging chat** (`src/islands/petbot/ChatPanel.tsx`, `chat.ts`): 52 px tiger (48 px on phones); a
  two-line greeting once per visitor (localStorage); a non-modal chat with the opening line, four quick replies and
  “More questions”; replies are one or two sentences with at most two actions, “Tell me more” shows a compact answer
  with the full text and sources behind disclosures; the job matcher is a secondary option. Same deterministic guide,
  no network. The tiger now answers `/`, ⌘J, the header Guide button and `?ask=` (GlobalUI `guide="external"`); the old
  drawer remains for the design-lab gallery only. The tiger’s text lives in a dependency-free module, so the guide
  engine is only loaded when the chat opens.
- **Source audit** of the local repositories (details kept outside the repo: `../review/PROJECT_AUDIT.md`):
  OpticLab is a personal, fictional embedded-Linux lab (not Nokia work) and replaces “Optics Controller”; SecureMed and
  FinBERT rewritten from verified source, tests and recorded evidence; no local source exists for the three Nokia
  projects (unchanged). Eight new evidenced skills; Kubernetes, Docker and C++ are no longer job-matcher gaps.
- **PRIYANSHU.EXE published as project 7** with a full case study: architecture diagram, component explorer,
  intent-routing lab on the real engine (`answer(q, trace)` reports each decision without changing it), contracts,
  “AI, honestly” (live / built-but-disabled / not built), challenges, dated evidence, roadmap. Linked from X-Ray; in
  `/work/`, filters, constellation, recruiter mode and the chat. Homepage keeps the three featured projects.
- Fixed along the way: BM25 “weather in Stuttgart” matched the profile (location words are stopwords now); a
  hydration mismatch from a timing label in the routing lab; the chat’s scroll offset.
- Verified: `npm run ci` exit 0 — `astro check` 0 errors · 123/123 unit · build + content and dist gates (17 pages) ·
  worker bundle · 118/118 e2e; design-lab e2e 34/34; no private audit details in the repo or `dist/` (scanned).
  Weight vs the previous commit (same static server, uncompressed): first-load JS 426 → 434 KB (+8 KB, almost all the
  larger content model), opening the chat 13 → 24 KB (lazy). Lighthouse mobile, single runs: `/` perf 89, LCP 3.47 s;
  `/work/priyanshu-exe/` perf 91, LCP 3.16 s; a11y/BP/SEO 100, CLS 0, TBT 0. LCP target still not met.

### Positioning and recruiter experience ✅ (2026-11-20, branch `feat/v2-positioning` from `feat/v2-chat-and-audit`, local commit only)
- **Positioning** (`src/data/profile.ts`): title “Software Engineer | Cybersecurity & Applied AI/ML”; headline “Reliable
  systems. Secure software. Explainable AI.”; a 78-word first-person introduction in three short paragraphs; four
  focus tags; education as “Duales Studium Informatik — DHBW Stuttgart” with cybersecurity/AI as a *technical focus*;
  a signature line (“Builder by nature, hustler by schedule …”); a three-line résumé summary and three Nokia bullets.
  Dates, language levels and a CV PDF are empty slots that render nothing until approved (`CONTENT_APPROVAL.md` Part 6).
- **Hero**: the name is sized from the portrait’s position (`--hn` in `src/pages/index.astro`), so the hair overlaps
  only the edge of the final “u” at every desktop width (it hid “shu” at 1512–2560 px); on tablets and phones the
  portrait tucks under the baseline. Three-line headline. Regression test measures the overlap at nine viewports.
- **Introduction** rebuilt: lead sentence, two columns (Nokia · studies and labs), signature, focus tags, education.
  The engineering principles moved off the homepage (still on About and in the guide).
- **Skills & languages** section (`src/data/capabilities.ts`): five groups whose entries link to the projects that list
  the skill, marked Nokia / DHBW / Own; the constellation teaser sits in the grid; a languages strip (English only).
- **Recruiter Mode** is now a one-page résumé (`src/components/Resume.astro`, also `/resume/`): header with contacts,
  summary, Nokia experience, four selected projects, grouped skills, education, languages; actions Email, Match a job
  description, Print/PDF, All case studies, Exit. A4 print CSS (two pages, white, no chrome). `ProfileSheet` removed.
- **LCP**: diagnosis by blocking requests in Lighthouse — the portrait costs ~0.3 s, the islands’ JavaScript (React
  runtime, chat, tiger, GSAP), which `client:idle` started just before the first paint, cost ~1.1 s. New
  `client:afterpaint` directive (`src/directives/afterpaint.ts`) and the motion script now wait for the load event and
  a reported contentful paint. Mobile LCP 3.5 s → 2.2–2.3 s (two single runs), performance 89 → 98–99.
- Also: “All seven projects” (was “six”), guide and chat name the German programme, security and AI domain blurbs.
- Verified: `npm run ci` exit 0 — `astro check` 0 errors · 134/134 unit · build + content and dist gates (17 pages) ·
  worker bundle · 123/123 e2e (1 skipped, as before); design-lab e2e 34/34. New tests: positioning unit tests (copy
  length, focus wording, no metrics, empty date/level slots, capability evidence) and e2e (hero overlap at nine
  viewports, introduction, skills section, résumé order and print for `/recruiter/` and `/resume/`). Responsive checks
  at 2560/1920/1728/1512/1440/1280/1100/901/820/390/320 px; axe on every route in both themes; A4 print (two pages,
  white, no site chrome). Lighthouse mobile, single runs: `/` perf 98–99, LCP 2.2–2.3 s, a11y/BP/SEO 100, CLS 0;
  `/recruiter/` perf 98, LCP 2.1 s. Before/after screenshots: `../review/screenshots/positioning/` (outside the repo).

### Master brief: identity, skills, labs ✅ (2026-11-21, branch `feat/v2-master` from `feat/v2-positioning`, local commits only)
- **M1 · identity and evidence** (`6ade4fd`): “Software Engineering · Cybersecurity · AI & Machine Learning”, headline
  “Building intelligent, secure systems.”, “Applied AI” removed from branding; owner-stated languages (Hindi native,
  German full professional, English C1). One skills taxonomy on the skill records (category + basis), shared by the
  constellation, homepage, `/skills/` and the résumé; every entry exists only through published projects; tools and
  exploration labelled; candidates without evidence not shown (CONTENT_APPROVAL Part 7, M6). OpticLab lab (real
  WebCrypto RSA-2048/SHA-256 verified boot, dm-verity-style tree, driver lifecycle, strict protocol, mTLS path).
  Allocation project retitled “Dynamic Test-Resource Allocation” (requested internal title blocked by the gate; kept in
  the private review folder). Planned project “Infrastructure Capacity & Hardware Cost Optimization”.
- **M2 · CSP and BREACH MODE** (`fc650e7`): post-build CSP meta on every page (`scripts/csp.mjs`: hashed inline scripts,
  no unsafe-inline/eval for scripts, network/frames/forms/base locked); Zod jitless. `/security-lab/`: consent gate,
  recon, resource timing (no IP lookup), real CSP and sandbox refusals, read-only permissions/WebAuthn, CORS rules on
  simulated servers, fictional shell, SQL-injection and XSS attack-and-defend.
- **M3 · AI Systems Lab**: `/ai-lab/` with a real retrieval pipeline (chunking, TF-IDF, BM25, RRF, budgeted context,
  extractive cited answers, live recall/MRR), tool calling on the Worker’s real Zod contracts with a rule planner and
  trace, a deterministic multi-role simulation (labelled), and an evaluation harness (18 cases, latency, output hashes,
  reproducibility, a cost model with a visitor-entered price). Guide/tiger topics for both labs; header and palette
  links; case-page section anchors (#approach, #decisions, #outcomes, #limits) now exist and are allowlisted.
- Security review: only deliberate lab payloads use innerHTML; no unsafe `_blank` links; CI `contents: read`;
  `npm audit --omit=dev` 0 vulnerabilities.
- Verified: `npm run ci` exit 0 — `astro check` 0 errors · 159/159 unit · build with CSP (23 pages, 69 inline hashes) and
  dist gate · worker bundle · 144/144 e2e (1 skipped, as before); lab specs re-run under parallel load after the
  afterpaint change: 106/106; design-lab e2e 34/34 (also under CSP). Lighthouse mobile, single runs: `/` perf 98, LCP
  2.1 s; `/security-lab/` 99, LCP 2.0 s; `/ai-lab/` 99, LCP 2.0 s (both labs hydrate after first paint); a11y/BP/SEO 100,
  CLS 0. AI lab live numbers: retrieval recall@1 80%, recall@5 100%, MRR 0.90; evaluation 18/18, reproducible.
  Screenshots: `../review/screenshots/master/` (outside the repo).

### v2.1 release pass (2026-11-21, branch `release/v2.1-rc` from published `main` 0b41360, local commits only)
- Production as found: GitHub Pages via the **Deploy site** workflow (manual dispatch, type `deploy`), last
  run 2026-11-21 20:44 from `main@0b41360` (= local `c4cd250` tree). `release/v2` also exists on the remote.
- Header: logo · EN/DE · Recruiter · menu drawer; ⌘K palette and header Guide removed; tiger opens the guide.
- Hero: field-notes strip removed, name ~20% smaller, portrait aligned to the grid.
- English/German: `/de/` mirror for every page (shared `src/views`, typed `src/i18n` dictionaries,
  `src/data/de.ts`); hreflang/canonical/og:locale; remembered explicit choice; no browser-language redirect.
- Tiger: exact EN/DE greeting once per session, two actions, dismiss; German replies and question routing.
- Analytics: GoatCounter beacon and public counter built, **off** unless `PUBLIC_GOATCOUNTER_CODE` is set
  (`docs/ANALYTICS.md`); DNT/GPC honoured; production host only.
- Audit: published history contains 9 confidential-list terms (V1 era) and the old paid Worker is still
  reachable; both listed as release blockers in CONTENT_APPROVAL Part 8.
- Verified: `npm run ci` exit 0: `astro check` 0 errors, 171/171 unit, build 38 pages + CSP (41 HTML files, hashed inline
  scripts) + dist gate, worker bundle, 205/205 e2e (1 skipped, as before) incl. 22 localized routes at 320/390 px;
  design-lab 34/34. Widths checked at 1440/820/390/320 (EN and DE). Lighthouse mobile, single runs: `/` 99 (LCP 2.1 s),
  `/de/` 98 (2.3 s), `/security-lab/` 99 (2.0 s); a11y/BP/SEO 100; CLS 0; TBT 0. `npm audit` 0. Screenshots:
  `../review/screenshots/v21/` (outside the repo).

## Open items (owner)
000000. v2.1: resolve the two release blockers in CONTENT_APPROVAL Part 8 (R6 history, R7 Worker), review German text (R1), decide on analytics (R3).
00000. Master brief: approve `CONTENT_APPROVAL.md` Part 7; authorise or decline the allocation title (M3); say whether the planned capacity project is Nokia work (M4).
0000. Positioning: approve `CONTENT_APPROVAL.md` Part 6; send dates (Q1), languages with levels (Q2), degree (Q3).
000. Chat/audit: approve `CONTENT_APPROVAL.md` Part 5; answer P1 (is there a separate Nokia optics project?).
00. Refinement: approve `CONTENT_APPROVAL.md` Part 4; send the Optics Controller details (R5).
0. V3: choose a concept in `/design-lab/` and approve `CONTENT_APPROVAL.md` Part 3 (portrait, copy, pet bot voice,
   Kubernetes). Then the winner can replace `/` on a new branch.
1. Approvals A1–A9 in `CONTENT_APPROVAL.md` Part 2 (A8 before any push; A9 concerns current production).
2. Review staging on desktop and a real phone (`DEPLOY.md` §1a now, or §1b behind Cloudflare Access).
3. Push the branch + backup tag, PR, Pages source switch, manual deploy (`DEPLOY.md` §2).
4. After launch: delete the v1 `portfolio-ai` Worker or revoke its key (the current v1 production terminal still calls it).
