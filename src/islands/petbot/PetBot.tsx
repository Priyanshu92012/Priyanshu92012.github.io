// Priyanshu's Pet Bot: the always-present tiger cub (≈4 KB on page load).
//  V2 site (variant "v2"): the bot owns a small messaging panel (ChatPanel, lazy) on the scripted guide.
//  Design lab (other variants): the bot owns the lab's compact panel (PetPanel, lazy).
//  connect="guide" (kept for reference): clicking opens GlobalUI's guide drawer instead.
// Behaviour: one greeting per session (never in recruiter mode), one offer per project per session,
// a farewell on close, small reactions to project interactions. No audio, no repeated interruptions.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { emit, on } from '../../lib/bus';
import Mascot, { type Mood } from './Mascot';
import { onPet } from './events';
import { PET, PROJECT_OFFERS, type PetLang } from './copy'; // no imports: keeps the guide engine out of every page
import './petbot.css';

const PetPanel = lazy(() => import('./PetPanel'));
const ChatPanel = lazy(() => import('./ChatPanel'));

type Bubble = { kind: 'greet' | 'offer' | 'farewell'; text: string; question?: string };
export type PetVariant = 'v2' | 'monolith' | 'orbit' | 'signal';

const ss = {
  get(k: string) { try { return sessionStorage.getItem(k); } catch { return '1'; } },
  set(k: string) { try { sessionStorage.setItem(k, '1'); } catch { /* storage blocked: stay quiet */ } },
};
/** First visit only: remembered across sessions when storage allows it (and per session otherwise). */
/** At most one greeting per browser session (sessionStorage only; nothing persists across visits). */
const greeted = ss;
const root = () => document.documentElement;
const reduced = () => root().dataset.motion === 'reduce';
const recruiter = () => root().dataset.mode === 'recruiter';

export default function PetBot({ variant, connect = 'panel', lang = 'en' }: { variant: PetVariant; connect?: 'panel' | 'guide'; lang?: PetLang }) {
  const T = PET[lang];
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mood, setMood] = useState<Mood>('idle');
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [request, setRequest] = useState<{ prompt?: string; send?: boolean; mode?: 'chat' | 'job'; nonce: number }>({ nonce: 0 });
  const isChat = variant === 'v2';
  const btn = useRef<HTMLButtonElement>(null);
  const bubbleTimer = useRef<number>(0);
  const moodTimer = useRef<number>(0);
  const openRef = useRef(open);
  openRef.current = open;

  const showBubble = useCallback((b: Bubble | null, ms = 0) => {
    clearTimeout(bubbleTimer.current);
    setBubble(b);
    if (b && ms) bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  }, []);
  const react = useCallback((m: Mood, ms = 1600) => {
    clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = window.setTimeout(() => setMood('idle'), ms);
  }, []);

  const opened = useCallback(() => { showBubble(null); setOpen(true); react('happy', 1200); }, [react, showBubble]);
  const closed = useCallback(() => {
    setOpen(false);
    react('wave', 2200);
    showBubble({ kind: 'farewell', text: T.farewell }, 2400);
  }, [react, showBubble, T]);

  const openPanel = useCallback((prompt?: string, send?: boolean, mode?: 'chat' | 'job') => {
    if (connect === 'guide') { emit('pexe:agent-open', { prompt, send, mode }); return; } // GlobalUI opens the drawer, then tells us
    setLoaded(true);
    setRequest((r) => ({ prompt, send, mode, nonce: r.nonce + 1 }));
    opened();
  }, [connect, opened]);

  const closePanel = useCallback(() => {
    closed();
    requestAnimationFrame(() => btn.current?.focus());
  }, [closed]);

  // One greeting per session. V2: once for the whole site; design lab: once per concept.
  useEffect(() => {
    const key = variant === 'v2' ? 'pexe:pet-greeted' : `pexe:pet-greeted:${variant}`;
    const store = variant === 'v2' ? greeted : ss;
    if (store.get(key) || recruiter()) return;
    const greet = (ms: number) => {
      if (openRef.current || store.get(key)) return;
      store.set(key);
      react('wave', 2400);
      showBubble({ kind: 'greet', text: T.greeting }, ms);
    };
    // Phones: the bubble would cover the hero's buttons, so it waits until the visitor has scrolled past them.
    if (matchMedia('(max-width: 560px)').matches) {
      let t = 0;
      const onScroll = () => { if (window.scrollY > 320 && !t) { t = window.setTimeout(() => greet(7000), 1200); window.removeEventListener('scroll', onScroll); } };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); };
    }
    const t1 = window.setTimeout(() => greet(9000), 1400);
    const dismissOnScroll = () => { if (window.scrollY > 700) setBubble((b) => (b?.kind === 'greet' ? null : b)); };
    window.addEventListener('scroll', dismissOnScroll, { passive: true });
    return () => { clearTimeout(t1); window.removeEventListener('scroll', dismissOnScroll); };
  }, [variant, isChat, react, showBubble, T]);

  // Blinking (random, sparse). Nothing moves under reduced motion or in recruiter mode.
  useEffect(() => {
    if (reduced() || recruiter()) return;
    let t = 0;
    const loop = () => {
      t = window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 150); loop(); }, 2800 + Math.random() * 3800);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // '/', ⌘J, the terminal and page CTAs ask for the guide. In panel mode that is us;
  // in guide mode GlobalUI opens the drawer and reports its state.
  useEffect(() => {
    if (connect === 'panel') return on('pexe:agent-open', (d) => openPanel(d.prompt, d.send, d.mode));
    return on('pexe:guide', (d) => (d.open ? opened() : openRef.current && closed()));
  }, [connect, openPanel, opened, closed]);

  // ?ask=<question> deep links open the chat with an answer.
  useEffect(() => {
    if (!isChat) return;
    const q = new URLSearchParams(location.search).get('ask');
    if (q !== null) openPanel(q.slice(0, 300) || undefined, !!q);
  }, [isChat, openPanel]);

  // Reactions to the page.
  useEffect(() => onPet((e) => {
    if (e.kind !== 'project') return;
    react('happy');
    const offer = PROJECT_OFFERS[lang][e.slug];
    const key = `pexe:pet-offer:${e.slug}`;
    if (!offer || openRef.current || ss.get(key) || recruiter()) return;
    ss.set(key);
    window.setTimeout(() => { if (!openRef.current) showBubble({ kind: 'offer', text: offer.text, question: offer.question }, 7000); }, 500);
  }), [react, showBubble, lang]);

  useEffect(() => () => { clearTimeout(bubbleTimer.current); clearTimeout(moodTimer.current); }, []);

  return (
    <div className={`pb pb--${variant}${open ? ' is-open' : ''}`}>
      <div className="pb-dock">
        {bubble && (
          <div className={`pb-bubble pb-bubble--${bubble.kind}${isChat ? ' pb-bubble--chat' : ''}`} role="status">
            <p>{bubble.text}</p>
            {bubble.kind === 'greet' && (
              <div className="pb-bubble-acts">
                <a className="pb-bubble-cta" href={lang === 'de' ? '/de/work/' : '/work/'} onClick={() => showBubble(null)}>{T.explore}</a>
                <button type="button" className="pb-bubble-cta" onClick={() => openPanel()}>{T.ask}</button>
              </div>
            )}
            {bubble.kind === 'offer' && bubble.question && (
              <button type="button" className="pb-bubble-cta" onClick={() => openPanel(bubble.question, true)}>{T.ask} <span aria-hidden="true">↗</span></button>
            )}
            {bubble.kind !== 'farewell' && (
              <button type="button" className="pb-bubble-x" aria-label={T.dismiss} onClick={() => showBubble(null)}>×</button>
            )}
          </div>
        )}
        <button
          ref={btn}
          type="button"
          className="pb-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={T.button}
          title={T.title}
          onClick={() => (open && connect === 'panel' ? closePanel() : openPanel())}
          onPointerEnter={() => !open && setMood((m) => (m === 'idle' ? 'curious' : m))}
          onPointerLeave={() => setMood((m) => (m === 'curious' ? 'idle' : m))}
        >
          <Mascot mood={mood} blink={blink} />
        </button>
      </div>
      {connect === 'panel' && loaded && (
        <Suspense fallback={null}>
          {isChat
            ? <ChatPanel open={open} onClose={closePanel} prompt={request.prompt} send={request.send} mode={request.mode} nonce={request.nonce} lang={lang} />
            : <PetPanel open={open} onClose={closePanel} variant={variant} prompt={request.prompt} send={request.send} nonce={request.nonce} onAnswer={() => react('happy', 1000)} />}
        </Suspense>
      )}
    </div>
  );
}
