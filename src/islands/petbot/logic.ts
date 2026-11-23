// Priyanshu's Pet Bot: a scripted portfolio companion. It adds a voice, short answers and
// contextual actions on top of the existing deterministic guide (src/lib/guide). No model, no
// network: answer() is pure and runs in the browser. Links pass the guide's allowlist.
import { answer, type GuideAnswer, type GuideLink } from '../../lib/guide/index';
import { isAllowedHref } from '../../lib/guide/links';
import { getProject } from '../../data/index';

import { PET, PROJECT_OFFERS as OFFERS } from './copy';
export const GREETING = PET.en.greeting;
export const PROJECT_OFFERS = OFFERS.en;

export type PetQuestion = { id: string; question: string; emoji: string };
export const PET_QUESTIONS: PetQuestion[] = [
  { id: 'who', question: 'Who is Priyanshu?', emoji: '👋' },
  { id: 'nokia', question: 'What does he do at Nokia?', emoji: '🏢' },
  { id: 'best', question: 'What are his coolest projects?', emoji: '✨' },
  { id: 'ai', question: 'What AI experience does he have?', emoji: '🧠' },
  { id: 'security', question: 'What cybersecurity work has he done?', emoji: '🛡️' },
  { id: 'tech', question: 'What technologies does he use?', emoji: '🧰' },
  { id: 'education', question: 'Tell me about his education.', emoji: '🎓' },
  { id: 'interesting', question: 'Why should I hire him?', emoji: '🤝' },
  { id: 'contact', question: 'How can I contact him?', emoji: '✉️' },
];

/** Tone only: these lines never carry facts, so they need no evidence. */
const LEAD: Record<string, string> = {
  who: 'Happy to introduce him!',
  nokia: 'Here’s his day job, in short.',
  best: 'My favourite question. These are the ones I’d show first:',
  ai: 'Ooh, the AI side. Here’s what’s published:',
  security: 'His careful side. Here’s the security work:',
  tech: 'His toolbox, counted by real projects:',
  education: 'Study and work, side by side:',
  interesting: 'I’m a little biased, so here’s the evidence instead:',
  contact: 'The quickest way to reach him:',
  project: 'Good pick! The short version:',
  skill: 'Here’s where that shows up:',
  job: 'Let’s map that against the evidence:',
  brief: 'Here’s a one-pager:',
  guard: 'That one stays private, sorry.',
  unknown: 'Hmm, that’s outside my notes, and I won’t guess.',
  search: 'I found something close:',
};

export type PetAction = { label: string; href: string };
const A = {
  all: { label: 'View all projects', href: '/work/' },
  skills: (hash?: string) => ({ label: 'Explore skills', href: hash ? `/skills/#${hash}` : '/skills/' }),
  recruiter: { label: 'Open recruiter mode', href: '/recruiter/' },
  contact: { label: 'Contact Priyanshu', href: '/about/#contact' },
  about: { label: 'About Priyanshu', href: '/about/' },
  project: (slug: string) => ({ label: 'Explore this project', href: `/work/${slug}/` }),
  lab: (slug: string) => ({ label: 'Open the lab', href: `/work/${slug}/#demo` }),
};

function projectActions(slug: string): PetAction[] {
  const p = getProject(slug);
  if (!p) return [A.all];
  return [A.project(slug), ...(p.demo && p.demo.kind !== 'xray' ? [A.lab(slug)] : []), A.all];
}

const ACTIONS: Record<string, () => PetAction[]> = {
  who: () => [A.recruiter, A.all, A.contact],
  nokia: () => projectActions('test-resource-scheduler'),
  best: () => [A.all, A.skills()],
  ai: () => [...projectActions('finbert-xai').slice(0, 2), A.skills('domain-ai')],
  security: () => [...projectActions('securemed').slice(0, 2), A.skills('domain-security')],
  tech: () => [A.skills(), A.all],
  education: () => [A.about, A.all],
  interesting: () => [A.recruiter, A.contact, A.all],
  contact: () => [A.contact, A.recruiter],
};

export type PetReply = {
  question: string;
  lead: string;
  /** The first, short part of the answer (always shown). */
  summary: string;
  /** The rest of the answer, behind “More details”. */
  more: string;
  answer: GuideAnswer;
  links: GuideLink[];
  actions: PetAction[];
};

/**
 * Summary form of a list block: “- **Title** (labels): long text” → “- **Title** (labels)”,
 * “- **Principle.** body” → “- **Principle.**”, and at most four items.
 */
export function compactList(block: string): string {
  const lines = block.split('\n');
  const isList = lines.every((l) => l.startsWith('- '));
  return lines
    .slice(0, isList ? 4 : lines.length)
    .map((l) => l.replace(/^(- \*\*[^*]+\*\* \([^)]*\)):\s.+$/, '$1').replace(/^(- \*\*[^*]+\.\*\*)\s.+$/, '$1'))
    .join('\n');
}

/**
 * Split an answer for progressive disclosure: a short summary (lists compacted to their titles)
 * and the details. Nothing is dropped: any compacted block appears in full in the details.
 */
export function splitAnswer(text: string): { summary: string; more: string } {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  const head: string[] = [];
  let len = 0;
  for (const b of blocks) {
    if (head.length >= 2 || (head.length >= 1 && len >= 140)) break;
    head.push(b);
    len += b.length;
  }
  const compacted = head.map(compactList);
  const full = head.filter((b, i) => compacted[i] !== b);
  return { summary: compacted.join('\n\n'), more: [...full, ...blocks.slice(head.length)].join('\n\n') };
}

export function petReply(question: string): PetReply {
  return decorate(answer(question), question);
}

/** Add the pet bot's voice, a short summary and contextual actions to any guide answer. */
export function decorate(a: GuideAnswer, question: string): PetReply {
  const key = a.route === 'curated' ? a.intent : a.route;
  const slug = a.intent.startsWith('project:') ? a.intent.slice(8) : undefined;
  const actions = (slug ? projectActions(slug) : (ACTIONS[a.intent]?.() ?? [A.all]))
    .filter((x) => isAllowedHref(x.href));
  const linkHrefs = new Set(a.links.map((l) => l.href));
  const { summary, more } = splitAnswer(a.text);
  return {
    question,
    lead: LEAD[key] ?? '',
    summary,
    more,
    answer: a,
    links: a.links,
    actions: actions.filter((x, i, arr) => !linkHrefs.has(x.href) && arr.findIndex((y) => y.href === x.href) === i),
  };
}
