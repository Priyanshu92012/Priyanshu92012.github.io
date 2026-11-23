// Professional positioning (profile copy), human languages and the skills taxonomy that the homepage,
// /skills/ and the résumé share with the Skills Constellation.
import { describe, expect, it } from 'vitest';
import { profile, projects, skillList, evidencedSkills, domainList } from '../../src/data/index';
import { taxonomy, humanLanguages, NOT_SHOWN, workKind } from '../../src/data/capabilities';
import { SKILL_CATEGORIES } from '../../src/data/constants';

const words = (s: string) => s.trim().split(/\s+/).length;

describe('positioning copy', () => {
  it('identity: Software Engineering · Cybersecurity · AI & Machine Learning, everywhere it is branded', () => {
    expect(profile.positioning).toBe('Software Engineering · Cybersecurity · AI & Machine Learning');
    expect(profile.headline).toBe('Building intelligent, secure systems.');
    expect(profile.title).toBe('Software Engineer | Cybersecurity · AI & Machine Learning');
    expect(profile.tags).toEqual(['Software engineering', 'Cybersecurity', 'AI & machine learning']);
    const branded = JSON.stringify([profile.title, profile.headline, profile.positioning, profile.lede, profile.intro, profile.summary, profile.tags, profile.focusAreas, profile.education, domainList]);
    expect(branded).not.toMatch(/applied ai/i);
  });

  it('introduction: 60–90 words in short paragraphs naming the role, the study and the focus', () => {
    const total = profile.intro.reduce((n, p) => n + words(p), 0);
    expect(total).toBeGreaterThanOrEqual(60);
    expect(total).toBeLessThanOrEqual(90);
    for (const p of profile.intro) expect(words(p), p).toBeLessThanOrEqual(35);
    const intro = profile.intro.join(' ');
    for (const term of ['Nokia', 'DHBW Stuttgart', 'cybersecurity', 'AI and machine learning']) expect(intro).toContain(term);
    expect(intro).not.toMatch(/passionate|innovation|production-deployed|senior/i);
  });

  it('education: the German programme name; cybersecurity is a technical focus, not an official track', () => {
    const edu = profile.education[0];
    expect(edu.programDe).toBe('Duales Studium Informatik');
    expect(edu.org).toBe('DHBW Stuttgart');
    expect(edu.focus).toBe('Technical focus: cybersecurity and AI/ML');
    expect(JSON.stringify(profile)).not.toMatch(/B\.?Sc|Bachelor|specialization in|major in/i);
  });

  it('“builder” leads; “hustler” appears once, in the signature only', () => {
    expect(profile.signature).toMatch(/^Builder\b/);
    expect(JSON.stringify(profile).toLowerCase().split('hustler').length - 1).toBe(1);
  });

  it('résumé summary: two or three short lines with no metrics', () => {
    expect(profile.summary.length).toBeGreaterThanOrEqual(2);
    expect(profile.summary.length).toBeLessThanOrEqual(3);
    for (const s of profile.summary) expect(words(s), s).toBeLessThanOrEqual(20);
    const copy = [...profile.intro, ...profile.summary, ...profile.experience.flatMap((e) => e.highlights)].join(' ');
    expect(copy).not.toMatch(/\d+\s?%|\b\d+x\b|\b\d+[,.]?\d*\s?(k|m)?\+?\s(users|customers|hours|tickets|engineers)\b/i);
  });

  it('human languages: exactly as stated by the owner; German is not native', () => {
    expect(humanLanguages.map((l) => [l.name, l.level])).toEqual([['Hindi', 'Native'], ['German', 'Full professional proficiency'], ['English', 'Fluent (C1)']]);
    expect(humanLanguages.find((l) => l.name === 'German')!.level).not.toMatch(/native/i);
  });

  it('dates and a CV PDF stay empty until approved', () => {
    for (const e of [...profile.experience, ...profile.education]) expect(e.period).toBeNull();
    expect(profile.resumePdf).toBeNull();
  });
});

describe('skills taxonomy', () => {
  it('shares the constellation’s data: every evidenced skill has a category and appears exactly once', () => {
    const inTaxonomy = taxonomy.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(inTaxonomy).size).toBe(inTaxonomy.length);
    for (const s of evidencedSkills()) {
      expect(s.category, `${s.id} needs a category`).toBeDefined();
      expect(inTaxonomy, s.id).toContain(s.id);
    }
    expect(taxonomy.map((g) => g.id)).toEqual(SKILL_CATEGORIES.filter((c) => taxonomy.some((g) => g.id === c)));
  });

  it('every item is evidenced by a published project that lists the skill, with matching kinds', () => {
    for (const g of taxonomy) for (const i of g.items) {
      expect(i.projects.length, i.label).toBeGreaterThan(0);
      for (const p of i.projects) {
        expect(projects).toContain(p);
        expect(p.skills, `${i.id} → ${p.slug}`).toContain(i.id);
      }
      const s = skillList.find((x) => x.id === i.id)!;
      if (s.basis === 'tool') expect(i.kinds).toEqual(['tool']);
      else if (s.basis === 'exploration') expect(i.kinds).toEqual(['exploring']);
      else expect(new Set(i.kinds)).toEqual(new Set(i.projects.map(workKind)));
    }
  });

  it('agentic AI is labelled truthfully: RAG and multi-agent are exploration, coding agents are tools', () => {
    const k = (id: string) => taxonomy.flatMap((g) => g.items).find((i) => i.id === id)?.kinds;
    expect(k('rag')).toEqual(['exploring']);
    expect(k('multi-agent')).toEqual(['exploring']);
    expect(k('claude-code')).toEqual(['tool']);
    expect(k('openai-codex')).toEqual(['tool']);
    expect(skillList.find((s) => s.id === 'rag')!.note).toMatch(/no language model/);
  });

  it('lists no candidate technology without evidence', () => {
    const labels = taxonomy.flatMap((g) => g.items.map((i) => i.label)).join(' | ');
    for (const t of NOT_SHOWN) expect(labels, t).not.toContain(t);
    expect(labels).not.toMatch(/Model Context Protocol|Gemini|Grafana|Prometheus/);
  });
});
