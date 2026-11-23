// Terminal mode: the v1 command interface, preserved and upgraded. Unknown input
// goes to the scripted portfolio guide (src/lib/guide): local, instant, no network.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { profile, projects, skillList, projectsWithSkill, getProject, STATUS_LABEL, EVIDENCE_LABEL, domainList, projectsInDomain } from '../data/index';
import { answer, toPlain, SUGGESTED } from '../lib/guide/index';
import { isAllowedHref } from '../lib/guide/links';
import { findProjectMention } from '../lib/guide/index';
import { executeTool } from '../lib/agent/tools';
import { emit } from '../lib/bus';
import { getPrefs, setPref } from '../lib/prefs';

type Line = { id: number; cls: 'cmd' | 'out' | 'muted' | 'accent' | 'err' | 'blank'; text: ReactNode };
let lid = 0;
const L = (cls: Line['cls'], text: ReactNode = ''): Line => ({ id: lid++, cls, text });

const BANNER = [
  L('accent', 'PRIYANSHU.EXE · terminal'),
  L('muted', 'type `help` for commands. Anything else goes to the portfolio guide (scripted, offline).'),
  L('blank'),
];

function resolve(arg: string) {
  const a = arg.trim().toLowerCase();
  return getProject(a) ?? projects.find((p) => p.slug.startsWith(a)) ?? (findProjectMention(a) ? getProject(findProjectMention(a)!) : undefined);
}

export default function Terminal({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState('');
  const hist = useRef<string[]>([]);
  const hIdx = useRef(-1);
  const input = useRef<HTMLInputElement>(null);
  const out = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prev.current = document.activeElement as HTMLElement;
    input.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); prev.current?.focus?.(); };
  }, [onClose]);
  useEffect(() => { out.current?.scrollTo({ top: out.current.scrollHeight }); }, [lines]);

  const print = (...l: Line[]) => setLines((x) => [...x, ...l]);

  function ask(q: string) {
    const a = answer(q);
    if (a.highlight) emit('pexe:focus', { target: a.highlight.target, id: a.highlight.id, source: 'agent' });
    const body = toPlain(a).split('\n').filter((x, i, arr) => x.trim() || (i > 0 && arr[i - 1].trim()));
    print(
      ...body.map((x) => L(x.startsWith('- ') ? 'out' : 'out', x || ' ')),
      ...(a.job ? [L('muted', `job match: ${a.job.coverage.strong} strong · ${a.job.coverage.partial} partial · ${a.job.coverage.gap} gap. Open the guide (/) for the full matrix.`)] : []),
      ...(a.links.length ? [L('muted', <>{a.links.filter((l) => isAllowedHref(l.href)).map((l, i) => <a key={l.href} href={l.href} {...(/^https?:/.test(l.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{i ? ' · ' : '→ '}{l.label}</a>)}</>)] : []),
      ...(a.followUps.length ? [L('muted', `try: ${a.followUps.map((f) => `ask ${f}`).join('  |  ')}`)] : []),
      L('blank'),
    );
  }

  function run(raw: string) {
    const cmd = raw.trim();
    print(L('cmd', cmd));
    if (!cmd) return;
    hist.current = [...hist.current, cmd].slice(-50); hIdx.current = -1;
    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(' ');
    switch (head.toLowerCase()) {
      case 'help': return print(...[
        ['whoami', 'short bio'], ['projects | ls [domain]', 'list projects (domains: systems, ai, security, research)'], ['cat <project>', 'project detail'],
        ['open <project>', 'open a case study'], ['cd <page>', 'go to a page (work, skills, lab, xray, about, recruiter, ~)'],
        ['sims', 'list the interactive simulators'], ['skills | stack', 'skills with evidence counts'], ['evidence <skill>', 'which projects prove a skill'],
        ['ask <question>', 'ask the portfolio guide'], ['questions', 'suggested questions'], ['match', 'job-description matcher'], ['brief [audience]', 'download an evidence brief'],
        ['contact | social', 'email, LinkedIn, GitHub'], ['github | linkedin', 'open profile'], ['policy', 'the AI’s public rules (alias: prompt)'],
        ['xray | paper | motion', 'toggle modes'], ['history | clear | exit', ''],
      ].map(([c, d]) => L('out', <><span className="t-c">{c.padEnd(24, ' ')}</span><span className="t-d">{d}</span></>)), L('muted', 'anything else → portfolio guide (scripted, offline)'), L('blank'));
      case 'whoami': return print(L('out', `${profile.name}: ${profile.role}, ${profile.location}.`), L('out', profile.lede), L('blank'));
      case 'projects': case 'ls': {
        const d = domainList.find((x) => x.id === arg.toLowerCase() || x.short.toLowerCase() === arg.toLowerCase());
        const list = d ? projectsInDomain(d.id) : [...projects];
        return print(...list.map((p) => L('out', <><span className="t-c">{String(p.index).padStart(2, '0')} {p.shortTitle.padEnd(20, ' ')}</span><span className="t-d">{STATUS_LABEL[p.status]} · {EVIDENCE_LABEL[p.evidence]}</span></>)), L('muted', 'cat <name> for detail · open <name> to view'), L('blank'));
      }
      case 'cat': {
        const p = resolve(arg);
        if (!p) return print(L('err', `cat: ${arg || '(missing)'}: no such project. Try \`ls\`.`), L('blank'));
        return print(L('accent', `${p.title}${p.org ? ` · ${p.org}` : ''}`), L('muted', `${STATUS_LABEL[p.status]} · ${EVIDENCE_LABEL[p.evidence]} · ${p.role}`), L('out', p.summary),
          ...p.outcomes.map((o) => L('out', `• ${o.claim} [${o.basis}]`)), ...(p.confidentiality ? [L('muted', p.confidentiality)] : []),
          L('out', <a href={`/work/${p.slug}/`}>→ /work/{p.slug}/</a>), L('blank'));
      }
      case 'open': {
        const p = resolve(arg);
        if (!p) return print(L('err', `open: unknown project "${arg}"`), L('blank'));
        print(L('accent', `opening ${p.title}…`));
        setTimeout(() => (location.href = `/work/${p.slug}/`), 300);
        return;
      }
      case 'cd': {
        const pages: Record<string, string> = { '': '/', '~': '/', '/': '/', '..': '/', home: '/', work: '/work/', skills: '/skills/', lab: '/lab/', xray: '/xray/', 'x-ray': '/xray/', about: '/about/', recruiter: '/recruiter/', resume: '/resume/' };
        const key = arg.toLowerCase().replace(/^\/+|\/+$/g, '');
        const dest = pages[key] ?? (resolve(arg) ? `/work/${resolve(arg)!.slug}/` : undefined);
        if (!dest) return print(L('err', `cd: ${arg}: no such page. Try: ${Object.keys(pages).filter((k) => /^[a-z]/.test(k)).join(', ')}`), L('blank'));
        print(L('muted', `→ ${dest}`));
        setTimeout(() => (location.href = dest), 250);
        return;
      }
      case 'sims': case 'labs': return print(
        ...projects.filter((p) => p.demo && p.demo.kind !== 'xray').map((p) => L('out', <a href={`/work/${p.slug}/#demo`}><span className="t-c">{p.shortTitle.padEnd(20, ' ')}</span><span className="t-d">{p.demo!.title}</span></a>)),
        L('muted', 'synthetic data, real algorithms · cd lab for the overview'), L('blank'));
      case 'skills': case 'stack': return print(...domainList.map((d) => L('out', <><span className="t-c">{d.short.padEnd(10, ' ')}</span><span className="t-d">{skillList.filter((s) => s.domain === d.id && projectsWithSkill(s.id).length).map((s) => `${s.label}(${projectsWithSkill(s.id).length})`).join(' · ')}</span></>)), L('muted', 'evidence <skill> for proof'), L('blank'));
      case 'evidence': {
        if (!arg) return print(L('err', 'usage: evidence <skill>'), L('blank'));
        const r = executeTool('showSkillEvidence', { skill: arg });
        const o = r.output as { found: boolean; skill?: string; projects?: { title: string; status: string; public_evidence: string }[]; note?: string };
        for (const a of r.actions) if (a.type === 'focus') emit('pexe:focus', { target: a.target, id: a.id, source: 'user' });
        return print(...(o.found ? [L('accent', o.skill!), ...o.projects!.map((p) => L('out', `• ${p.title} (${p.status}; ${p.public_evidence})`))] : [L('muted', o.note!)]), L('blank'));
      }
      case 'brief': {
        const r = executeTool('generateBrief', { audience: arg || undefined });
        if (r.artifact?.kind === 'brief') {
          const b = r.artifact.data;
          const url = URL.createObjectURL(new Blob([b.markdown], { type: 'text/markdown' }));
          return print(L('out', `${b.title}: ${r.summary}`), L('out', <a href={url} download={b.filename}>↓ download {b.filename}</a>), L('blank'));
        }
        return;
      }
      case 'ask': return void (arg ? ask(arg) : print(L('err', 'usage: ask <question>   (try: questions)')));
      case 'match': onClose(); emit('pexe:agent-open', { mode: 'job' }); return;
      case 'contact': case 'social': case 'email': return print(L('out', <a href={profile.links.email}>email     {profile.links.emailLabel}</a>), L('out', <a href={profile.links.linkedin} target="_blank" rel="noopener">linkedin  {profile.links.linkedinLabel}</a>), L('out', <a href={profile.links.github} target="_blank" rel="noopener">github    {profile.links.githubLabel}</a>), L('blank'));
      case 'github': window.open(profile.links.github, '_blank', 'noopener'); return print(L('muted', 'opened GitHub in a new tab'), L('blank'));
      case 'linkedin': window.open(profile.links.linkedin, '_blank', 'noopener'); return print(L('muted', 'opened LinkedIn in a new tab'), L('blank'));
      case 'policy': case 'prompt': case 'guide': return print(L('accent', 'Priyanshu’s pet bot · portfolio guide'), L('out', 'A scripted guide, not a language model. Questions are matched to curated topics (synonyms + keywords),'), L('out', 'to a named project or skill, or to the job matcher; answers are assembled from the approved records in src/data.'), L('out', 'Unknown questions get an honest "not covered" with the closest topics. Nothing you type leaves your browser.'), L('blank'));
      case 'questions': case 'q': return print(...SUGGESTED.map((x) => L('out', <><span className="t-c">{x.kicker.padEnd(11, ' ')}</span><span className="t-d">ask {x.question}</span></>)), L('blank'));
      case 'xray': { const n = getPrefs().xray === 'on' ? 'off' : 'on'; setPref('xray', n); return print(L('muted', `x-ray ${n}`), L('blank')); }
      case 'paper': case 'theme': { const n = getPrefs().theme === 'paper' ? 'dark' : 'paper'; setPref('theme', n); return print(L('muted', `theme: ${n}`), L('blank')); }
      case 'motion': { const n = getPrefs().motion === 'reduce' ? 'full' : 'reduce'; setPref('motion', n); return print(L('muted', `motion: ${n}`), L('blank')); }
      case 'history': return print(...hist.current.map((h, i) => L('muted', `${String(i + 1).padStart(3, ' ')}  ${h}`)), L('blank'));
      case 'clear': return setLines([]);
      case 'exit': case 'quit': return onClose();
      case 'sudo':
        if (/hire\s+priyanshu/i.test(arg)) { print(L('accent', '[sudo] permission granted. Opening a direct line…')); setTimeout(() => (location.href = profile.links.email), 700); return; }
        return print(L('err', `${profile.name.toLowerCase()} is not in the sudoers file. This incident will be reported. (try: sudo hire priyanshu)`), L('blank'));
      case 'rm': return print(L('err', 'rm: refusing to operate on a read-only portfolio. Every tool here is read-only by design.'), L('blank'));
      default: ask(cmd);
    }
  }

  return (
    <div className="term-root" role="dialog" aria-modal="true" aria-label="Terminal">
      <div className="term-bar"><span>priyanshu@exe: ~</span><button type="button" onClick={onClose} aria-label="Close terminal">esc ✕</button></div>
      <div className="term-out" ref={out} aria-live="polite">
        {lines.map((l) => (
          <div key={l.id} className={`t-line t-${l.cls}`}>{l.cls === 'cmd' ? <><span className="t-prompt">~ %</span> {l.text}</> : l.text}</div>
        ))}
      </div>
      <form className="term-in" onSubmit={(e) => { e.preventDefault(); run(value); setValue(''); }}>
        <span className="t-prompt" aria-hidden="true">~ %</span>
        <label className="sr-only" htmlFor="term-input">Command</label>
        <input
          id="term-input" ref={input} value={value} autoComplete="off" spellCheck={false} autoCapitalize="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); const h = hist.current; if (!h.length) return; hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1); setValue(h[hIdx.current]); }
            if (e.key === 'ArrowDown') { e.preventDefault(); const h = hist.current; if (hIdx.current < 0) return; hIdx.current = Math.min(h.length, hIdx.current + 1); setValue(h[hIdx.current] ?? ''); if (hIdx.current >= h.length) hIdx.current = -1; }
            if (e.key === 'Tab') {
              e.preventDefault();
              const cmds = ['help', 'whoami', 'projects', 'ls', 'cat', 'open', 'skills', 'evidence', 'ask', 'match', 'brief', 'contact', 'github', 'linkedin', 'policy', 'xray', 'paper', 'motion', 'history', 'clear', 'exit'];
              const [h, ...r] = value.split(' ');
              if (!r.length) { const m = cmds.filter((c) => c.startsWith(h)); if (m.length === 1) setValue(`${m[0]} `); }
              else if (['cat', 'open'].includes(h)) { const m = projects.filter((p) => p.slug.startsWith(r.join(' '))); if (m.length === 1) setValue(`${h} ${m[0].slug}`); }
            }
          }}
          placeholder="help"
        />
      </form>
      <style>{`
        .term-root { position: fixed; left: 0; right: 0; top: 0; z-index: 105; height: min(62vh, 560px); display: grid; grid-template-rows: auto 1fr auto; background: color-mix(in srgb, #05070B 97%, transparent); color: #D6DEEA; border-bottom: 1px solid #2A3550; box-shadow: 0 30px 80px rgba(0,0,0,.6); font: 0.8125rem/1.65 var(--font-mono); animation: term-drop 320ms var(--ease) both; }
        @keyframes term-drop { from { transform: translateY(-100%); } }
        .term-bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid #1C2536; color: #8C97AA; font-size: .75rem; }
        .term-bar button { background: none; border: 0; color: #8C97AA; cursor: pointer; font: inherit; }
        .term-out { overflow-y: auto; padding: 12px 16px; }
        .t-line { white-space: pre-wrap; overflow-wrap: anywhere; min-height: 1.2em; }
        .t-cmd { color: #E9EEF6; } .t-muted { color: #8C97AA; } .t-accent { color: #8BFFB0; } .t-err { color: #FF885E; }
        .t-c { color: #E9EEF6; } .t-d { color: #8C97AA; }
        .t-prompt { color: #8BFFB0; }
        .term-out a { color: #7A8CFF; }
        .term-in { display: flex; gap: 10px; align-items: center; padding: 10px 16px 14px; border-top: 1px solid #1C2536; }
        .term-in input { flex: 1; background: none; border: 0; outline: none; color: #E9EEF6; font: inherit; caret-color: #8BFFB0; min-width: 0; }
      `}</style>
    </div>
  );
}
