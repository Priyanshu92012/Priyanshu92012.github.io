// generateBrief: a visitor-downloadable Markdown brief built only from approved data.
import { profile, projects, getSkill, STATUS_LABEL, EVIDENCE_LABEL, EVIDENCE_RANK, type DomainId, type Project } from '../../data/index';
import { detectSkills } from './search';
import type { Brief } from './protocol';

const SITE = 'https://priyanshu92012.github.io';
const DOMAIN_WORDS: Record<DomainId, RegExp> = {
  ai: /\b(ai|ml|llm|agent|agents|machine learning|genai|nlp|data scien)/i,
  security: /\b(security|secure|appsec|devsecops|cyber|auth)/i,
  systems: /\b(backend|systems?|platform|software|data|infrastructure|full.?stack|engineer)/i,
  research: /\b(research|iot|academic|industry 4\.0|embedded)/i,
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'general';
}

export function relevantProjects(focus: string, limit = 4): Project[] {
  const skillHits = new Set(detectSkills(focus));
  const domains = (Object.keys(DOMAIN_WORDS) as DomainId[]).filter((d) => DOMAIN_WORDS[d].test(focus));
  return [...projects]
    .map((p) => ({
      p,
      score: p.skills.filter((s) => skillHits.has(s)).length * 3 + p.domains.filter((d) => domains.includes(d)).length * 2 + EVIDENCE_RANK[p.evidence] + (p.tier === 'flagship' ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export function generateBrief(input: { audience?: string; focus?: string } = {}): Brief {
  const audience = (input.audience || 'a general engineering role').slice(0, 80);
  const focus = `${audience} ${input.focus ?? ''}`;
  const chosen = relevantProjects(focus);
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# ${profile.name}: evidence brief for ${audience}`);
  lines.push('');
  lines.push(`_Generated ${date} by the PRIYANSHU.EXE portfolio guide from approved public portfolio records. Each outcome is labelled with its basis (verified, linked or self-reported)._`);
  lines.push('');
  lines.push('## Snapshot');
  lines.push(`- **${profile.role}**, ${profile.location}`);
  for (const e of profile.experience) lines.push(`- ${e.title}, ${e.org} (${e.unit})`);
  for (const e of profile.education) lines.push(`- ${e.program}, ${e.org}`);
  lines.push('');
  lines.push('## Most relevant work');
  chosen.forEach((p, i) => {
    lines.push('');
    lines.push(`### ${i + 1}. ${p.title}`);
    lines.push(`${STATUS_LABEL[p.status]} · ${EVIDENCE_LABEL[p.evidence]}${p.org ? ` · ${p.org}` : ''}`);
    lines.push('');
    lines.push(p.summary);
    lines.push('');
    lines.push(`- **Role:** ${p.role}`);
    for (const d of p.decisions.slice(0, 2)) lines.push(`- **Decision:** ${d.decision}. ${d.why}`);
    for (const o of p.outcomes) lines.push(`- **Outcome (${o.basis}):** ${o.claim}`);
    lines.push(`- **Skills:** ${p.skills.map((s) => getSkill(s)?.label ?? s).join(', ')}`);
    lines.push(`- **Read more:** ${SITE}/work/${p.slug}/`);
  });
  lines.push('');
  lines.push('## Contact');
  lines.push(`- Email: ${profile.links.emailLabel}`);
  lines.push(`- LinkedIn: ${profile.links.linkedin}`);
  lines.push(`- GitHub: ${profile.links.github}`);
  return {
    title: `Evidence brief: ${audience}`,
    filename: `priyanshu-brief-${slugify(audience)}.md`,
    markdown: lines.join('\n'),
  };
}
