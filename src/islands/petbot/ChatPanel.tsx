// The pet bot's chat (V2 site, lazy chunk). A small messaging panel: short bubbles, at most two
// actions per reply, the full answer only on “Tell me more”. Answers come from the deterministic
// guide via chat.ts, so nothing is generated and nothing leaves the browser.
// Accessibility: a non-modal dialog (never traps focus), Escape closes, focus returns to the tiger,
// the conversation is a polite live log, and the panel lifts above an on-screen keyboard.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Markdown from '../agent/Markdown';
import { BriefView, JobMatchView } from '../agent/Artifacts';
import { isAllowedHref, isExternal } from '../../lib/guide/links';
import { answer } from '../../lib/guide/index';
import Mascot from './Mascot';
import { chat, chatReply, quickLabel, QUICK, MORE_TOPICS, type ChatReply, type QuickReply } from './chat';
import { PET, type PetLang } from './copy';
import { splitAnswer } from './logic';
import '../guide/guide.css'; // evidence-matrix and brief artefact styles
import './chat.css';

type Msg =
  | { id: number; from: 'me'; text: string }
  | { id: number; from: 'bot'; text: string; reply?: ChatReply; long?: ChatReply; job?: true };
let seq = 0;
const STORE = 'pexe:chat';

function load(): Msg[] { try { return JSON.parse(sessionStorage.getItem(STORE) || '[]').slice(-30); } catch { return []; } }
function save(m: Msg[]) {
  try {
    // keep only what is needed to rebuild the conversation; replies are re-derived (always current)
    sessionStorage.setItem(STORE, JSON.stringify(m.slice(-30).map((x) => (x.from === 'me' ? x : { id: x.id, from: 'bot', text: x.text, q: (x as Msg & { q?: string }).q, long: !!x.long, job: x.job }))));
  } catch { /* storage blocked */ }
}
function revive(raw: Msg[], lang: PetLang): Msg[] {
  return raw.map((m) => {
    seq = Math.max(seq, m.id);
    const q = (m as Msg & { q?: string }).q;
    if (m.from === 'bot' && q) { const r = chat(q, lang); return m.long ? { ...m, long: r, reply: undefined } : { ...m, reply: r }; }
    return m;
  });
}

function Action({ href, label }: { href: string; label: string }) {
  if (!isAllowedHref(href)) return null;
  const web = /^https?:/.test(href);
  return (
    <a className="ck-act" href={href} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {label}<span aria-hidden="true">{isExternal(href) ? (web ? ' ↗' : ' ✉') : ' →'}</span>
    </a>
  );
}

export default function ChatPanel({ open, onClose, prompt, send, mode, nonce, lang = 'en' }: {
  open: boolean; onClose: () => void; prompt?: string; send?: boolean; mode?: 'chat' | 'job'; nonce: number; lang?: PetLang;
}) {
  const T = PET[lang];
  const [msgs, setMsgs] = useState<Msg[]>(() => revive(load(), lang));
  const [asking, setAsking] = useState(false);
  const [input, setInput] = useState('');
  const [more, setMore] = useState(false);
  const [jobMode, setJobMode] = useState(false);
  const [jd, setJd] = useState('');
  const panel = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const jdRef = useRef<HTMLTextAreaElement>(null);
  const scrollTo = useRef<number | null>(null);

  useEffect(() => save(msgs), [msgs]);

  const push = useCallback((...m: Msg[]) => setMsgs((cur) => [...cur, ...m].slice(-40)), []);

  const ask = useCallback((q: string, shown?: string) => {
    const text = q.trim().slice(0, 1200);
    if (!text) return;
    const reply = chat(text, lang);
    const me: Msg = { id: ++seq, from: 'me', text: (shown ?? text).slice(0, 240) };
    const bot = { id: ++seq, from: 'bot' as const, text: reply.text, reply, q: text };
    scrollTo.current = bot.id;
    push(me, bot as Msg);
    setInput('');
    setMore(false);
  }, [push, lang]);

  const tellMore = useCallback((r: ChatReply, q?: string) => {
    const bot = { id: ++seq, from: 'bot' as const, text: '', long: r, q };
    scrollTo.current = bot.id;
    push({ id: ++seq, from: 'me', text: T.tellMore }, bot as Msg);
  }, [push]);

  const startJob = useCallback(() => {
    setMore(false);
    setJobMode(true);
    const bot: Msg = { id: ++seq, from: 'bot', text: T.jobIntro, job: true };
    scrollTo.current = bot.id;
    push(bot);
    requestAnimationFrame(() => jdRef.current?.focus());
  }, [push]);

  const mapJob = useCallback(() => {
    if (jd.trim().length < 40) return;
    const a = answer(`Compare this job description to the portfolio evidence:\n\n${jd}`);
    const reply = chatReply(a, lang);
    const bot: Msg = { id: ++seq, from: 'bot', text: reply.text, reply };
    scrollTo.current = bot.id;
    push({ id: ++seq, from: 'me', text: `Job description (${jd.trim().split(/\n/).length} lines)` }, bot);
    setJd(''); setJobMode(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [jd, push]);

  // open / external requests ('/', the Guide button, ?ask=, the terminal's job matcher)
  useEffect(() => {
    if (!open) return;
    if (mode === 'job') startJob();
    else if (prompt && send) ask(prompt);
    else if (prompt) setInput(prompt);
    const coarse = matchMedia('(pointer: coarse)').matches;
    // on touch screens, don't pop the keyboard up uninvited: move focus to the panel instead
    requestAnimationFrame(() => (coarse ? panel.current : (mode === 'job' ? jdRef.current : inputRef.current))?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nonce]);

  // Escape closes, wherever focus is (the chat never traps it)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // scroll only to a message the visitor just asked for, and only so far that its top is visible
  useLayoutEffect(() => {
    const id = scrollTo.current;
    if (id === null || !log.current) return;
    scrollTo.current = null;
    const el = log.current.querySelector<HTMLElement>(`[data-msg="${id}"]`);
    if (!el) return;
    const top = el.offsetTop - 12;
    const box = log.current;
    if (top < box.scrollTop || el.offsetTop + Math.min(el.offsetHeight, box.clientHeight) > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: Math.max(0, Math.min(top, box.scrollHeight)), behavior: document.documentElement.dataset.motion === 'reduce' ? 'auto' : 'smooth' });
    }
  }, [msgs]);

  // keep the panel above an on-screen keyboard (visualViewport shrinks when it opens)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv || !panel.current) return;
    const el = panel.current;
    const fit = () => el.style.setProperty('--ck-kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    fit();
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); el.style.removeProperty('--ck-kb'); };
  }, [open]);

  const quick = (r: QuickReply) => ask(r.q, quickLabel(r, lang));
  const startAsking = () => { setAsking(true); requestAnimationFrame(() => inputRef.current?.focus()); };
  const started = msgs.some((m) => m.from === 'me');

  return (
    <section className={`ck${open ? ' is-open' : ''}`} role="dialog" aria-modal="false" aria-labelledby="ck-title" ref={panel} tabIndex={-1} inert={!open}>
      <header className="ck-head">
        <span className="ck-av ck-av-lg" aria-hidden="true"><Mascot mood="idle" /></span>
        <div className="ck-who">
          <h2 id="ck-title">{T.panelTitle}</h2>
          <p><span className="ck-dot" aria-hidden="true" />{T.panelSub}</p>
        </div>
        {started && <button type="button" className="ck-tool" onClick={() => { setMsgs([]); setMore(false); setJobMode(false); setAsking(false); }}>{T.clear}</button>}
        <button type="button" className="ck-tool ck-x" onClick={onClose} aria-label={T.close}>✕</button>
      </header>

      <div className="ck-log" ref={log} role="log" aria-live="polite" aria-label={T.log}>
        <div className="ck-row bot">
          <span className="ck-av" aria-hidden="true"><Mascot mood="happy" /></span>
          <div className="ck-bubble"><p>{T.greeting}</p></div>
        </div>
        {!started && !asking && (
          <div className="ck-quick" role="group" aria-label={T.suggested}>
            <a className="ck-chip ck-chip-link" href={lang === 'de' ? '/de/work/' : '/work/'}>{T.explore}</a>
            <button type="button" className="ck-chip" onClick={startAsking}>{T.ask}</button>
          </div>
        )}
        {!started && asking && (
          <div className="ck-quick" role="group" aria-label={T.suggested}>
            <p className="ck-hint">{T.askHint}</p>
            {QUICK.map((r) => <button key={r.q} type="button" className="ck-chip" onClick={() => quick(r)}>{quickLabel(r, lang)}</button>)}
            {!more && <button type="button" className="ck-chip ck-chip-quiet" onClick={() => setMore(true)} aria-expanded="false">{T.more}</button>}
          </div>
        )}
        {!started && asking && more && (
          <div className="ck-quick ck-quick-more" role="group" aria-label={T.moreTopics}>
            {MORE_TOPICS.map((r) => <button key={r.q} type="button" className="ck-chip" onClick={() => quick(r)}>{quickLabel(r, lang)}</button>)}
            <button type="button" className="ck-chip ck-chip-quiet" onClick={startJob}>{T.job}</button>
          </div>
        )}

        {msgs.map((m) => m.from === 'me' ? (
          <div key={m.id} className="ck-row me" data-msg={m.id}><div className="ck-bubble"><p><span className="sr-only">{T.you} </span>{m.text}</p></div></div>
        ) : (
          <div key={m.id} className="ck-row bot" data-msg={m.id}>
            <span className="ck-av" aria-hidden="true"><Mascot mood="idle" /></span>
            <div className="ck-bubble" data-intent={m.reply?.intent ?? m.long?.intent}>
              {m.long ? (
                <>
                  {(() => { const { summary, more: rest } = splitAnswer(m.long.more); return (<>
                    {T.englishOnly && <p className="ck-en">{T.englishOnly}</p>}
                    <div className="ck-md ag-text" lang={lang === 'de' ? 'en' : undefined}><Markdown text={summary} /></div>
                    {rest && <details className="ck-src"><summary>{T.fullAnswer}</summary><div className="ck-md ag-text" lang={lang === 'de' ? 'en' : undefined}><Markdown text={rest} /></div></details>}
                  </>); })()}
                  {m.long.links.length > 0 && <p className="ck-acts">{m.long.links.map((l) => <Action key={l.href} {...l} />)}</p>}
                  {m.long.sources.length > 0 && (
                    <details className="ck-src"><summary>{T.sources}</summary>
                      <ul>{m.long.sources.map((s) => <li key={s.url}><a href={s.url}>{s.title}</a></li>)}</ul>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p>{m.text}</p>
                  {m.reply?.job && <details className="ck-src"><summary>{T.evidenceMap}</summary><JobMatchView data={m.reply.job} /></details>}
                  {m.reply?.brief && <details className="ck-src"><summary>{T.onePager}</summary><BriefView data={m.reply.brief} /></details>}
                  {m.reply && m.reply.actions.length > 0 && (
                    <p className="ck-acts">
                      {m.reply.actions.map((a) => ('href' in a
                        ? <Action key={a.href} href={a.href} label={a.label} />
                        : <button key="more" type="button" className="ck-act ck-act-more" onClick={() => tellMore(m.reply!, (m as Msg & { q?: string }).q)}>{a.label}</button>))}
                    </p>
                  )}
                  {m.reply && m.reply.suggestions.length > 0 && (
                    <div className="ck-quick ck-quick-in" role="group" aria-label={T.tryThese}>
                      {m.reply.suggestions.map((r) => <button key={r.q} type="button" className="ck-chip" onClick={() => quick(r)}>{r.label}</button>)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {jobMode ? (
        <form className="ck-compose ck-compose-job" onSubmit={(e) => { e.preventDefault(); mapJob(); }}>
          <label className="sr-only" htmlFor="ck-jd">{T.jdLabel}</label>
          <textarea id="ck-jd" ref={jdRef} rows={4} maxLength={6000} value={jd} onChange={(e) => setJd(e.target.value)} placeholder={T.jdPlaceholder} />
          <div className="ck-job-row">
            <button type="button" className="ck-tool" onClick={() => setJobMode(false)}>{T.cancel}</button>
            <button type="submit" className="ck-send-lg" disabled={jd.trim().length < 40}>{T.map}</button>
          </div>
        </form>
      ) : (
        <form className="ck-compose" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <label className="sr-only" htmlFor="ck-input">{T.inputLabel}</label>
          <input id="ck-input" ref={inputRef} value={input} maxLength={1200} autoComplete="off" enterKeyHint="send" onChange={(e) => setInput(e.target.value)} placeholder={T.placeholder} />
          <button type="submit" className="ck-send" disabled={!input.trim()} aria-label={T.send}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      )}
    </section>
  );
}
