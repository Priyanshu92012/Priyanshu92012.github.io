// Concept A hero object. Server-rendered SVG poster of the twisted graphite stack; on capable
// desktops the WebGL sculpture (lazy chunk) fades in over it after first paint.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import SceneBoundary from '../../islands/SceneBoundary';
import { decide3d, whenIdle } from './decide';
import { PLATES, PLATE, SCAN_AT, VIEW_H, plateFaces, plateAngle } from './monolith-geometry';

const MonolithScene = lazy(() => import('./MonolithScene'));

function Poster() {
  const total = (PLATES - 1) * PLATE.pitch;
  const scan = Math.round(SCAN_AT * (PLATES - 1));
  return (
    <svg className="mono-poster" viewBox={`-1.6 ${-VIEW_H / 2} 3.2 ${VIEW_H}`} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="mono-front" x1="0" x2="1">
          <stop offset="0" stopColor="#4a4c52" /><stop offset="0.45" stopColor="#2a2b30" /><stop offset="1" stopColor="#16171a" />
        </linearGradient>
        <linearGradient id="mono-side" x1="0" x2="1">
          <stop offset="0" stopColor="#121316" /><stop offset="1" stopColor="#34363b" />
        </linearGradient>
        <radialGradient id="mono-shadow"><stop offset="0" stopColor="#000" stopOpacity="0.7" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <filter id="mono-glow" x="-50%" y="-400%" width="200%" height="900%"><feGaussianBlur stdDeviation="0.035" /></filter>
      </defs>
      <ellipse cx="0" cy={total / 2 + 0.28} rx="1.3" ry="0.12" fill="url(#mono-shadow)" />
      {Array.from({ length: PLATES }, (_, i) => {
        const { front, side } = plateFaces(i);
        const span = front + Math.abs(side);
        const x0 = -span / 2;
        const y = total / 2 - i * PLATE.pitch - PLATE.h / 2;
        const frontX = side >= 0 ? x0 : x0 + Math.abs(side);
        const sideX = side >= 0 ? x0 + front : x0;
        return (
          <g key={i}>
            <rect x={frontX} y={y} width={front} height={PLATE.h} fill="url(#mono-front)" />
            <rect x={sideX} y={y} width={Math.abs(side)} height={PLATE.h} fill="url(#mono-side)" />
            <line x1={x0} x2={x0 + span} y1={y} y2={y} stroke="#c4c7cd" strokeOpacity={0.12 + 0.4 * Math.abs(Math.cos(plateAngle(i)))} strokeWidth="0.006" />
          </g>
        );
      })}
      {(() => {
        const { front, side } = plateFaces(scan);
        const span = front + Math.abs(side) + 0.08;
        const y = total / 2 - scan * PLATE.pitch + PLATE.pitch / 2;
        return (
          <g className="mono-scan">
            <line x1={-span / 2} x2={span / 2} y1={y} y2={y} stroke="var(--lime)" strokeWidth="0.05" filter="url(#mono-glow)" opacity="0.8" />
            <line x1={-span / 2} x2={span / 2} y1={y} y2={y} stroke="var(--lime)" strokeWidth="0.012" />
          </g>
        );
      })()}
    </svg>
  );
}

export default function MonolithStage() {
  const [mode, setMode] = useState<'poster' | 'loading' | '3d'>('poster');
  const [optIn, setOptIn] = useState(false);
  const [why, setWhy] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = decide3d();
    setWhy(d.why);
    setOptIn(!d.auto && d.allowed && !matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduce');
    if (d.auto) return whenIdle(() => setMode('loading'));
  }, []);

  return (
    <div className={`mono-stage is-${mode}`} ref={root} data-why={why || undefined}>
      <Poster />
      {mode !== 'poster' && (
        <SceneBoundary onFail={() => setMode('poster')}>
          <Suspense fallback={null}>
            <MonolithScene onReady={() => setMode('3d')} />
          </Suspense>
        </SceneBoundary>
      )}
      {mode === 'poster' && optIn && (
        <button type="button" className="mono-3d-btn" onClick={() => setMode('loading')}>Render in 3D</button>
      )}
    </div>
  );
}
