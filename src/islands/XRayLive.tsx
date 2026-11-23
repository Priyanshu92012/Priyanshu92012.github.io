// Engineering X-Ray: live, measured diagnostics from the visitor's own session.
// Nothing here is mocked: every number comes from browser APIs.
import { useEffect, useState } from 'react';
import { on } from '../lib/bus';
import { getPrefs, setPref, webglAvailable } from '../lib/prefs';
import './demos/demos.css';

type Vitals = { thirdParty: string[]; ttfb?: number; dcl?: number; load?: number; lcp?: number; cls: number; js: number; jsCount: number; css: number; fonts: number; islands: number; hydrated: number; gpu?: string; dpr: number };

function measure(): Vitals {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const sum = (f: (r: PerformanceResourceTiming) => boolean) => res.filter(f).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0);
  const islands = document.querySelectorAll('astro-island');
  let gpu: string | undefined;
  if (webglAvailable()) {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      gpu = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'WebGL available';
    } catch { gpu = undefined; }
  }
  const hosts = [...new Set(res.map((r) => { try { return new URL(r.name).host; } catch { return location.host; } }).filter((h) => h && h !== location.host))];
  return {
    thirdParty: hosts,
    ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : undefined,
    dcl: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : undefined,
    load: nav && nav.loadEventEnd ? Math.round(nav.loadEventEnd - nav.startTime) : undefined,
    cls: 0,
    js: sum((r) => r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name)),
    jsCount: res.filter((r) => r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name)).length,
    css: sum((r) => /\.css(\?|$)/.test(r.name)),
    fonts: sum((r) => /\.woff2?(\?|$)/.test(r.name)),
    islands: islands.length,
    hydrated: [...islands].filter((el) => !el.hasAttribute('ssr')).length,
    gpu,
    dpr: Math.round(window.devicePixelRatio * 100) / 100,
  };
}

const kb = (b: number) => (b ? `${(b / 1024).toFixed(1)} KB` : '0 KB (cached)');

export default function XRayLive() {
  const [v, setV] = useState<Vitals | null>(null);
  const [lcp, setLcp] = useState<number | null>(null);
  const [cls, setCls] = useState(0);
  const [prefs, setPrefsState] = useState<ReturnType<typeof getPrefs> | null>(null);

  useEffect(() => {
    const update = () => setV(measure());
    update();
    const t = setTimeout(update, 1500);
    setPrefsState(getPrefs());
    const offs = [on('pexe:prefs', (p) => setPrefsState(p))];
    const obs: PerformanceObserver[] = [];
    try {
      const o = new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) setLcp(Math.round(e.startTime)); });
      o.observe({ type: 'largest-contentful-paint', buffered: true }); obs.push(o);
    } catch { /* unsupported (e.g. Safari < 17) */ }
    try {
      const o = new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) setCls((c) => c + e.value); });
      o.observe({ type: 'layout-shift', buffered: true }); obs.push(o);
    } catch { /* unsupported */ }
    return () => { clearTimeout(t); offs.forEach((f) => f()); obs.forEach((o) => o.disconnect()); };
  }, []);

  const toggle = (k: 'theme' | 'motion' | 'mode' | 'xray') => {
    const p = getPrefs();
    const next = { theme: p.theme === 'paper' ? 'dark' : 'paper', motion: p.motion === 'reduce' ? 'full' : 'reduce', mode: p.mode === 'recruiter' ? 'immersive' : 'recruiter', xray: p.xray === 'on' ? 'off' : 'on' }[k];
    setPref(k, next as never);
  };

  const grade = (val: number | undefined | null, good: number, poor: number) => (val == null ? '' : val <= good ? 'good' : val > poor ? 'warn' : '');

  return (
    <div className="demo d-systems xr-live">
      <section className="demo-card" aria-label="This page load">
        <header><span><b>This page load</b> · measured in your browser</span><button type="button" className="btn btn-sm" onClick={() => setV(measure())}>Re-measure</button></header>
        <div className="body">
          <div className="demo-metrics">
            <div className={`demo-metric ${grade(v?.ttfb, 800, 1800)}`}><span>TTFB</span><b>{v?.ttfb ?? '—'}<small>ms</small></b></div>
            <div className={`demo-metric ${grade(lcp, 2500, 4000)}`}><span>LCP</span><b>{lcp ?? '—'}<small>ms</small></b></div>
            <div className={`demo-metric ${cls <= 0.1 ? 'good' : 'warn'}`}><span>CLS</span><b>{cls.toFixed(3)}</b></div>
            <div className="demo-metric"><span>DOM ready</span><b>{v?.dcl ?? '—'}<small>ms</small></b></div>
            <div className="demo-metric"><span>JS transferred</span><b style={{ fontSize: '1rem' }}>{v ? kb(v.js) : '—'}<small> · {v?.jsCount ?? 0} files</small></b></div>
            <div className="demo-metric"><span>CSS · fonts</span><b style={{ fontSize: '1rem' }}>{v ? `${kb(v.css)} · ${kb(v.fonts)}` : '—'}</b></div>
            <div className="demo-metric"><span>Islands hydrated</span><b>{v ? `${v.hydrated}/${v.islands}` : '—'}</b></div>
            <div className="demo-metric"><span>Device pixel ratio</span><b>{v?.dpr ?? '—'}</b></div>
          </div>
          <p className="demo-note" style={{ marginTop: 10 }}>GPU: <b>{v?.gpu ?? 'no WebGL: every 3D view falls back to its static SVG'}</b>. LCP and CLS come from <code>PerformanceObserver</code> (Chromium and Firefox; Safari may show “—”). Transfer sizes read 0 when served from cache.</p>
        </div>
      </section>

      <div className="xr-two">
        <section className="demo-card" aria-label="Modes">
          <header><span><b>Modes</b> · applied before first paint</span></header>
          <div className="body xr-modes">
            {(() => { const pr = prefs ?? { theme: 'dark', motion: 'full', mode: 'immersive', xray: 'off' }; return ([
              ['theme', 'Paper reading mode', pr.theme === 'paper', 'P'],
              ['motion', 'Reduced motion', pr.motion === 'reduce', ''],
              ['mode', 'Recruiter mode', pr.mode === 'recruiter', ''],
              ['xray', 'Island outlines', pr.xray === 'on', 'X'],
            ] as const); })().map(([k, label, onState, key]) => (
              <button key={k} type="button" className="xr-toggle" role="switch" aria-checked={onState} disabled={!prefs} onClick={() => toggle(k)}>
                <span className="sw" aria-hidden="true"><i /></span>{label}{key && <kbd>{key}</kbd>}
              </button>
            ))}
          </div>
        </section>

        <section className="demo-card" aria-label="Network">
          <header><span><b>Network</b> · this page load</span></header>
          <div className="body">
            <p className={`demo-note ${v && v.thirdParty.length === 0 ? 'ok' : ''}`}>{v ? (v.thirdParty.length === 0 ? '0 requests to other hosts. Fonts, scripts and the portfolio guide are all served from this site.' : `Requests to other hosts: ${v.thirdParty.join(', ')}`) : '—'}</p>
            <p className="demo-note" style={{ marginTop: 8 }}>The portfolio guide answers inside this page: open it with <kbd>/</kbd>, ask anything, then press Re-measure. The count stays the same.</p>
          </div>
        </section>
      </div>

    </div>
  );
}
