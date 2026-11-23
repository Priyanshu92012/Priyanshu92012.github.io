// BaSyx .aasx import workflow on the tested engine in src/lib/sim/basyx.ts.
// Upload → parse → compare → decide → apply, with safe defaults: new entries are
// imported, conflicts are skipped unless the user explicitly chooses to overwrite.
import { useMemo, useState } from 'react';
import { PACKAGES, REPOSITORY, compare, defaultDecision, apply, type Decision, type Entry, type ConceptDescription } from '../../lib/sim/basyx';
import './demos.css';

const STEPS = ['Upload', 'Parse', 'Compare', 'Decide', 'Apply'] as const;

export default function BasyxLab() {
  const [repo, setRepo] = useState<ConceptDescription[]>(() => REPOSITORY.map((r) => ({ ...r })));
  const [pkgIdx, setPkgIdx] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [report, setReport] = useState<ReturnType<typeof apply>['report'] | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const pkg = pkgIdx !== null ? PACKAGES[pkgIdx] : null;
  const entries: Entry[] = useMemo(() => (pkg ? compare(pkg, repo) : []), [pkg, repo]);

  const choose = (i: number) => { setPkgIdx(i); setStep(1); setDecisions({}); setReport(null); };
  const decisionOf = (e: Entry) => decisions[e.cd.id] ?? defaultDecision(e);
  const doApply = () => {
    const r = apply(repo, entries, decisions);
    setRepo(r.repo); setReport(r.report); setStep(4);
    setTouched(new Set([...r.report.imported, ...r.report.overwritten]));
  };
  const restart = (resetRepo: boolean) => {
    if (resetRepo) { setRepo(REPOSITORY.map((r) => ({ ...r }))); setTouched(new Set()); }
    setPkgIdx(null); setStep(0); setDecisions({}); setReport(null);
  };
  const counts = { new: entries.filter((e) => e.status === 'new').length, conflict: entries.filter((e) => e.status === 'conflict').length, identical: entries.filter((e) => e.status === 'identical').length };

  return (
    <div className="demo d-research">
      <ol className="bx-steps" aria-label="Import steps">
        {STEPS.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}><span className="mono">{i + 1}</span>{s}</li>)}
      </ol>

      <div className="bx-grid">
        <section className="demo-card" aria-live="polite">
          {step === 0 && (
            <>
              <header><span><b>Upload an .aasx package</b></span><span>synthetic</span></header>
              <div className="body bx-pkgs">
                {PACKAGES.map((p, i) => (
                  <button key={p.name} type="button" className="bx-pkg" onClick={() => choose(i)}>
                    <span className="bx-file" aria-hidden="true">AASX</span>
                    <span><b className="mono">{p.name}</b><span className="demo-note">{p.cds.length} concept descriptions · {p.eds.length} embedded data specs</span></span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && pkg && (
            <>
              <header><span><b>Parsed</b> · {pkg.name}</span><span>{pkg.cds.length} CDs</span></header>
              <div className="body">
                <ul className="bx-list">
                  {pkg.cds.map((c) => <li key={c.id}><span className="mono muted">{c.id}</span><b>{c.idShort}</b><span className="demo-note">{c.preferredName}{c.unit ? ` · ${c.unit}` : ''} · {c.source.toUpperCase()} v{c.version}</span></li>)}
                </ul>
                <p className="demo-lab" style={{ margin: '12px 0 6px' }}>Embedded data specifications</p>
                <ul className="bx-list">
                  {pkg.eds.map((e) => <li key={e.submodelProperty}><span className="mono">{e.submodelProperty}</span><span className="demo-note">→ {e.cdRef}</span></li>)}
                </ul>
                <div className="demo-ctrls" style={{ marginTop: 12 }}><button type="button" className="btn btn-sm btn-run" onClick={() => setStep(2)}>Compare with repository</button><button type="button" className="btn btn-sm" onClick={() => restart(false)}>Back</button></div>
              </div>
            </>
          )}
          {(step === 2 || step === 3) && pkg && (
            <>
              <header><span><b>{step === 2 ? 'Comparison' : 'Decide'}</b> · {counts.new} new · {counts.conflict} conflict · {counts.identical} identical</span><span>{pkg.name}</span></header>
              <div className="body">
                <ul className="bx-entries">
                  {entries.map((e) => (
                    <li key={e.cd.id} className={`bx-e ${e.status}`}>
                      <div className="bx-eh">
                        <span className={`pill ${e.status === 'new' ? 'ok' : e.status === 'conflict' ? 'bad' : ''}`}>{e.status}</span>
                        <b>{e.cd.idShort}</b><span className="mono muted">{e.cd.id}</span>
                      </div>
                      {e.diff.length > 0 && <ul className="bx-diff">{e.diff.map((d) => <li key={d} className="mono">{d}</li>)}</ul>}
                      {step === 3 && e.status !== 'identical' && (
                        <div className="bx-dec" role="radiogroup" aria-label={`Decision for ${e.cd.idShort}`}>
                          {(e.status === 'new' ? (['import', 'skip'] as Decision[]) : (['skip', 'overwrite'] as Decision[])).map((d) => (
                            <label key={d} className={decisionOf(e) === d ? 'on' : ''}>
                              <input type="radio" name={`dec-${e.cd.id}`} checked={decisionOf(e) === d} onChange={() => setDecisions((x) => ({ ...x, [e.cd.id]: d }))} />
                              {d}{d === defaultDecision(e) ? ' (default)' : ''}
                            </label>
                          ))}
                        </div>
                      )}
                      {step === 3 && e.status === 'identical' && <p className="demo-note">Already in the repository: nothing to do.</p>}
                    </li>
                  ))}
                </ul>
                <div className="demo-ctrls" style={{ marginTop: 12 }}>
                  {step === 2 ? <button type="button" className="btn btn-sm btn-run" onClick={() => setStep(3)}>Review decisions</button>
                    : <button type="button" className="btn btn-sm btn-run" onClick={doApply}>Apply import</button>}
                  <button type="button" className="btn btn-sm" onClick={() => setStep(step - 1)}>Back</button>
                </div>
                {step === 3 && <p className="demo-note" style={{ marginTop: 8 }}>Safe defaults: new entries are imported, conflicts are <b>skipped</b>. Overwriting needs an explicit choice, so an upload can never silently change existing semantics.</p>}
              </div>
            </>
          )}
          {step === 4 && report && (
            <>
              <header><span><b>Import report</b></span><span className="ok">applied</span></header>
              <div className="body">
                <div className="demo-metrics">
                  <div className="demo-metric good"><span>Imported</span><b>{report.imported.length}</b></div>
                  <div className="demo-metric warn"><span>Overwritten</span><b>{report.overwritten.length}</b></div>
                  <div className="demo-metric"><span>Skipped</span><b>{report.skipped.length}</b></div>
                  <div className="demo-metric"><span>Unchanged</span><b>{report.unchanged.length}</b></div>
                </div>
                <ul className="bx-list" style={{ marginTop: 12 }}>
                  {[...report.imported.map((id) => ['imported', id]), ...report.overwritten.map((id) => ['overwritten', id]), ...report.skipped.map((id) => ['skipped', id])].map(([k, id]) => <li key={id}><span className={`pill ${k === 'imported' ? 'ok' : k === 'overwritten' ? 'warn' : ''}`}>{k}</span><span className="mono">{id}</span></li>)}
                </ul>
                <div className="demo-ctrls" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-sm btn-run" onClick={() => restart(false)}>Import another package</button>
                  <button type="button" className="btn btn-sm" onClick={() => restart(true)}>Reset repository</button>
                </div>
                <p className="demo-note" style={{ marginTop: 8 }}>Re-importing the same package now reports every entry as identical: the import is idempotent.</p>
              </div>
            </>
          )}
        </section>

        <section className="demo-card" aria-label="Target repository">
          <header><span><b>Repository</b> · concept descriptions</span><span>{repo.length}</span></header>
          <div className="body" style={{ overflowX: 'auto' }}>
            <table className="gm-ledger bx-repo">
              <thead><tr><th>idShort</th><th>Name</th><th>Unit</th><th>v</th></tr></thead>
              <tbody>
                {repo.map((r) => (
                  <tr key={r.id} className={touched.has(r.id) ? 'bx-new' : ''}>
                    <td><b>{r.idShort}</b><div className="mono muted" style={{ fontSize: '0.625rem' }}>{r.id}</div></td>
                    <td>{r.preferredName}</td><td>{r.unit ?? '—'}</td><td className="mono">{r.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
