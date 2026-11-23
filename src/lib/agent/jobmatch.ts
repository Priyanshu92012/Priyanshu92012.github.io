// compareToJob: requirement → evidence matrix. Deterministic and grounded:
// every "strong"/"partial" cell points at a published project; gaps are stated.
// It is an evidence-coverage view, NOT an applicant score (plan §5).
import { projectsWithSkill, getSkill, STATUS_LABEL, EVIDENCE_LABEL, EVIDENCE_RANK, type Project } from '../../data/index';
import { detectSkills } from './search';
import { MAX_JOB_CHARS } from './constants';
import type { JobMatch } from './protocol';

export const UNEVIDENCED_TECH = ['java', 'kotlin', 'golang', 'rust', 'c#', '.net', 'aws', 'azure', 'gcp', 'google cloud', 'terraform', 'spark', 'kafka', 'scala', 'swift', 'php', 'ruby', 'angular', 'spring', 'snowflake', 'airflow', 'tensorflow', 'graphql', 'redis', 'mongodb', 'elasticsearch'];

type Req = { text: string; priority: 'must' | 'nice' };

export function splitRequirements(input: string): Req[] {
  const text = input.slice(0, MAX_JOB_CHARS);
  let section: 'must' | 'nice' | 'skip' = 'must';
  const out: Req[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s\-*•·–—>]+|^\s*\d+[.)]\s*/g, '').trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const words = line.split(/\s+/).length;
    // A heading ends with ":" or is a short, known section title, so "Excellent communication skills" is NOT a heading.
    const heading = /:$/.test(line) || (words <= 4 && !/[.;]$/.test(line) && /^(\w+\s)?(requirements?|qualifications?|must.?haves?|nice.to.haves?|good to have|bonus|preferred|desirable|benefits|perks|what we offer|we offer|about (us|the role)|your profile|profile|responsibilities|your tasks|tasks|what you.ll do|what you bring|who you are|tech stack|aufgaben|wünschenswert)\b/i.test(line));
    if (heading) {
      if (/(nice to have|nice-to-have|bonus|a plus|preferred|desirable|wünschenswert|good to have)/.test(lower)) section = 'nice';
      else if (/(benefit|we offer|perks|about us|equal opportunity|how to apply|salary|compensation|why join)/.test(lower)) section = 'skip';
      else section = 'must';
      continue;
    }
    if (section === 'skip') continue;
    const sentences = line.length > 200 ? line.split(/(?<=[.;!?])\s+/) : [line];
    for (const s of sentences) {
      const t = s.trim();
      if (t.split(/\s+/).length < 3 || t.length > 320) continue;
      const nice = /(nice to have|is a plus|a plus|bonus|preferred|ideally|desirable)/i.test(t);
      out.push({ text: t, priority: nice ? 'nice' : section === 'nice' ? 'nice' : 'must' });
    }
  }
  const seen = new Set<string>();
  return out.filter((r) => { const k = r.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 16);
}

function rankProject(p: Project): number {
  const statusBonus = ['production', 'professional', 'open-source'].includes(p.status) ? 3 : 0;
  return EVIDENCE_RANK[p.evidence] * 10 + statusBonus + (p.tier === 'flagship' ? 1 : 0);
}

export function compareToJob(description: string): JobMatch {
  const reqs = splitRequirements(description);
  const tally = new Map<string, number>();
  const requirements = reqs.map((r) => {
    const skillIds = detectSkills(r.text);
    const lower = ` ${r.text.toLowerCase()} `;
    if (!skillIds.length) {
      const missing = UNEVIDENCED_TECH.filter((t) => lower.includes(` ${t}`) || lower.includes(`${t},`) || lower.includes(`(${t}`));
      if (missing.length) {
        return { ...r, strength: 'gap' as const, skills: [], evidence: [], note: `No public evidence of ${missing.join(', ')} in the portfolio.` };
      }
      return { ...r, strength: 'not-assessable' as const, skills: [], evidence: [], note: 'Not something project evidence can show (e.g. soft skills, language, location, years). Worth asking directly.' };
    }
    const evidence = [...new Map(skillIds.flatMap((id) => projectsWithSkill(id)).map((p) => [p.slug, p])).values()]
      .sort((a, b) => rankProject(b) - rankProject(a))
      .slice(0, 3);
    const strong = evidence.some((p) => EVIDENCE_RANK[p.evidence] >= 3 || ['production', 'professional', 'open-source'].includes(p.status));
    const weight = strong ? 2 : 1;
    for (const p of evidence) tally.set(p.slug, (tally.get(p.slug) ?? 0) + weight * (r.priority === 'must' ? 2 : 1));
    const yearsNote = /\d+\s*\+?\s*(years|yrs|jahre)/i.test(r.text) ? ' Years of experience are not something project evidence can verify.' : '';
    return {
      ...r,
      strength: strong ? ('strong' as const) : ('partial' as const),
      skills: skillIds.map((id) => ({ id, label: getSkill(id)!.label })),
      evidence: evidence.map((p) => ({ slug: p.slug, title: p.title, status: STATUS_LABEL[p.status], evidence: EVIDENCE_LABEL[p.evidence], url: `/work/${p.slug}/` })),
      note: (strong
        ? `Evidenced by ${evidence[0].title} (${STATUS_LABEL[evidence[0].status]}, ${EVIDENCE_LABEL[evidence[0].evidence].toLowerCase()}).`
        : `Only owner-reported or pending evidence so far: ${evidence.map((p) => p.title).join(', ')}.`) + yearsNote,
    };
  });

  const coverage = {
    strong: requirements.filter((r) => r.strength === 'strong').length,
    partial: requirements.filter((r) => r.strength === 'partial').length,
    gap: requirements.filter((r) => r.strength === 'gap').length,
    notAssessable: requirements.filter((r) => r.strength === 'not-assessable').length,
  };
  const readFirst = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => {
      const reqsHit = requirements.filter((r) => r.evidence.some((e) => e.slug === slug)).length;
      const ev = requirements.flatMap((r) => r.evidence).find((e) => e.slug === slug)!;
      return { slug, title: ev.title, url: ev.url, reason: `Covers ${reqsHit} of ${requirements.length} extracted requirements.` };
    });
  const caveats = [
    'This shows coverage by public portfolio evidence. It is not a suitability score.',
    'Owner-reported and pending items are labelled; ask for detail in an interview.',
  ];
  if (!requirements.length) caveats.unshift('No requirements could be extracted. Paste the requirements or qualifications section of the job description.');
  return { requirements, coverage, readFirst, caveats };
}
