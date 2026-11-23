// Site-wide interaction layer: keyboard shortcuts, terminal,
// PRIYANSHU.AI portfolio guide, X-Ray overlay and toasts. Heavy parts load on demand.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { emit, on } from '../lib/bus';
import { getPrefs, setPref } from '../lib/prefs';
import { localizePath, type Locale } from '../i18n/index';

const GuideDrawer = lazy(() => import('./guide/GuideDrawer'));
const Terminal = lazy(() => import('./Terminal'));

type Toast = { id: number; text: string };
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function labelIslands(on: boolean) {
  document.querySelectorAll('astro-island').forEach((el) => {
    if (!on) return el.removeAttribute('data-xray-label');
    const url = el.getAttribute('component-url') || '';
    const name = url.split('/').pop()?.replace(/\.[jt]sx?.*$/, '').replace(/\..*$/, '') || 'island';
    const client = el.getAttribute('client') || 'only';
    el.setAttribute('data-xray-label', `${name} · client:${client}`);
  });
}

/**
 * guide="drawer" (default, every V2 page): this layer owns the portfolio-guide drawer.
 * guide="external": another island (the V3 design-lab pet bot) listens for 'pexe:agent-open' instead.
 */
export default function GlobalUI({ guide = 'drawer', lang = 'en' }: { guide?: 'drawer' | 'external'; lang?: Locale }) {
  const [terminal, setTerminal] = useState(false);
  const [agent, setAgent] = useState<{ open: boolean; prompt?: string; mode?: 'chat' | 'job'; send?: boolean; nonce: number }>({ open: false, nonce: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef<string[]>([]);
  const gPending = useRef(false);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const toggleXray = useCallback(() => {
    const next = getPrefs().xray === 'on' ? 'off' : 'on';
    setPref('xray', next);
    labelIslands(next === 'on');
    toast(next === 'on'
      ? (lang === 'de' ? 'X-Ray an: gestrichelte Rahmen sind hydrierte React-Islands. Alles andere ist statisches HTML.' : 'X-Ray on: dashed outlines are hydrated React islands. Everything else is static HTML.')
      : (lang === 'de' ? 'X-Ray aus' : 'X-Ray off'));
  }, [toast, lang]);

  useEffect(() => {
    const offs = [
      on('pexe:terminal-open', () => setTerminal(true)),
      on('pexe:prefs', (p) => labelIslands(p.xray === 'on')),
    ];
    if (guide === 'drawer') {
      offs.push(on('pexe:agent-open', (d) => setAgent((a) => ({ open: true, prompt: d.prompt, mode: d.mode, send: d.send, nonce: a.nonce + 1 }))));
      const askParam = new URLSearchParams(location.search).get('ask');
      if (askParam !== null) setAgent((a) => ({ open: true, prompt: askParam.slice(0, 300) || undefined, send: !!askParam, nonce: a.nonce + 1 }));
    }
    return () => offs.forEach((f) => f());
  }, [guide]);

  // Tell the pet bot when the guide drawer opens or closes (after the first open only).
  useEffect(() => { if (agent.nonce > 0) emit('pexe:guide', { open: agent.open }); }, [agent.open, agent.nonce]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); emit('pexe:agent-open', {}); return; }
      if (isTyping(e.target) || mod || e.altKey) return;

      seq.current = [...seq.current, e.key].slice(-KONAMI.length);
      if (KONAMI.every((k, i) => seq.current[i]?.toLowerCase() === k.toLowerCase())) {
        seq.current = [];
        if (getPrefs().xray !== 'on') toggleXray();
        toast('Blueprint unlocked. You found the X-Ray. Press X to toggle, or visit /xray/ for the full teardown.');
        return;
      }
      if (gPending.current) {
        gPending.current = false;
        const dest: Record<string, string> = { h: '/', w: '/work/', s: '/skills/', l: '/lab/', x: '/xray/', a: '/about/', r: '/recruiter/' };
        if (dest[e.key]) { e.preventDefault(); location.href = localizePath(dest[e.key], lang); }
        return;
      }
      switch (e.key) {
        case '/': e.preventDefault(); emit('pexe:agent-open', {}); break;
        case '`': case '~': e.preventDefault(); setTerminal((t) => !t); break;
        case 'x': case 'X': toggleXray(); break;
        case 'p': case 'P': setPref('theme', getPrefs().theme === 'paper' ? 'dark' : 'paper'); break;
        case 'g': gPending.current = true; setTimeout(() => (gPending.current = false), 900); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast, toggleXray, lang]);

  return (
    <>
      {terminal && (
        <Suspense fallback={null}>
          <Terminal onClose={() => setTerminal(false)} />
        </Suspense>
      )}
      {guide === 'drawer' && (agent.open || agent.nonce > 0) && (
        <Suspense fallback={null}>
          <GuideDrawer
            key="agent"
            open={agent.open}
            initialPrompt={agent.prompt}
            initialMode={agent.mode}
            autoSend={agent.send}
            nonce={agent.nonce}
            onClose={() => setAgent((a) => ({ ...a, open: false }))}
          />
        </Suspense>
      )}
      <div className="pexe-toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="pexe-toast">{t.text}</div>)}
      </div>
      <style>{`
        .pexe-toasts { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 120; display: grid; gap: 8px; width: min(560px, calc(100vw - 32px)); pointer-events: none; }
        .pexe-toast { padding: 12px 16px; border-radius: 8px; background: var(--fg); color: var(--bg); font: 500 0.875rem/1.45 var(--font-body); box-shadow: 0 18px 40px rgba(0,0,0,.4); animation: rise-in 360ms var(--ease) both; }
      `}</style>
    </>
  );
}
