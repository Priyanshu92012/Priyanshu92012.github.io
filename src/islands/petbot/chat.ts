// Conversational layer for the pet bot chat. The deterministic guide (src/lib/guide) still decides
// WHAT is answered: intent, route, links and sources come from answer(). This module only decides HOW
// it is said: one or two short sentences, at most two actions, and the full answer behind
// “Tell me more”. Every fact is read from the approved content model; nothing is generated.
import { answer, closestSuggestions, SUGGESTED, type GuideAnswer } from '../../lib/guide/index';
import { isAllowedHref } from '../../lib/guide/links';
import { profile, projects, getProject, getSkill, projectsInDomain, evidencedSkills, projectsWithSkill, type Project } from '../../data/index';
import type { Brief, JobMatch } from '../../lib/agent/protocol';
import { PROFILE_DE, PROJECT_DE } from '../../data/de';
import { localizePath } from '../../i18n/index';
import type { PetLang } from './copy';

export type ChatAction = { label: string; href: string } | { label: string; more: true };
export type ChatReply = {
  intent: string;
  route: GuideAnswer['route'];
  /** One or two short sentences, plain text. */
  text: string;
  /** At most two. */
  actions: ChatAction[];
  /** The guide's full answer (Markdown), shown only on “Tell me more”. */
  more: string;
  links: { label: string; href: string }[];
  sources: { title: string; url: string }[];
  /** Quick replies, only when the bot could not answer. */
  suggestions: QuickReply[];
  job?: JobMatch;
  brief?: Brief;
};

export type QuickReply = { label: string; q: string };
export { PET } from './copy';
export const QUICK: QuickReply[] = [
  { label: 'About Priyanshu', q: 'Who is Priyanshu?' },
  { label: 'His best projects', q: 'What are his best projects?' },
  { label: 'AI & engineering', q: 'What AI experience does he have?' },
  { label: 'Work at Nokia', q: 'What does he do at Nokia?' },
];
export const MORE_TOPICS: QuickReply[] = [
  { label: 'Security work', q: 'What cybersecurity work has he done?' },
  { label: 'Tech stack', q: 'What technologies does he use?' },
  { label: 'Education', q: 'Tell me about his education.' },
  { label: 'How he works', q: 'What makes his engineering work interesting?' },
  { label: 'Contact', q: 'How can I contact him?' },
  { label: 'BREACH MODE', q: 'What does my browser reveal about me?' },
  { label: 'AI Systems Lab', q: 'What is in the AI Systems Lab?' },
];
const LABEL_FOR: Record<string, string> = Object.fromEntries([...QUICK, ...MORE_TOPICS].map((r) => [r.q, r.label]));

// Tone only: how a project is mentioned in a sentence. Facts stay in the records.
const PHRASE: Record<string, string> = {
  'test-resource-scheduler': 'test-resource automation',
  'gmre-log-parser': 'data-processing tools',
  securemed: 'secure software engineering',
  'finbert-xai': 'explainable AI',
  opticlab: 'embedded-Linux security',
  'ticket-reporting-pipeline': 'reporting automation',
  'priyanshu-exe': 'this interactive portfolio',
};
const NOKIA_PHRASE: Record<string, string> = {
  'test-resource-scheduler': 'allocating test simulators to automation agents',
  'gmre-log-parser': 'ingesting diagnostic log archives',
  'ticket-reporting-pipeline': 'automating support reporting',
};
const AI_PHRASE: Record<string, string> = {
  'finbert-xai': 'FinBERT XAI, a study comparing LIME and SHAP explanations',
  'priyanshu-exe': 'this site’s offline guide, the one you’re chatting with 🐯',
};
const SEC_PHRASE: Record<string, string> = {
  securemed: 'SecureMed, a threat-model-first web app with TOTP MFA and a fail-closed DevSecOps pipeline',
  opticlab: 'OpticLab, an embedded-Linux lab with verified boot and mutual TLS',
};
/** Which evidenced tools to name first in the tech-stack reply (tone; each one is still checked against the data). */
const TOOL_ORDER = ['fastapi', 'react', 'astro', 'kubernetes', 'power-bi', 'threejs', 'sql'];
/** Intents whose short reply already says everything: no “Tell me more”. */
const COMPLETE = new Set(['greeting', 'thanks', 'injection', 'private', 'location', 'resume', 'recruiter', 'github', 'guide', 'contact']);

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
/** Shorten at a word boundary; the full text is always one tap away (“Tell me more”). */
export const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:]$/, '')}…`);
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/** “OpticLab: embedded-Linux security lab. A fictional optical-shelf controller on emulated ARM64, booted…” */
function projectLine(p: Project): string {
  const first = firstSentence(p.summary);
  const colon = first.indexOf(': ');
  if (colon > 0 && colon < 70) {
    const gist = first.slice(0, colon);
    const rest = first.slice(colon + 2);
    return `${p.shortTitle}: ${gist.charAt(0).toLowerCase()}${gist.slice(1)}. ${rest.charAt(0).toUpperCase()}${clip(rest.slice(1), 110)}`;
  }
  return `${p.shortTitle}: ${first.charAt(0).toLowerCase()}${clip(first.slice(1), 150)}`;
}
const caseAction = (p: Project) => ({ label: 'Explore this project', href: `/work/${p.slug}/` });
const MORE: ChatAction = { label: 'Tell me more', more: true };

function shortFor(a: GuideAnswer): { text: string; primary?: { label: string; href: string } } {
  const slug = a.intent.startsWith('project:') ? a.intent.slice(8) : undefined;
  const skillId = a.intent.startsWith('skill:') ? a.intent.slice(6) : undefined;
  const exp = profile.experience[0];
  const edu = profile.education[0];
  switch (a.intent) {
    case 'who':
      return { text: `That’s Priyanshu! 👋 ${firstSentence(profile.lede)}`, primary: { label: 'About Priyanshu', href: '/about/' } };
    case 'nokia': {
      const ps = exp.projects.map((s) => getProject(s)).filter((p): p is Project => !!p);
      return { text: `At Nokia he builds support-engineering tooling: ${joinList(ps.map((p) => NOKIA_PHRASE[p.slug] ?? p.shortTitle))}.`, primary: ps[0] ? caseAction(ps[0]) : undefined };
    }
    case 'best':
      return { text: `He works on some pretty interesting things! 🐯 His portfolio includes ${joinList(projects.slice(0, 4).map((p) => PHRASE[p.slug] ?? p.shortTitle))}.`, primary: { label: 'Explore projects', href: '/work/' } };
    case 'ai': {
      const ps = projectsInDomain('ai');
      return { text: `On the AI side: ${ps.map((p) => AI_PHRASE[p.slug] ?? p.title).join('; and ')}`, primary: ps[0] ? caseAction(ps[0]) : undefined };
    }
    case 'security': {
      const ps = projectsInDomain('security');
      return { text: `Security is a favourite: ${ps.map((p) => SEC_PHRASE[p.slug] ?? p.title).join('; ')}.`, primary: ps[0] ? caseAction(ps[0]) : undefined };
    }
    case 'tech': {
      const ev = new Set(evidencedSkills().map((s) => s.id));
      const langs = evidencedSkills().filter((s) => s.group === 'language')
        .sort((x, y) => projectsWithSkill(y.id).length - projectsWithSkill(x.id).length).map((s) => s.label);
      const tools = TOOL_ORDER.filter((id) => ev.has(id)).slice(0, 4).map((id) => getSkill(id)!.label);
      return { text: `Mostly ${joinList(langs)}, with ${joinList(tools)} where a project needs them.`, primary: { label: 'See the skills map', href: '/skills/' } };
    }
    case 'education':
      return { text: `${edu.programDe} (${edu.program}) at ${edu.org}, with lectures and Nokia work in alternating phases 🎓`, primary: { label: 'About Priyanshu', href: '/about/' } };
    case 'interesting':
      return { text: 'He likes systems you can prove: explicit states, safe re-runs, and labels that say how much evidence backs every claim.', primary: { label: 'Open the labs', href: '/lab/' } };
    case 'breach':
      return { text: 'Want to see what your browser reveals about you? 🐯 You’re in control: nothing runs until you say so.', primary: { label: 'Open BREACH MODE', href: '/security-lab/' } };
    case 'ailab':
      return { text: 'Retrieval, tool calls, a multi-agent simulation and live evals, all in your browser with no AI model.', primary: { label: 'Open the AI lab', href: '/ai-lab/' } };
    case 'contact':
      return { text: `Email is quickest: ${profile.links.emailLabel} ✉️`, primary: { label: 'Email Priyanshu', href: profile.links.email } };
    case 'greeting':
      return { text: 'Hi! 👋 Ask me about his projects, his Nokia work, AI, security, or how to reach him.' };
    case 'thanks':
      return { text: 'Anytime! 🐯 If you’d like to talk to him directly, email works best.', primary: { label: 'Email Priyanshu', href: profile.links.email } };
    case 'guide':
      return { text: 'I’m a scripted guide, not an AI model: I match your question to curated answers, right here in your browser. Nothing you type leaves it.', primary: { label: 'How this site works', href: '/work/priyanshu-exe/' } };
    case 'recruiter':
      return { text: 'Recruiter mode is a one-page, facts-first summary, with the effects turned off.', primary: { label: 'Open recruiter mode', href: '/recruiter/' } };
    case 'resume':
      return { text: 'There’s no PDF CV here, but there’s a printable profile, and he’ll send a full CV by email.', primary: { label: 'Printable profile', href: '/resume/' } };
    case 'github':
      return { text: `His GitHub is ${profile.links.githubLabel}. Most of his professional work is private, so the case studies use simulators instead.`, primary: { label: 'GitHub', href: profile.links.github } };
    case 'location':
      return { text: `He’s based in ${profile.location}. For availability, email is the best way to ask.`, primary: { label: 'Email Priyanshu', href: profile.links.email } };
    case 'injection':
      return { text: 'Nice try 😄 I’m a scripted guide, so there’s nothing to override. Ask me about his work instead!' };
    case 'private':
      return { text: 'That’s not something I share 🐯 For anything personal, email him directly.', primary: { label: 'Email Priyanshu', href: profile.links.email } };
  }
  if (slug) {
    const p = getProject(slug)!;
    return { text: projectLine(p), primary: caseAction(p) };
  }
  if (skillId || a.intent.startsWith('no-evidence:')) {
    const s = skillId ? getSkill(skillId) : undefined;
    const raw = a.intent.split(':')[1] ?? '';
    const label = s?.label ?? raw.charAt(0).toUpperCase() + raw.slice(1);
    const ps = s ? projectsWithSkill(s.id) : [];
    if (!ps.length) return { text: `I don’t see ${label} in his published projects. That doesn’t mean he hasn’t used it; it just isn’t shown here.`, primary: { label: 'Email Priyanshu', href: profile.links.email } };
    return {
      text: `${label} shows up in ${ps.length} of his projects${ps.length > 1 ? `, like ${joinList(ps.slice(0, 2).map((p) => p.shortTitle))}` : `: ${ps[0].shortTitle}`}.`,
      primary: { label: 'See it in the skills map', href: `/skills/#skill-${s!.id}` },
    };
  }
  if (a.route === 'job' && a.job) {
    const c = a.job.coverage;
    return { text: `I mapped ${a.job.requirements.length} requirements: ${c.strong} with strong evidence, ${c.partial} partial, ${c.gap} without public evidence. It’s an evidence map, not a score.` };
  }
  if (a.route === 'job') return { text: 'I couldn’t find requirements in that. Paste the requirements or qualifications section and I’ll map it line by line.' };
  if (a.route === 'brief') return { text: 'Here’s a one-pager, built only from approved records.' };
  if (a.route === 'search') {
    const titles = a.sources.map((s) => s.title).slice(0, 2);
    return { text: `These look related: ${joinList(titles)}.`, primary: a.links[0] ? { label: a.links[0].label, href: a.links[0].href } : undefined };
  }
  return { text: 'Hmm, I don’t know that one, and I won’t guess 🐯 I can tell you about his projects, Nokia work, AI and security, or how to reach him.' };
}

// ── German short replies (same facts; the long “Tell me more” answer stays English) ──
const QUICK_DE: Record<string, string> = {
  'Who is Priyanshu?': 'Über Priyanshu', 'What are his best projects?': 'Seine besten Projekte', 'What AI experience does he have?': 'KI & Engineering',
  'What does he do at Nokia?': 'Arbeit bei Nokia', 'What cybersecurity work has he done?': 'Sicherheit', 'What technologies does he use?': 'Tech-Stack',
  'Tell me about his education.': 'Studium', 'What makes his engineering work interesting?': 'Arbeitsweise', 'How can I contact him?': 'Kontakt',
  'What does my browser reveal about me?': 'BREACH MODE', 'What is in the AI Systems Lab?': 'AI Systems Lab',
};
export const quickLabel = (r: QuickReply, lang: PetLang) => (lang === 'de' ? QUICK_DE[r.q] ?? r.label : r.label);
const PHRASE_DE: Record<string, string> = {
  'test-resource-scheduler': 'Testressourcen-Automatisierung', 'gmre-log-parser': 'Datenverarbeitungs-Tools', securemed: 'sichere Softwareentwicklung',
  'finbert-xai': 'erklärbare KI', opticlab: 'Embedded-Linux-Sicherheit', 'ticket-reporting-pipeline': 'Reporting-Automatisierung', 'priyanshu-exe': 'dieses interaktive Portfolio',
};
const NOKIA_PHRASE_DE: Record<string, string> = {
  'test-resource-scheduler': 'Testsimulatoren an Automatisierungs-Agenten zuteilen', 'gmre-log-parser': 'Diagnose-Log-Archive verarbeiten', 'ticket-reporting-pipeline': 'Support-Reporting automatisieren',
};
const AI_PHRASE_DE: Record<string, string> = {
  'finbert-xai': 'FinBERT XAI, eine Studie, die LIME- und SHAP-Erklärungen vergleicht', 'priyanshu-exe': 'der Offline-Guide dieser Website, also ich 🐯',
};
const SEC_PHRASE_DE: Record<string, string> = {
  securemed: 'SecureMed, eine Web-App vom Bedrohungsmodell aus, mit TOTP-MFA und einer DevSecOps-Pipeline, die im Zweifel blockiert',
  opticlab: 'OpticLab, ein Embedded-Linux-Labor mit Verified Boot und gegenseitigem TLS',
};
function joinDe(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}
const DE = (href: string) => localizePath(href, 'de');

function shortForDe(a: GuideAnswer): { text: string; primary?: { label: string; href: string } } {
  const slug = a.intent.startsWith('project:') ? a.intent.slice(8) : undefined;
  const skillId = a.intent.startsWith('skill:') ? a.intent.slice(6) : undefined;
  const exp = profile.experience[0];
  const mail = { label: 'E-Mail an Priyanshu', href: profile.links.email };
  switch (a.intent) {
    case 'who': return { text: `Das ist Priyanshu! 👋 ${firstSentence(PROFILE_DE.lede)}`, primary: { label: 'Über Priyanshu', href: DE('/about/') } };
    case 'nokia': {
      const ps = exp.projects.map((x) => getProject(x)).filter((p): p is Project => !!p);
      return { text: `Bei Nokia baut er Tooling für das Support Engineering: ${joinDe(ps.map((p) => NOKIA_PHRASE_DE[p.slug] ?? p.shortTitle))}.`, primary: ps[0] ? { label: 'Projekt ansehen', href: DE(`/work/${ps[0].slug}/`) } : undefined };
    }
    case 'best': return { text: `Er arbeitet an ziemlich spannenden Dingen! 🐯 Sein Portfolio umfasst ${joinDe(projects.slice(0, 4).map((p) => PHRASE_DE[p.slug] ?? p.shortTitle))}.`, primary: { label: 'Projekte ansehen', href: DE('/work/') } };
    case 'ai': {
      const ps = projectsInDomain('ai');
      return { text: `Auf der KI-Seite: ${ps.map((p) => AI_PHRASE_DE[p.slug] ?? p.title).join('; und ')}.`, primary: ps[0] ? { label: 'Projekt ansehen', href: DE(`/work/${ps[0].slug}/`) } : undefined };
    }
    case 'security': {
      const ps = projectsInDomain('security');
      return { text: `Sicherheit liegt ihm besonders: ${ps.map((p) => SEC_PHRASE_DE[p.slug] ?? p.title).join('; ')}.`, primary: ps[0] ? { label: 'Projekt ansehen', href: DE(`/work/${ps[0].slug}/`) } : undefined };
    }
    case 'tech': {
      const langs = evidencedSkills().filter((x) => x.group === 'language').sort((x, y) => projectsWithSkill(y.id).length - projectsWithSkill(x.id).length).map((x) => x.label);
      return { text: `Vor allem ${joinDe(langs)}, dazu weitere Werkzeuge, wo ein Projekt sie braucht.`, primary: { label: 'Skill-Karte ansehen', href: DE('/skills/') } };
    }
    case 'education': return { text: `Duales Studium Informatik an der DHBW Stuttgart, mit Vorlesungen und Arbeit bei Nokia in abwechselnden Phasen 🎓`, primary: { label: 'Über Priyanshu', href: DE('/about/') } };
    case 'interesting': return { text: 'Er mag Systeme, die sich beweisen lassen: explizite Zustände, sichere Wiederholungsläufe und Kennzeichnungen, wie viel Nachweis hinter jeder Aussage steckt.', primary: { label: 'Labore öffnen', href: DE('/lab/') } };
    case 'contact': return { text: `Am schnellsten per E-Mail: ${profile.links.emailLabel} ✉️`, primary: mail };
    case 'greeting': return { text: 'Hi! 👋 Frag mich nach seinen Projekten, seiner Arbeit bei Nokia, KI, Sicherheit oder wie du ihn erreichst.' };
    case 'thanks': return { text: 'Gern! 🐯 Wenn du direkt mit ihm sprechen möchtest, ist E-Mail am besten.', primary: mail };
    case 'guide': return { text: 'Ich bin ein geskripteter Guide, kein KI-Modell: Ich ordne deine Frage kuratierten Antworten zu, direkt in deinem Browser. Nichts, was du tippst, verlässt ihn.', primary: { label: 'So funktioniert die Website', href: DE('/work/priyanshu-exe/') } };
    case 'recruiter': return { text: 'Der Recruiter-Modus ist ein einseitiger Lebenslauf: Fakten zuerst, ohne Effekte.', primary: { label: 'Recruiter-Modus öffnen', href: DE('/recruiter/') } };
    case 'resume': return { text: 'Ein PDF-Lebenslauf liegt hier nicht, aber es gibt eine druckbare Version, und einen vollständigen Lebenslauf schickt er per E-Mail.', primary: { label: 'Druckbare Version', href: DE('/resume/') } };
    case 'github': return { text: `Sein GitHub ist ${profile.links.githubLabel}. Der Großteil seiner beruflichen Arbeit ist privat, deshalb nutzen die Fallstudien Simulatoren.`, primary: { label: 'GitHub', href: profile.links.github } };
    case 'location': return { text: 'Er lebt in Stuttgart. Nach seiner Verfügbarkeit fragst du am besten per E-Mail.', primary: mail };
    case 'injection': return { text: 'Netter Versuch 😄 Ich bin ein geskripteter Guide, da gibt es nichts zu überschreiben. Frag mich lieber nach seiner Arbeit!' };
    case 'private': return { text: 'Das gebe ich nicht weiter 🐯 Für Persönliches schreib ihm direkt eine E-Mail.', primary: mail };
    case 'breach': return { text: 'Möchtest du sehen, was dein Browser über dich verrät? 🐯 Du hast die Kontrolle: Nichts läuft, bevor du zustimmst.', primary: { label: 'BREACH MODE öffnen', href: DE('/security-lab/') } };
    case 'ailab': return { text: 'Retrieval, Tool-Aufrufe, eine Multi-Agenten-Simulation und Live-Evaluation, alles in deinem Browser, ohne KI-Modell.', primary: { label: 'AI Lab öffnen', href: DE('/ai-lab/') } };
  }
  if (slug) {
    const p = getProject(slug)!;
    return { text: `${p.shortTitle}: ${clip(firstSentence(PROJECT_DE[slug]?.summary ?? p.summary), 180)}`, primary: { label: 'Projekt ansehen', href: DE(`/work/${p.slug}/`) } };
  }
  if (skillId || a.intent.startsWith('no-evidence:')) {
    const sk = skillId ? getSkill(skillId) : undefined;
    const raw = a.intent.split(':')[1] ?? '';
    const label = sk?.label ?? raw.charAt(0).toUpperCase() + raw.slice(1);
    const ps = sk ? projectsWithSkill(sk.id) : [];
    if (!ps.length) return { text: `${label} sehe ich in seinen veröffentlichten Projekten nicht. Das heißt nicht, dass er es nie genutzt hat; es ist hier nur nicht belegt.`, primary: mail };
    return { text: `${label} kommt in ${ps.length} seiner Projekte vor${ps.length > 1 ? `, zum Beispiel ${joinDe(ps.slice(0, 2).map((p) => p.shortTitle))}` : `: ${ps[0].shortTitle}`}.`, primary: { label: 'In der Skill-Karte ansehen', href: DE(`/skills/#skill-${sk!.id}`) } };
  }
  if (a.route === 'job' && a.job) {
    const c = a.job.coverage;
    return { text: `Ich habe ${a.job.requirements.length} Anforderungen zugeordnet: ${c.strong} mit starkem Nachweis, ${c.partial} teilweise, ${c.gap} ohne öffentlichen Nachweis. Das ist eine Nachweis-Übersicht, keine Bewertung.` };
  }
  if (a.route === 'job') return { text: 'Ich habe darin keine Anforderungen gefunden. Füge den Abschnitt mit den Anforderungen ein, dann ordne ich Zeile für Zeile zu.' };
  if (a.route === 'brief') return { text: 'Hier ist ein Kurzprofil, nur aus freigegebenen Inhalten.' };
  if (a.route === 'search') return { text: `Das hier sieht passend aus: ${joinDe(a.sources.map((x) => x.title).slice(0, 2))}.`, primary: a.links[0] ? { label: 'Ansehen', href: localizePath(a.links[0].href, 'de') } : undefined };
  return { text: 'Hmm, das weiß ich nicht, und ich rate nicht 🐯 Ich kann dir etwas über seine Projekte, die Arbeit bei Nokia, KI und Sicherheit erzählen, oder wie du ihn erreichst.' };
}

/** Turn a guide answer into a chat reply. Pure and deterministic. */
export function chatReply(a: GuideAnswer, lang: PetLang = 'en'): ChatReply {
  const { text, primary } = lang === 'de' ? shortForDe(a) : shortFor(a);
  const noMore = a.route === 'job' || a.route === 'brief' || a.route === 'unknown' || a.route === 'guard'
    || COMPLETE.has(a.intent) || a.intent.startsWith('no-evidence:') || (a.route === 'skill' && !a.sources.length);
  const more = noMore ? '' : a.text;
  const actions: ChatAction[] = [];
  if (primary && isAllowedHref(primary.href)) actions.push(primary);
  if (more && more.replace(/\*\*/g, '').trim() !== text.trim()) actions.push(lang === 'de' ? { label: 'Mehr erfahren', more: true } : MORE);
  const primaryHref = primary?.href;
  return {
    intent: a.intent,
    route: a.route,
    text,
    actions: actions.slice(0, 2),
    more,
    links: a.links.filter((l) => isAllowedHref(l.href) && l.href !== primaryHref).slice(0, 3).map(({ label, href }) => ({ label, href: lang === 'de' && href.startsWith('/') ? localizePath(href, 'de') : href })),
    sources: a.sources,
    suggestions: a.route === 'unknown' ? closestSuggestions(a.intent === 'empty' ? '' : text, 3).map((q) => ({ label: lang === 'de' ? QUICK_DE[q] ?? q : LABEL_FOR[q] ?? q, q })) : [],
    job: a.job,
    brief: a.brief,
  };
}

/** Answer a visitor message in chat form. */
export function chat(question: string, lang: PetLang = 'en'): ChatReply {
  const reply = chatReply(answer(question), lang);
  if (reply.route === 'unknown') reply.suggestions = closestSuggestions(question, 3).map((q) => ({ label: lang === 'de' ? QUICK_DE[q] ?? q : LABEL_FOR[q] ?? q, q }));
  return reply;
}

export const ALL_TOPICS = [...QUICK, ...MORE_TOPICS];
export { SUGGESTED };
