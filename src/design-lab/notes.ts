// Editorial notes for the /design-lab/ gallery. Qualitative comparison and the recommendation are
// written by hand; numbers in the gallery come from metrics.json (npm run lab:measure), not from here.
type Id = 'monolith' | 'orbit' | 'signal' | 'v2';

const notes = {
  intro:
    'Three new homepage directions, each built as a working prototype, next to the unchanged V2. All four use the same approved content. The three new ones share the same three flagship projects, the same portrait and the same pet bot, so the comparison is about design, not content.',
  rules: ['Same 3 flagship projects', 'Same portrait (your photo, unaltered)', 'Same scripted pet bot, no AI service', 'Synthetic demo data, labelled', 'noindex, local build only'],
  recommended: 'orbit' as Id,
  summaries: {
    monolith: 'Charcoal, platinum and one lime signal line. A twisted graphite tower (live WebGL on desktop, identical SVG elsewhere) stands behind your portrait; projects read like long-form feature stories with the live lab beside them.',
    orbit: 'Your portrait inside three project orbits. The rings pass behind your head and in front of your shoulders (real depth in WebGL, layered SVG without it). Each orbit moves like its project, and selecting one reveals the project.',
    signal: 'An ivory magazine: your name set monumentally behind a monochrome cover portrait, a live signal line, features as spreads (one inverted), and a table-of-contents capabilities page. No 3D at all.',
    v2: 'The current V2 homepage, unchanged: the Spatial Lab hero, the 13-project index, six feature rows, constellation, guide and X-Ray teasers.',
  } as Record<Id, string>,
  compare: [
    { label: 'Mood', values: { monolith: 'Quiet, architectural, premium', orbit: 'Immersive, alive, exploratory', signal: 'Editorial, confident, bold type', v2: 'Dense, technical, dashboard-like' } },
    { label: 'Signature element', values: { monolith: 'Twisted graphite tower with a lime scan line (WebGL)', orbit: 'Three-orbit gyroscope with depth occlusion (WebGL)', signal: 'Name behind the cover portrait + live signal line (SVG)', v2: '3D project floor + inspector' } },
    { label: 'Portrait', values: { monolith: 'Large cut-out, softly graded, in front of the tower', orbit: 'Centre of the composition, orbits pass around it', signal: 'Monochrome magazine cover, overlapping the name', v2: 'Not on the homepage (About page only)' } },
    { label: 'Projects on the homepage', values: { monolith: '3 feature stories', orbit: '3 orbits + 3 chapters', signal: '3 spreads', v2: '13 in the index + 6 features' } },
    { label: 'How depth is revealed', values: { monolith: '“Read the story” per project', orbit: 'Select an orbit, then “Mission notes”', signal: '“Read the technical notes”', v2: 'Everything visible at once' } },
    { label: 'Pet bot skin', values: { monolith: 'Platinum cub, lime tag, square panel', orbit: 'Orange cub, mint glow, glass panel', signal: 'Ink line-art cub, red accents, offset-shadow card', v2: 'V2 guide drawer (no mascot)' } },
    { label: 'Without WebGL / reduced motion', values: { monolith: 'Same shape as an SVG poster', orbit: 'Layered SVG rings, still with depth', signal: 'Static signal line; nothing else changes', v2: 'SVG lab poster' } },
    { label: 'Main risk', values: { monolith: 'Can feel restrained if the tower does not render on a slow device', orbit: 'Most moving parts; the most to maintain', signal: 'Light theme departs from the dark V2 identity', v2: 'Crowded first screen (the reason for V3)' } },
  ],
  recommendation: {
    title: 'Orbit, with Monolith as the calmer fallback',
    body: [
      'Orbit is the only concept where <b>your photograph and your work are one image</b>: three projects literally orbit you, each moving like what it is (reservations hopping between slots, requests stopping at security gates, attributions swelling and flipping sign). That is the “technically serious, creatively ambitious” sentence made visible. It also has the least text on the first screen, reveals projects only on interaction, and measured best: performance 92 (V2: 91), and the least JavaScript on a phone (115 KB vs V2’s 154 KB).',
      'Monolith is the most elegant and the safest: the strongest typography, the most negative space, and feature stories that give each flagship room. If Orbit feels too busy on a second look, Monolith is the one to take. Signal is the most distinctive brand, but it is the only light design, so “Explore All Projects” would drop visitors from an ivory magazine into the dark V2 pages until those are restyled.',
    ],
    points: [
      '<b>Pick Orbit</b> for the memorable, interactive first impression. Its rings and beads are built from one geometry file, so they are cheap to tune.',
      '<b>Pick Monolith</b> for quiet, premium confidence and the lowest maintenance.',
      '<b>Pick Signal</b> if you want an editorial identity and accept restyling the inner pages.',
      'A hybrid is possible later (Orbit’s hero above Monolith’s feature stories), but nothing has been merged: that is your call.',
      'Whichever you choose: the pet bot, the shared content model and the three live showcases carry over unchanged.',
    ],
  },
  findings: [
    '<b>Accessibility:</b> axe (WCAG 2.2 AA) finds 0 serious or critical issues on all four pages, and Lighthouse accessibility is 100 everywhere. The pet bot is a labelled dialog with a focus trap; Escape closes it and focus returns to the mascot. All of this is covered by <code>npm run test:lab</code> (34 checks).',
    '<b>Layout:</b> no horizontal scrolling at 1440, 820, 390 or 320 px. Intentional bleeds (the cover portrait, the Monolith figure) are clipped inside their section.',
    '<b>Fallbacks:</b> without JavaScript every project, link and detail is visible. With reduced motion nothing loops and no WebGL starts. Without WebGL the same shapes render as SVG. Phones get the static versions, with 3D as an opt-in.',
    '<b>Performance (Lighthouse 12, mobile, simulated slow 4G, median of 3):</b> Monolith 90, Orbit 92, Signal 90, V2 91 in the same run. CLS 0 and TBT 0 ms on the concepts.',
    '<b>LCP is the open issue:</b> 3.2–3.3 s for the concepts vs 3.2 s for V2 in the same run, so all four miss the 2.5 s target in this simulation. On the concepts the LCP element is the portrait. Unthrottled it paints in about 0.4 s; the simulated time is dominated by the 450 ms simulated server response and slow-4G transfer of the HTML, fonts and image. Next steps if this matters for the winner: one fewer webfont on the first screen, and an even smaller first portrait.',
    '<b>SEO 69</b> on the concepts comes only from their deliberate <code>noindex</code> (the one failing audit is “is-crawlable”). V2 scores 100.',
    '<b>Privacy and cost:</b> 0 requests to other hosts on every page; no AI service, no API key, no analytics. The pet bot is scripted over the approved records.',
    '<b>Not tested:</b> real phones, Safari and Firefox (Chrome only, with software WebGL). Lighthouse numbers vary by about ±0.4 s LCP between runs on this Mac.',
    '<b>Needs your decision:</b> CONTENT_APPROVAL.md Part 3 (portrait, new layout copy, pet bot voice) and Kubernetes for SecureMed, which is not in the approved record and is therefore not shown.',
  ],
};

export default notes;
