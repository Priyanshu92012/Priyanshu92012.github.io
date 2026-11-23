// Security boundaries: real experiments against this page's own Content-Security-Policy and a sandboxed
// frame, real permission states (read, never requested), WebAuthn capability, and a CORS simulator
// that applies the browser's rules to fictional servers (no cross-origin request is ever made).
import { useEffect, useRef, useState } from 'react';
import { corsDecision, type CorsServer } from '../../lib/sim/breach';

type Probe = { name: string; blocked: boolean; detail: string };

export default function Boundaries() {
  return (
    <div className="br-mod br-bounds">
      <CspProbe />
      <SandboxProbe />
      <CorsSim />
      <Permissions />
    </div>
  );
}

// ── CSP: try three classic injections against this very page ─────────
function CspProbe() {
  const [policy, setPolicy] = useState<string | null>(null);
  const [res, setRes] = useState<Probe[] | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const run = async () => {
    setPolicy(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? null);
    const seen: string[] = [];
    const onV = (e: SecurityPolicyViolationEvent) => seen.push(`${e.effectiveDirective} (${e.blockedURI || 'inline'})`);
    document.addEventListener('securitypolicyviolation', onV);
    const out: Probe[] = [];
    // 1. injected inline <script>
    const w = window as Window & { __breach?: number };
    delete w.__breach;
    const s = document.createElement('script'); s.textContent = 'window.__breach = 1'; document.body.appendChild(s); s.remove();
    out.push({ name: 'Inject an inline <script>', blocked: w.__breach !== 1, detail: w.__breach === 1 ? 'executed' : 'refused by script-src (no unsafe-inline)' });
    // 2. inline event handler via innerHTML
    const box = document.createElement('div'); box.hidden = true; document.body.appendChild(box);
    box.innerHTML = '<img src="data:," onerror="window.__breach = 2">';
    await new Promise((r) => setTimeout(r, 120)); box.remove();
    out.push({ name: 'Inline onerror handler via innerHTML', blocked: w.__breach !== 2, detail: w.__breach === 2 ? 'executed' : 'refused by script-src-attr' });
    // 3. eval
    try { (0, eval)('window.__breach = 3'); out.push({ name: 'eval()', blocked: false, detail: 'executed' }); }
    catch (e) { out.push({ name: 'eval()', blocked: true, detail: `${(e as Error).name}: no unsafe-eval` }); }
    // 4. fetch to another origin (blocked before any network traffic)
    try { await fetch('https://example.invalid/', { mode: 'no-cors' }); out.push({ name: 'fetch() to another origin', blocked: false, detail: 'sent' }); }
    catch { out.push({ name: 'fetch() to another origin', blocked: true, detail: 'refused by connect-src before any request left' }); }
    await new Promise((r) => setTimeout(r, 50));
    document.removeEventListener('securitypolicyviolation', onV);
    setRes(out); setEvents(seen);
  };
  return (
    <section className="demo-card">
      <header><span><b>Content-Security-Policy</b> · real, this page</span><button type="button" className="btn btn-sm btn-primary" onClick={run}>Try to inject</button></header>
      <div className="body">
        <p className="demo-note">This site ships a strict CSP: scripts only from its own origin or hashed inline blocks, no eval, no inline handlers, network only to itself. The button attacks this page the way an XSS payload would. The browser’s console will show the refusals.</p>
        {res && <ProbeList items={res} />}
        {res && events.length > 0 && <p className="demo-note">The page also received {events.length} <code>securitypolicyviolation</code> event{events.length === 1 ? '' : 's'}: {events.join(' · ')}.</p>}
        {policy && <details className="br-policy"><summary>The policy this page actually carries</summary><code>{policy.replace(/'sha256-[^']+'/g, (m) => `${m.slice(0, 16)}…'`)}</code></details>}
        {res && !policy && <p className="demo-note">No CSP meta found (development server). The production build adds it.</p>}
      </div>
    </section>
  );
}

// ── sandboxed iframe: an opaque origin probes its own limits ─────────
function SandboxProbe() {
  const [res, setRes] = useState<Probe[] | null>(null);
  const [on, setOn] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!on) return;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'breach:sandbox') return; // accept only our frame's report
      setRes((e.data.results as Probe[]).map((p) => ({ name: String(p.name), blocked: Boolean(p.blocked), detail: String(p.detail).slice(0, 160) })));
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, [on]);
  return (
    <section className="demo-card">
      <header><span><b>Same-origin policy &amp; sandboxing</b> · real</span><button type="button" className="btn btn-sm btn-primary" onClick={() => { setRes(null); setOn(false); requestAnimationFrame(() => setOn(true)); }}>Open sandboxed frame</button></header>
      <div className="body">
        <p className="demo-note">A frame from this same site, loaded with <code>sandbox="allow-scripts"</code>. The browser gives it an opaque origin, so it is treated as a stranger: its script tries to reach out and reports what the browser allowed.</p>
        {on && <iframe ref={frame} className="br-frame" src="/security-lab/sandbox.html" sandbox="allow-scripts" title="Sandboxed probe frame" />}
        {res && <ProbeList items={res} inverse={['My origin', 'Talk to the parent (postMessage)']} />}
      </div>
    </section>
  );
}

// ── CORS: browser rules, fictional servers ───────────────────────────
const PRESETS: { id: string; label: string; srv: CorsServer }[] = [
  { id: 'none', label: 'API sends no CORS headers', srv: { allowOrigin: null, allowMethods: [], allowHeaders: [], allowCredentials: false } },
  { id: 'star', label: 'API allows “*”', srv: { allowOrigin: '*', allowMethods: ['GET', 'POST'], allowHeaders: [], allowCredentials: false } },
  { id: 'exact', label: 'API allows exactly app.example, with credentials', srv: { allowOrigin: 'https://app.example', allowMethods: ['GET', 'POST', 'PUT'], allowHeaders: ['Authorization', 'Content-Type'], allowCredentials: true } },
];
function CorsSim() {
  const [srv, setSrv] = useState(PRESETS[0]);
  const [origin, setOrigin] = useState('https://app.example');
  const [method, setMethod] = useState('GET');
  const [auth, setAuth] = useState(false);
  const [cred, setCred] = useState(false);
  const d = corsDecision({ origin, method, headers: auth ? ['Authorization'] : [], credentials: cred }, srv.srv);
  return (
    <section className="demo-card">
      <header><span><b>CORS</b> · browser rules, simulated servers</span><span className={`pill ${d.allowed ? 'ok' : 'bad'}`}>{d.allowed ? 'page may read the response' : 'blocked by the browser'}</span></header>
      <div className="body br-cors">
        <div className="br-cors-ctrls">
          <label>Server<select className="demo-select" value={srv.id} onChange={(e) => setSrv(PRESETS.find((p) => p.id === e.target.value)!)}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label>Calling page<select className="demo-select" value={origin} onChange={(e) => setOrigin(e.target.value)}><option>https://app.example</option><option>https://evil.example</option></select></label>
          <label>Method<select className="demo-select" value={method} onChange={(e) => setMethod(e.target.value)}>{['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="br-inline"><input type="checkbox" checked={auth} onChange={(e) => setAuth(e.target.checked)} /> Authorization header</label>
          <label className="br-inline"><input type="checkbox" checked={cred} onChange={(e) => setCred(e.target.checked)} /> Send cookies</label>
        </div>
        <ol className="br-steps">{d.steps.map((s) => <li key={s.step} className={s.ok ? 'ok' : 'bad'}><b>{s.ok ? '✓' : '✕'} {s.step}</b><span>{s.detail}</span></li>)}</ol>
        <p className="demo-note">CORS protects the <em>reader</em>, not the server: a blocked request may still have reached the API. Servers still need authentication and CSRF defences.</p>
      </div>
    </section>
  );
}

// ── permissions and passkeys: read, never request ────────────────────
function Permissions() {
  const [rows, setRows] = useState<{ name: string; state: string }[] | null>(null);
  const [passkey, setPasskey] = useState<string | null>(null);
  const run = async () => {
    const names = ['geolocation', 'camera', 'microphone', 'notifications', 'clipboard-read'];
    setRows(await Promise.all(names.map(async (name) => {
      try { return { name, state: (await navigator.permissions.query({ name: name as PermissionName })).state }; }
      catch { return { name, state: 'not queryable in this browser' }; }
    })));
    const PKC = (window as Window & { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }).PublicKeyCredential;
    setPasskey(PKC?.isUserVerifyingPlatformAuthenticatorAvailable ? ((await PKC.isUserVerifyingPlatformAuthenticatorAvailable()) ? 'a built-in authenticator (passkeys) is available' : 'no built-in authenticator; a security key or phone could still work') : 'WebAuthn not supported');
  };
  return (
    <section className="demo-card">
      <header><span><b>Permission boundaries &amp; web authentication</b> · real, read-only</span><button type="button" className="btn btn-sm btn-primary" onClick={run}>Read states</button></header>
      <div className="body">
        <p className="demo-note">Powerful features need your explicit permission per site. This reads the current states without triggering a single prompt.</p>
        {rows && <ul className="br-perms">{rows.map((r) => <li key={r.name}><span className="mono">{r.name}</span><b className={`st-${r.state.split(' ')[0]}`}>{r.state}</b></li>)}</ul>}
        {passkey && <p className="br-passkey"><b>WebAuthn:</b> {passkey}. A passkey is bound to the site’s origin, so a look-alike phishing domain cannot use it.</p>}
      </div>
    </section>
  );
}

function ProbeList({ items, inverse = [] }: { items: Probe[]; inverse?: string[] }) {
  return (
    <ul className="br-probes" aria-live="polite">
      {items.map((p) => {
        const expected = inverse.includes(p.name) ? !p.blocked : p.blocked;
        return <li key={p.name} className={expected ? 'ok' : 'bad'}><b>{p.blocked ? 'Blocked' : 'Allowed'}</b><span>{p.name}</span><small>{p.detail}</small></li>;
      })}
    </ul>
  );
}
