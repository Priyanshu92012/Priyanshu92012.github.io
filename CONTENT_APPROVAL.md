# Content approval register (staging)

This repository is **public**, so this file describes removed internal details generically and never quotes them.
The build enforces the same rule: `scripts/confidential.mjs` (hashed term list) fails `npm run build` if a
confidential internal name appears in sources, docs, tests or the built site.

- **Part 1** lists conservative wording that is **already implemented** on the staging build.
- **Part 2** lists what still needs **your explicit approval** before anything goes to production.
- Approving a project record: set `review: 'confirmed'` in `src/data/projects.ts`. Unpublishing: `publishApproved: false`.

## Part 1 · Implemented conservatively (live on staging; no action needed to stage)

| # | What changed | Public text now |
|---|---|---|
| C1 | Retired the detailed GMRE architecture page (it listed internal record types, module paths and data-field names). `/gmre_architecture_v3.html` is now a `noindex` redirect to the case study. | “The detailed architecture page has been retired; a public summary is in the case study.” |
| C2 | Removed the unapproved GMRE metrics (plugin, migration and test-file counts; archive size). Evidence level lowered from “public write-up” to **“owner-reported”** because the write-up is gone. | Summary: “Plugin-based ingestion engine for nested diagnostic log archives. It stream-reads archives without full extraction, fingerprints them with SHA-256 for safe re-runs, and loads typed records into a relational database for team dashboards.” Decision: “Memory stays bounded on very large nested archives, and there is no temporary-disk cleanup.” Limit: “The source code and internal architecture are private. This case study and the synthetic simulator below are the public evidence.” |
| C3 | Replaced the internal scheduler name everywhere (title, URL, guide, sim seed). URL is now `/work/test-resource-scheduler/`. | Title “Automated Test Resource Scheduler”. Summary: “Scheduling work at Nokia: allocating shared test resources to automation agents through reservations, explicit lifecycle states and reliability safeguards.” |
| C4 | Replaced internal team / unit names with public-facing descriptions. Ticket pipeline URL is now `/work/ticket-reporting-pipeline/`. | Experience: “Software Engineer (dual study), Nokia · Support-engineering tooling”. Lede: “Software engineer at Nokia in Stuttgart and dual computer-science student at DHBW.” About: “I work at Nokia on support-engineering tooling as part of a dual study programme with DHBW Stuttgart …”. Hero/OG: “Nokia · DHBW Stuttgart”. Project title: “Support Ticket Reporting Pipeline”. GMRE outcome (self-reported): “Feeds the support-engineering team’s Power BI reporting dashboards”. Skill label “SQL”. |
| C5 | Removed the v1 archive from V2. `/v1/` is a `noindex` redirect to `/`; the footer and 404 page no longer link it. | “The previous version of this portfolio has been retired.” |
| C6 | Agent Arena: protocol, not results. | “Research design: an evaluation protocol for comparing AI coding agents (Claude Code and Codex) on identical tasks, with tasks, scoring and limitations fixed in advance. No runs or results are published yet.” |
| C7 | Experiments: no promised write-ups, explicit “no results”. | Schimmelwächter / Wearable: “Personal lab experiment in … Early stage: no results are published.” Investment: “Exploratory academic work at DHBW on stock strategies, with an emphasis on reproducible analysis. No results are published. Not financial advice.” |
| C8 | SecureMed: academic work vs simulation made explicit. | Limit: “The interactive lab is a simulation for this portfolio, not the course code: the architecture is a generic reference model and the pipeline is illustrative. Only the TOTP algorithm is a real RFC 6238 implementation, running locally.” (Summary unchanged: “Course project … It is not deployed patient software.”) |
| C9 | AI Incident Copilot: intent, not achievement. | “In-progress personal project: an incident assistant designed to ingest docs, logs and tickets, call tools through MCP, and draft a likely root cause, blast radius and next actions for faster triage.” |
| C10 | PRIYANSHU.AI described as a free, deterministic guide; the site’s own record no longer claims LLM/RAG/Workers/abuse-protection skills (the LLM Worker is undeployed). | “PRIYANSHU.AI · Portfolio guide … Curated answers, straight from the portfolio’s own records … no AI model, nothing leaves your browser.” |
| C11 | FinBERT study results stay unpublished; the synthetic lexicon demo stays, labelled “NOT FinBERT”. | Unchanged. |
| C12 | Repository hygiene: internal planning doc removed from the branch (your copy lives outside the repo); prototype sources sanitised; prototype screenshots (rendered old wording) removed. | — |

## Part 2 · Needs your explicit approval before production

| # | Decision | Notes |
|---|---|---|
| A1 | **Scheduler record** (C3): approve the neutral name and the description, or clear the internal name for public use. | No metrics are published. |
| A2 | **GMRE record** (C1, C2): approve the remaining engineering description (7-stage pipeline, streaming, SHA-256 fingerprints, per-plugin ledger, dry-run tooling, DB constraints as last guardrail), the name “GMRE”, and the self-reported outcome. Optionally approve a sanitised architecture page to restore “public write-up” evidence. | |
| A3 | **Nokia wording** (C4): confirm the title “Software Engineer (dual study)” and “support-engineering tooling”. | |
| A4 | **FinBERT** (C11): approve as is (no results). Publishing results needs your lecturer’s confirmation and your approval first. | |
| A5 | **SecureMed, Agent Arena, experiments, Copilot** (C6–C9): approve the new wording or unpublish. | |
| A6 | **Self-reported numbers**: BaSyx “As test manager, derived and executed 17 system test cases, all passing” · MidLog “12,000 m² cold-chain food distribution centre” (from the seminar brief) · ticket pipeline “Replaced a manual weekly reporting routine with automated refresh”. | Labelled self-reported on the site. |
| A7 | **Site record** (C10) and **site copy** (About “Who” paragraphs, X-Ray, Lab blurbs, guide framing lines). | Re-confirm. |
| A8 | **Before pushing this branch** (the repository is public): an earlier local commit (`f8bed0b`) still contains the internal planning doc; pushing publishes it in history. Choose: rewrite this unpushed branch’s history to drop it (I can do this on request), or accept. | Staging does not require pushing. |
| A9 | **Current production** (not changed by me): `main` still serves the v1 site (old metrics, internal team name) and `/prototypes/hero/` (old wording and screenshots), and the v1 terminal still calls the paid `portfolio-ai` Worker. These disappear only when V2 is launched, or if you remove them earlier. | Production change: your call. |

## Part 3 · V3 design lab (local only, `feat/v3-design-lab`)

The `/design-lab/` concepts are never built into `dist/` (they exist only in `npm run lab`). Every project claim in them is
derived from `src/data` (`src/design-lab/content.ts`, unit-tested). Before any concept goes to production, approve:

| # | Decision | Notes |
|---|---|---|
| V1 | **Portrait**: the studio headshot you selected (`Professional South Asian Business Headshot.png`, kept untouched and git-ignored in the repo root). Public copies are re-encoded without metadata; the cut-out only adds an alpha mask (macOS Vision, on-device), face pixels unchanged. | Becomes public on deploy. |
| V2 | **SecureMed + Kubernetes**: you asked to highlight Kubernetes, but the approved SecureMed record has no Kubernetes claim, so it is **not shown**. Confirm it, and it becomes one skill entry in `src/data/skills.ts` + the SecureMed record. | A unit test blocks the word until then. |
| V3 | **Honesty notes** on the three flagships: “Demo: a synthetic simulator generated in your browser. Not Nokia code, data or configuration.” · “Academic course project, not deployed patient software. The lab is a portfolio simulation, not the course application; only the TOTP algorithm is real.” · “Study results are not published. The demo explains a small transparent lexicon model, NOT FinBERT.” | Restate approved limitations. |
| V4 | **Layout copy** (no claims): “Three flagship projects. Each with a working lab.” · “Four disciplines. Every skill wired to proof.” · “Three orbits. Three working labs.” · “Start a conversation.” · “Write to Priyanshu” · “The intelligent-systems issue” · “Let’s build something reliable.” (V2 footer) | |
| V5 | **Pet bot voice** (`src/design-lab/petbot/logic.ts`): greeting, nine questions (yours, verbatim), lead-in lines, offers, farewell. Lead-ins carry tone only; every fact comes from the existing guide. | Scripted, no model. |
| V6 | Guide synonym: “coolest / cool projects” now routes to the best-projects answer (V2 guide too). | Additive. |

## Part 4 · V2 refinement (`feat/v2-refinement`, local only)

| # | Decision | Notes |
|---|---|---|
| R1 | **Public set = six projects**: Test Simulator Allocator, GMRE Log Parser, SecureMed, FinBERT Explainability Study, Optics Controller, Support Ticket Reporting Pipeline. The other eight records stay in `src/data/projects.ts` with `publishApproved: false` (no pages, not in the index, guide, constellation or lab). | Flip one flag to bring a project back. |
| R2 | **Test Simulator Allocator** (was “Automated Test Resource Scheduler”, URL unchanged). Summary: “Allocation and scheduling work at Nokia: assigning shared test simulators to automation agents through reservations, explicit lifecycle states and reliability safeguards.” Adds the skill “Process automation” and the lab title “Simulator allocation lab”. | “Simulators” is from your brief. The **internal product name stays blocked** by the confidential-term gate (A1). To use it: approve A1, remove its hash from `scripts/confidential.mjs`, then change `title` in the record. Write it nowhere else. |
| R3 | **SecureMed** summary: “Security-first course project: a medical-records application designed around a threat model, multi-factor authentication and a CI/CD pipeline whose security gates block a vulnerable release. Academic work, not deployed patient software.” | TOTP is named only for the portfolio lab, not claimed for the course app. Confirm if the course app used TOTP. |
| R4 | **FinBERT** summary: “Explainable-AI study on FinBERT, a transformer model for financial sentiment: LIME and SHAP attributions compared on the same inputs, inside a documented and tested explanation workflow.” | Still no study results (A4). |
| R5 | **Optics Controller**: new record with only what you stated (“controller project for the Nokia optics team”). Evidence “case study pending”, no skills, approach or outcomes. **Needed from you:** what it controls (public terms), your role, stack, a public-safe problem statement, any outcome you can state, and whether you want a synthetic lab. | Nothing was found in the repo, its history or your plan document. |
| R6 | **Support Ticket Reporting Pipeline** summary: “Reporting automation at Nokia: a Power BI pipeline that pulls support-ticket data from Excel exports and source systems and replaces a manual weekly routine with consistent, automatically refreshed KPIs.” Approach (new, restating the record): pull ticket data from Excel exports and source systems into one model · define the KPIs once as DAX measures · refresh automatically. | Review flag set back to needs-owner-review. |
| R7 | **GMRE** role: “Designed and built the ingestion pipeline, parser plugins, database schema and test harness.” | Wording only. |
| R8 | **Site copy**: hero (name, headline, “Software Engineer · Nokia · DHBW Stuttgart”), “Three systems, each with a lab.”, “All six projects, on one floor.”, “Also in the index”; domain blurbs AI → “Language models and explainability: AI that has to show its evidence.”, Research → “Academic research: explainability studies and experiment design.”; guide: drawer title “Priyanshu’s pet bot”, greeting “Hello! 🐯 I’m Priyanshu’s pet bot. Want to explore his work?”, intro, lead-in lines, action labels (Explore this project · Open the lab · View all projects · Contact Priyanshu · Open recruiter mode), GitHub answer. | |
| R9 | **Portrait on the homepage** (same photo and processing as V1). | Becomes public on deploy. |

## Part 5 · Chat, seventh project and source audit (`feat/v2-chat-and-audit`, local only)

Records were checked against the projects’ own source, tests and recorded evidence on 2026-11-20. The detailed audit,
with local paths, run IDs and anything not cleared for publication, is kept **outside this repository**
(`../review/PROJECT_AUDIT.md`). Nothing from the private repositories was copied here.

| # | Decision | Notes |
|---|---|---|
| P1 | **OpticLab Secure Controller replaces “Optics Controller”** (R5). Its own README states the product is fictional and contains no employer material, so the record is a **personal lab project, not Nokia work**. New summary, approach, decisions, verified outcomes (37/37 QEMU integration checks, 71 host checks with sanitizers, 32 million fuzz executions, checkpatch clean) and limits. | **Question:** is there a separate, real Nokia optics-controller project? Nothing about one exists locally. |
| P2 | **SecureMed** rewritten from its source and documentation: sole developer; FastAPI, Argon2id, RFC 6238 TOTP admin MFA, 18 endpoints; fail-closed pipeline (gitleaks, Semgrep, syft, grype); **local Kubernetes (k3d)** with restricted pods and default-deny NetworkPolicies; verified outcomes; documented accepted gaps. | Answers V2 (Kubernetes: yes) and R3 (the app uses TOTP). The repo still records the solo submission as an open lecturer decision; public text says “sole developer” only. |
| P3 | **FinBERT** rewritten: pre-registered protocol, stratified 45-sentence sample, LIME/SHAP, deletion interventions as a proxy, 95 tests, sanitised public copy. Includes the study’s own disclosure that AI coding assistants helped write code, tests and docs. | Remove the disclosure line if you prefer; results stay unpublished (A4). |
| P4 | **PRIYANSHU.EXE published as project 7** with a full case study (architecture, component explorer, intent-routing lab on the real engine, contracts, “AI, honestly”, challenges, dated evidence, roadmap). Role says “built with AI coding assistants”. The LLM Worker is described as built, tested with a mocked provider and **disabled**. | Evidence numbers are dated; update them when tests change. |
| P5 | **New skills** evidenced by the audit: C++17, Embedded Linux (Buildroot, U-Boot), Linux kernel drivers (C), Verified boot & disk integrity, mTLS & PKI, Fuzzing & sanitizers, Kubernetes, Containers & supply chain. C++, Kubernetes and Docker are no longer listed as gaps in the job matcher. | |
| P6 | **Chat copy**: greeting (“Hey! 👋 I’m Priyanshu’s pet bot 🐯 / Want to explore his work?”), opening line, quick replies, the short reply lines in `src/islands/petbot/chat.ts`; “best projects” now lists the featured projects first. | Tone only; facts still come from the records. |
| P7 | **Not touched** (no local source exists): Test Simulator Allocator, GMRE Log Parser, Support Ticket Reporting Pipeline keep their owner-reported wording. | Send public-safe facts to strengthen them. |

## Part 6 · Positioning and recruiter experience (`feat/v2-positioning`, local only)

Nothing here adds a fact that is not already in the records; the new copy rephrases them. Empty slots render
nothing until you fill them (`period`, language `level`, `resumePdf` in `src/data/profile.ts`).

| # | Item | Status / what I need |
|---|---|---|
| Q1 | **Dates** for Nokia (start) and the DHBW programme (start–expected end). | **Missing.** No record has them; the résumé shows none. Not inferred from anything. |
| Q2 | **Languages**: only “English” is recorded, with no level. | **Missing.** Send every language with a CEFR level (e.g. “German · B2”). Shown only once added. |
| Q3 | **Degree type**: the site says “Duales Studium Informatik” and “Computer Science, dual study”, never “Bachelor” or “B.Sc.”. | Confirm the degree (e.g. B.Sc. Informatik) if you want it shown. A unit test blocks “Bachelor/B.Sc.” until then. |
| Q4 | **“Technical focus: cybersecurity and applied AI/ML”**: worded as your focus, not an official DHBW track. Courses named: Security by Design (SecureMed), Explainable AI (FinBERT). | Confirm the wording and the two course names. |
| Q5 | **Homepage introduction** (78 words): “I’m a software engineer at Nokia and a dual Computer Science student at DHBW Stuttgart, focused on cybersecurity and applied AI.” · “At Nokia, I build automation and diagnostic tooling for engineering workflows: allocating shared test simulators to automation agents, ingesting nested diagnostic logs, and automating reporting.” · “In my studies and own labs, I build secure and explainable systems, from a threat-modelled web app with MFA and gated CI/CD to a verified-boot embedded controller and LIME/SHAP studies on FinBERT.” | Approve or edit. Each clause maps to a published record. |
| Q6 | **Headline, title, tags**: “Reliable systems. Secure software. Explainable AI.” · “Software Engineer \| Cybersecurity & Applied AI/ML” · tags Software engineering, Cybersecurity, AI / machine learning, Systems automation · masthead “Field notes on systems, security & AI”. | Approve. |
| Q7 | **Signature**: “Builder by nature, hustler by schedule. Engineering at Nokia and a Computer Science degree, in alternating phases.” (“hustler” appears only here). | Approve, soften or drop. |
| Q8 | **Résumé summary** (3 lines) and **Nokia bullets** (3): allocation and scheduling logic for shared test simulators; GMRE (plugin-based, stream-reads nested archives, SHA-256 duplicate skipping, typed records for dashboards); weekly KPI reporting automated with Power BI. No metrics. | Approve. The bullets restate R2, R6, R7 and the GMRE record. |
| Q9 | **Employer wording**: “Nokia · Support-engineering tooling”, title “Software Engineer (dual study)”. “Nokia Optics” stays off the site (A3). | Confirm the unit name and job title as they appear on your contract or LinkedIn. |
| Q10 | **CV line**: no PDF is published; the résumé says “Full CV on request” and `/resume/` prints the page itself. | Confirm, or send an approved PDF for `public/` + `resumePdf`. |
| Q11 | **Skills & languages section and résumé skills**: five groups (Software & systems, Cybersecurity, AI & machine learning, Automation & reliability, Platforms & infrastructure), each entry linked to the projects that list the skill, marked Nokia / DHBW / Own. Two entries rest on project text rather than a skill tag: “Retrieval & intent routing” (PRIYANSHU.EXE guide: BM25 + intent matching) and “AI-assisted engineering” (FinBERT and PRIYANSHU.EXE both disclose AI coding assistants). LLM agents, RAG and MCP are **not** listed: no published project evidences them. | Approve the groups and the two text-based entries. |
| Q12 | **Domain blurbs**: Security → “Threat models, authentication, verified boot and pipelines that refuse to ship vulnerabilities.” · AI → “Transformer models, explainability and retrieval: AI that has to show its evidence.” (replaces R8’s AI blurb). | Approve. |
| Q13 | **Recruiter Mode** is now the résumé (header, summary, experience, selected projects, skills, education, languages) with Email, Match a job description, Print/PDF, All case studies and Exit. The old “in 60 seconds” sheet and its outcomes list are gone; outcomes stay on the case studies with their sources. | Layout only. |

Technical (no approval needed): the hero name is now sized from the portrait’s position, so the portrait overlaps
only the edge of the last letter at every width (it previously hid “shu” on 1500–2560 px screens). Islands and
GSAP hydrate after the first contentful paint (`client:afterpaint`), which brought mobile LCP from 3.5 s to
2.2–2.3 s in Lighthouse.

## Part 7 · Master brief: identity, skills, labs (`feat/v2-master`, local only)

| # | Item | Status / what I need |
|---|---|---|
| M1 | **Identity**: “Software Engineering · Cybersecurity · AI & Machine Learning”; headline “Building intelligent, secure systems.”; title “Software Engineer \| Cybersecurity · AI & Machine Learning”; new intro (79 words) and résumé summary. “Applied AI” removed from branding. | Approve. Supersedes Part 6 Q5–Q6. |
| M2 | **Human languages** (owner statement, 2026-11-21): Hindi native; German full professional proficiency, used in university studies and professional work; English fluent (C1). | Implemented as stated. Supersedes Part 6 Q2. |
| M3 | **Allocation project title**: the requested title contains an identifier that the confidential-term gate blocks. Public title: “Dynamic Test-Resource Allocation”. The requested title and the steps to publish it are in the private review folder (`../review/TITLE_APPROVAL.md`). | **Needs Nokia/manager authorisation** before the identifier can be published. |
| M4 | **Planned project** “Infrastructure Capacity & Hardware Cost Optimization”: status Planned · early research, no results, skills or lab; category set to *personal* with no organisation. | **Question:** is this planned at Nokia or independently? If Nokia, it becomes professional and needs clearance. |
| M5 | **Skills taxonomy**: 8 categories, every entry tied to published projects. Added from the source audit: C, Bash, JavaScript, REST APIs, SQLite, Docker, Linux, Git & GitHub, GitHub Actions, pandas, NumPy, PyTorch, Hugging Face Transformers, Playwright, Linux security hardening, Claude Code (tool), OpenAI Codex (tool), AI-assisted software engineering, multi-agent systems (exploration). RAG is labelled exploration (retrieval real, no model). | Approve. |
| M6 | **Not shown (no evidence found)**: Grafana, Prometheus, Telegraf, OpenTelemetry, Azure, Vercel, Flask, TensorFlow, PostgreSQL, Google Gemini, MCP. | Point me to public-safe work for any of these and it becomes an entry. |
| M7 | **BREACH MODE** (`/security-lab/`) and **AI Systems Lab** (`/ai-lab/`): new pages, header links and guide topics; tiger line “Want to see what your browser reveals about you? 🐯 You’re in control.” | Approve copy and placement. |
| M8 | **Content-Security-Policy** on every page (meta, hashed inline scripts). Styles still allow inline CSS; `frame-ancestors` and reporting need real headers (not possible on GitHub Pages). | Technical; no approval needed. |

## Part 8 · v2.1 release pass (`release/v2.1-rc`, local only)

| # | Item | Status / what I need |
|---|---|---|
| R1 | **German translation** of all page text, project summaries/roles/problems/disclosures, profile, résumé, skills, tiger replies (`src/data/de.ts`, `src/i18n/`). Long case-study details, the X-Ray body and the lab internals stay English behind a visible notice. | Please read the German pages once; wording like “Verhandlungssicher” (German) and “Hustler nach Stundenplan” is yours to approve. |
| R2 | **Tiger greeting** exactly as briefed, with typographic apostrophes: “Hey there! 🐯 I’m Priyanshu’s pet bot. Want to explore his work?” / “Hey! 🐯 Ich bin Priyanshus kleiner Bot. Möchtest du seine Projekte entdecken?” | Approve. |
| R3 | **Analytics**: GoatCounter integration is built but **off**. No public number is shown. Enabling needs your account, two repository variables and (likely) a privacy notice; see `docs/ANALYTICS.md`. | Decide whether to enable; get privacy advice first. |
| R4 | **Header/menu**: link row, ⌘K palette and the header Guide button removed; the tiger opens the guide. | Approve. |
| R5 | **Hero**: field-notes strip removed; name ~20% smaller; portrait aligned to the grid. | Approve from screenshots. |
| R6 | **Release blocker, published history**: 9 terms from the confidential list occur in older commits of the published `main` history (from the V1 site era; not in the current files). Pushing this release does not add any, but they remain public in history. | Your decision: accept, or plan a history rewrite of `main` (destructive; see the release report). |
| R7 | **Release blocker, paid Worker**: the old `portfolio-ai` Cloudflare Worker still answers (GET 405, OPTIONS 204). Nothing on the site calls it, but it can still receive requests. | Delete it or revoke its API key in your Cloudflare/Anthropic accounts. |

## Not published (by design)

FinBERT study numbers · scheduler outcome metrics · Agent Arena results · availability dates · employment and study dates · language levels · a résumé PDF
(`profile.resumePdf` is null) · private repository content · credentials · customer data.
