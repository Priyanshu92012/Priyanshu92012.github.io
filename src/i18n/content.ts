// Localized views of the content model. English comes from src/data, German from src/data/de.ts.
import { profile, getSkill, STATUS_LABEL, EVIDENCE_LABEL, type Project } from '../data/index';
import { SKILL_CATEGORY_LABEL, type SkillCategory } from '../data/constants';
import { PROJECT_DE, PROFILE_DE, STATUS_DE, EVIDENCE_DE, CATEGORY_DE, SKILL_DE, SKILL_NOTE_DE } from '../data/de';
import type { Locale } from './index';

export const statusLabel = (s: Project['status'], lang: Locale) => (lang === 'de' ? STATUS_DE[s] : STATUS_LABEL[s]);
export const evidenceLabel = (e: Project['evidence'], lang: Locale) => (lang === 'de' ? EVIDENCE_DE[e] : EVIDENCE_LABEL[e]);
export const categoryLabel = (c: SkillCategory, lang: Locale) => (lang === 'de' ? CATEGORY_DE[c] : SKILL_CATEGORY_LABEL[c]);
export const skillLabel = (id: string, lang: Locale) => (lang === 'de' && SKILL_DE[id]) || getSkill(id)?.label || id;
export const skillNote = (id: string, lang: Locale) => (lang === 'de' ? SKILL_NOTE_DE[id] : getSkill(id)?.note);

export function projectText(p: Project, lang: Locale) {
  const de = lang === 'de' ? PROJECT_DE[p.slug] : undefined;
  return {
    summary: de?.summary ?? p.summary,
    role: de?.role ?? p.role,
    problem: de?.problem ?? p.problem,
    demoTitle: de?.demoTitle ?? p.demo?.title,
    demoDisclosure: de?.demoDisclosure ?? p.demo?.disclosure,
    org: lang === 'de' && p.org === 'Personal lab project' ? 'Persönliches Laborprojekt' : p.org,
  };
}

/** The profile fields pages render, in one language. */
export function profileText(lang: Locale) {
  const exp = profile.experience[0];
  const edu = profile.education[0];
  if (lang === 'en') {
    return {
      title: profile.title, headline: profile.headline, positioning: profile.positioning, focusAreas: [...profile.focusAreas],
      lede: profile.lede, intro: [...profile.intro], summary: [...profile.summary], tags: [...profile.tags], signature: profile.signature,
      location: profile.location,
      languages: profile.languages.map((l) => ({ name: l.name, level: l.level, note: l.note })),
      exp: { org: exp.org, unit: exp.unit, title: exp.title, location: exp.location, period: exp.period, summary: exp.summary, highlights: [...exp.highlights] },
      edu: { org: edu.org, program: edu.program, programDe: edu.programDe, focus: edu.focus, period: edu.period, summary: edu.summary, coursework: edu.coursework.map((c) => ({ ...c })) },
      principles: profile.principles.map((p) => ({ ...p })),
    };
  }
  const D = PROFILE_DE;
  return {
    title: D.title, headline: D.headline, positioning: D.positioning, focusAreas: [...D.focusAreas],
    lede: D.lede, intro: [...D.intro], summary: [...D.summary], tags: [...D.tags], signature: D.signature,
    location: D.location,
    languages: profile.languages.map((l) => D.languages[l.name] ?? { name: l.name, level: l.level ?? '', note: l.note }),
    exp: { org: exp.org, unit: D.experience.unit, title: D.experience.title, location: exp.location, period: exp.period, summary: D.experience.summary, highlights: [...D.experience.highlights] },
    edu: { org: edu.org, program: D.education.program, programDe: edu.programDe, focus: D.education.focus, period: edu.period, summary: D.education.summary, coursework: edu.coursework.map((c) => ({ ...c, course: D.education.coursework[c.course] ?? c.course })) },
    principles: profile.principles.map((p) => D.principles[p.title] ?? p),
  };
}
