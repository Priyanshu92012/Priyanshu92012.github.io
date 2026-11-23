// BREACH MODE: a consent-based security lab. Nothing runs until the visitor grants permission, and each
// experiment then runs only when its button is pressed. Results stay in memory (no storage, no network)
// and "Revoke" clears them. Engines: src/lib/sim/breach.ts (unit-tested) and the browser itself.
import { useEffect, useState } from 'react';
import Boundaries from './Boundaries';
import AttackDefend from './AttackDefend';
import ShellLab from './ShellLab';
import '../demos/demos.css';
import './breach.css';

type Tab = 'recon' | 'network' | 'boundaries' | 'shell' | 'attack';
type Lang = 'en' | 'de';
const TABS_I18N: Record<Lang, { id: Tab; label: string; kind: string }[]> = {
  en: [
    { id: 'recon', label: 'Browser recon', kind: 'real' },
    { id: 'network', label: 'Network detective', kind: 'real' },
    { id: 'boundaries', label: 'Security boundaries', kind: 'real + simulated' },
    { id: 'shell', label: 'Command sandbox', kind: 'fictional' },
    { id: 'attack', label: 'Attack & defend', kind: 'simulated + real CSP' },
  ],
  de: [
    { id: 'recon', label: 'Browser-Recon', kind: 'echt' },
    { id: 'network', label: 'Netzwerk-Detektiv', kind: 'echt' },
    { id: 'boundaries', label: 'Sicherheitsgrenzen', kind: 'echt + simuliert' },
    { id: 'shell', label: 'Kommando-Sandbox', kind: 'fiktiv' },
    { id: 'attack', label: 'Angriff & Abwehr', kind: 'simuliert + echte CSP' },
  ],
};
const G = {
  en: {
    kicker: 'PERMISSION REQUEST · NOTHING HAS RUN', h: 'You decide what this page may look at.',
    runs: 'What runs, if you press Run', never: 'What never happens',
    r: ['Reads of what your browser already exposes to every site: screen, language, time zone, supported APIs.', 'Timing of the requests this page itself made.', 'Real browser experiments: a sandboxed frame, this site’s Content-Security-Policy, permission states.', 'A fictional server shell and a deliberately vulnerable toy app.'],
    n: ['The experiments make no requests to other servers: no IP lookup, no port scans, no local-network probing.', 'No storage, no fingerprint hash: results live in this tab’s memory and are never sent anywhere.', 'No permission prompts: permission states are read, never requested.', 'No commands on your machine: the shell is a simulation.'],
    ack: 'I understand. Run each experiment only when I press its button.', grant: 'Grant permission', back: 'No thanks, take me back',
    noJs: 'The experiments need JavaScript; the page is still loading it, or it is turned off.',
    granted: 'PERMISSION GRANTED · LOCAL ONLY', clear: 'Clear results', revoke: 'Revoke permission', aria: 'BREACH MODE experiments', tabs: 'BREACH MODE modules', en: '',
  },
  de: {
    kicker: 'ANFRAGE ZUR ERLAUBNIS · NOCH NICHTS GELAUFEN', h: 'Du entscheidest, was diese Seite sich ansehen darf.',
    runs: 'Was läuft, wenn du auf Start drückst', never: 'Was nie passiert',
    r: ['Lesen, was dein Browser ohnehin jeder Website offenlegt: Bildschirm, Sprache, Zeitzone, unterstützte APIs.', 'Zeitmessung der Anfragen, die diese Seite selbst gestellt hat.', 'Echte Browser-Experimente: ein Sandbox-Frame, die Content-Security-Policy dieser Website, Berechtigungszustände.', 'Eine fiktive Server-Shell und eine absichtlich verwundbare Spielzeug-App.'],
    n: ['Die Experimente stellen keine Anfragen an andere Server: keine IP-Abfrage, keine Port-Scans, kein Abtasten des lokalen Netzes.', 'Keine Speicherung, kein Fingerprint-Hash: Ergebnisse bleiben im Speicher dieses Tabs und werden nirgendwohin gesendet.', 'Keine Berechtigungsabfragen: Zustände werden gelesen, nie angefragt.', 'Keine Befehle auf deinem Gerät: Die Shell ist eine Simulation.'],
    ack: 'Verstanden. Jedes Experiment läuft nur, wenn ich seinen Button drücke.', grant: 'Erlaubnis erteilen', back: 'Nein danke, zurück',
    noJs: 'Die Experimente brauchen JavaScript; die Seite lädt es noch, oder es ist ausgeschaltet.',
    granted: 'ERLAUBNIS ERTEILT · NUR LOKAL', clear: 'Ergebnisse löschen', revoke: 'Erlaubnis widerrufen', aria: 'BREACH-MODE-Experimente', tabs: 'BREACH-MODE-Module', en: 'Die Experimente selbst sind auf Englisch.',
  },
} as const;

export default function BreachLab({ lang = 'en' }: { lang?: Lang }) {
  const g = G[lang];
  const TABS = TABS_I18N[lang];
  const [granted, setGranted] = useState(false);
  const [ack, setAck] = useState(false);
  const [tab, setTab] = useState<Tab>('recon');
  const [epoch, setEpoch] = useState(0); // bumping it remounts every module: results are gone
  const [ready, setReady] = useState(false); // consent can only be given once the lab is interactive
  useEffect(() => setReady(true), []);

  if (!granted) {
    return (
      <section className="br-gate" aria-labelledby="br-gate-h">
        <p className="br-kicker mono">{g.kicker}</p>
        <h2 id="br-gate-h" className="br-gate-h">{g.h}</h2>
        <div className="br-scope">
          <div>
            <h3>{g.runs}</h3>
            <ul>{g.r.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3>{g.never}</h3>
            <ul>{g.n.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
        <label className="br-ack"><input type="checkbox" checked={ack} disabled={!ready} onChange={(e) => setAck(e.target.checked)} /> {g.ack}</label>
        <div className="br-gate-actions">
          <button type="button" className="btn btn-primary" disabled={!ack} onClick={() => setGranted(true)}>{g.grant}</button>
          <a className="btn btn-quiet" href={lang === 'de' ? '/de/' : '/'}>{g.back}</a>
        </div>
        {!ready && <p className="demo-note">{g.noJs}</p>}
      </section>
    );
  }

  return (
    <section className="demo br-lab" aria-label={g.aria}>
      <div className="br-status">
        <span className="mono"><span className="br-dot" aria-hidden="true" /> {g.granted}</span>
        <span className="br-status-actions">
          <button type="button" className="btn btn-sm" onClick={() => setEpoch((n) => n + 1)}>{g.clear}</button>
          <button type="button" className="btn btn-sm" onClick={() => { setGranted(false); setAck(false); setEpoch((n) => n + 1); }}>{g.revoke}</button>
        </span>
      </div>
      <div className="demo-tabs br-tabs" role="tablist" aria-label={g.tabs}>
        {TABS.map((t) => (
          <button key={t.id} id={`br-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`br-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const i = TABS.findIndex((x) => x.id === tab);
              const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
              setTab(n.id); document.getElementById(`br-tab-${n.id}`)?.focus();
            }}>{t.label}<small>{t.kind}</small></button>
        ))}
      </div>
      {g.en && <p className="demo-note">{g.en}</p>}
      <div id={`br-panel-${tab}`} role="tabpanel" aria-labelledby={`br-tab-${tab}`} className="br-panel" key={`${tab}-${epoch}`} lang={lang === 'de' ? 'en' : undefined}>
        {tab === 'recon' && <Recon />}
        {tab === 'network' && <Network />}
        {tab === 'boundaries' && <Boundaries />}
        {tab === 'shell' && <ShellLab />}
        {tab === 'attack' && <AttackDefend />}
      </div>
    </section>
  );
}

// ── A. browser recon ─────────────────────────────────────────────────
type Row = { label: string; value: string | null; why: string };
type NavExtra = Navigator & { userAgentData?: { brands: { brand: string; version: string }[]; platform: string; mobile: boolean }; deviceMemory?: number; connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean } };

function collect(): { group: string; rows: Row[] }[] {
  const n = navigator as NavExtra;
  const mq = (q: string) => matchMedia(q).matches;
  let gpu: string | null = null;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = gl ? (ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'WebGL available; renderer name hidden by the browser') : null;
  } catch { gpu = null; }
  return [
    { group: 'Browser & platform', rows: [
      { label: 'Brand hints', value: n.userAgentData ? n.userAgentData.brands.map((b) => `${b.brand} ${b.version}`).join(', ') : null, why: 'User-Agent Client Hints (Chromium). Coarse on purpose.' },
      { label: 'Platform', value: n.userAgentData?.platform ?? null, why: 'From Client Hints; unavailable in Firefox and Safari.' },
      { label: 'Mobile', value: n.userAgentData ? String(n.userAgentData.mobile) : null, why: 'Client Hints.' },
      { label: 'User-Agent string', value: n.userAgent, why: 'Sent with every request you make, to every server.' },
    ] },
    { group: 'Screen & preferences', rows: [
      { label: 'Viewport', value: `${innerWidth} × ${innerHeight} CSS px`, why: 'Any page can measure its own window.' },
      { label: 'Screen', value: `${screen.width} × ${screen.height}, ${devicePixelRatio}× pixel ratio, ${screen.colorDepth}-bit colour`, why: 'Screen size is a classic fingerprinting signal.' },
      { label: 'Colour scheme', value: mq('(prefers-color-scheme: dark)') ? 'dark' : 'light', why: 'CSS media query.' },
      { label: 'Reduced motion', value: mq('(prefers-reduced-motion: reduce)') ? 'requested' : 'not requested', why: 'CSS media query.' },
    ] },
    { group: 'Locale & time', rows: [
      { label: 'Languages', value: (n.languages ?? [n.language]).join(', '), why: 'Also sent as the Accept-Language header.' },
      { label: 'Time zone', value: Intl.DateTimeFormat().resolvedOptions().timeZone, why: 'Narrows your region without any IP lookup.' },
      { label: 'Local time', value: new Date().toLocaleString(), why: 'Your clock, as JavaScript sees it.' },
    ] },
    { group: 'Hardware hints', rows: [
      { label: 'Logical CPU cores', value: n.hardwareConcurrency ? String(n.hardwareConcurrency) : null, why: 'navigator.hardwareConcurrency.' },
      { label: 'Device memory', value: n.deviceMemory ? `≈ ${n.deviceMemory} GB (rounded)` : null, why: 'Chromium only, deliberately rounded.' },
      { label: 'Graphics', value: gpu, why: 'WebGL renderer string; some browsers hide it.' },
      { label: 'Network estimate', value: n.connection ? `${n.connection.effectiveType ?? '?'}, ~${n.connection.rtt ?? '?'} ms RTT, ~${n.connection.downlink ?? '?'} Mbit/s` : null, why: 'Network Information API (Chromium), coarse buckets.' },
    ] },
    { group: 'Security features present', rows: [
      { label: 'Secure context', value: String(isSecureContext), why: 'HTTPS or localhost: required for most powerful APIs.' },
      { label: 'Web Crypto', value: crypto?.subtle ? 'available' : null, why: 'Used by the OpticLab and SecureMed labs on this site.' },
      { label: 'WebAuthn (passkeys)', value: 'PublicKeyCredential' in window ? 'available' : null, why: 'Phishing-resistant, origin-bound credentials.' },
      { label: 'Cross-origin isolated', value: String(crossOriginIsolated), why: 'Needs COOP/COEP headers; GitHub Pages cannot send them.' },
      { label: 'Trusted Types', value: 'trustedTypes' in window ? 'available' : null, why: 'DOM-XSS defence (Chromium).' },
    ] },
  ];
}

function Recon() {
  const [data, setData] = useState<ReturnType<typeof collect> | null>(null);
  return (
    <div className="br-mod">
      <div className="br-mod-head">
        <p>What any website can read without asking. Shown to you, kept in memory, never sent or stored.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setData(collect())}>{data ? 'Read again' : 'Run recon'}</button>
      </div>
      {data && (
        <div className="br-recon" aria-live="polite">
          {data.map((g) => (
            <section key={g.group} className="demo-card">
              <header><span><b>{g.group}</b></span></header>
              <dl>
                {g.rows.map((r) => (
                  <div key={r.label} className={r.value === null ? 'na' : ''}>
                    <dt>{r.label}</dt>
                    <dd>{r.value ?? 'Unavailable in this browser'}<small>{r.why}</small></dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <p className="demo-note br-wide">Combined, signals like these can single out a browser (“fingerprinting”). This page does not combine, hash or keep them. Firefox and Safari expose less, which is why some rows say unavailable.</p>
        </div>
      )}
    </div>
  );
}

// ── B. network detective ─────────────────────────────────────────────
type Entry = { name: string; type: string; start: number; dur: number; size: number; proto: string; cached: boolean };

function Network() {
  const [nav, setNav] = useState<Record<string, number | string> | null>(null);
  const [rows, setRows] = useState<Entry[]>([]);
  const read = () => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (n) setNav({
      protocol: n.nextHopProtocol || 'unknown', dns: Math.round(n.domainLookupEnd - n.domainLookupStart), connect: Math.round(n.connectEnd - n.connectStart),
      tls: n.secureConnectionStart > 0 ? Math.round(n.connectEnd - n.secureConnectionStart) : 0, ttfb: Math.round(n.responseStart - n.requestStart),
      download: Math.round(n.responseEnd - n.responseStart), size: n.transferSize, total: Math.round(n.loadEventEnd || n.responseEnd),
    });
    const rs = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((r) => ({
      name: new URL(r.name).pathname.split('/').pop() || r.name, type: r.initiatorType, start: r.startTime, dur: r.duration, size: r.transferSize, proto: r.nextHopProtocol, cached: r.transferSize === 0 && r.decodedBodySize > 0,
    })).sort((a, b) => a.start - b.start).slice(0, 18);
    setRows(rs);
  };
  const end = Math.max(1, ...rows.map((r) => r.start + r.dur));
  return (
    <div className="br-mod">
      <div className="br-mod-head">
        <p>Real Resource Timing for this page: how long DNS, the connection, TLS and each file took. Only requests this page made itself.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={read}>{nav ? 'Measure again' : 'Read timings'}</button>
      </div>
      {nav && (
        <div className="br-net" aria-live="polite">
          <div className="demo-metrics">
            {[['Protocol', nav.protocol], ['DNS', `${nav.dns} ms`], ['Connect', `${nav.connect} ms`], ['TLS', nav.tls ? `${nav.tls} ms` : '— (no TLS or reused)'], ['Time to first byte', `${nav.ttfb} ms`], ['HTML transfer', `${Math.round(Number(nav.size) / 1024)} KB`]].map(([k, v]) => (
              <div key={k} className="demo-metric"><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          <section className="demo-card">
            <header><span><b>Waterfall</b> · first {rows.length} resources</span><span>{Math.round(end)} ms</span></header>
            <ol className="br-wf">
              {rows.map((r, i) => (
                <li key={i}>
                  <span className="br-wf-name mono" title={r.name}>{r.name}</span>
                  <span className="br-wf-bar" aria-hidden="true"><i style={{ left: `${(r.start / end) * 100}%`, width: `${Math.max(0.6, (r.dur / end) * 100)}%` }} /></span>
                  <span className="br-wf-meta mono">{r.cached ? 'cache' : `${Math.max(0, Math.round(r.size / 1024))} KB`} · {Math.round(r.dur)} ms</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="demo-card br-tls">
            <header><span><b>TLS 1.3 handshake</b> · educational diagram</span></header>
            <ol>
              <li><b>ClientHello</b> supported ciphers + a key share</li>
              <li><b>ServerHello</b> its key share; from here everything is encrypted</li>
              <li><b>Certificate + CertificateVerify</b> proves the server holds the key for this name</li>
              <li><b>Finished</b> both sides confirm the transcript; one round trip in total</li>
            </ol>
          </section>
          <p className="demo-note">No public-IP lookup: this is a static site, so it would need a third-party service to see your address, and it will not send you there. An IP address alone does not reveal your name or exact location.</p>
        </div>
      )}
    </div>
  );
}
