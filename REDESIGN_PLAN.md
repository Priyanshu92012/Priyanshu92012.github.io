# REDESIGN_PLAN.md — FAANG-Recruiter-Clean Minimal

> **Scope:** `index.html` only. `terminal.js` and `worker/` are untouched.
> **Branch:** `redesign/faang-minimal`
> **Process:** One commit per step below. Test 375px mobile before each commit.

---

## Constraints (hard)

- Preserve DOM IDs: `termOutput`, `termInput`, `termWindow`, `termMobileBtn`, `termCloseBtn`
- Preserve CSS class semantics: `.term-line`, `.term-line.cmd`, `.out`, `.err`, `.ai`, `.muted`, `.blank`
- Preserve `body.term-open` toggle logic (inline `<script>` handlers untouched)
- Preserve `terminal.js` `<script>` tag (line 737)
- Do NOT change WORKER_URL in terminal.js

---

## Target design system

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#ffffff` | `#0f1117` |
| `--bg-elev` | `#f7f7f8` | `#1a1d27` |
| `--fg` | `#0f1117` | `#f0f0ee` |
| `--fg-soft` | `#4b5563` | `#9ca3af` |
| `--fg-mute` | `#9ca3af` | `#4b5563` |
| `--line` | `#e5e7eb` | `#1f2330` |
| `--accent` | `#2563eb` | `#3b82f6` |

Fonts: `Inter` (300/400/500/600) + `JetBrains Mono` (400/500) — both from Google Fonts CDN.
Drop: Bricolage Grotesque, Geist.

---

## Build order

### Step 0 — Create branch
```
git checkout -b redesign/faang-minimal
```
No file changes; just branching.

---

### Step 1 — Fonts + CSS custom properties
**Commit:** `redesign: swap fonts to Inter, replace CSS tokens`

Changes:
- Google Fonts link → Inter + JetBrains Mono only
- `:root` → new token set (light-mode values)
- Add `@media (prefers-color-scheme: dark) { :root { ... } }` with dark overrides
- Update `body` font-family to `'Inter', system-ui, sans-serif`
- Remove `.display`, `.mono`, `.accent`, `.gradient` class definitions
  (these will be inlined where needed or removed from HTML)
- Update `::selection` to use `--accent`

---

### Step 2 — Nav
**Commit:** `redesign: minimal nav`

Changes:
- Logo: plain `Inter` weight-600, no Bricolage override, no colored dot
  → `priyanshu` in `--fg`, nothing special
- Nav links: `font-size: 14px`, `color: var(--fg-soft)`, hover `color: var(--fg)`
- Remove `.logo span { color: var(--accent) }` (the violet dot after "priyanshu")
- Nav padding: `24px 0`
- HTML: change `<a href="/" class="logo">priyanshu<span>.</span></a>` → `<a href="/" class="logo">Priyanshu</a>`

---

### Step 3 — Hero: collapse to single column
**Commit:** `redesign: single-column hero, remove 3-column grid`

Changes:
- Remove `.hero` grid → block, `padding: 80px 0 64px`, `max-width: 680px`
- Remove `.hero-left`, `.hero-right`, `.hero-overline` (the `// hello, I'm` labels)
- New hero HTML structure:
  ```
  <section class="hero">
    <p class="hero-eyebrow">Software Engineer · Nokia Optics · Stuttgart</p>
    <h1 class="hero-name">Priyanshu</h1>
    <p class="hero-sub">Building intelligent systems on top of telecom data.</p>
    <div class="hero-links">
      [Work ↓]  [GitHub ↗]  [LinkedIn ↗]  [Email ↗]
    </div>
  </section>
  ```
- `.hero-eyebrow`: JetBrains Mono, 13px, `--fg-mute`, `margin-bottom: 24px`
- `.hero-name`: Inter 700, `clamp(56px, 10vw, 96px)`, `letter-spacing: -0.04em`, `--fg`, `margin-bottom: 16px`
- `.hero-sub`: 18px, `--fg-soft`, `max-width: 480px`, `margin-bottom: 40px`
- `.hero-links`: `display: flex; gap: 24px; flex-wrap: wrap`
  - `[See work ↓]` → `href="#work"`, `color: var(--fg)`, underline on hover
  - `[Email ↗]` → `href="mailto:..."`, `color: var(--accent)`
  - GitHub and LinkedIn stay in contact section only — not in hero
- CSS: remove `.hero-left`, `.hero-right`, `.hero-role`, `.hero-cta`, `.hero-overline`, `.hero-tag` rules
- Remove portrait section from hero HTML

---

### Step 4 — Remove portrait + glow
**Commit:** `redesign: remove portrait block`

Changes:
- Delete `.portrait-wrap`, `.portrait-glow`, `.portrait`, `.portrait-placeholder` CSS
- Delete `@keyframes glowPulse`
- Delete `.portrait-wrap` hero animation-delay rule
- Delete portrait `<div class="portrait-wrap">...</div>` from HTML
- Delete cursor parallax `<script>` block for `portrait-glow` (the `mousemove` listener)
- Keep the IntersectionObserver block and terminal handlers

---

### Step 5 — Remove socials band
**Commit:** `redesign: remove socials icon band`

Changes:
- Delete `.socials`, `.socials a` CSS
- Delete `<div class="socials">...</div>` HTML block
- Social links already present in hero-links (Step 3) and contact section — no info lost

---

### Step 6 — Section headers: remove decorative numbers + italic em
**Commit:** `redesign: clean section headers`

Changes:
- `.section-head`: `margin-bottom: 48px`
- `.section-head .num`: remove entirely (delete CSS, delete `<span class="num">` from all section heads)
- `.section-head h2`: Inter 600, `clamp(28px, 4vw, 40px)`, `letter-spacing: -0.02em`, `color: var(--fg)`
- HTML: `<h2>Selected <em>projects</em>.</h2>` → `<h2>Work</h2>`
- HTML: `<h2>The <em>short</em> version.</h2>` → `<h2>About</h2>`
- HTML: `<h2>Get in <em>touch</em>.</h2>` → `<h2>Contact</h2>`
- Remove `em { font-style: italic; color: var(--accent) }` rule from section-head h2

---

### Step 7 — Work list rows
**Commit:** `redesign: work list minimal style`

Changes:
- `.work-row`: `grid-template-columns: 1fr auto`; remove 60px num column; keep `↗` arrow
  → `display: grid; grid-template-columns: 1fr 24px; gap: 24px; padding: 28px 0`
- `.work-row .num`: remove CSS + delete `<span class="num">` from HTML
- `.work-row h3`: Inter 600, `20px`, `--fg`, `margin-bottom: 6px`, no Bricolage
- `.work-row .desc`: `14px`, `--fg-soft`, `line-height: 1.6`, `max-width: 560px`
- `.work-row .stack`: keep; `JetBrains Mono 11px`, `--fg-mute`, text-align right
  → only show status chip + first tech line; second line drops on mobile
- `.work-row .arr`: `--fg-mute`; hover → `--accent`
- Hover effect: remove padding shift; just `border-top-color: var(--accent)` on hover → cleaner
- `.work-row:hover { border-top-color: var(--accent); }` (add transition)

---

### Step 8 — About section
**Commit:** `redesign: about section single-column`

Changes:
- `.about-grid`: remove 2-column grid → single column, `max-width: 680px`
- `.about-prose p`: Inter 400, `17px`, `line-height: 1.7`, `--fg-soft`, `margin-bottom: 16px`
- `.about-prose p .hl`: `color: var(--fg); font-weight: 500`
- `.about-stack`: move below prose with `margin-top: 40px`; horizontal flex on desktop
  → `display: flex; flex-wrap: wrap; gap: 40px`
- `.stack-group .label`: JetBrains Mono 10px, `--accent`, `letter-spacing: 0.18em`
- `.stack-group .items`: `14px`, `--fg-soft`

---

### Step 9 — Contact section
**Commit:** `redesign: contact section minimal`

Changes:
- `.contact-wrap`: single-column (remove 2-column grid); keep contact-list rows
- Delete `.contact-lead` block from HTML (the big "Let's build something good" display)
- Delete `.contact-lead` CSS
- Add after `<h2>Contact</h2>`:
  `<p class="contact-intro">The fastest way to reach me is email.</p>`
  Style: `font-size: 16px; color: var(--fg-soft); margin-bottom: 32px`
- `.contact-list` sits directly under `.contact-intro`
- `.contact-row`: keep grid `80px 1fr auto`; clean up padding to `16px 0`
- `.contact-row:hover`: remove padding shift; just accent-color on `.v` and `.arr`
- Remove `border-bottom` on last row (keep top borders only)

---

### Step 10 — Terminal chrome
**Commit:** `redesign: terminal chrome — remove macOS dots, new header`

Changes to HTML:
- Replace `<div class="term-bar">` contents:
  - Remove `.term-dots` and the three `<span class="term-dot">` elements
  - Replace `.term-title` with `<span class="term-header-text">Ask anything about Priyanshu</span>`
  - Keep `<button class="term-close-btn" id="termCloseBtn">× close</button>`
- Mobile: change `<button class="term-mobile-btn" id="termMobileBtn">` text to `Ask AI ↗`

Changes to CSS:
- `.term-bar`: `padding: 14px 20px`; `justify-content: space-between`
- `.term-dots`, `.term-dot`, `.term-dot.r/y/g`: delete
- `.term-title` → rename to `.term-header-text`: Inter 500, 13px, `--fg-soft`
- `.term-window`: `border-radius: 8px`; border `1px solid var(--line)`
- `.term-mobile-btn`: stays same structure (ID preserved); update styling to match new palette
- `.term-close-btn:hover`: `color: var(--accent); background: rgba(37,99,235,0.08)`
- `.term-line.cmd::before`: `content: '~ % '; color: var(--accent);` — no change
- `.term-line a`: `color: var(--accent)`

---

### Step 11 — Footer
**Commit:** `redesign: footer cleanup`

Changes:
- `footer`: Inter 12px, `--fg-mute`; keep `justify-content: space-between`
- Remove `font-family: 'JetBrains Mono'` override on footer (use body font)
- `border-top: 1px solid var(--line); padding: 24px 0; margin-top: 60px`

---

### Step 12 — Page max-width + section rhythm
**Commit:** `redesign: layout max-width + spacing`

Changes:
- `.page`: `max-width: 960px` (down from 1280px); `padding: 0 24px`
- `section.block`: `padding: 96px 0` (down from 120px)
- Hero: already `max-width: 680px` on inner content
- `.section-head`: `margin-bottom: 40px`
- `html`: add `font-size: 16px`

---

### Step 13 — Mobile responsiveness
**Commit:** `redesign: mobile pass at 375px`

Changes:
- `@media (max-width: 768px)` — tablet adjustments:
  - `.hero`: `padding: 48px 0 40px`
  - `.hero-name`: `clamp(44px, 14vw, 72px)`
  - `.hero-links`: `gap: 16px; font-size: 14px`
  - `section.block`: `padding: 64px 0`
  - `.work-row`: `gap: 12px; padding: 20px 0`
  - `.work-row .stack`: hide (`display: none`)
  - `.about-stack`: `flex-direction: column; gap: 24px`
  - `.contact-row .k`: width `60px`
  - `nav.top .links`: `gap: 16px`
  - Terminal mobile: `display: none` on `.term-window`, `display: flex` on `.term-mobile-btn`
  - `body.term-open` styles: unchanged

- `@media (max-width: 480px)` — phone-specific tightening:
  - `.page`: `padding: 0 16px`
  - `.hero-name`: `clamp(40px, 12vw, 56px)`
  - `section.block`: `padding: 48px 0`
  - `.about-stack`: `gap: 16px`
  - `nav.top .links`: `font-size: 12px; gap: 12px`
  - `.contact-row`: `grid-template-columns: 56px 1fr auto`

---

### Step 14 — Scroll reveal + hero animation
**Commit:** `redesign: simplify reveal animations`

Changes:
- `.reveal` transition: keep `opacity + translateY(16px)` but shorten to `600ms`
- Hero animation: replace per-child delays with single `animation: rise 800ms forwards` on `.hero`
- Remove individual `animation-delay` on `.hero-left`, `.hero-right`, `.portrait-wrap`
  (since portrait is gone, only one element needs rise animation now)
- Remove `.hero > *` selector; apply `animation` directly to `.hero`

---

### Step 15 — Final: HANDOFF update + push
**Commit:** `handoff: redesign/faang-minimal session complete`

Changes:
- Update `HANDOFF.md`: current phase, what changed, next tasks
- Merge branch into main, push

---

## Files changed across all steps

| File | Steps |
|------|-------|
| `index.html` | 1–14 |
| `HANDOFF.md` | 15 |
| `REDESIGN_PLAN.md` | this file (created now) |

**Never touched:** `terminal.js`, `worker/`, `projects/`, `assets/`

---

## Verification checklist (after Step 14)

- [ ] `help` command works in terminal
- [ ] `whoami`, `projects`, `cat gmre` — correct output
- [ ] AI fallthrough streams tokens (requires Anthropic credits)
- [ ] 375px mobile: page readable, terminal toggle button visible and functional
- [ ] Light mode (system set to light): white background, readable contrast
- [ ] Dark mode (system set to dark): near-black bg, readable contrast
- [ ] Nav links scroll to correct anchors
- [ ] GitHub + LinkedIn links open new tab
- [ ] No JS errors in console
- [ ] Tab completion still works (this is terminal.js — should be unaffected)
