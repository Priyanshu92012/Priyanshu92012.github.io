// Facts about this website's own architecture, for the PRIYANSHU.EXE case study. Every entry points at
// real files in this repository; statuses distinguish what visitors use, what runs at build time, and
// what exists but is switched off. Numbers carry the date and context of the run that produced them.
export type SiteComponent = {
  id: string;
  name: string;
  layer: 'content' | 'build' | 'page' | 'island' | 'engine' | 'quality' | 'experimental';
  status: 'live' | 'build-time' | 'disabled';
  /** How it reaches the browser. */
  delivery: string;
  role: string;
  files: string[];
  tested: string;
};

export const SITE_COMPONENTS: SiteComponent[] = [
  {
    id: 'content', name: 'Typed content model', layer: 'content', status: 'build-time', delivery: 'Bundled data; validated with Zod at build time only',
    role: 'The single source of every public claim: seven projects, their skills, outcomes (each with a basis) and the owner profile. Pages, 3D scenes, the constellation and the guide all read it.',
    files: ['src/data/projects.ts', 'src/data/schema.ts', 'src/data/validate.ts'], tested: 'Unit: schema, publish set, relations, honest labels',
  },
  {
    id: 'pages', name: 'Static pages', layer: 'page', status: 'live', delivery: 'Pre-rendered HTML, CSS inlined per page',
    role: 'Every route renders to static HTML that works without JavaScript; interaction is added on top, island by island.',
    files: ['src/pages/', 'src/layouts/BaseLayout.astro'], tested: 'E2E: every route at 1440/390/320 px, metadata, no-JS',
  },
  {
    id: 'guide', name: 'Portfolio guide engine', layer: 'engine', status: 'live', delivery: 'Lazy chunk with the chat (loaded on first open)',
    role: 'Deterministic answers: normalisation, guards, small talk, intent scoring with synonyms, project and skill detection, BM25 retrieval, a job-description matcher and an honest fallback.',
    files: ['src/lib/guide/index.ts', 'src/lib/agent/search.ts', 'src/lib/agent/jobmatch.ts'], tested: 'Unit: all topics, synonyms, guards, fallbacks, determinism',
  },
  {
    id: 'links', name: 'Action allowlist', layer: 'engine', status: 'live', delivery: 'Part of the guide chunk',
    role: 'Every link an answer can show must be a known page, a published project or skill anchor, or the owner’s own profile. Checked in the engine and again when rendering.',
    files: ['src/lib/guide/links.ts'], tested: 'Unit + E2E: only allowlisted destinations render',
  },
  {
    id: 'chat', name: 'Pet bot chat', layer: 'island', status: 'live', delivery: 'Mascot on idle (~4 KB); chat panel lazy on first open',
    role: 'The tiger and its messaging panel: short replies, at most two actions, details on request, a discreet job matcher. A non-modal dialog that never traps focus.',
    files: ['src/islands/petbot/PetBot.tsx', 'src/islands/petbot/ChatPanel.tsx', 'src/islands/petbot/chat.ts'], tested: 'Unit + E2E: every topic, fallbacks, keyboard, Escape, 320 px',
  },
  {
    id: 'bus', name: 'Typed event bus', layer: 'engine', status: 'live', delivery: 'Shared module',
    role: 'Islands never touch each other: they exchange typed CustomEvents. Events that open UI are queued until a listener hydrates, so early clicks are never lost.',
    files: ['src/lib/bus.ts'], tested: 'E2E: shortcuts and focus hand-offs across pages',
  },
  {
    id: 'labs', name: 'Simulation engines', layer: 'engine', status: 'live', delivery: 'Lazy, inside each case study (client:visible)',
    role: 'Deterministic, seeded engines behind the labs: a reservation scheduler, a nested-archive ingester with real SHA-256, RFC 6238 TOTP and release gates, exact Shapley values and seeded LIME.',
    files: ['src/lib/sim/', 'src/islands/demos/'], tested: 'Unit: invariants, algorithms; E2E: every lab',
  },
  {
    id: 'spatial', name: 'Spatial Lab (3D)', layer: 'island', status: 'live', delivery: 'SVG poster first; Three.js scene lazy, only near the viewport on desktop',
    role: 'The project floor: colour is domain, height is public evidence, traces are shared skills. The static poster and the 3D scene use the same layout code.',
    files: ['src/islands/HeroLab.tsx', 'src/islands/scenes/LabScene.tsx', 'src/lib/lab.ts'], tested: 'E2E: no-WebGL fallback, resize regression',
  },
  {
    id: 'constellation', name: 'Skills Constellation', layer: 'island', status: 'live', delivery: 'SSR SVG; 2D map interactive; 3D orbit lazy',
    role: 'Every evidenced skill wired to the projects behind it, with search, domain filters and deep links. One deterministic radial layout for SVG, 2D and 3D.',
    files: ['src/islands/Constellation.tsx', 'src/lib/constellation.ts'], tested: 'E2E: deep link, search, focus from the guide',
  },
  {
    id: 'xray', name: 'Engineering X-Ray', layer: 'island', status: 'live', delivery: 'Page + live diagnostics island; X toggles island outlines anywhere',
    role: 'The site explaining itself: architecture, hydration, live numbers from the visitor’s own browser, and security boundaries.',
    files: ['src/pages/xray/index.astro', 'src/islands/XRayLive.tsx'], tested: 'E2E: page renders, shortcut',
  },
  {
    id: 'csp', name: 'Content-Security-Policy', layer: 'quality', status: 'build-time', delivery: 'A <meta> CSP injected into every built page',
    role: 'GitHub Pages cannot send headers, so a post-build step hashes every inline script and writes a strict policy per page: no inline or eval script execution, network, frames, forms and <base> limited to the site.',
    files: ['scripts/csp.mjs'], tested: 'E2E: every route loads with no violation; BREACH MODE asserts the browser refuses injected scripts, handlers, eval and cross-origin fetch',
  },
  {
    id: 'breach', name: 'BREACH MODE security lab', layer: 'island', status: 'live', delivery: 'Lazy island on /security-lab/; nothing runs before consent',
    role: 'Opt-in experiments: browser recon, resource timing, real CSP and sandbox refusals, CORS rules, a fictional shell, and attack-and-defend toys (SQL injection, XSS).',
    files: ['src/islands/breach/', 'src/lib/sim/breach.ts', 'public/security-lab/'], tested: 'Unit: CORS, SQL engine, shell; E2E: consent gate, refusals, full flow',
  },
  {
    id: 'ailab', name: 'AI Systems Lab', layer: 'island', status: 'live', delivery: 'Lazy island on /ai-lab/',
    role: 'Chunking, TF-IDF and BM25 with rank fusion, extractive cited answers, the Worker’s real tool contracts with a rule planner, a deterministic multi-role simulation and an evaluation harness.',
    files: ['src/islands/ai/', 'src/lib/ai/'], tested: 'Unit: recall, groundedness, planning, refusals, reproducibility; E2E: each module',
  },
  {
    id: 'gates', name: 'Build gates', layer: 'quality', status: 'build-time', delivery: 'Run by every build',
    role: 'The content gate blocks secrets, private hosts and a hashed list of confidential names; the dist gate blocks AI endpoints, source maps, local paths and unknown e-mail addresses in the output.',
    files: ['scripts/check-content.mjs', 'scripts/check-dist.mjs', 'scripts/confidential.mjs'], tested: 'Runs in CI on every push',
  },
  {
    id: 'tests', name: 'Test suites and CI', layer: 'quality', status: 'build-time', delivery: 'GitHub Actions on every non-main push',
    role: 'Type check, Vitest unit tests, build with both gates, Worker bundle check, then Playwright end-to-end tests with axe accessibility checks and a guard that fails on any request to another host.',
    files: ['.github/workflows/ci.yml', 'tests/unit/', 'tests/e2e/'], tested: 'Itself',
  },
  {
    id: 'worker', name: 'LLM agent Worker', layer: 'experimental', status: 'disabled', delivery: 'Not deployed. No page calls it',
    role: 'A Cloudflare Worker on the Anthropic SDK: a streaming tool loop over seven read-only, schema-validated tools, an origin allowlist, request caps, rate limits and a daily spend guard behind a default-off kill switch.',
    files: ['worker/src/', 'src/lib/agent/tools.ts', 'src/lib/agent/policy.ts'], tested: 'Unit with a mocked provider (no real model call made)',
  },
];

/** Verified evidence, with the date and context of the run. */
export const SITE_EVIDENCE: { label: string; value: string; context: string }[] = [
  { label: 'Unit tests (Vitest)', value: '171 passed', context: '2026-11-22, local, `npm test`: guide, chat (EN/DE), content model, positioning, i18n, analytics privacy, simulations, OpticLab, BREACH MODE, AI lab, agent and the mocked Worker' },
  { label: 'Browser tests (Playwright + axe)', value: '205 passed', context: '2026-11-22, local Chrome against the production build, as part of `npm run ci`' },
  { label: 'Accessibility', value: '0 serious or critical axe findings', context: 'WCAG 2.2 AA rules on every route in dark and paper themes, same run' },
  { label: 'Lighthouse, homepage (mobile)', value: 'Performance 98–99 · Accessibility 100 · Best practices 100 · SEO 100', context: 'Lighthouse 12, simulated slow 4G, single runs on 2026-11-22: / 99, /de/ 98' },
  { label: 'Largest Contentful Paint', value: '2.1–2.3 s (target 2.5 s, met)', context: 'Same runs; the LCP element is the hero portrait' },
  { label: 'Requests to other hosts', value: '0', context: 'Asserted by every browser test; the build fails if an AI endpoint reaches the output' },
];

export const ROADMAP: { title: string; note: string }[] = [
  { title: 'On-device answers for open questions', note: 'A small model running in the browser (WebGPU) as a fallback for questions the scripted guide cannot match, still answering only from the approved records. Not built.' },
  { title: 'Opt-in LLM guide', note: 'Switch on the existing Worker behind its budget and rate limits, if visitor value justifies the cost. Not enabled.' },
  { title: 'Evaluations for the guide', note: 'A fixed question set with expected routes, run in CI, so changes to synonyms cannot silently re-route answers. Partly covered by unit tests today.' },
  { title: 'Keep LCP under 2.5 s on slow 4G', note: 'Met in Lighthouse since islands hydrate after the first contentful paint, with a margin of about 0.2 s. Not yet measured on real phones; fewer first-screen fonts would widen the margin.' },
];
