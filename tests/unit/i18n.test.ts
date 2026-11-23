// English/German: complete dictionaries, every localized route present in the build plan, correct path
// mapping, German content for every public record, and the tiger replying in German.
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UI } from '../../src/i18n/ui';
import { localizePath, basePath, localeFromPath, isLocalized, LOCALIZED_ROUTES } from '../../src/i18n/index';
import { HOME } from '../../src/i18n/pages/home';
import { WORK } from '../../src/i18n/pages/work';
import { CASE } from '../../src/i18n/pages/case';
import { LAB } from '../../src/i18n/pages/lab';
import { SKILLS } from '../../src/i18n/pages/skills';
import { ABOUT } from '../../src/i18n/pages/about';
import { RC } from '../../src/i18n/pages/recruiter';
import { SEC, AIL } from '../../src/i18n/pages/labs2';
import { PRIVACY } from '../../src/i18n/pages/privacy';
import { PROJECT_DE, STATUS_DE, EVIDENCE_DE, CATEGORY_DE, PROFILE_DE } from '../../src/data/de';
import { projects, profile, STATUS_LABEL, EVIDENCE_LABEL } from '../../src/data/index';
import { SKILL_CATEGORIES } from '../../src/data/constants';
import { PET } from '../../src/islands/petbot/copy';
import { chat, ALL_TOPICS, quickLabel } from '../../src/islands/petbot/chat';
import { isAllowedHref } from '../../src/lib/guide/links';

const DICTS = { UI, HOME, WORK, CASE, LAB, SKILLS, ABOUT, RC, SEC, AIL, PET, PRIVACY };
/** Keys whose German text may legitimately equal the English (names and technical terms). */
const SAME_OK = /^(nav\.(breach|ailab|xray|skills)|nav\.recruiter\.short|foot\.stack|common\.lab|title|kicker|h|skills|status|colStack|lgWork|lgStudy|lgTool|k[1-7]|m5|moreSm|moreOl|breachKick|ctaRecruiter|recruiter|kPortfolio|aiTitle|cat|evidence|m1|m2|panelTitle|send|askQ|hostH|whoB)$/;

describe('dictionaries', () => {
  it('German has exactly the English keys, none empty', () => {
    for (const [name, d] of Object.entries(DICTS)) {
      expect(Object.keys(d.de).sort(), name).toEqual(Object.keys(d.en).sort());
      for (const [k, v] of Object.entries(d.de as Record<string, string>)) if (!(name === 'PET' && k === 'englishOnly')) expect(String(v).trim(), `${name}.${k}`).not.toBe('');
    }
  });
  it('German strings are translated, not copied (except names and technical terms)', () => {
    for (const [name, d] of Object.entries(DICTS)) {
      const copied = Object.keys(d.en).filter((k) => (d.en as Record<string, string>)[k] === (d.de as Record<string, string>)[k] && (d.en as Record<string, string>)[k].length > 12 && !SAME_OK.test(k));
      expect(copied, name).toEqual([]);
    }
  });
  it('placeholders match between languages', () => {
    for (const [name, d] of Object.entries(DICTS)) for (const k of Object.keys(d.en)) {
      const ph = (s: string) => (String(s).match(/\{\w+\}/g) ?? []).sort();
      expect(ph((d.de as Record<string, string>)[k]), `${name}.${k}`).toEqual(ph((d.en as Record<string, string>)[k]));
    }
  });
});

describe('content in German', () => {
  it('every published project, status, evidence level and taxonomy category has German text', () => {
    for (const p of projects) { expect(PROJECT_DE[p.slug], p.slug).toBeDefined(); expect(PROJECT_DE[p.slug].summary.length).toBeGreaterThan(60); if (p.demo) expect(PROJECT_DE[p.slug].demoDisclosure, p.slug).toBeTruthy(); }
    for (const s of Object.keys(STATUS_LABEL)) expect(STATUS_DE[s as keyof typeof STATUS_DE], s).toBeTruthy();
    for (const e of Object.keys(EVIDENCE_LABEL)) expect(EVIDENCE_DE[e as keyof typeof EVIDENCE_DE], e).toBeTruthy();
    for (const c of SKILL_CATEGORIES) expect(CATEGORY_DE[c], c).toBeTruthy();
  });
  it('the German profile keeps the facts: same number of intro paragraphs, bullets and languages; German is not “native”', () => {
    expect(PROFILE_DE.intro).toHaveLength(profile.intro.length);
    expect(PROFILE_DE.summary).toHaveLength(profile.summary.length);
    expect(PROFILE_DE.experience.highlights).toHaveLength(profile.experience[0].highlights.length);
    expect(PROFILE_DE.languages.German.level).not.toMatch(/mutter/i);
    expect(PROFILE_DE.positioning).toBe('Software Engineering · Cybersecurity · KI & Machine Learning');
    expect(JSON.stringify(PROFILE_DE)).not.toMatch(/angewandte KI|Bachelor|B\.?Sc/i);
  });
});

describe('routes', () => {
  it('maps paths both ways and keeps anchors', () => {
    expect(localizePath('/work/opticlab/#demo', 'de')).toBe('/de/work/opticlab/#demo');
    expect(localizePath('/de/work/opticlab/', 'en')).toBe('/work/opticlab/');
    expect(localizePath('/', 'de')).toBe('/de/');
    expect(localizePath('/de/', 'en')).toBe('/');
    expect(localizePath('/v1/', 'de')).toBe('/de/'); // English-only pages fall back to the German home
    expect(basePath('/de/skills/')).toBe('/skills/');
    expect(localeFromPath('/de/about/')).toBe('de');
    expect(localeFromPath('/design/')).toBe('en');
    expect(isLocalized('/de/work/securemed/')).toBe(true);
  });
  it('every localized route has a German page file', () => {
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));
    const de = files('src/pages/de').map((f) => f.replace('src/pages/de', '').replace(/index\.astro$/, '').replace('[slug].astro', '[slug]/'));
    for (const r of LOCALIZED_ROUTES) expect(de, r).toContain(r);
    expect(de).toContain('/work/[slug]/');
  });
});

describe('tiger in German', () => {
  it('greets with the exact sentences and never mentions the visitor', () => {
    expect(PET.en.greeting).toBe('Hey there! 🐯 I’m Priyanshu’s pet bot. Want to explore his work?');
    expect(PET.de.greeting).toBe('Hey! 🐯 Ich bin Priyanshus kleiner Bot. Möchtest du seine Projekte entdecken?');
    for (const g of [PET.en.greeting, PET.de.greeting]) expect(g).not.toMatch(/\b(ip|location|standort|zeitzone|time ?zone|browser|device|gerät)\b/i);
  });
  it('answers German questions in German with German links', () => {
    for (const [q, intent] of [['Wer ist Priyanshu?', 'who'], ['Was macht er bei Nokia?', 'nokia'], ['Welche Erfahrung hat er mit KI?', 'ai'], ['Wie kann ich ihn kontaktieren?', 'contact'], ['Kennt er Python?', 'skill:python']] as const) {
      const r = chat(q, 'de');
      expect(r.intent, q).toBe(intent);
      expect(r.text, q).not.toMatch(/\b(the|his|he is|and)\b/);
      for (const a of r.actions) if ('href' in a && a.href.startsWith('/')) { expect(a.href, q).toMatch(/^\/de\//); expect(isAllowedHref(a.href)).toBe(true); }
    }
    for (const t of ALL_TOPICS) expect(quickLabel(t, 'de'), t.q).not.toBe('');
  });
});
