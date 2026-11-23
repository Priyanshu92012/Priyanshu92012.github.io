// Live reservation timeline on the deterministic scheduler engine (src/lib/sim/scheduler.ts).
// Synthetic: resources, agents, timings and faults come from a seed in your browser.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SchedulerSim, type ResState } from '../../lib/sim/scheduler';

const WINDOW = 30;
type Cell = { rid: string; state: ResState } | null;
type Frame = { t: number; lanes: Cell[]; offline: boolean[] };

function snapshot(sim: SchedulerSim): Frame {
  const byId = new Map(sim.reservations.map((r) => [r.id, r]));
  return {
    t: sim.t,
    lanes: sim.resources.map((res) => {
      const r = res.holder ? byId.get(res.holder) : undefined;
      return r ? { rid: r.id, state: r.state } : null;
    }),
    offline: sim.resources.map((r) => !r.online),
  };
}

function init(): { sim: SchedulerSim; frames: Frame[] } {
  const sim = new SchedulerSim({ seed: 2026, resources: 7, agents: 6, arrival: 0.32 });
  const frames: Frame[] = [];
  for (let i = 0; i < WINDOW; i++) { sim.step(); frames.push(snapshot(sim)); }
  return { sim, frames };
}

export default function SchedulerViz({ onInteract, label = 'Reservation timeline' }: { onInteract?: () => void; label?: string }) {
  const [seeded] = useState(init); // deterministic, so server and client render the same first frame
  const sim = seeded.sim;
  const [frames, setFrames] = useState<Frame[]>(seeded.frames);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const tick = useCallback(() => {
    sim.step();
    setFrames((f) => [...f.slice(-(WINDOW - 1)), snapshot(sim)]);
  }, [sim]);

  // Animate only while visible, and never under reduced motion.
  useEffect(() => {
    if (document.documentElement.dataset.motion === 'reduce') return;
    const el = root.current;
    if (!el) return;
    let id = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(id);
      setRunning(e.isIntersecting);
      if (e.isIntersecting) id = window.setInterval(tick, 650);
    }, { threshold: 0.15 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(id); };
  }, [tick]);

  const fault = (kind: 'crash-agent' | 'resource-offline' | 'burst') => {
    sim.inject(kind);
    const last = [...sim.events].reverse().find((e) => e.kind === 'fault');
    setNote(last ? last.text : null);
    tick();
    onInteract?.();
  };

  const m = sim.metrics();
  const lanes = frames[0]?.lanes.length ?? 0;
  const W = 600, H = 26 * lanes + 8, cw = W / WINDOW;
  const runs: { lane: number; x0: number; x1: number; rid: string; state: ResState }[] = [];
  const off: { lane: number; x: number }[] = [];
  for (let lane = 0; lane < lanes; lane++) {
    let cur: (typeof runs)[number] | null = null;
    frames.forEach((f, i) => {
      if (f.offline[lane]) off.push({ lane, x: i });
      const c = f.lanes[lane];
      if (c && cur && cur.rid === c.rid) { cur.x1 = i; cur.state = c.state; return; }
      if (cur) runs.push(cur);
      cur = c ? { lane, x0: i, x1: i, rid: c.rid, state: c.state } : null;
    });
    if (cur) runs.push(cur);
  }

  return (
    <div className="viz viz-sched" ref={root}>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label={`${label}: ${lanes} synthetic test resources over the last ${WINDOW} ticks. ${m.active} reservations active, ${m.queued} queued, ${m.completed} completed.`}>
        {Array.from({ length: lanes }, (_, l) => (
          <g key={l}>
            <line x1="0" x2={W} y1={l * 26 + 17} y2={l * 26 + 17} className="viz-rule" />
            <text x="0" y={l * 26 + 13} className="viz-lane">R-{String(l + 1).padStart(2, '0')}</text>
          </g>
        ))}
        {off.map((o, i) => <rect key={`o${i}`} x={o.x * cw + 40} y={o.lane * 26 + 6} width={cw * ((W - 40) / W)} height="16" className="viz-off" />)}
        {runs.map((r) => {
          const x = 40 + r.x0 * cw * ((W - 40) / W);
          const w = Math.max(4, (r.x1 - r.x0 + 1) * cw * ((W - 40) / W) - 2);
          return <rect key={`${r.lane}-${r.rid}-${r.x0}`} x={x} y={r.lane * 26 + 6} width={w} height="16" rx="3" className={`viz-res s-${r.state}`} />;
        })}
        <line x1={W - 1} x2={W - 1} y1="0" y2={H} className="viz-head" />
      </svg>
      <dl className="viz-stats">
        <div><dt>Active</dt><dd>{m.active}</dd></div>
        <div><dt>Queued</dt><dd>{m.queued}</dd></div>
        <div><dt>Completed</dt><dd>{m.completed}</dd></div>
        <div><dt>Expired / failed</dt><dd>{m.expired + m.failed}</dd></div>
      </dl>
      <div className="viz-controls">
        <button type="button" onClick={() => fault('crash-agent')}>Crash an agent</button>
        <button type="button" onClick={() => fault('resource-offline')}>Take a resource offline</button>
        {!running && <button type="button" onClick={() => { tick(); onInteract?.(); }}>Step</button>}
      </div>
      <p className="viz-note" aria-live="polite">{note ? `${note}. Watch its lease expire and the work retry with backoff.` : 'Reserved → active → released. Leases expire when heartbeats stop; nothing is ever double-booked.'}</p>
      <p className="viz-cap"><span className="viz-legend s-reserved" /> reserved <span className="viz-legend s-active" /> active <span className="viz-legend viz-off" /> offline · synthetic simulation, seed 2026</p>
    </div>
  );
}
