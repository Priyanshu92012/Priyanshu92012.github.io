// Site modes. The inline head script (BaseLayout) applies them before first paint;
// this module reads/writes them at runtime.
import { emit, type Prefs } from './bus';

const KEY = 'pexe:prefs';

function store(): Partial<Prefs> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function getPrefs(): Prefs {
  const s = store();
  const osReduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    theme: s.theme === 'dark' ? 'dark' : 'paper', // light (paper) is the default
    motion: s.motion === 'reduce' || (s.motion !== 'full' && osReduce) ? 'reduce' : 'full',
    mode: s.mode === 'recruiter' ? 'recruiter' : 'immersive',
    xray: document.documentElement.dataset.xray === 'on' ? 'on' : 'off',
  };
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): Prefs {
  const s = store();
  if (key !== 'xray') {
    (s as Record<string, string>)[key] = value as string;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  }
  const root = document.documentElement;
  if (key === 'theme') root.dataset.theme = value as string;
  if (key === 'motion') root.dataset.motion = value as string;
  if (key === 'mode') root.dataset.mode = value as string;
  if (key === 'xray') root.dataset.xray = value as string;
  const prefs = getPrefs();
  emit('pexe:prefs', prefs);
  return prefs;
}

export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduce';
}

/** Heuristic for low-power devices: prefer the static poster over live 3D. */
export function lowPower(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (n.connection?.saveData) return true;
  if (typeof n.deviceMemory === 'number' && n.deviceMemory <= 2) return true;
  if (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 2) return true;
  return false;
}

export function webglAvailable(): boolean {
  if (new URLSearchParams(location.search).get('webgl') === '0') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
