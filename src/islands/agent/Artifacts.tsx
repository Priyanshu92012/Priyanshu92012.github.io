import type { Brief, JobMatch } from '../../lib/agent/protocol';

const STRENGTH_LABEL = { strong: 'Strong evidence', partial: 'Partial', gap: 'No public evidence', 'not-assessable': 'Not assessable' } as const;

export function JobMatchView({ data }: { data: JobMatch }) {
  const total = data.requirements.length || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="ag-artifact">
      <div className="ag-art-head">
        <span>Evidence matrix</span>
        <span>{data.requirements.length} requirements</span>
      </div>
      <div className="jm-bar" role="img" aria-label={`${data.coverage.strong} strong, ${data.coverage.partial} partial, ${data.coverage.gap} gaps, ${data.coverage.notAssessable} not assessable`}>
        <i className="s-strong" style={{ width: seg(data.coverage.strong) }} />
        <i className="s-partial" style={{ width: seg(data.coverage.partial) }} />
        <i className="s-gap" style={{ width: seg(data.coverage.gap) }} />
        <i className="s-na" style={{ width: seg(data.coverage.notAssessable) }} />
      </div>
      <ol className="jm-list">
        {data.requirements.map((r, i) => (
          <li key={i} className={`jm-row s-${r.strength}`}>
            <div className="jm-req">
              <span className="jm-strength">{STRENGTH_LABEL[r.strength]}</span>
              {r.priority === 'nice' && <span className="jm-nice">nice-to-have</span>}
              <p>{r.text}</p>
            </div>
            {r.evidence.length > 0 && (
              <div className="jm-ev">
                {r.evidence.map((e) => <a key={e.slug} className="tag" href={e.url}>{e.title}</a>)}
              </div>
            )}
            <p className="jm-note">{r.note}</p>
          </li>
        ))}
      </ol>
      {data.readFirst.length > 0 && (
        <div className="jm-read">
          <span className="eyebrow">Read first</span>
          {data.readFirst.map((r) => <a key={r.slug} href={r.url}>{r.title} <span className="muted">· {r.reason}</span></a>)}
        </div>
      )}
      <ul className="jm-caveats">{data.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
    </div>
  );
}

export function BriefView({ data }: { data: Brief }) {
  function download() {
    const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = data.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() { try { await navigator.clipboard.writeText(data.markdown); } catch { /* clipboard blocked */ } }
  return (
    <div className="ag-artifact">
      <div className="ag-art-head"><span>{data.title}</span><span>{data.filename}</span></div>
      <pre className="brief-pre">{data.markdown.split('\n').slice(0, 14).join('\n')}{'\n…'}</pre>
      <div className="brief-actions">
        <button className="btn btn-sm btn-primary" type="button" onClick={download}>Download .md</button>
        <button className="btn btn-sm" type="button" onClick={copy}>Copy</button>
      </div>
    </div>
  );
}
