// The Pet Bot conversation panel (lazy chunk). Answers come from petReply(), i.e. the
// deterministic portfolio guide over the approved records. Accessible dialog: labelled,
// focus moves in and is trapped, Escape closes, focus returns to the mascot.
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from '../agent/Markdown';
import { BriefView, JobMatchView } from '../agent/Artifacts';
import { isAllowedHref, isExternal } from '../../lib/guide/links';
import Mascot from './Mascot';
import { PET_QUESTIONS, petReply, type PetReply } from './logic';
import '../guide/guide.css'; // evidence-matrix / brief artefact styles

type Turn = PetReply & { id: number };
let seq = 0;

function Dest({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  if (!isAllowedHref(href)) return null;
  const web = /^https?:/.test(href);
  return (
    <a className={`pbp-link${primary ? ' is-primary' : ''}`} href={href} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {label}<span aria-hidden="true">{isExternal(href) ? (web ? ' ↗' : ' ✉') : ' →'}</span>
    </a>
  );
}

export default function PetPanel({ open, onClose, variant, prompt, send, nonce, onAnswer }: {
  open: boolean; onClose: () => void; variant: string; prompt?: string; send?: boolean; nonce: number; onAnswer: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const panel = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const last = useRef<HTMLLIElement>(null);

  const ask = useCallback((q: string) => {
    const text = q.trim().slice(0, 6000);
    if (!text) return;
    setTurns((t) => [...t.slice(-5), { ...petReply(text), id: ++seq }]);
    setInput('');
    onAnswer();
  }, [onAnswer]);

  useEffect(() => {
    if (!open) return;
    if (prompt && send) ask(prompt); else if (prompt) setInput(prompt);
    requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>(turns.length || prompt ? '#pbp-input' : '.pbp-q') ?? inputRef.current)?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nonce]);

  useEffect(() => {
    const el = last.current;
    if (el && body.current) body.current.scrollTo({ top: el.offsetTop - 8, behavior: document.documentElement.dataset.motion === 'reduce' ? 'auto' : 'smooth' });
  }, [turns.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, summary, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`pbp-root pbp--${variant}${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="pbp-scrim" onClick={onClose} />
      <section className="pbp" role="dialog" aria-modal="true" aria-labelledby="pbp-title" ref={panel} inert={!open}>
        <header className="pbp-head">
          <span className="pbp-avatar"><Mascot mood={turns.length ? 'happy' : 'idle'} /></span>
          <div className="pbp-titles">
            <h2 id="pbp-title">Priyanshu’s Pet Bot <span aria-hidden="true">🐯</span></h2>
            <p>Scripted portfolio companion</p>
          </div>
          {turns.length > 0 && <button type="button" className="pbp-tool" onClick={() => setTurns([])}>All questions</button>}
          <button type="button" className="pbp-tool pbp-close" onClick={onClose} aria-label="Close the pet bot">✕</button>
        </header>

        <div className="pbp-body" ref={body}>
          {turns.length === 0 ? (
            <div className="pbp-intro">
              <p className="pbp-hello">Hey there! I’m here to help you discover Priyanshu’s work. What would you like to know?</p>
              <ul className="pbp-qs" aria-label="Suggested questions">
                {PET_QUESTIONS.map((q, i) => (
                  <li key={q.id} style={{ ['--i' as string]: i }}>
                    <button type="button" className="pbp-q" onClick={() => ask(q.question)}>
                      <span className="pbp-q-emoji" aria-hidden="true">{q.emoji}</span>
                      <span>{q.question}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="pbp-thread" aria-live="polite" aria-relevant="additions">
              {turns.map((t, i) => (
                <li key={t.id} className="pbp-turn" ref={i === turns.length - 1 ? last : undefined}>
                  <p className="pbp-you"><span className="sr-only">You asked: </span>{t.question.length > 240 ? `${t.question.slice(0, 240)}…` : t.question}</p>
                  <article className={`pbp-answer r-${t.answer.route}`} data-intent={t.answer.intent} aria-label="Answer">
                    {t.lead && <p className="pbp-lead">{t.lead}</p>}
                    <div className="pbp-text ag-text"><Markdown text={t.summary} /></div>
                    {t.more && (
                      <details className="pbp-more">
                        <summary>More details</summary>
                        <div className="pbp-text ag-text"><Markdown text={t.more} /></div>
                      </details>
                    )}
                    {t.answer.job && <JobMatchView data={t.answer.job} />}
                    {t.answer.brief && <BriefView data={t.answer.brief} />}
                    {(t.links.length > 0 || t.actions.length > 0) && (
                      <div className="pbp-links">
                        {t.links.map((l) => <Dest key={l.href} href={l.href} label={l.label} primary={l.primary} />)}
                        {t.actions.map((a) => <Dest key={a.href} href={a.href} label={a.label} />)}
                      </div>
                    )}
                    {t.answer.followUps.length > 0 && (
                      <div className="pbp-next">
                        <span>{t.answer.route === 'unknown' ? 'I can tell you about' : 'Ask next'}</span>
                        {t.answer.followUps.map((f) => <button key={f} type="button" onClick={() => ask(f)}>{f}</button>)}
                      </div>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>

        <form className="pbp-compose" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <label className="sr-only" htmlFor="pbp-input">Ask the pet bot</label>
          <input id="pbp-input" ref={inputRef} value={input} maxLength={1200} autoComplete="off" onChange={(e) => setInput(e.target.value)} placeholder="Ask me something…" />
          <button type="submit" disabled={!input.trim()}>Ask</button>
        </form>
        <p className="pbp-note">Scripted, not generative: curated answers from Priyanshu’s approved portfolio records. No AI model, and nothing you type leaves your browser.</p>
      </section>
    </div>
  );
}
