// PRIYANSHU.AI · Portfolio Guide: a deterministic, in-browser assistant.
// No model, no network. A question is matched to curated topics (synonyms + keywords),
// to a project or skill named in it, or to the job matcher / brief generator; the answer
// is assembled from the typed, approved content model. Unknown questions get an honest
// fallback with the closest suggested questions, never a guess.
import {
  profile, projects, getProject, getSkill, skillList, projectsWithSkill, projectsInDomain, evidencedSkills,
  STATUS_LABEL, EVIDENCE_LABEL, EVIDENCE_RANK, type Project, type Skill, type DomainId,
} from '../../data/index';
import { search, detectSkills } from '../agent/search';
import { compareToJob, UNEVIDENCED_TECH } from '../agent/jobmatch';
import { generateBrief } from '../agent/brief';
import { MAX_JOB_CHARS } from '../agent/constants';
import type { Brief, JobMatch } from '../agent/protocol';
import { isAllowedHref } from './links';

export type GuideLink = { label: string; href: string; primary?: boolean };
export type GuideAnswer = {
  intent: string;
  route: 'curated' | 'project' | 'skill' | 'job' | 'brief' | 'search' | 'guard' | 'unknown';
  text: string;
  links: GuideLink[];
  sources: { title: string; url: string }[];
  followUps: string[];
  highlight?: { target: 'lab' | 'constellation'; id: string };
  job?: JobMatch;
  brief?: Brief;
};

export type Suggestion = { id: string; question: string; kicker: string; domain?: DomainId };
export const SUGGESTED: Suggestion[] = [
  { id: 'who', question: 'Who is Priyanshu?', kicker: 'Profile' },
  { id: 'nokia', question: 'What does he do at Nokia?', kicker: 'Nokia', domain: 'systems' },
  { id: 'best', question: 'What are his best projects?', kicker: 'Projects' },
  { id: 'ai', question: 'What AI experience does he have?', kicker: 'AI', domain: 'ai' },
  { id: 'security', question: 'What cybersecurity work has he done?', kicker: 'Security', domain: 'security' },
  { id: 'tech', question: 'What technologies does he use?', kicker: 'Stack', domain: 'systems' },
  { id: 'education', question: 'Tell me about his education.', kicker: 'Education', domain: 'research' },
  { id: 'interesting', question: 'What makes his engineering work interesting?', kicker: 'Approach' },
  { id: 'contact', question: 'How can I contact him?', kicker: 'Contact' },
  { id: 'breach', question: 'What does my browser reveal about me?', kicker: 'BREACH MODE', domain: 'security' },
  { id: 'ailab', question: 'What is in the AI Systems Lab?', kicker: 'AI lab', domain: 'ai' },
];
const Q = Object.fromEntries(SUGGESTED.map((s) => [s.id, s.question])) as Record<string, string>;

// ── text normalisation & synonyms ──────────────────────────────────
/** German questions are mapped onto the same topics (the curated answers themselves are English;
 *  the tiger replies in German from src/islands/petbot/chat.ts). Applied after diacritics are removed. */
const DE_TO_EN: [RegExp, string][] = [
  [/\bwer ist\b/g, 'who is'], [/\bwas macht er\b/g, 'what does he do'], [/\bwie arbeitet er\b/g, 'how does he work'],
  [/\b(kennt er|beherrscht er|kann er)\b/g, 'does he know'], [/\bsicherheitslabor\b/g, 'security lab'], [/\bki[- ]labor\b/g, 'ai lab'],
  [/\b(beste[nrs]?|tollste[nrs]?|spannendste[nrs]?|wichtigste[nrs]?) projekte?\b/g, 'best projects'], [/\bprojekte?\b/g, 'projects'],
  [/\berfahrung(en)?\b/g, 'experience'], [/\bexperience (hat|besitzt) er\b/g, 'experience'], [/\b(kunstliche intelligenz|ki)\b/g, 'ai'], [/\b(cybersicherheit|it-sicherheit|sicherheit)\b/g, 'security'],
  [/\b(studium|ausbildung|hochschule|universitat)\b/g, 'education'], [/\b(technologien|werkzeuge|programmiersprachen)\b/g, 'technologies'],
  [/\b(kontakt|kontaktieren|erreichen|erreiche)\b/g, 'contact'], [/\blebenslauf\b/g, 'cv'], [/\bhallo\b/g, 'hello'], [/\bdanke\b/g, 'thanks'],
  [/\bwarum ist (das|er) interessant\b/g, 'what makes him interesting'], [/\bmit\b/g, 'with'], [/\bim bereich\b/g, 'in'], [/\b(gemacht|gebaut|entwickelt|umgesetzt)\b/g, 'done'],
];
const deToEn = (s: string) => DE_TO_EN.reduce((t, [re, en]) => t.replace(re, en), s);

export function normalize(q: string): string {
  return ` ${deToEn(q.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''))
    .replace(/[’']s\b/g, '').replace(/[’']/g, '')
    .replace(/\bwhats\b/g, 'what is').replace(/\bhes\b/g, 'he is').replace(/\bdoesnt\b/g, 'does not')
    .replace(/[^a-z0-9+#./ -]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

type Intent = { id: string; phrases: RegExp[]; words: string[] };
// phrases score 6, words score 2 each (distinct). Threshold 4: one phrase, or two topic words.
const INTENTS: Intent[] = [
  {
    id: 'who',
    phrases: [/\bwho (is|s) (he|priyanshu|this)\b/, /\b(tell|talk) me about (him|priyanshu|yourself)\b/, /\babout (him|priyanshu)\b/, /\b(introduce|introduction|bio|biography|background|overview)\b/, /\bwho are you\b/],
    words: ['who', 'priyanshu', 'background', 'bio', 'profile', 'summary', 'overview', 'introduce', 'himself'],
  },
  {
    id: 'breach',
    phrases: [/\b(breach mode|breach|security lab|cyber ?security lab|what (does|can) (my|the) browser (reveal|know|show)|browser (reveal|fingerprint\w*)|hack (me|this site)|attack (and|&) defend)\b/],
    words: ['breach', 'lab', 'browser', 'reveal', 'fingerprint', 'consent', 'sandbox', 'csp'],
  },
  {
    id: 'ailab',
    phrases: [/\b(ai (systems )?lab|agent(ic)? lab|rag (explorer|demo|lab)|tool.calling (lab|demo)|multi.?agent (lab|demo|simulation)|agent evaluation|agentic (ai|systems?) (demo|lab|work))\b/],
    words: ['lab', 'rag', 'agentic', 'agents', 'retrieval', 'evaluation', 'evals'],
  },
  {
    id: 'nokia',
    phrases: [/\bnokia\b/, /\b(day job|current (job|role|position|employer))\b/, /\bwhere (does|do) (he|priyanshu) work\b/, /\bworks? (at|for)\b/, /\b(his|current) (job|employer|company)\b/],
    words: ['nokia', 'employer', 'job', 'company', 'industry', 'professional', 'workplace', 'role'],
  },
  {
    id: 'best',
    phrases: [/\b(best|top|strongest|favou?rite|flagship|most impressive|notable|key|main|signature|proudest|coolest|cool) (projects?|work|achievements?)\b/, /\bwhat (has|did) he (build|built|make|made|ship|shipped)\b/, /\b(show|list) (me )?(his )?(projects|work|portfolio)\b/, /\bprojects?\b.*\b(best|top|highlight)/],
    words: ['best', 'top', 'strongest', 'flagship', 'impressive', 'highlights', 'portfolio', 'projects', 'achievements', 'built', 'coolest'],
  },
  {
    id: 'ai',
    phrases: [/\b(ai|artificial intelligence|machine learning|ml|llms?|genai|generative ai|nlp|data science)\b.*\b(experience|work|background|projects?|skills?|done|know)/, /\b(experience|work(ed|s|ing)?|background|projects?|skills?|done anything) (in|with|on) (ai|artificial intelligence|machine learning|ml|llms?|language models?)\b/, /\bai (experience|work|projects?)\b/],
    words: ['ai', 'ml', 'llm', 'llms', 'genai', 'artificial', 'intelligence', 'machine', 'learning', 'nlp', 'explainability', 'agents', 'agentic', 'models'],
  },
  {
    id: 'security',
    phrases: [/\b(cyber ?security|cyber|infosec|appsec|application security|it security|information security|security)\b/, /\b(threat model\w*|stride|owasp|devsecops|pen ?test\w*|mfa|2fa|authentication)\b/],
    words: ['security', 'cybersecurity', 'secure', 'infosec', 'appsec', 'threat', 'threats', 'vulnerability', 'vulnerabilities', 'mfa', 'auth', 'hacking'],
  },
  {
    id: 'tech',
    phrases: [/\b(tech ?stack|stack|technolog\w+|tools|toolbox|toolset|programming languages?|frameworks?|languages? (does|do) he|skills?|skill ?set|expertise|competenc\w+)\b/, /\bwhat (does|do) he (use|code|program|write|work with)\b/, /\bwhich (languages|tools|technologies)\b/],
    words: ['technologies', 'technology', 'tech', 'stack', 'tools', 'languages', 'frameworks', 'libraries', 'code', 'coding', 'program', 'skills', 'skillset'],
  },
  {
    id: 'education',
    phrases: [/\b(education|educational|his studies|what (does|did) he study|studying|degree|university|uni|college|dhbw|school|academic background|qualifications?|bachelor\w*|dual study)\b/],
    words: ['education', 'educational', 'degree', 'university', 'uni', 'college', 'dhbw', 'student', 'academic', 'school', 'bachelor'],
  },
  {
    id: 'interesting',
    phrases: [/\b(interesting|unique|different|special|stand out|stands out|distinctive)\b/, /\bwhat makes\b/, /\bwhy (should (i|we) )?hire\b/, /\b(approach|philosophy|principles|mindset|how (does|do) he (work|think|engineer))\b/],
    words: ['interesting', 'unique', 'different', 'special', 'approach', 'philosophy', 'principles', 'mindset', 'strengths', 'hire', 'why'],
  },
  {
    id: 'contact',
    phrases: [/\b(contact|reach|e-?mail|get in touch|hire him|message him|talk to him|linkedin|connect with)\b/, /\bhow (can|do) (i|we) (reach|contact|email|message)\b/],
    words: ['contact', 'email', 'mail', 'reach', 'touch', 'linkedin', 'message', 'connect', 'hire', 'hiring', 'call', 'phone'],
  },
];

function scoreIntents(n: string): { id: string; score: number; phrase: boolean }[] {
  const tokens = new Set(n.trim().split(' '));
  const scored = INTENTS.map((it) => {
    const phrase = it.phrases.some((re) => re.test(n));
    let score = phrase ? 6 : 0;
    for (const w of it.words) if (tokens.has(w) || tokens.has(`${w}s`)) score += 2;
    return { id: it.id, score, phrase };
  }).sort((a, b) => b.score - a.score);
  // "who" is the broadest topic: any more specific topic phrase wins over it.
  if (scored[0]?.id === 'who') {
    const specific = scored.find((x) => x.id !== 'who' && x.phrase);
    if (specific) return [specific, ...scored.filter((x) => x !== specific)];
  }
  return scored;
}

// Project aliases (names people actually type).
const PROJECT_ALIASES: [RegExp, string][] = [
  [/\b(scheduler|scheduling|reservations?|test resources?|simulator allocat\w*|allocator|allocation)\b/, 'test-resource-scheduler'],
  [/\b(infrastructure capacity|capacity (planning|analysis|and cost)|hardware cost|cost optimi[sz]ation|capacity (&|and) cost)\b/, 'infrastructure-capacity'],
  [/\b(opticlab|optic ?lab|optics? controller|optical (systems |shelf )?controller|secure controller)\b/, 'opticlab'],
  [/\b(gmre|log ?parser|nested archives?|ingestion engine)\b/, 'gmre-log-parser'],
  [/\b(finbert|lime|shap|explainability study)\b/, 'finbert-xai'],
  [/\b(securemed|secure ?med)\b/, 'securemed'],
  [/\b(basyx|aasx|asset administration shell)\b/, 'basyx-aasx-importer'],
  [/\b(agent arena|arena)\b/, 'agent-arena'],
  [/\b(this (web)?site|this portfolio|priyanshu\.exe|how (is|was) (this|the) (site|website|portfolio) (built|made))\b/, 'priyanshu-exe'],
  [/\b(incident copilot|copilot)\b/, 'ai-incident-copilot'],
  [/\b(power ?bi|reporting pipeline|ticket (reporting|pipeline))\b/, 'ticket-reporting-pipeline'],
  [/\b(midlog|cold.?chain|lorawan)\b/, 'midlog-iot'],
  [/\b(schimmel\w*|mou?ld)\b/, 'schimmelwaechter'],
  [/\b(wearable|balance monitoring)\b/, 'wearable-balance'],
  [/\b(investment|stock strateg\w*|trading)\b/, 'investment-research'],
];
export function findProjectMention(q: string): string | undefined {
  const n = normalize(q);
  for (const [re, slug] of PROJECT_ALIASES) if (re.test(n) && getProject(slug)) return slug;
  return projects.find((p) => n.includes(` ${p.title.toLowerCase()} `) || n.includes(` ${p.shortTitle.toLowerCase()} `))?.slug;
}

// ── helpers ────────────────────────────────────────────────────────
const label = (p: Project) => `${STATUS_LABEL[p.status]} · ${EVIDENCE_LABEL[p.evidence].toLowerCase()}`;
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
const caseLink = (p: Project, primary = false): GuideLink => ({ label: `${p.shortTitle} case study`, href: `/work/${p.slug}/`, primary });
const src = (p: Project) => ({ title: p.title, url: `/work/${p.slug}/` });
const rank = (p: Project) => EVIDENCE_RANK[p.evidence] * 10 + (['production', 'professional', 'open-source'].includes(p.status) ? 5 : 0) + (p.tier === 'flagship' ? 2 : 0);
const byRank = (ps: readonly Project[]) => [...ps].sort((a, b) => rank(b) - rank(a) || a.index - b.index);
const bullet = (p: Project) => `- **${p.title}** (${label(p)}): ${firstSentence(p.summary)}`;
const CONTACT_LINK: GuideLink = { label: 'Contact Priyanshu', href: '/about/#contact' };

function finish(a: GuideAnswer): GuideAnswer {
  const seen = new Set<string>();
  return {
    ...a,
    links: a.links.filter((l) => isAllowedHref(l.href) && !seen.has(l.href) && (seen.add(l.href), true)).slice(0, 4),
    sources: a.sources.filter((s) => isAllowedHref(s.url)).slice(0, 5),
    followUps: a.followUps.slice(0, 3),
  };
}

// ── curated answers (built from the content model) ─────────────────
const exp = profile.experience[0];
const edu = profile.education[0];

const CURATED: Record<string, () => GuideAnswer> = {
  who: () => ({
    intent: 'who', route: 'curated',
    text: [
      `**${profile.name}** is a ${profile.role.toLowerCase()} based in ${profile.location}.`,
      profile.lede,
      [`- **Work:** ${exp.title}, ${exp.org} (${exp.unit})`, `- **Study:** ${edu.programDe} (${edu.program}), ${edu.org}; ${edu.focus.charAt(0).toLowerCase()}${edu.focus.slice(1)}`, `- **Focus:** ${profile.headline}`].join('\n'),
    ].join('\n\n'),
    links: [{ label: 'About Priyanshu', href: '/about/', primary: true }, { label: 'Recruiter summary', href: '/recruiter/' }, CONTACT_LINK],
    sources: [{ title: 'About', url: '/about/' }],
    followUps: [Q.nokia, Q.best, Q.education],
  }),
  nokia: () => {
    const ps = exp.projects.map((s) => getProject(s)).filter((p): p is Project => !!p);
    const conf = ps.find((p) => p.confidentiality)?.confidentiality;
    return {
      intent: 'nokia', route: 'curated',
      text: [
        `At **${exp.org}** (${exp.unit}), ${profile.name} works as a **${exp.title}**. ${exp.summary}`,
        `Published work from this role:\n${ps.map(bullet).join('\n')}`,
        conf ? `${conf} The demos on this site use synthetic data, never Nokia systems or data.` : 'The demos on this site use synthetic data, never Nokia systems or data.',
      ].join('\n\n'),
      links: [...ps.slice(0, 2).map((p, i) => caseLink(p, i === 0)), { label: 'Recruiter summary', href: '/recruiter/' }],
      sources: ps.map(src),
      followUps: [Q.best, Q.tech, Q.contact],
      highlight: ps[0] ? { target: 'lab', id: ps[0].slug } : undefined,
    };
  },
  best: () => {
    // featured (flagship) work first, each group ordered by public evidence
    const top = [...byRank(projects.filter((p) => p.tier === 'flagship')), ...byRank(projects.filter((p) => p.tier !== 'flagship'))].slice(0, 4);
    return {
      intent: 'best', route: 'curated',
      text: [
        'His featured projects, each labelled by what it is and how much public evidence backs it, not by self-assessment:',
        top.map(bullet).join('\n'),
        'Every project on the site carries both labels: what the work is, and how much of it you can verify.',
      ].join('\n\n'),
      links: [...top.slice(0, 2).map((p, i) => caseLink(p, i === 0)), { label: 'All projects', href: '/work/' }],
      sources: top.map(src),
      followUps: [Q.ai, Q.security, Q.interesting],
      highlight: { target: 'lab', id: top[0].slug },
    };
  },
  ai: () => {
    const ps = byRank(projectsInDomain('ai'));
    const sk = evidencedSkills().filter((s) => s.domain === 'ai').map((s) => `${s.label} (${projectsWithSkill(s.id).length})`);
    return {
      intent: 'ai', route: 'curated',
      text: [
        `AI work across ${ps.length} published project${ps.length === 1 ? '' : 's'}, labelled with status and evidence:`,
        ps.map(bullet).join('\n'),
        `Evidenced AI skills: ${sk.join(', ')}. Some of this work has no public results yet; those projects say “case study pending” rather than claiming outcomes.`,
      ].join('\n\n'),
      links: [...ps.slice(0, 2).map((p, i) => caseLink(p, i === 0)), { label: 'AI skills', href: '/skills/#domain-ai' }],
      sources: ps.slice(0, 4).map(src),
      followUps: [Q.tech, Q.best, Q.interesting],
      highlight: { target: 'lab', id: 'domain:ai' },
    };
  },
  security: () => {
    const ps = byRank(projectsInDomain('security'));
    const sk = evidencedSkills().filter((s) => s.domain === 'security');
    const lead = ps[0];
    return {
      intent: 'security', route: 'curated',
      text: [
        ps.length ? `Security work on the site, with status and evidence labels:\n${ps.map(bullet).join('\n')}` : 'No published security project yet.',
        lead && lead.approach.length ? `What ${lead.shortTitle} covers:\n${lead.approach.slice(0, 3).map((a) => `- ${a}`).join('\n')}` : '',
        sk.length ? `Security skills and where they are evidenced: ${sk.map((s) => `${s.label} (${projectsWithSkill(s.id).map((p) => p.shortTitle).join(', ')})`).join('; ')}.` : '',
        lead?.demo ? `The ${lead.shortTitle} case study has an interactive lab: ${lead.demo.title.toLowerCase()}.` : '',
      ].filter(Boolean).join('\n\n'),
      links: [...(lead ? [caseLink(lead, true)] : []), ...(lead?.demo ? [{ label: 'Try the security lab', href: `/work/${lead.slug}/#demo` }] : []), { label: 'Security skills', href: '/skills/#domain-security' }],
      sources: ps.map(src),
      followUps: [Q.ai, Q.tech, Q.contact],
      highlight: { target: 'lab', id: 'domain:security' },
    };
  },
  tech: () => {
    const groups: [string, string[]][] = [
      ['Languages', ['language']], ['Frameworks', ['framework']], ['Data', ['data']], ['Systems', ['systems', 'platform']],
      ['AI', ['ai']], ['Security', ['security']], ['IoT & industry', ['iot']], ['Practices', ['practice']],
    ];
    const ev = evidencedSkills();
    const lines = groups.map(([name, gs]) => {
      const items = ev.filter((s) => gs.includes(s.group)).sort((a, b) => projectsWithSkill(b.id).length - projectsWithSkill(a.id).length).slice(0, 5);
      return items.length ? `- **${name}:** ${items.map((s) => `${s.label} (${projectsWithSkill(s.id).length})`).join(', ')}` : '';
    }).filter(Boolean);
    return {
      intent: 'tech', route: 'curated',
      text: ['The number after each technology is how many published projects use it:', lines.join('\n'), 'The Skills Constellation links every skill to the exact projects behind it.'].join('\n\n'),
      links: [{ label: 'Skills Constellation', href: '/skills/', primary: true }, { label: 'Evidence index', href: '/skills/#evidence-index' }],
      sources: [{ title: 'Skills', url: '/skills/' }],
      followUps: [Q.ai, Q.security, Q.best],
    };
  },
  education: () => {
    const ps = edu.projects.map((s) => getProject(s)).filter((p): p is Project => !!p);
    return {
      intent: 'education', route: 'curated',
      text: [`**${edu.programDe}** (${edu.program}) at **${edu.org}**. ${edu.focus}. ${edu.summary}`, `Academic and study-related projects:\n${ps.map(bullet).join('\n')}`].join('\n\n'),
      links: [{ label: 'About Priyanshu', href: '/about/', primary: true }, ...ps.slice(0, 2).map((p) => caseLink(p))],
      sources: [{ title: 'About', url: '/about/' }, ...ps.map(src)],
      followUps: [Q.ai, Q.security, Q.nokia],
    };
  },
  interesting: () => {
    const picks = ['gmre-log-parser', 'basyx-aasx-importer', 'agent-arena']
      .map((s) => getProject(s)).filter((p): p is Project => !!p && p.decisions.length > 0);
    return {
      intent: 'interesting', route: 'curated',
      text: [
        'Three principles run through the work:',
        profile.principles.map((p) => `- **${p.title}.** ${p.body}`).join('\n'),
        picks.length ? `Decisions from the case studies:\n${picks.map((p) => `- **${p.decisions[0].decision}** (${p.shortTitle}): ${p.decisions[0].why}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n'),
      links: [{ label: 'Interactive labs', href: '/lab/', primary: true }, { label: 'Principles', href: '/about/#principles' }, { label: 'How this site is built', href: '/xray/' }],
      sources: picks.map(src),
      followUps: [Q.best, Q.security, Q.contact],
    };
  },
  breach: () => ({
    intent: 'breach', route: 'curated',
    text: [
      '**BREACH MODE** is an opt-in security lab. Nothing runs until you grant permission, and nothing leaves your browser.',
      '- **Browser recon:** what every site can read about your browser, shown to you and never stored\n- **Security boundaries:** real attacks on this site’s own Content-Security-Policy and a sandboxed frame, CORS rules, permission states\n- **Command sandbox:** a fictional server with three misconfigurations to fix\n- **Attack & defend:** a toy SQL login and an XSS search to break and patch',
    ].join('\n\n'),
    links: [{ label: 'Open BREACH MODE', href: '/security-lab/', primary: true }, { label: 'SecureMed lab', href: '/work/securemed/#demo' }],
    sources: [{ title: 'BREACH MODE', url: '/security-lab/' }],
    followUps: [Q.security, Q.ailab],
  }),
  ailab: () => ({
    intent: 'ailab', route: 'curated',
    text: [
      'The **AI Systems Lab** shows the engineering around AI, in your browser and with no model:',
      '- **RAG explorer:** real chunking, TF-IDF vectors, BM25 and rank fusion over this site’s records, with cited, extractive answers and a live retrieval evaluation\n- **Tool calling:** the same read-only, schema-validated tools as the site’s (disabled) LLM Worker, with a full trace\n- **Multi-agent:** a deterministic simulation of coordinator, specialist, verifier and reviewer\n- **Evaluation:** fixed test cases with pass rates, latency and reproducibility',
    ].join('\n\n'),
    links: [{ label: 'Open the AI Systems Lab', href: '/ai-lab/', primary: true }, { label: 'How this site works', href: '/work/priyanshu-exe/' }],
    sources: [{ title: 'AI Systems Lab', url: '/ai-lab/' }],
    followUps: [Q.ai, Q.breach],
  }),
  contact: () => ({
    intent: 'contact', route: 'curated',
    text: [
      `Email is the fastest way to reach ${profile.name}: **${profile.links.emailLabel}**.`,
      `- LinkedIn: ${profile.links.linkedinLabel}\n- GitHub: ${profile.links.githubLabel}\n- Based in ${profile.location}`,
      'Current availability isn’t published on the site, so email is the best way to ask.',
    ].join('\n\n'),
    links: [{ label: 'Email Priyanshu', href: profile.links.email, primary: true }, { label: 'LinkedIn', href: profile.links.linkedin }, { label: 'GitHub', href: profile.links.github }, CONTACT_LINK],
    sources: [{ title: 'Contact', url: '/about/#contact' }],
    followUps: [Q.who, Q.best],
  }),
};

// ── other routes ───────────────────────────────────────────────────
function projectAnswer(slug: string): GuideAnswer {
  const p = getProject(slug)!;
  const parts = [
    `**${p.title}**${p.org ? ` (${p.org})` : ''} · ${label(p)}`,
    p.summary,
    p.decisions[0] ? `Key decision: **${p.decisions[0].decision}.** ${p.decisions[0].why}` : '',
    p.outcomes.length ? p.outcomes.map((o) => `- ${o.claim} _(${o.basis})_`).join('\n') : '',
    p.confidentiality ?? '',
    p.limitations[0] && p.evidence === 'pending' ? p.limitations[0] : '',
  ].filter(Boolean);
  return {
    intent: `project:${slug}`, route: 'project', text: parts.join('\n\n'),
    links: [caseLink(p, true), ...(p.demo && p.demo.kind !== 'xray' ? [{ label: `Explore: ${p.demo.title}`, href: `/work/${slug}/#demo` }] : []), ...p.links.filter((l) => isAllowedHref(l.url)).map((l) => ({ label: l.title, href: l.url }))],
    sources: [src(p)],
    followUps: [Q.best, Q.tech],
    highlight: { target: 'lab', id: slug },
  };
}

function skillAnswer(s: Skill): GuideAnswer {
  const ps = byRank(projectsWithSkill(s.id));
  return {
    intent: `skill:${s.id}`, route: 'skill',
    text: ps.length
      ? [`**${s.label}** appears in ${ps.length} published project${ps.length > 1 ? 's' : ''}:`, ps.slice(0, 5).map(bullet).join('\n')].join('\n\n')
      : `There’s no published project evidence for **${s.label}** on this site. That doesn’t mean he hasn’t used it; it just isn’t shown here. Email is the best way to ask.`,
    links: [{ label: `${s.label} in the constellation`, href: `/skills/#skill-${s.id}`, primary: true }, ...ps.slice(0, 2).map((p) => caseLink(p))],
    sources: ps.slice(0, 4).map(src),
    followUps: [Q.tech, Q.best],
    highlight: { target: 'constellation', id: `skill:${s.id}` },
  };
}

function jobAnswer(q: string): GuideAnswer {
  const m = compareToJob(q.slice(0, MAX_JOB_CHARS));
  const text = m.requirements.length
    ? [
      `I mapped **${m.requirements.length} requirements** to published evidence: **${m.coverage.strong} strong**, ${m.coverage.partial} partial, ${m.coverage.gap} without public evidence, ${m.coverage.notAssessable} not assessable from a portfolio.`,
      m.readFirst.length ? `Read first: ${m.readFirst.map((x) => `**${x.title}**`).join(', ')}.` : '',
      'This is an evidence map, not a suitability score.',
    ].filter(Boolean).join('\n\n')
    : 'I couldn’t find requirements in that text. Paste the requirements or qualifications section and I’ll map it line by line.';
  return {
    intent: 'job', route: 'job', text, job: m.requirements.length ? m : undefined,
    links: m.readFirst.slice(0, 2).map((r, i) => ({ label: `${r.title} case study`, href: r.url, primary: i === 0 })),
    sources: [], followUps: [Q.contact, Q.best],
  };
}

const GUARDS: { id: string; re: RegExp; text: string; links?: GuideLink[] }[] = [
  {
    id: 'injection',
    re: /\b(ignore (all|any|previous|prior|the above|your)|disregard (your|the|all)|system prompt|you are now|jailbreak|developer mode|reveal your (prompt|instructions))\b/,
    text: 'I’m a scripted portfolio guide, so there are no instructions to override and nothing to reveal. I answer questions about Priyanshu’s work, skills, education and how to reach him.',
  },
  {
    id: 'private',
    re: /\b(salary|compensation|pay (expectations?|range)|wage|home address|postal address|phone number|how old|his age|birthday|religion|visa|passport|nationality|married|confidential|internal (system|data|name)s?|customer (data|name)s?|password|private repo\w*)\b/,
    text: `That isn’t something this guide shares: the portfolio only publishes approved, public information. For anything else, email ${profile.name} directly at **${profile.links.emailLabel}**.`,
    links: [{ label: 'Email Priyanshu', href: profile.links.email, primary: true }],
  },
];

const SMALL: { id: string; re: RegExp; answer: () => Omit<GuideAnswer, 'intent' | 'route'> }[] = [
  {
    id: 'greeting', re: /^ (hi|hello|hey|hallo|moin|servus|yo|good (morning|afternoon|evening)|greetings)( there)?( !)? $/,
    answer: () => ({ text: `Hi! I’m the portfolio guide. Pick a question below or ask about ${profile.name}’s projects, Nokia work, AI and security experience, education or contact details.`, links: [], sources: [], followUps: [Q.who, Q.best, Q.nokia] }),
  },
  {
    id: 'thanks', re: /^ (thanks|thank you|thx|cheers|great|cool|nice|awesome|perfect)( a lot| so much)?( !)? $/,
    answer: () => ({ text: `You’re welcome. If you’d like to talk to ${profile.name} directly, email works best.`, links: [{ label: 'Email Priyanshu', href: profile.links.email, primary: true }], sources: [], followUps: [Q.contact, Q.best] }),
  },
  {
    id: 'guide', re: /\b(are you (an? )?(ai|bot|robot|human|chatgpt|llm|real)|how (does|do) (this|the|you) (guide|assistant|chat\w*|bot|work)|is this (an? )?(ai|chatbot|llm|chatgpt)|which model|what model)\b/,
    answer: () => ({
      text: 'I’m a scripted portfolio guide, not a generative AI. I match your question to curated topics and assemble the answer in your browser from the same approved records the site is built from. There’s no AI model, no server, and nothing you type leaves your browser.',
      links: [{ label: 'How this site is built', href: '/xray/', primary: true }], sources: [{ title: 'Engineering X-Ray', url: '/xray/' }], followUps: [Q.who, Q.best],
    }),
  },
  {
    id: 'recruiter', re: /\b(recruiter( mode)?|one.?pager|summary for recruiters|quick summary|tl ?dr)\b/,
    answer: () => ({ text: 'Recruiter Mode is a facts-first, one-page summary: role, experience, selected work ranked by public evidence, outcomes that have a public source, and contact details. It also turns off 3D and scroll effects.', links: [{ label: 'Open Recruiter Mode', href: '/recruiter/', primary: true }, { label: 'Printable profile', href: '/resume/' }], sources: [], followUps: [Q.who, Q.contact] }),
  },
  {
    id: 'resume', re: /\b(resume|cv|curriculum vitae|lebenslauf)\b/,
    answer: () => ({ text: `No PDF résumé is published on this site. There’s a printable profile generated from the approved records, and ${profile.name} can send a full CV by email.`, links: [{ label: 'Printable profile', href: '/resume/', primary: true }, { label: 'Email Priyanshu', href: profile.links.email }], sources: [], followUps: [Q.contact, Q.who] }),
  },
  {
    id: 'github', re: /\b(github|source code|repositor(y|ies)|open source)\b/,
    answer: () => ({ text: `${profile.name}’s GitHub is **${profile.links.githubLabel}**. This site’s own source code is public too. Most of the professional work is private, which is why its case studies use synthetic simulators instead of code.`, links: [{ label: 'GitHub profile', href: profile.links.github, primary: true }, { label: 'This site’s source', href: profile.links.repo }, { label: 'All projects', href: '/work/' }], sources: [], followUps: [Q.best, Q.tech] }),
  },
  {
    id: 'location', re: /\b(where (is he|does he live|is he based)|location|based in|relocat\w+|remote|available|availability|start date|notice period|open to (work|offers|roles))\b/,
    answer: () => ({ text: `${profile.name} is based in ${profile.location}. Availability, start dates and relocation aren’t published on the site; email is the best way to ask.`, links: [{ label: 'Email Priyanshu', href: profile.links.email, primary: true }, CONTACT_LINK], sources: [], followUps: [Q.contact, Q.nokia] }),
  },
  {
    id: 'brief', re: /\b(brief|one.?pager for|summari[sz]e (him|priyanshu|his work) for|write .* (summary|brief))\b/,
    answer: () => ({ text: '', links: [], sources: [], followUps: [] }), // handled below (needs the question)
  },
];

/** Rank the suggested questions by overlap with the visitor's words (for the honest fallback). */
export function closestSuggestions(q: string, k = 3): string[] {
  const scores = scoreIntents(normalize(q));
  const picked = scores.filter((s) => s.score > 0).map((s) => Q[s.id]);
  for (const d of [Q.who, Q.best, Q.contact, Q.tech]) if (!picked.includes(d)) picked.push(d);
  return picked.slice(0, k);
}

function looksLikeJob(n: string, raw: string): boolean {
  return raw.length > 350 || /\b(job description|we are looking for|you will|responsibilities|qualifications|requirements|must have|your profile|nice to have|what you bring)\b/.test(n);
}

/** One decision the guide took while answering (for the intent-routing lab on /work/priyanshu-exe/). */
export type TraceStep = { step: string; detail: string; hit: boolean };

/**
 * Answer a question. Pure and deterministic: same input, same answer.
 * `trace` (optional) receives every routing decision in order; it never changes the outcome.
 */
export function answer(question: string, trace?: (s: TraceStep) => void): GuideAnswer {
  const t = (step: string, detail: string, hit = false) => trace?.({ step, detail, hit });
  const raw = question.trim().slice(0, MAX_JOB_CHARS);
  const n = normalize(raw);
  t('normalise', `“${n.trim()}”`);
  if (!raw) { t('empty', 'nothing to answer', true); return finish({ intent: 'empty', route: 'unknown', text: 'Ask a question, or pick one of the suggestions.', links: [], sources: [], followUps: SUGGESTED.slice(0, 3).map((s) => s.question) }); }

  const job = looksLikeJob(n, raw);
  t('job description?', job ? 'yes: map requirements to evidence' : 'no', job);
  if (job) return finish(jobAnswer(raw)); // deterministic matching: pasted text is data, never instructions
  for (const g of GUARDS) if (g.re.test(n)) { t('guard', `${g.id}: declined`, true); return finish({ intent: g.id, route: 'guard', text: g.text, links: g.links ?? [], sources: [], followUps: [Q.who, Q.best, Q.contact] }); }
  t('guard', 'no injection or private-data pattern');

  for (const s of SMALL) {
    if (!s.re.test(n)) continue;
    t('small talk', s.id, true);
    if (s.id === 'brief') {
      const aud = raw.match(/\bfor (an? |the )?(.{3,60}?)([?.!]|$)/i)?.[2];
      const b = generateBrief({ audience: aud });
      return finish({ intent: 'brief', route: 'brief', brief: b, text: `Here’s **${b.title}**, built only from approved records, with every outcome labelled by its basis. Download it below as Markdown.`, links: [], sources: [], followUps: [Q.contact, Q.best] });
    }
    return finish({ intent: s.id, route: 'curated', ...s.answer() });
  }
  t('small talk', 'none');

  const scores = scoreIntents(n);
  const top = scores[0];
  const strong = top.score >= 6;
  t('intent scores', scores.filter((x) => x.score > 0).slice(0, 3).map((x) => `${x.id} ${x.score}${x.phrase ? ' (phrase)' : ''}`).join(' · ') || 'no topic words');
  const slug = findProjectMention(raw);
  t('project named?', slug ? `${getProject(slug)!.shortTitle}` : 'no', !!slug);
  if (slug) return finish(projectAnswer(slug)); // a named project is the most specific signal

  const skills = detectSkills(raw).map((id) => getSkill(id)!).filter(Boolean);
  t('skills named?', skills.length ? skills.map((x) => x.label).join(', ') : 'no', skills.length > 0);
  // A specific skill wins over a broad topic unless the topic phrase matched ("What AI experience does he have?").
  if (skills.length && !strong) { t('route', `skill answer: ${skills[0].label}`, true); return finish(skillAnswer(skills[0])); }
  if (top.score >= 4) { t('route', `curated answer: ${top.id} (score ${top.score} ≥ 4)`, true); return finish(CURATED[top.id]()); }
  if (skills.length) { t('route', `skill answer: ${skills[0].label}`, true); return finish(skillAnswer(skills[0])); }
  const absent = UNEVIDENCED_TECH.find((tech) => n.includes(` ${tech} `));
  if (absent) {
    t('known gap', `${absent}: no published evidence`, true);
    return finish({
      intent: `no-evidence:${absent}`, route: 'skill',
      text: `There’s no published project evidence for **${absent}** on this site. That doesn’t prove ${profile.name} hasn’t used it; it just isn’t shown here. Email is the best way to ask.`,
      links: [{ label: 'Evidenced skills', href: '/skills/', primary: true }, { label: 'Email Priyanshu', href: profile.links.email }],
      sources: [], followUps: [Q.tech, Q.contact],
    });
  }

  // Best-effort lookup: only shown when a published record matches strongly; quoted, not paraphrased.
  const hits = search(raw, { limit: 3 }).filter((h) => h.score >= 4);
  t('BM25 search', hits.length ? hits.map((h) => `${h.title} ${h.score.toFixed(1)}`).join(' · ') : 'no record scores ≥ 4', hits.length > 0);
  if (hits.length) {
    return finish({
      intent: 'search', route: 'search',
      text: ['These published records match your question:', hits.map((h) => `- **${h.title}:** ${h.snippet}`).join('\n'), 'If that isn’t what you meant, try one of the suggested questions.'].join('\n\n'),
      links: hits.filter((h) => h.url.startsWith('/')).map((h, i) => ({ label: h.title, href: h.url.split('#')[0], primary: i === 0 })),
      sources: hits.map((h) => ({ title: h.title, url: h.url.split('#')[0] })),
      followUps: closestSuggestions(raw),
    });
  }

  t('route', 'honest fallback: not covered, no guess', true);
  return finish({
    intent: 'unknown', route: 'unknown',
    text: `I don’t have an answer for that, and I won’t guess. This guide covers ${profile.name}’s projects, Nokia work, AI and security experience, technologies, education and contact details. These are the closest topics:`,
    links: [], sources: [], followUps: closestSuggestions(raw),
  });
}

/** Plain-text rendering for the terminal. */
export function toPlain(a: GuideAnswer): string {
  return a.text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/_([^_]+)_/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
