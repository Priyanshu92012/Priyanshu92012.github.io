import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { projects, getProject, getSkill, getDomain, STATUS_LABEL, EVIDENCE_LABEL, EVIDENCE_RANK, type DomainId } from '../data/index';
import { emit, on, takePendingFocus } from '../lib/bus';
import { lowPower, reducedMotion, webglAvailable } from '../lib/prefs';
import { emitPet } from './petbot/events';

const LabScene = lazy(() => import('./scenes/LabScene'));
import SceneBoundary from './SceneBoundary';
type Mode = 'poster' | 'loading' | '3d';

function EvidenceBars({ level }: { level: number }) {
  return <span className="bars" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}</span>;
}

export default function HeroLab() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [domain, setDomain] = useState<DomainId | null>(null);
  const [mode, setMode] = useState<Mode>('poster');
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [stats, setStats] = useState<{ dpr: number; fps: number } | null>(null);
  const order = useMemo(() => projects.map((p) => p.slug), []);
  const stage = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-lab-stage]') : null;

  const load3d = useCallback(() => setMode('loading'), []);

  // decide whether to start the 3D scene
  useEffect(() => {
    setReduced(reducedMotion());
    const mq = matchMedia('(max-width: 760px)');
    const setC = () => setCompact(mq.matches);
    setC(); mq.addEventListener('change', setC);
    const recruiter = document.documentElement.dataset.mode === 'recruiter';
    const params = new URLSearchParams(location.search);
    // cheap checks first: probing WebGL creates a GPU context, so phones and recruiter mode never pay for it
    let io: IntersectionObserver | undefined;
    if (params.get('3d') === '0') setWhy('3D disabled by URL.');
    else if (recruiter) setWhy('Recruiter mode: static lab for speed.');
    else if (mq.matches || matchMedia('(pointer: coarse)').matches) setWhy('Phone or touch screen: the static lab loads instantly.'); // 3D is opt-in on mobile (saves ~1 MB of JS and seconds of main-thread time)
    else if (lowPower()) setWhy('Low-power device detected: static lab.');
    else if (!webglAvailable()) setWhy('WebGL unavailable: showing the static lab.');
    else {
      // the lab sits below the hero: load the 3D chunk only when it is about to scroll into view
      const start = () => load3d();
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const el = document.querySelector('[data-lab-stage]');
      const go = () => (ric ? ric(start, { timeout: 1800 }) : setTimeout(start, 600));
      if (el && 'IntersectionObserver' in window) {
        io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io?.disconnect(); go(); } }, { rootMargin: '300px 0px' });
        io.observe(el);
      } else go();
    }
    return () => { mq.removeEventListener('change', setC); io?.disconnect(); };
  }, [load3d]);

  // the pet bot reacts (once per project per session) when a visitor selects a module
  useEffect(() => { if (selected) emitPet({ kind: 'project', slug: selected }); }, [selected]);

  // keep the SVG poster in sync (it stays interactive until 3D takes over)
  useEffect(() => {
    if (!stage) return;
    stage.classList.toggle('filtering', !!domain);
    stage.classList.toggle('is-3d', mode === '3d');
    stage.querySelectorAll<HTMLElement>('[data-poster] .mod').forEach((el) => {
      el.classList.toggle('is-hit', !domain || (el.dataset.domains ?? '').split(' ').includes(domain));
      el.classList.toggle('is-active', el.dataset.slug === (selected ?? hovered));
    });
    stage.querySelectorAll<SVGElement>('[data-poster] .trace').forEach((t) => {
      const s = selected ?? hovered;
      t.classList.toggle('on', !!s && (t.dataset.a === s || t.dataset.b === s));
    });
    const poster = stage.querySelector<SVGSVGElement>('[data-poster]');
    if (poster) { if (mode === '3d') poster.setAttribute('inert', ''); else poster.removeAttribute('inert'); }
  }, [stage, domain, selected, hovered, mode]);

  // domain chips (static HTML in the hero copy) + index rows + poster clicks
  useEffect(() => {
    const chips = document.querySelectorAll<HTMLButtonElement>('[data-domain-chip]');
    const onChip = (e: Event) => {
      const id = (e.currentTarget as HTMLElement).dataset.domainChip as DomainId;
      setDomain((d) => (d === id ? null : id));
      setSelected(null);
    };
    chips.forEach((c) => c.addEventListener('click', onChip));
    const posterClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('[data-poster] .mod');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); // first click selects (inspector), the inspector links onward
      setSelected((s) => (s === a.dataset.slug ? null : a.dataset.slug!));
    };
    stage?.addEventListener('click', posterClick);
    return () => { chips.forEach((c) => c.removeEventListener('click', onChip)); stage?.removeEventListener('click', posterClick); };
  }, [stage]);
  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>('[data-domain-chip]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.domainChip === domain)));
  }, [domain]);

  // bus: agent / index focus
  useEffect(() => {
    const apply = (id: string | null, source: string) => {
      if (!id) { setSelected(null); return; }
      if (id.startsWith('domain:')) { setDomain(id.slice(7) as DomainId); setSelected(null); return; }
      const slug = id.startsWith('project:') ? id.slice(8) : id;
      if (!getProject(slug)) return;
      if (source === 'index') setHovered(slug); else { setSelected(slug); setDomain(null); }
    };
    const pending = takePendingFocus();
    if (pending && pending.target !== 'constellation') apply(pending.id, pending.source);
    return on('pexe:focus', (f) => { if (f.target !== 'constellation') apply(f.id, f.source); });
  }, []);

  const step = (dir: 1 | -1) => {
    const list = domain ? order.filter((s) => getProject(s)!.domains.includes(domain)) : order;
    const i = selected ? list.indexOf(selected) : -1;
    setSelected(list[(i + dir + list.length) % list.length]);
  };

  const p = selected ? getProject(selected) : hovered ? getProject(hovered) : null;
  const visibleCount = domain ? projects.filter((x) => x.domains.includes(domain)).length : projects.length;

  return (
    <>
      {(mode === 'loading' || mode === '3d') && (
        <SceneBoundary onFail={() => { setMode('poster'); setWhy('3D stopped after an error: showing the static lab.'); }}>
        <Suspense fallback={null}>
          <LabScene
            selected={selected} hovered={hovered} domain={domain} reduced={reduced} compact={compact}
            onSelect={setSelected} onHover={setHovered} onReady={() => setMode('3d')} onStats={setStats}
          />
        </Suspense>
        </SceneBoundary>
      )}

      <section className="inspector" aria-live="polite" aria-label="Lab inspector">
        <header className="insp-head">
          <span>{p ? `Module ${String(p.index).padStart(2, '0')}` : 'Spatial Lab'}</span>
          <span className="insp-nav">
            <button type="button" onClick={() => step(-1)} aria-label="Previous project">←</button>
            <span className="mono">{visibleCount} modules{domain ? ` · ${getDomain(domain).short}` : ''}</span>
            <button type="button" onClick={() => step(1)} aria-label="Next project">→</button>
          </span>
        </header>
        {p ? (
          <div className="insp-body">
            <h2 className="insp-title">{p.title}</h2>
            <div className="insp-meta">
              <span className="status" data-status={p.status}>{STATUS_LABEL[p.status]}</span>
              <span className="evidence"><EvidenceBars level={EVIDENCE_RANK[p.evidence]} />{EVIDENCE_LABEL[p.evidence]}</span>
            </div>
            <p className="insp-sum">{p.summary}</p>
            <div className="insp-tags">{p.skills.slice(0, 5).map((s) => <span key={s} className="tag">{getSkill(s)?.label}</span>)}</div>
            <div className="insp-actions">
              <a className="btn btn-sm btn-primary" href={`/work/${p.slug}/`}>{p.demo ? 'Open case study + demo' : 'Open case study'} <span className="arrow">→</span></a>
              <button className="btn btn-sm" type="button" onClick={() => emit('pexe:agent-open', { prompt: `Tell me about ${p.title}. What did Priyanshu own, and what’s the evidence?`, send: true })}>Ask the guide</button>
            </div>
          </div>
        ) : (
          <div className="insp-body">
            <p className="insp-lead">Every module is a real project. <b>Height = how much public evidence backs it.</b></p>
            <ul className="insp-legend">
              {(['public', 'documented', 'reported', 'pending'] as const).map((l) => (
                <li key={l}><span className="evidence"><EvidenceBars level={EVIDENCE_RANK[l]} />{EVIDENCE_LABEL[l]}</span></li>
              ))}
            </ul>
            <p className="insp-hint">Select a module, filter by domain, or use ← →.</p>
          </div>
        )}
        <footer className="insp-foot mono">
          {mode === '3d' ? <>webgl · dpr {stats?.dpr.toFixed(2) ?? '…'}{stats ? ` · ${stats.fps} fps` : ''}{reduced ? ' · static frame' : ''}</> : mode === 'loading' ? 'loading 3D scene…' : (
            <>{why ?? 'static lab'} {why && !why.startsWith('WebGL') && <button type="button" className="linkish" onClick={load3d}>Load 3D</button>}</>
          )}
        </footer>
      </section>
    </>
  );
}
