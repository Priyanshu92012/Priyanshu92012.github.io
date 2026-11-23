// Concept B hero: the portrait inside three project orbits. Server-rendered as layered SVG
// (back halves behind the portrait, front halves over it) with accessible orbit buttons and an
// info panel; on capable desktops a WebGL gyroscope (lazy) takes over the rings.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import SceneBoundary from '../../islands/SceneBoundary';
import { emitPet } from '../../islands/petbot/events';
import { decide3d, whenIdle } from './decide';
import { RINGS, COLORS, ringPath, ringPoint, CENTER } from './orbit-geometry';

const OrbitScene = lazy(() => import('./OrbitScene'));

export type OrbitItem = { slug: string; no: string; shortTitle: string; title: string; domain: string; domainLabel: string; line: string; tech: string[]; honesty: string; caseHref: string; labHref: string };

function Rings({ half, hot }: { half: 'back' | 'front'; hot: string | null }) {
  return (
    <svg className={`o-rings o-rings-${half}`} viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {RINGS.map((r) => {
        const beads = Array.from({ length: 7 }, (_, i) => ringPoint(r, (i / 7) * Math.PI * 2 + r.r * 9, r.r)).filter(([, , z]) => (half === 'front' ? z >= 0 : z < 0));
        return (
          <g key={r.slug} className={`o-ring${hot ? (hot === r.slug ? ' is-hot' : ' is-dim') : ''}`} style={{ ['--c' as string]: COLORS[r.domain] }}>
            <path d={ringPath(r, half)} className="o-ring-glow" />
            <path d={ringPath(r, half)} className="o-ring-line" />
            {beads.map(([x, y], i) => <circle key={i} cx={CENTER.x + x} cy={CENTER.y - y} r={0.0065} className="o-bead" />)}
          </g>
        );
      })}
    </svg>
  );
}

export default function OrbitHero({ items, portrait, portraitSrc, children }: { items: OrbitItem[]; portrait?: ReactNode; portraitSrc: string; children?: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<'poster' | 'loading' | '3d'>('poster');
  const [optIn, setOptIn] = useState(false);
  const [box, setBox] = useState<{ cx: number; cy: number; s: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = decide3d();
    setOptIn(!d.auto && d.allowed && document.documentElement.dataset.motion !== 'reduce');
    if (d.auto) return whenIdle(() => setMode('loading'));
  }, []);

  // Where the portrait sits inside the stage, so the 3D occluder lines up with the HTML image.
  useEffect(() => {
    const measure = () => {
      const s = stage.current?.getBoundingClientRect(), f = frame.current?.getBoundingClientRect();
      if (!s || !f || !s.height) return;
      setBox({ cx: (f.left + f.width / 2 - s.left) / s.width, cy: (f.top + f.height / 2 - s.top) / s.height, s: f.height / s.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    if (frame.current) ro.observe(frame.current);
    return () => ro.disconnect();
  }, []);

  const select = useCallback((slug: string | null) => {
    setSelected((cur) => (cur === slug ? null : slug));
    if (slug) emitPet({ kind: 'project', slug });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  const hot = hovered ?? selected;
  const current = items.find((i) => i.slug === selected);

  return (
    <div className={`o-stage is-${mode}${selected ? ' has-selection' : ''}`} ref={stage}>
      <div className="o-frame" ref={frame}>
        <Rings half="back" hot={hot} />
        {portrait}
        <Rings half="front" hot={hot} />
      </div>
      {mode !== 'poster' && box && (
        <SceneBoundary onFail={() => setMode('poster')}>
          <Suspense fallback={null}>
            <OrbitScene box={box} portraitSrc={portraitSrc} selected={selected} hovered={hovered} onHover={setHovered} onSelect={select} onReady={() => setMode('3d')} />
          </Suspense>
        </SceneBoundary>
      )}
      {children}
      <div className="o-legend" role="group" aria-label="Project orbits">
        <p className="o-hint" aria-hidden="true">{selected ? 'Esc to release' : mode === '3d' ? 'Drag your pointer · select an orbit' : 'Select an orbit'}</p>
        <div className="o-legend-row">
          {items.map((it) => (
            <button
              key={it.slug} type="button" className={`o-orbit-btn${hot === it.slug ? ' is-hot' : ''}`} style={{ ['--c' as string]: COLORS[it.domain] }}
              aria-pressed={selected === it.slug} aria-controls="o-panel"
              onClick={() => select(it.slug)} onPointerEnter={() => setHovered(it.slug)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(it.slug)} onBlur={() => setHovered(null)}
            >
              <span className="o-dot" aria-hidden="true" /><span className="o-no">{it.no}</span><span>{it.shortTitle}</span><span className="o-dom">{it.domainLabel}</span>
            </button>
          ))}
        </div>
        {optIn && mode === 'poster' && <button type="button" className="o-3d-btn" onClick={() => setMode('loading')}>Render the orbits in 3D</button>}
      </div>
      <div id="o-panel" className={`o-panel${current ? ' is-open' : ''}`} ref={panel} role="region" aria-live="polite" aria-label="Selected project">
        {current && (
          <div className="o-panel-in" style={{ ['--c' as string]: COLORS[current.domain] }} key={current.slug}>
            <p className="o-panel-k"><span className="o-dot" aria-hidden="true" />{current.no} · {current.domainLabel}</p>
            <h2 className="o-panel-t">{current.title}</h2>
            <p className="o-panel-line">{current.line}</p>
            <ul className="o-chips" aria-label="Technologies">{current.tech.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="o-panel-honesty">{current.honesty}</p>
            <p className="o-panel-links">
              <a href={`#o-${current.slug}`} onClick={() => setSelected(null)}>Explore below ↓</a>
              <a href={current.caseHref}>Case study →</a>
              <a href={current.labHref}>Open the lab →</a>
            </p>
            <button type="button" className="o-panel-x" onClick={() => setSelected(null)} aria-label="Close project details">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
