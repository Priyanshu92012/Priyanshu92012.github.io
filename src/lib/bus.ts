// Typed cross-island event bus (CustomEvents on window).
// The AI agent never touches the DOM directly: it emits validated UI actions,
// which become these events; islands decide how to react.

export type FocusTarget = 'lab' | 'constellation' | 'any';

export type BusEvents = {
  /** Highlight a project (slug), skill (skill:<id>) or domain (domain:<id>) in whichever visualization is on screen. */
  'pexe:focus': { target: FocusTarget; id: string | null; source: 'user' | 'agent' | 'index' };
  /** Open the PRIYANSHU.AI drawer, optionally pre-filled. */
  'pexe:agent-open': { prompt?: string; mode?: 'chat' | 'job'; send?: boolean };
  /** The portfolio-guide drawer opened or closed (the pet bot reacts to this). */
  'pexe:guide': { open: boolean };
  'pexe:terminal-open': Record<string, never>;
  /** Real agent activity (tool calls, results, UI actions, timings) for the activity panel and the X-Ray. */
  'pexe:agent-activity': AgentActivity;
  /** Modes changed (theme / motion / recruiter / xray). */
  'pexe:prefs': Prefs;
};

export type AgentActivity = {
  id: string;
  at: number;
  kind: 'request' | 'tool_call' | 'tool_result' | 'ui_action' | 'response' | 'error' | 'mode';
  label: string;
  detail?: string;
  ms?: number;
};

export type Prefs = { theme: 'dark' | 'paper'; motion: 'full' | 'reduce'; mode: 'immersive' | 'recruiter'; xray: 'on' | 'off' };

// Events that open UI are queued until something listens, so a click on "Guide" (or ⌘K)
// before the global UI layer has hydrated (client:afterpaint) is delivered, not lost.
const QUEUED = new Set<keyof BusEvents>(['pexe:agent-open', 'pexe:terminal-open']);
type BusState = { listeners: Record<string, number>; queue: { name: string; detail: unknown }[] };
function state(): BusState {
  const w = window as Window & { __pexeBus?: BusState };
  return (w.__pexeBus ??= { listeners: {}, queue: [] });
}

export function emit<K extends keyof BusEvents>(name: K, detail: BusEvents[K]): void {
  if (typeof window === 'undefined') return;
  const st = state();
  if (QUEUED.has(name) && !st.listeners[name]) { st.queue.push({ name, detail }); return; }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends keyof BusEvents>(name: K, fn: (detail: BusEvents[K]) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<BusEvents[K]>).detail);
  window.addEventListener(name, h);
  const st = state();
  st.listeners[name] = (st.listeners[name] ?? 0) + 1;
  const pending = st.queue.filter((q) => q.name === name);
  if (pending.length) {
    st.queue = st.queue.filter((q) => q.name !== name);
    queueMicrotask(() => pending.forEach((q) => fn(q.detail as BusEvents[K])));
  }
  return () => { window.removeEventListener(name, h); st.listeners[name] = Math.max(0, (st.listeners[name] ?? 1) - 1); };
}

// Cross-page hand-off: an agent action like openProject + focus survives navigation.
const PENDING_KEY = 'pexe:pending-focus';
export function setPendingFocus(f: BusEvents['pexe:focus']): void {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(f)); } catch { /* storage blocked */ }
}
export function takePendingFocus(): BusEvents['pexe:focus'] | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw);
  } catch { return null; }
}

// Activity log kept in-session so the X-Ray page can show what the agent actually did.
const ACTIVITY_KEY = 'pexe:activity';
export function recordActivity(a: AgentActivity): void {
  emit('pexe:agent-activity', a);
  try {
    const list: AgentActivity[] = JSON.parse(sessionStorage.getItem(ACTIVITY_KEY) || '[]');
    list.push(a);
    sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(-80)));
  } catch { /* ignore */ }
}
export function readActivity(): AgentActivity[] {
  try { return JSON.parse(sessionStorage.getItem(ACTIVITY_KEY) || '[]'); } catch { return []; }
}
