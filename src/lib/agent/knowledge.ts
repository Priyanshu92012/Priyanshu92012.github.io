// Knowledge documents for retrieval, generated from the approved content model only.
// Nothing outside src/data reaches the agent (plan §7: never index private files).
import { profile, projects, skillList, projectsWithSkill, STATUS_LABEL, EVIDENCE_LABEL, getSkill, type Project } from '../../data/index';

export type KDoc = {
  id: string;
  title: string;
  text: string;
  /** extra matching terms (skill labels + aliases), not shown to users */
  keywords: string;
  url: string;
  kind: 'project' | 'profile' | 'skill' | 'site';
  projectSlug?: string;
};

function skillKeywords(p: Project): string {
  return p.skills.map((id) => { const s = getSkill(id); return s ? `${s.label} ${s.aliases.join(' ')}` : id; }).join(' ');
}

function projectDocs(p: Project): KDoc[] {
  const url = `/work/${p.slug}/`;
  const head = `${p.title}${p.org ? ` (${p.org})` : ''}`;
  const kw = `${p.title} ${p.shortTitle} ${skillKeywords(p)} ${p.domains.join(' ')}`;
  const docs: KDoc[] = [{
    id: `project:${p.slug}`, title: head, url, kind: 'project', projectSlug: p.slug, keywords: kw,
    text: `${head}. Status: ${STATUS_LABEL[p.status]}. Public evidence: ${EVIDENCE_LABEL[p.evidence]}. Role: ${p.role}. ${p.summary}${p.problem ? ` Problem: ${p.problem}` : ''}`,
  }];
  if (p.approach.length) docs.push({ id: `project:${p.slug}#approach`, title: `${p.shortTitle}: approach`, url: `${url}#approach`, kind: 'project', projectSlug: p.slug, keywords: kw, text: p.approach.join(' ') });
  if (p.decisions.length) docs.push({ id: `project:${p.slug}#decisions`, title: `${p.shortTitle}: decisions`, url: `${url}#decisions`, kind: 'project', projectSlug: p.slug, keywords: kw, text: p.decisions.map((d) => `Decision: ${d.decision}. Why: ${d.why}`).join(' ') });
  if (p.outcomes.length) docs.push({ id: `project:${p.slug}#outcomes`, title: `${p.shortTitle}: outcomes`, url: `${url}#outcomes`, kind: 'project', projectSlug: p.slug, keywords: kw, text: p.outcomes.map((o) => `${o.claim} (basis: ${o.basis}).`).join(' ') });
  const limits = [...p.limitations, p.confidentiality ?? '', p.demo ? `Demo: ${p.demo.title}. ${p.demo.disclosure}` : ''].filter(Boolean);
  if (limits.length) docs.push({ id: `project:${p.slug}#limits`, title: `${p.shortTitle}: limitations & disclosure`, url: `${url}#limits`, kind: 'project', projectSlug: p.slug, keywords: kw, text: limits.join(' ') });
  return docs;
}

let cache: KDoc[] | null = null;
export function knowledge(): KDoc[] {
  if (cache) return cache;
  const docs: KDoc[] = [];
  docs.push({
    id: 'profile:about', title: `About ${profile.name}`, url: '/about/', kind: 'profile', keywords: 'about bio who background summary introduce',
    text: `${profile.name}, ${profile.role} based in ${profile.location}. ${profile.headline} ${profile.lede}`,
  });
  docs.push({
    id: 'profile:experience', title: 'Professional experience', url: '/recruiter/#experience', kind: 'profile', keywords: 'experience job work employer nokia career professional industry',
    text: profile.experience.map((e) => `${e.title} at ${e.org} (${e.unit}), ${e.location}. ${e.summary}`).join(' '),
  });
  docs.push({
    id: 'profile:education', title: 'Education', url: '/recruiter/#education', kind: 'profile', keywords: 'education study degree university dhbw student academic',
    text: profile.education.map((e) => `${e.program} at ${e.org}. ${e.summary}`).join(' '),
  });
  docs.push({
    id: 'profile:principles', title: 'Engineering principles', url: '/about/#principles', kind: 'profile', keywords: 'principles philosophy values approach how works',
    text: profile.principles.map((p) => `${p.title}: ${p.body}`).join(' '),
  });
  docs.push({
    id: 'profile:contact', title: 'Contact', url: '/about/#contact', kind: 'profile', keywords: 'contact email reach hire linkedin github availability',
    text: `Email ${profile.links.emailLabel}. LinkedIn ${profile.links.linkedinLabel}. GitHub ${profile.links.githubLabel}. Email is the fastest way to reach ${profile.name}.`,
  });
  docs.push({
    id: 'site:guide', title: 'How the portfolio guide works', url: '/xray/#guide', kind: 'site', keywords: 'guide assistant chatbot ai how work privacy model llm offline',
    text: 'The portfolio guide (Priyanshu’s pet bot) is a scripted assistant. It matches a question to curated topics and assembles the answer in the browser from the approved project records the site is built from. It uses no AI model and sends nothing to a server.',
  });
  docs.push({
    id: 'site:stack', title: 'How this website is built', url: '/xray/', kind: 'site', keywords: 'website built stack astro react three.js architecture portfolio site',
    text: 'Static Astro site with React islands, lazy-loaded Three.js scenes behind static SVG posters, a typed content model that also feeds the in-browser portfolio guide, and no backend. Tested with Vitest and Playwright.',
  });
  for (const p of projects) docs.push(...projectDocs(p));
  for (const s of skillList) {
    const ev = projectsWithSkill(s.id);
    if (!ev.length) continue;
    docs.push({
      id: `skill:${s.id}`, title: `Skill: ${s.label}`, url: `/skills/#skill-${s.id}`, kind: 'skill', keywords: `${s.label} ${s.aliases.join(' ')}`,
      text: `${s.label} is evidenced by ${ev.map((p) => `${p.title} (${STATUS_LABEL[p.status]}, ${EVIDENCE_LABEL[p.evidence]})`).join('; ')}.`,
    });
  }
  cache = docs;
  return docs;
}

export function docById(id: string): KDoc | undefined {
  return knowledge().find((d) => d.id === id);
}
