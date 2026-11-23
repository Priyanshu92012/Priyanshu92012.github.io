// Priyanshu's Pet Bot · Portfolio guide. A scripted, in-browser guide: answers are assembled
// instantly from the approved content model (src/lib/guide). No AI model, no network,
// no fake typing. Links are allowlisted twice (engine + render). The tiger (src/islands/petbot)
// adds a voice, a short summary with “More details”, and contextual next steps.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { answer, SUGGESTED, type GuideAnswer, type GuideLink } from '../../lib/guide/index';
import { isAllowedHref, isExternal } from '../../lib/guide/links';
import { emit } from '../../lib/bus';
import Markdown from '../agent/Markdown';
import Mascot from '../petbot/Mascot';
import { decorate, type PetReply } from '../petbot/logic';
import { BriefView, JobMatchView } from '../agent/Artifacts';
import './guide.css';
import '../petbot/petbot.css';

type Turn = { id: string; q: string; a: GuideAnswer; r: PetReply };
const turn = (q: string): Turn => { const a = answer(q); return { id: uid(), q, a, r: decorate(a, q) }; };
/** Routes whose text is prose about the portfolio: shown as summary + “More details”. Job maps, briefs and fallbacks stay whole. */
const SPLIT = new Set<GuideAnswer['route']>(['curated', 'project', 'skill']);
const STORE = 'pexe:guide';
const ROUTE_KICKER: Record<GuideAnswer['route'], string> = {
  curated: 'From the portfolio', project: 'Project record', skill: 'Skill evidence', job: 'Job match',
  brief: 'Evidence brief', search: 'Matching records', guard: 'Not shared here', unknown: 'Not covered',
};

let seq = 0;
const uid = () => `g${Date.now().toString(36)}${(seq++).toString(36)}`;
function loadQuestions(): string[] { try { return JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch { return []; } }
function saveQuestions(qs: string[]) { try { sessionStorage.setItem(STORE, JSON.stringify(qs.slice(-12))); } catch { /* storage blocked */ } }

function LinkButton({ l }: { l: GuideLink }) {
  if (!isAllowedHref(l.href)) return null;
  const ext = isExternal(l.href);
  const web = /^https?:/.test(l.href);
  return (
    <a className={`btn btn-sm${l.primary ? ' btn-primary' : ''}`} href={l.href} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {l.label}<span className="arrow" aria-hidden="true">{ext ? (web ? ' ↗' : ' ✉') : ' →'}</span>
    </a>
  );
}

export default function GuideDrawer({ open, onClose, initialPrompt, initialMode, autoSend, nonce }: {
  open: boolean; onClose: () => void; initialPrompt?: string; initialMode?: 'chat' | 'job'; autoSend?: boolean; nonce: number;
}) {
  // Re-derive answers from stored questions: always current, never a stale saved answer.
  const [turns, setTurns] = useState<Turn[]>(() => loadQuestions().map(turn));
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'job'>('chat');
  const [jd, setJd] = useState('');
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const lastAnswer = useRef<HTMLLIElement>(null);

  useEffect(() => saveQuestions(turns.map((t) => t.q)), [turns]);
  useEffect(() => {
    // bring the newest answer's top into view (not the bottom: answers can be long)
    const el = lastAnswer.current;
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 12, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [turns.length]);

  const ask = useCallback((text: string) => {
    const q = text.trim().slice(0, 6000);
    if (!q) return;
    const next = turn(q);
    if (next.a.highlight) emit('pexe:focus', { target: next.a.highlight.target, id: next.a.highlight.id, source: 'agent' });
    setTurns((t) => [...t, next]);
    setInput('');
    setTab('chat');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement;
    if (initialMode === 'job') setTab('job');
    if (initialPrompt) { if (autoSend) ask(initialPrompt); else setInput(initialPrompt); }
    requestAnimationFrame(() => (initialMode === 'job' ? document.getElementById('ag-jd') : inputRef.current)?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nonce]);

  useEffect(() => {
    if (!open) { returnFocus.current?.focus?.(); return; }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const cards = useMemo(() => SUGGESTED, []);

  return (
    <div className={`ag-root ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="ag-scrim" onClick={onClose} />
      <aside className="ag" role="dialog" aria-modal="true" aria-labelledby="ag-title" ref={panel} inert={!open}>
        <header className="ag-head">
          <div className="ag-title">
            <span className="gd-avatar pb--v2" aria-hidden="true"><Mascot mood={turns.length ? 'happy' : 'idle'} /></span>
            <h2 id="ag-title">Priyanshu’s <span>pet bot</span></h2>
            <span className="gd-badge">Portfolio guide</span>
          </div>
          <div className="ag-tools">
            {turns.length > 0 && <button type="button" className="ag-icon" onClick={() => setTurns([])}>Start over</button>}
            <button type="button" className="ag-icon ag-close" onClick={onClose} aria-label="Close the portfolio guide">✕</button>
          </div>
        </header>

        <div className="ag-tabs" role="tablist" aria-label="Guide mode">
          <button role="tab" type="button" id="gd-tab-chat" aria-controls="gd-panel" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>Ask</button>
          <button role="tab" type="button" id="gd-tab-job" aria-controls="gd-panel" aria-selected={tab === 'job'} onClick={() => setTab('job')}>Match a job</button>
        </div>

        <div className="ag-body" ref={scroller} id="gd-panel" role="tabpanel" aria-labelledby={tab === 'job' ? 'gd-tab-job' : 'gd-tab-chat'}>
          {tab === 'job' ? (
            <div className="ag-job">
              <p>Paste a job description. Each requirement is mapped to published project evidence: <b>strong</b>, <b>partial</b>, <b>no public evidence</b> or <b>not assessable</b>. It’s an evidence map, not a score, and it runs entirely in your browser.</p>
              <label className="sr-only" htmlFor="ag-jd">Job description</label>
              <textarea id="ag-jd" className="field" rows={10} value={jd} maxLength={6000} onChange={(e) => setJd(e.target.value)} placeholder="Paste the requirements / qualifications section…" />
              <div className="ag-job-foot">
                <span className="muted mono">{jd.length}/6000</span>
                <button className="btn btn-primary btn-sm" type="button" disabled={jd.trim().length < 40} onClick={() => ask(`Compare this job description to the portfolio evidence:\n\n${jd}`)}>Map evidence →</button>
              </div>
            </div>
          ) : (
            <>
              {turns.length === 0 && (
                <div className="gd-intro">
                  <p className="eyebrow"><span className="dot" />Explore Priyanshu’s work</p>
                  <p className="gd-hello">Hey there! I’m here to help you discover Priyanshu’s work. What would you like to know?</p>
                  <p className="gd-sub">Curated answers from the portfolio’s own records. Instant and private: no AI model, nothing leaves your browser.</p>
                  <ul className="gd-cards">
                    {cards.map((c, i) => (
                      <li key={c.id} style={{ ['--i' as string]: i }}>
                        <button type="button" className={`gd-card${c.domain ? ` d-${c.domain}` : ''}`} onClick={() => ask(c.question)}>
                          <span className="gd-kicker">{c.kicker}</span>
                          <span className="gd-q">{c.question}</span>
                          <span className="gd-go" aria-hidden="true">→</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {turns.length > 0 && (
                <ol className="ag-thread" aria-live="polite" aria-relevant="additions">
                  {turns.map((t, i) => (
                    <li key={t.id} className="gd-turn" ref={i === turns.length - 1 ? lastAnswer : undefined}>
                      <p className="ag-user"><span className="sr-only">You asked: </span>{t.q.length > 300 ? `${t.q.slice(0, 300)}…` : t.q}</p>
                      <article className={`gd-answer r-${t.a.route}`} aria-label="Answer">
                        <p className="gd-kick">{ROUTE_KICKER[t.a.route]}</p>
                        {t.r.lead && <p className="gd-lead">{t.r.lead}</p>}
                        {SPLIT.has(t.a.route) ? (
                          <>
                            <div className="ag-text"><Markdown text={t.r.summary} /></div>
                            {t.r.more && (
                              <details className="gd-more">
                                <summary>More details</summary>
                                <div className="ag-text"><Markdown text={t.r.more} /></div>
                              </details>
                            )}
                          </>
                        ) : <div className="ag-text"><Markdown text={t.a.text} /></div>}
                        {t.a.job && <JobMatchView data={t.a.job} />}
                        {t.a.brief && <BriefView data={t.a.brief} />}
                        {(t.a.links.length > 0 || t.r.actions.length > 0) && (
                          <div className="gd-links">
                            {t.a.links.map((l) => <LinkButton key={l.href} l={l} />)}
                            {t.r.actions.map((x) => <LinkButton key={x.href} l={{ label: x.label, href: x.href }} />)}
                          </div>
                        )}
                        {t.a.sources.length > 0 && (
                          <div className="ag-sources"><span className="eyebrow">Sources</span>{t.a.sources.map((s) => <a key={s.url} className="tag" href={s.url}>{s.title}</a>)}</div>
                        )}
                        {t.a.followUps.length > 0 && (
                          <div className="gd-next">
                            <span className="eyebrow">{t.a.route === 'unknown' ? 'Closest topics' : 'Ask next'}</span>
                            {t.a.followUps.map((f) => <button key={f} type="button" className="chip" onClick={() => ask(f)}>{f}</button>)}
                          </div>
                        )}
                      </article>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>

        <form className="ag-compose" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <label className="sr-only" htmlFor="ag-input">Ask the portfolio guide</label>
          <textarea
            id="ag-input" ref={inputRef} rows={1} value={input} maxLength={1200}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            placeholder="Ask about projects, Nokia, AI, security…"
          />
          <button className="btn btn-sm btn-accent" type="submit" disabled={!input.trim()}>Ask</button>
        </form>
        <p className="ag-privacy">Scripted guide · answers come only from approved portfolio records · nothing you type leaves your browser</p>
      </aside>
    </div>
  );
}
