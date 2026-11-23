// V3 design lab: Priyanshu's Pet Bot is a scripted layer over the deterministic guide.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PET_QUESTIONS, petReply, splitAnswer, compactList, PROJECT_OFFERS } from '../../src/islands/petbot/logic';
import { flagships, intro, capabilities, explore } from '../../src/design-lab/content';
import { isAllowedHref } from '../../src/lib/guide/links';
import { answer } from '../../src/lib/guide/index';
import { profile, projects, getProject } from '../../src/data/index';

describe('pet bot questions', () => {
  it('asks exactly the nine owner-specified questions', () => {
    expect(PET_QUESTIONS.map((q) => q.question)).toEqual([
      'Who is Priyanshu?', 'What does he do at Nokia?', 'What are his coolest projects?', 'What AI experience does he have?',
      'What cybersecurity work has he done?', 'What technologies does he use?', 'Tell me about his education.',
      'Why should I hire him?', 'How can I contact him?',
    ]);
  });

  it('routes each question to its curated intent with a short summary and actions', () => {
    for (const q of PET_QUESTIONS) {
      const r = petReply(q.question);
      expect(r.answer.route, q.question).toBe('curated');
      expect(r.answer.intent, q.question).toBe(q.id);
      expect(r.lead.length, q.question).toBeGreaterThan(5);
      expect(r.summary.length, q.question).toBeGreaterThan(30);
      expect(r.actions.length + r.links.length, q.question).toBeGreaterThan(1);
      for (const a of [...r.actions.map((x) => x.href), ...r.links.map((x) => x.href)]) expect(isAllowedHref(a), a).toBe(true);
    }
  });

  it('never duplicates a destination between links and actions', () => {
    for (const q of PET_QUESTIONS) {
      const r = petReply(q.question);
      const hrefs = [...r.links.map((l) => l.href), ...r.actions.map((a) => a.href)];
      expect(new Set(hrefs).size, q.question).toBe(hrefs.length);
    }
  });

  it('nothing is dropped: every block of the answer is in the summary or the details', () => {
    for (const q of PET_QUESTIONS) {
      const r = petReply(q.question);
      const shown = `${r.summary}\n\n${r.more}`;
      for (const b of r.answer.text.split(/\n{2,}/).filter((x) => x.trim())) expect(shown, q.question).toContain(b);
    }
    expect(splitAnswer('One.\n\nTwo.\n\nThree.')).toEqual({ summary: 'One.\n\nTwo.', more: 'Three.' });
  });

  it('keeps summaries short by compacting project lists to titles and labels', () => {
    expect(compactList('- **SecureMed** (Academic · owner-reported): Course project on …\n- **Proof beats claims.** Every project …'))
      .toBe('- **SecureMed** (Academic · owner-reported)\n- **Proof beats claims.**');
    const best = petReply('What are his coolest projects?');
    expect(best.summary.length).toBeLessThan(best.answer.text.length / 2);
    expect(best.more).toContain('allocation and scheduling work at Nokia');
    for (const q of PET_QUESTIONS) expect(petReply(q.question).summary.length, q.question).toBeLessThan(520);
  });

  it('keeps the honest fallback for questions it does not cover', () => {
    const r = petReply('What is his favourite pizza?');
    expect(r.answer.route).toBe('unknown');
    expect(r.lead).toMatch(/won’t guess/);
  });

  it('named projects get project actions, including the lab when one exists', () => {
    const r = petReply('Tell me about SecureMed');
    expect(r.answer.route).toBe('project');
    const hrefs = [...r.links.map((l) => l.href), ...r.actions.map((a) => a.href)];
    expect(hrefs).toEqual(expect.arrayContaining(['/work/securemed/', '/work/securemed/#demo', '/work/']));
  });

  it('offers exist for every design-lab flagship and only for published projects', () => {
    for (const f of flagships) expect(PROJECT_OFFERS[f.slug], f.slug).toBeDefined();
    for (const slug of Object.keys(PROJECT_OFFERS)) expect(getProject(slug), slug).toBeDefined();
  });

  it('the V2 guide still answers its original phrasings the same way', () => {
    expect(answer('What are his best projects?').intent).toBe('best');
    expect(answer('What are his coolest projects?').intent).toBe('best');
    expect(answer('What makes his engineering work interesting?').intent).toBe('interesting');
  });
});

describe('design lab content', () => {
  it('features exactly the three owner-chosen flagships, in order', () => {
    expect(flagships.map((f) => f.slug)).toEqual(['test-resource-scheduler', 'securemed', 'finbert-xai']);
  });

  it('derives every flagship claim from the approved record', () => {
    for (const f of flagships) {
      const p = getProject(f.slug)!;
      expect(p.summary.startsWith(f.line), f.slug).toBe(true);
      expect(f.title).toBe(p.title);
      if (f.problem) expect(f.problem).toBe(p.problem);
      for (const a of f.approach) expect(p.approach).toContain(a);
      expect(f.tech.length).toBeGreaterThanOrEqual(3);
      expect(f.honesty.length).toBeGreaterThan(40);
    }
  });

  it('labels the demos honestly', () => {
    const by = Object.fromEntries(flagships.map((f) => [f.slug, f.honesty]));
    expect(by['finbert-xai']).toMatch(/NOT FinBERT/);
    expect(by.securemed).toMatch(/not the course application/);
    expect(by['test-resource-scheduler']).toMatch(/Not Nokia code/);
  });

  it('uses approved profile copy and data-derived counts', () => {
    expect(intro.lede).toBe(profile.lede);
    expect(intro.headline).toBe(profile.headline);
    expect(explore.projects).toBe(projects.length);
    expect(capabilities).toHaveLength(4);
  });

  it('design-lab sources never mention unapproved technology claims', () => {
    // Kubernetes is not in the SecureMed record; it must not be presented until the owner approves it.
    // (notes.ts is the gallery's open-items commentary, which names it precisely to say it is not shown.)
    const dir = join(__dirname, '../../src/design-lab');
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : /\.(ts|tsx|astro|css)$/.test(e.name) && e.name !== 'notes.ts' ? [join(d, e.name)] : []);
    const files = walk(dir);
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/kubernetes|k8s/i);
  });
});
