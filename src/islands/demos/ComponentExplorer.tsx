// Component explorer for the PRIYANSHU.EXE case study: pick a part of the site, see what it does,
// how it reaches the browser, where it lives and how it is tested. Data: src/data/site-architecture.ts.
import { useState } from 'react';
import { SITE_COMPONENTS, type SiteComponent } from '../../data/site-architecture';
import './site.css';

const STATUS: Record<SiteComponent['status'], string> = { live: 'Live for visitors', 'build-time': 'Build time', disabled: 'Built, disabled' };
const LAYERS: { id: SiteComponent['layer']; label: string }[] = [
  { id: 'content', label: 'Content' }, { id: 'page', label: 'Pages' }, { id: 'island', label: 'Islands' },
  { id: 'engine', label: 'Engines' }, { id: 'quality', label: 'Quality' }, { id: 'experimental', label: 'Experimental' },
];

export default function ComponentExplorer() {
  const [id, setId] = useState('guide');
  const c = SITE_COMPONENTS.find((x) => x.id === id)!;
  return (
    <div className="cx">
      <div className="cx-list" role="tablist" aria-label="Site components" aria-orientation="vertical">
        {LAYERS.map((l) => {
          const items = SITE_COMPONENTS.filter((x) => x.layer === l.id);
          if (!items.length) return null;
          return (
            <div key={l.id} className="cx-group">
              <p className="cx-layer mono">{l.label}</p>
              {items.map((x) => (
                <button key={x.id} type="button" role="tab" id={`cx-tab-${x.id}`} aria-selected={x.id === id} aria-controls="cx-panel"
                  className={`cx-item s-${x.status}`} onClick={() => setId(x.id)}>
                  <span className="cx-dot" aria-hidden="true" />{x.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="cx-panel" role="tabpanel" id="cx-panel" aria-labelledby={`cx-tab-${c.id}`}>
        <p className={`cx-status s-${c.status} mono`}>{STATUS[c.status]}</p>
        <h3 className="h3">{c.name}</h3>
        <p className="soft">{c.role}</p>
        <dl className="cx-facts">
          <div><dt>Delivery</dt><dd>{c.delivery}</dd></div>
          <div><dt>Tested by</dt><dd>{c.tested}</dd></div>
          <div><dt>Where</dt><dd>{c.files.map((f) => <code key={f}>{f}</code>)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
