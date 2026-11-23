// Test-resource scheduler laboratory on the tested SchedulerSim engine (src/lib/sim/scheduler.ts).
// Everything is generated from a seed in the browser. Invariants are asserted every tick.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SchedulerSim, DEFAULT_CONFIG, TRANSITIONS, type ResState, type Strategy, type Reservation } from '../../lib/sim/scheduler';
import { reducedMotion } from '../../lib/prefs';
import './demos.css';

const SPEEDS = [{ label: '1×', ms: 650 }, { label: '2×', ms: 320 }, { label: '4×', ms: 130 }];
const STRATS: { id: Strategy; label: string; note: string }[] = [
  { id: 'fifo', label: 'FIFO', note: 'First come, first served. Simple and fair, but urgent work waits behind everything else.' },
  { id: 'priority', label: 'Priority + aging', note: 'Urgent requests first; waiting time slowly raises priority so nothing starves.' },
  { id: 'best-fit', label: 'Best fit', note: 'Priority order, but each request takes the least-capable free resource, keeping versatile ones available.' },
];
const BOX: Record<ResState, [number, number]> = {
  queued: [8, 30], reserved: [132, 30], active: [256, 30], releasing: [380, 30], released: [504, 30], expired: [194, 128], failed: [318, 128],
};
const W = 104, Hh = 40;

type Hist = { util: number[]; queue: number[] };

function transitionsAt(sim: SchedulerSim): Set<string> {
  const hot = new Set<string>();
  for (const r of sim.reservations) {
    for (let i = 1; i < r.history.length; i++) if (r.history[i].t === sim.t) hot.add(`${r.history[i - 1].state}>${r.history[i].state}`);
  }
  return hot;
}

function edgeD(a: ResState, b: ResState): string {
  const [ax, ay] = BOX[a], [bx, by] = BOX[b];
  if (ay === by) return `M${ax + W} ${ay + Hh / 2} L${bx - 4} ${by + Hh / 2}`;
  if (a === 'queued' && b === 'failed') return `M${ax + W / 2} ${ay + Hh} C${ax + W / 2} ${by + Hh + 26} ${bx + W / 2} ${by + Hh + 26} ${bx + W / 2} ${by + Hh + 4}`;
  const sx = ax + W / 2 + (b === 'expired' && a === 'active' ? -24 : b === 'failed' ? 10 : 10);
  return `M${sx} ${ay + Hh} L${bx + W / 2 + (a === 'active' && b === 'expired' ? 20 : 0)} ${by - 4}`;
}

export default function SchedulerLab() {
  const [strategy, setStrategy] = useState<Strategy>('priority');
  const [seed, setSeed] = useState(DEFAULT_CONFIG.seed);
  const simRef = useRef<SchedulerSim>(new SchedulerSim({ seed, strategy }));
  const histRef = useRef<Hist>({ util: [], queue: [] });
  const [, setV] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<null | { strategy: Strategy; m: ReturnType<SchedulerSim['metrics']> }[]>(null);
  const host = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  const rerender = () => setV((v) => v + 1);

  const reset = useCallback((s = seed, st = strategy) => {
    simRef.current = new SchedulerSim({ seed: s, strategy: st });
    histRef.current = { util: [], queue: [] };
    setSelected(null); setError(null); rerender();
  }, [seed, strategy]);

  const step = useCallback(() => {
    const sim = simRef.current;
    try {
      sim.step();
      const h = histRef.current;
      h.util.push(sim.resources.filter((r) => r.holder).length / sim.resources.length);
      h.queue.push(sim.reservations.filter((r) => r.state === 'queued').length);
      if (h.util.length > 140) { h.util.shift(); h.queue.shift(); }
    } catch (e) {
      setError((e as Error).message); setRunning(false);
    }
    rerender();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(step, SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [running, speed, step]);

  // start once when scrolled into view (never under reduced motion); pause when off-screen
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !autoStarted.current && !reducedMotion()) { autoStarted.current = true; setRunning(true); }
      if (!e.isIntersecting) setRunning(false);
    }, { threshold: 0.25 });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);

  const sim = simRef.current;
  const m = sim.metrics();
  const hot = transitionsAt(sim);
  const counts = useMemo(() => {
    const c = Object.fromEntries(Object.keys(TRANSITIONS).map((k) => [k, 0])) as Record<ResState, number>;
    for (const r of sim.reservations) c[r.state]++;
    return c;
  }, [sim, sim.t, sim.reservations.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = sim.events.slice(-14).reverse();
  const queue = sim.reservations.filter((r) => r.state === 'queued').sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
  const sel = selected ? sim.reservations.find((r) => r.id === selected) : null;
  const flashed = new Set(sim.events.filter((e) => e.t === sim.t && e.resource).map((e) => e.resource!));

  const runCompare = () => {
    const out = STRATS.map((s) => {
      const x = new SchedulerSim({ seed, strategy: s.id });
      for (let t = 1; t <= 240; t++) {
        if (t === 60) x.inject('crash-agent');
        if (t === 120) x.inject('resource-offline');
        if (t === 180) x.inject('burst');
        x.step();
      }
      return { strategy: s.id, m: x.metrics() };
    });
    setCompare(out);
  };

  const spark = (vals: number[], max: number) => {
    if (vals.length < 2) return '';
    return vals.map((v, i) => `${i ? 'L' : 'M'}${((i / 139) * 300).toFixed(1)} ${(52 - (v / Math.max(max, 1e-6)) * 48).toFixed(1)}`).join(' ');
  };
  const qMax = Math.max(4, ...histRef.current.queue);

  return (
    <div className="demo d-systems" ref={host}>
      <div className="demo-bar">
        <div className="demo-ctrls">
          <button type="button" className="btn btn-sm btn-run" onClick={() => setRunning((r) => !r)} aria-pressed={running}>{running ? 'Pause' : 'Run'}</button>
          <button type="button" className="btn btn-sm" onClick={step} disabled={running}>Step</button>
          <div className="demo-ctrls" role="group" aria-label="Speed">
            {SPEEDS.map((s, i) => <button key={s.label} type="button" className="btn btn-sm" aria-pressed={speed === i} onClick={() => setSpeed(i)}>{s.label}</button>)}
          </div>
          <span className="sep" aria-hidden="true" />
          <label className="demo-lab">Strategy
            <select className="demo-select" value={strategy} onChange={(e) => { const st = e.target.value as Strategy; setStrategy(st); reset(seed, st); }}>
              {STRATS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="demo-lab">Seed
            <input className="demo-num" type="number" value={seed} min={1} max={99999} onChange={(e) => setSeed(Math.max(1, Math.min(99999, Number(e.target.value) || 1)))} onBlur={() => reset()} onKeyDown={(e) => e.key === 'Enter' && reset()} />
          </label>
          <button type="button" className="btn btn-sm" onClick={() => reset()}>Reset</button>
        </div>
        <div className="demo-ctrls" role="group" aria-label="Inject a fault">
          <span className="demo-lab">Inject</span>
          <button type="button" className="btn btn-sm" onClick={() => { sim.inject('crash-agent'); rerender(); }}>Crash an agent</button>
          <button type="button" className="btn btn-sm" onClick={() => { sim.inject('resource-offline'); rerender(); }}>Resource offline</button>
          <button type="button" className="btn btn-sm" onClick={() => { sim.inject('burst'); rerender(); }}>Request burst</button>
        </div>
      </div>
      <p className="demo-note">{STRATS.find((s) => s.id === strategy)!.note}</p>

      <div className="demo-metrics" aria-live="off">
        <div className="demo-metric"><span>Tick</span><b>{m.tick}</b></div>
        <div className="demo-metric good"><span>Completed</span><b>{m.completed}</b></div>
        <div className="demo-metric warn"><span>Expired leases</span><b>{m.expired}</b></div>
        <div className="demo-metric warn"><span>Failed</span><b>{m.failed}</b></div>
        <div className="demo-metric"><span>Retries</span><b>{m.retries}</b></div>
        <div className="demo-metric"><span>Utilisation</span><b>{Math.round(m.utilization * 100)}<small>%</small></b></div>
        <div className="demo-metric"><span>Avg wait</span><b>{m.avgWait.toFixed(1)}<small>t</small></b></div>
        <div className="demo-metric"><span>Queue</span><b>{m.queued}<small>/ max {m.maxQueue}</small></b></div>
      </div>

      <div className="sch-grid">
        <section className="demo-card" aria-label="Resources">
          <header><span><b>Resources</b> · leases &amp; heartbeats</span><span>{sim.resources.filter((r) => r.holder).length}/{sim.resources.length} held</span></header>
          <div className="body sch-res">
            {sim.resources.map((r) => {
              const res = r.holder ? sim.reservations.find((x) => x.id === r.holder) : undefined;
              const missed = res?.state === 'active' ? sim.t - (res.lastHeartbeat ?? sim.t) : 0;
              const prog = res?.startedAt !== undefined ? Math.min(1, (sim.t - res.startedAt) / res.duration) : 0;
              return (
                <button key={r.id} type="button" className={`sch-r${res ? ' held' : ''}${!r.online ? ' offline' : ''}${flashed.has(r.id) ? ' flash' : ''}`}
                  onClick={() => res && setSelected(res.id)}
                  style={{ textAlign: 'left', cursor: res ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
                  <span className="id"><span>{r.id}</span><span className={!r.online ? 'bad' : res ? '' : 'muted'}>{!r.online ? 'OFFLINE' : res ? res.state.toUpperCase() : 'free'}</span></span>
                  <span className="sch-caps">{r.caps.map((c) => <i key={c}>{c}</i>)}</span>
                  {res && (
                    <>
                      <span className="sch-hold">{res.id} · {res.agent} · P{res.priority}</span>
                      <span className="sch-bar" aria-hidden="true"><i style={{ width: `${prog * 100}%` }} /></span>
                      <span className="sch-hb" aria-hidden="true" title="Heartbeats within the lease TTL">
                        {Array.from({ length: sim.cfg.leaseTtl + 1 }, (_, i) => <i key={i} className={i < missed ? 'miss' : res.state === 'active' ? 'on' : ''} />)}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="body" style={{ borderTop: '1px solid var(--line)' }}>
            <p className="demo-lab" style={{ marginBottom: 8 }}>Queue ({queue.length}) · dashed = backing off after a failure</p>
            <div className="sch-queue">
              {queue.length === 0 && <span className="demo-note">Empty.</span>}
              {queue.slice(0, 18).map((q) => (
                <button key={q.id} type="button" className={`sch-q${q.notBefore > sim.t ? ' wait' : ''}`} onClick={() => setSelected(q.id)}>
                  <span className={`p${q.priority}`}>P{q.priority}</span>{q.id}<span className="muted">{q.need}</span>{q.attempt > 0 && <span className="warn">↻{q.attempt}</span>}
                </button>
              ))}
              {queue.length > 18 && <span className="demo-note">+{queue.length - 18} more</span>}
            </div>
          </div>
        </section>

        <div className="demo-grid">
          <section className="demo-card" aria-label="Reservation lifecycle">
            <header><span><b>Lifecycle</b> · explicit state machine</span><span>{sim.reservations.length} total</span></header>
            <div className="body">
              <svg className="sch-sm" viewBox="0 0 616 200" role="img" aria-label={`Reservation states: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`}>
                <defs><marker id="sch-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor" style={{ color: 'var(--fg-mute)' }} /></marker></defs>
                {(Object.entries(TRANSITIONS) as [ResState, ResState[]][]).flatMap(([a, bs]) => bs.map((b) => (
                  <g key={`${a}>${b}`} className={`tr${hot.has(`${a}>${b}`) ? ' hot' : ''}`}><path d={edgeD(a, b)} /></g>
                )))}
                {(Object.keys(BOX) as ResState[]).map((s) => (
                  <g key={s} className={`st${['released', 'expired', 'failed'].includes(s) ? ' term' : ''}${[...hot].some((h) => h.endsWith(`>${s}`)) ? ' hot' : ''}`}>
                    <rect x={BOX[s][0]} y={BOX[s][1]} width={W} height={Hh} rx="6" />
                    <text x={BOX[s][0] + 10} y={BOX[s][1] + 25}>{s}</text>
                    <text className="n" x={BOX[s][0] + W - 10} y={BOX[s][1] + 26} textAnchor="end">{counts[s]}</text>
                  </g>
                ))}
              </svg>
              <div className="sch-inv" aria-live="polite">
                {error
                  ? <span className="pill bad">Invariant violated: {error}</span>
                  : <><span className="pill ok">✓ no double booking</span><span className="pill ok">✓ no stale holders</span><span className="pill ok">✓ only legal transitions</span></>}
              </div>
              <p className="demo-note" style={{ marginTop: 8 }}>All three properties are asserted on every tick; an illegal transition throws instead of corrupting state.</p>
            </div>
          </section>

          <section className="demo-card" aria-label="Utilisation and queue over time">
            <header><span><b>Trend</b> · last 140 ticks</span><span><span style={{ color: 'var(--violet)' }}>■</span> util · <span style={{ color: 'var(--orange)' }}>■</span> queue</span></header>
            <div className="body">
              <svg className="sch-spark" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
                <path d={spark(histRef.current.util, 1)} stroke="var(--violet)" />
                <path d={spark(histRef.current.queue, qMax)} stroke="var(--orange)" />
              </svg>
            </div>
          </section>
        </div>
      </div>

      <div className="sch-grid">
        <section className="demo-card" aria-label="Event log">
          <header><span><b>Event log</b></span><span>newest first</span></header>
          <div className="body">
            <ol className="demo-log">
              {recent.length === 0 && <li><span className="t">t0</span><span>Press Run, or Step through tick by tick.</span></li>}
              {recent.map((e, i) => <li key={`${e.t}-${i}-${e.text}`} className={`k-${e.kind}`}><span className="t">t{e.t}</span><span>{e.text}</span></li>)}
            </ol>
          </div>
        </section>
        <section className="demo-card" aria-label="Selected reservation" aria-live="polite">
          <header><span><b>Inspect</b> · {sel ? sel.id : 'click a resource or queued request'}</span>{sel && <button type="button" className="linkish" onClick={() => setSelected(null)}>Clear</button>}</header>
          <div className="body">
            {sel ? <ResDetail r={sel} /> : <p className="demo-note">Each reservation keeps its full transition history. Retries are new reservations linked to the attempt that failed, with exponential backoff (2, 4, 8 ticks).</p>}
          </div>
        </section>
      </div>

      <section className="demo-card" aria-label="Strategy comparison">
        <header><span><b>Compare strategies</b> · same seed, same faults</span><button type="button" className="btn btn-sm" onClick={runCompare}>Run 240-tick comparison</button></header>
        <div className="body">
          {!compare ? (
            <p className="demo-note">Runs all three strategies on seed {seed} with identical scripted faults (agent crash at t60, resource outage at t120, burst at t180) and compares the outcomes.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="sch-cmp">
                <thead><tr><th>Strategy</th><th>Completed</th><th>Expired</th><th>Failed</th><th>Retries</th><th>Avg wait</th><th>Max queue</th><th>Utilisation</th></tr></thead>
                <tbody>
                  {compare.map((c) => {
                    const best = (k: keyof typeof c.m, dir: 1 | -1) => compare.every((o) => dir * (c.m[k] as number) >= dir * (o.m[k] as number));
                    return (
                      <tr key={c.strategy}>
                        <td>{STRATS.find((s) => s.id === c.strategy)!.label}</td>
                        <td className={best('completed', 1) ? 'best' : ''}>{c.m.completed}</td>
                        <td className={best('expired', -1) ? 'best' : ''}>{c.m.expired}</td>
                        <td className={best('failed', -1) ? 'best' : ''}>{c.m.failed}</td>
                        <td>{c.m.retries}</td>
                        <td className={best('avgWait', -1) ? 'best' : ''}>{c.m.avgWait.toFixed(2)}</td>
                        <td className={best('maxQueue', -1) ? 'best' : ''}>{c.m.maxQueue}</td>
                        <td className={best('utilization', 1) ? 'best' : ''}>{Math.round(c.m.utilization * 100)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="demo-note" style={{ marginTop: 8 }}>Green marks the best value per column. These are properties of this synthetic model and seed, not measurements of any real system.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ResDetail({ r }: { r: Reservation }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p className="demo-note"><b>{r.agent}</b> needs a <b>{r.need}</b> resource · priority P{r.priority} · {r.duration} ticks of work{r.attempt ? ` · retry attempt ${r.attempt}` : ''}{r.resource ? ` · on ${r.resource}` : ''}</p>
      <ol className="demo-log" style={{ maxHeight: 180 }}>
        {r.history.map((h, i) => <li key={i} className={['expired'].includes(h.state) ? 'k-expire' : h.state === 'failed' ? 'k-fail' : h.state === 'released' ? 'k-ok' : ''}><span className="t">t{h.t}</span><span>{h.state}</span></li>)}
      </ol>
    </div>
  );
}
