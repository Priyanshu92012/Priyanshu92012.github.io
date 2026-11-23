// Skills Constellation: domains → projects → evidenced skills.
// The SSR output of this island IS the no-JS view (an SVG with real links).
// Hydrated, it becomes an interactive 2D map with an inspector; capable devices
// can switch to a lazy 3D scene that shares the exact same layout and selection.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { projects, getProject, getSkill, getDomain, domainList, projectsWithSkill, projectsInDomain, STATUS_LABEL, EVIDENCE_LABEL, EVIDENCE_RANK, type DomainId } from '../data/index';
import { constellationLayout, edgePath, neighbourhood, VIEW, type CNode } from '../lib/constellation';
import { emit, on, takePendingFocus } from '../lib/bus';
import { lowPower, reducedMotion, webglAvailable } from '../lib/prefs';
import './constellation.css';

const ConstellationScene = lazy(() => import('./scenes/ConstellationScene'));
import SceneBoundary from './SceneBoundary';
type View = '2d' | '3d-loading' | '3d';

function Bars({ level }: { level: number }) {
  return <span className="bars" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}</span>;
}

/** Accepts "skill:x", "project:x", "domain:x" or a bare project slug / skill id. */
function normalise(id: string | null): string | null {
  if (!id) return null;
  const { byId } = constellationLayout();
  if (byId.has(id)) return id;
  if (byId.has(`project:${id}`)) return `project:${id}`;
  if (byId.has(`skill:${id}`)) return `skill:${id}`;
  if (byId.has(`domain:${id}`)) return `domain:${id}`;
  return null;
}

export default function Constellation() {
  const L = useMemo(() => constellationLayout(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [domain, setDomain] = useState<DomainId | null>(null);
  const [view, setView] = useState<View>('2d');
  const [hydrated, setHydrated] = useState(false);
  const [why3d, setWhy3d] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [query, setQuery] = useState('');

  const select = useCallback((id: string | null) => setSelected((s) => (id && s === id ? null : normalise(id))), []);

  useEffect(() => {
    setHydrated(true);
    setReduced(reducedMotion());
    // initial focus: agent hand-off, then URL hash (#skill-python), then ?focus=
    const pending = takePendingFocus();
    const hash = location.hash.match(/^#(skill|project|domain)-(.+)$/);
    const param = new URLSearchParams(location.search).get('focus');
    const first = normalise(pending?.id ?? (hash ? `${hash[1]}:${hash[2]}` : param));
    if (first) setSelected(first);
    // 3D only when it will actually look and run well; 2D is never a lesser view of the data
    if (!webglAvailable()) setWhy3d('WebGL is unavailable in this browser.');
    else if (lowPower()) setWhy3d('Low-power device: 3D is off by default.');
    else if (document.documentElement.dataset.mode === 'recruiter') setWhy3d('Recruiter mode keeps the fast 2D map.');
    const off = on('pexe:focus', (d) => { if (d.target !== 'lab') { const id = normalise(d.id); if (id || d.id === null) setSelected(id); } });
    return off;
  }, []);

  // reflect selection into the static evidence index below (highlight + scroll in view only on agent focus)
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-skill-row]').forEach((el) => {
      el.classList.toggle('is-sel', selected === `skill:${el.dataset.skillRow}`);
    });
  }, [selected]);

  const focusId = hovered ?? selected;
  const hood = useMemo(() => neighbourhood(focusId), [focusId]);
  const inDomain = (n: CNode) => !domain || n.domain === domain || (n.kind === 'project' && getProject(n.id.slice(8))?.domains.includes(domain));
  const state = (n: CNode): 'sel' | 'hood' | 'dim' | 'idle' => {
    if (focusId === n.id) return 'sel';
    if (hood) return hood.has(n.id) ? 'hood' : 'dim';
    return inDomain(n) ? 'idle' : 'dim';
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return L.nodes.filter((n) => n.kind !== 'domain' && (n.label.toLowerCase().includes(q) || (n.kind === 'skill' && getSkill(n.id.slice(6))?.aliases.some((a) => a.includes(q))))).slice(0, 6);
  }, [query, L]);

  const sel = selected ? L.byId.get(selected) ?? null : null;
  const start3d = () => { setView('3d-loading'); };

  return (
    <div className={`cst view-${view}${hydrated ? ' is-live' : ''}`}>
      <div className="cst-toolbar" role="toolbar" aria-label="Constellation controls">
        <div className="cst-chips" role="group" aria-label="Filter by domain">
          {domainList.map((d) => (
            <button key={d.id} type="button" className={`chip d-${d.id}`} aria-pressed={domain === d.id} onClick={() => { setDomain((x) => (x === d.id ? null : d.id)); setSelected(null); }}>
              <span className="swatch" />{d.short}<span className="count">{projectsInDomain(d.id).length}</span>
            </button>
          ))}
        </div>
        <div className="cst-tools">
          <div className="cst-search">
            <label className="sr-only" htmlFor="cst-q">Find a skill or project</label>
            <input id="cst-q" className="field" type="search" placeholder="Find a skill…" value={query} autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { select(matches[0].id); setQuery(''); } }}
              aria-describedby="cst-q-hint" />
            <span id="cst-q-hint" className="sr-only">Type at least two letters; press Enter to select the first match.</span>
            {matches.length > 0 && (
              <ul className="cst-results" role="list">
                {matches.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => { select(m.id); setQuery(''); }}><span className="dot" style={{ background: m.color }} />{m.label}<span className="mono muted">{m.kind}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="cst-view" role="group" aria-label="View">
            <button type="button" className="btn btn-sm" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D map</button>
            <button type="button" className="btn btn-sm" aria-pressed={view !== '2d'} disabled={!!why3d || !hydrated} title={why3d ?? 'Orbit the constellation in 3D'} onClick={start3d}>3D orbit</button>
          </div>
        </div>
      </div>

      <div className="cst-body">
        <div className="cst-stage" onPointerLeave={() => setHovered(null)}>
          {view !== '3d' && (
            <svg className="cst-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="group" aria-labelledby="cst-svg-t">
              <title id="cst-svg-t">{`Skills constellation: ${projects.length} projects connected to the skills they evidence, across ${domainList.length} domains. The evidence index below lists the same data.`}</title>
              <g className="cst-edges">
                {L.edges.map((e) => {
                  const a = L.byId.get(e.source)!, b = L.byId.get(e.target)!;
                  const on = !!hood && hood.has(e.source) && hood.has(e.target) && (e.source === focusId || e.target === focusId);
                  return <path key={`${e.source}-${e.target}`} d={edgePath(a, b)} className={`ce ce-${e.kind}${on ? ' on' : ''}${hood && !on ? ' dim' : ''}`} style={on ? { stroke: (L.byId.get(focusId!) ?? a).color } : undefined} />;
                })}
              </g>
              <g className="cst-nodes">
                {L.nodes.map((n) => {
                  const st = state(n);
                  const showLabel = n.kind !== 'skill' || st === 'sel' || st === 'hood' || (n.weight >= 2 && st !== 'dim');
                  const right = n.x >= VIEW.w / 2;
                  const href = n.kind === 'project' ? `/work/${n.id.slice(8)}/` : n.kind === 'skill' ? `#skill-${n.id.slice(6)}` : `#domain-${n.id.slice(7)}`;
                  return (
                    <a key={n.id} href={href} tabIndex={-1} aria-hidden="true" className={`cn cn-${n.kind} st-${st}`} style={{ ['--c' as string]: n.color }}
                      onClick={(e) => { if (!hydrated) return; e.preventDefault(); select(n.id); }}
                      onPointerEnter={() => setHovered(n.id)}>
                      <circle className="halo" cx={n.x} cy={n.y} r={n.r + 9} />
                      <circle className="core" cx={n.x} cy={n.y} r={n.r} />
                      {showLabel && (
                        <text x={n.x + (right ? n.r + 6 : -n.r - 6)} y={n.y + 4} textAnchor={right ? 'start' : 'end'}>{n.label}</text>
                      )}
                    </a>
                  );
                })}
              </g>
            </svg>
          )}
          {view !== '2d' && (
            <SceneBoundary onFail={() => { setView('2d'); setWhy3d('3D stopped after an error; the 2D map shows the same data.'); }}>
            <Suspense fallback={<div className="cst-loading mono muted">Loading the 3D constellation…</div>}>
              <ConstellationScene selected={selected} hovered={hovered} domain={domain} reduced={reduced}
                onSelect={select} onHover={setHovered} onReady={() => setView('3d')} />
            </Suspense>
            </SceneBoundary>
          )}
          <p className="cst-legend mono muted" aria-hidden="true">
            <span><i className="lg-domain" />domain</span><span><i className="lg-project" />project · size = public evidence</span><span><i className="lg-skill" />skill · size = projects using it</span>
          </p>
        </div>

        <aside className="cst-inspector panel" aria-live="polite" aria-label="Constellation inspector">
          <Inspector node={sel} onSelect={select} />
        </aside>
      </div>
    </div>
  );
}

function Inspector({ node, onSelect }: { node: CNode | null; onSelect: (id: string | null) => void }) {
  if (!node) {
    const top = [...constellationLayout().nodes].filter((n) => n.kind === 'skill').sort((a, b) => b.weight - a.weight).slice(0, 6);
    return (
      <>
        <div className="panel-head"><span>Inspector</span><span>nothing selected</span></div>
        <div className="panel-body ci-body">
          <p className="ci-lead">Select a skill to see <b>exactly which projects evidence it</b>, at what status and with how much public proof.</p>
          <p className="mono muted ci-k">Most evidenced</p>
          <ul className="ci-list">
            {top.map((n) => (
              <li key={n.id}><button type="button" className="linkish" onClick={() => onSelect(n.id)}>{n.label}</button><span className="mono muted">{n.weight} projects</span></li>
            ))}
          </ul>
        </div>
      </>
    );
  }
  if (node.kind === 'skill') {
    const id = node.id.slice(6);
    const s = getSkill(id)!;
    const ps = [...projectsWithSkill(id)].sort((a, b) => EVIDENCE_RANK[b.evidence] - EVIDENCE_RANK[a.evidence]);
    const best = ps[0];
    return (
      <>
        <div className="panel-head"><span>Skill</span><button type="button" className="linkish" onClick={() => onSelect(null)}>Clear</button></div>
        <div className="panel-body ci-body">
          <h3 className="ci-title" style={{ color: node.color }}>{s.label}</h3>
          <p className="mono muted ci-k">{getDomain(s.domain).label} · evidenced by {ps.length} project{ps.length === 1 ? '' : 's'}</p>
          {best && <p className="ci-lead">Strongest public evidence: <b>{EVIDENCE_LABEL[best.evidence].toLowerCase()}</b> ({best.shortTitle}).</p>}
          <ul className="ci-projects">
            {ps.map((p) => (
              <li key={p.slug}>
                <a href={`/work/${p.slug}/`}>{p.title}</a>
                <span className="ci-meta"><span className="status" data-status={p.status}>{STATUS_LABEL[p.status]}</span><span className="evidence"><Bars level={EVIDENCE_RANK[p.evidence]} />{EVIDENCE_LABEL[p.evidence]}</span></span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-sm" onClick={() => emit('pexe:agent-open', { prompt: `What evidence is there for ${s.label}?`, send: true })}>Ask the guide about {s.label}</button>
        </div>
      </>
    );
  }
  if (node.kind === 'project') {
    const p = getProject(node.id.slice(8))!;
    return (
      <>
        <div className="panel-head"><span>Project {String(p.index).padStart(2, '0')}</span><button type="button" className="linkish" onClick={() => onSelect(null)}>Clear</button></div>
        <div className="panel-body ci-body">
          <h3 className="ci-title">{p.title}</h3>
          <p className="ci-meta"><span className="status" data-status={p.status}>{STATUS_LABEL[p.status]}</span><span className="evidence"><Bars level={EVIDENCE_RANK[p.evidence]} />{EVIDENCE_LABEL[p.evidence]}</span></p>
          <p className="ci-sum">{p.summary}</p>
          <div className="ci-tags">
            {p.skills.map((s) => <button key={s} type="button" className="tag" onClick={() => onSelect(`skill:${s}`)}>{getSkill(s)?.label ?? s}</button>)}
          </div>
          <a className="btn btn-sm btn-primary" href={`/work/${p.slug}/`}>Open case study <span className="arrow">→</span></a>
        </div>
      </>
    );
  }
  const d = getDomain(node.id.slice(7) as DomainId);
  return (
    <>
      <div className="panel-head"><span>Domain</span><button type="button" className="linkish" onClick={() => onSelect(null)}>Clear</button></div>
      <div className="panel-body ci-body">
        <h3 className="ci-title" style={{ color: node.color }}>{d.label}</h3>
        <p className="ci-sum">{d.blurb}</p>
        <ul className="ci-list">
          {projectsInDomain(d.id).map((p) => (
            <li key={p.slug}><button type="button" className="linkish" onClick={() => onSelect(`project:${p.slug}`)}>{p.title}</button><span className="status" data-status={p.status}>{STATUS_LABEL[p.status]}</span></li>
          ))}
        </ul>
      </div>
    </>
  );
}
