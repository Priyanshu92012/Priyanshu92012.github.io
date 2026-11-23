// SecureMed security laboratory: STRIDE threat model, a real TOTP MFA login
// (RFC 6238 via Web Crypto, all in the browser) and CI/CD security gates.
// Generic reference controls; no patient data and no course implementation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPONENTS, FLOWS, THREATS, INJECTIONS, GATES, runPipeline, type Injection, type Threat, type GateResult } from '../../lib/sim/securemed';
import { randomSecret, totp, verifyTotp, otpauthUri } from '../../lib/sim/totp';
import { reducedMotion } from '../../lib/prefs';
import './demos.css';

type Tab = 'threats' | 'mfa' | 'pipeline';
const STRIDE: Threat['stride'][] = ['Spoofing', 'Tampering', 'Repudiation', 'Information disclosure', 'Denial of service', 'Elevation of privilege'];

export default function SecureMedLab() {
  const [tab, setTab] = useState<Tab>('mfa');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'mfa', label: 'MFA login (real TOTP)' },
    { id: 'threats', label: 'Threat model' },
    { id: 'pipeline', label: 'CI/CD security gates' },
  ];
  return (
    <div className="demo d-security">
      <div className="demo-tabs" role="tablist" aria-label="SecureMed laboratory">
        {tabs.map((t) => (
          <button key={t.id} id={`sm-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`sm-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.id === tab);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                setTab(n.id); document.getElementById(`sm-tab-${n.id}`)?.focus();
              }
            }}>{t.label}</button>
        ))}
      </div>
      <div id={`sm-panel-${tab}`} role="tabpanel" aria-labelledby={`sm-tab-${tab}`}>
        {tab === 'threats' && <ThreatModel />}
        {tab === 'mfa' && <MfaLab />}
        {tab === 'pipeline' && <Pipeline />}
      </div>
    </div>
  );
}

// ── Threat model ─────────────────────────────────────────────────────
function ThreatModel() {
  const [sel, setSel] = useState('gateway');
  const [stride, setStride] = useState<Threat['stride'] | null>(null);
  const pos = useMemo(() => new Map(COMPONENTS.map((c) => [c.id, c])), []);
  const hit = (id: string) => !stride || (THREATS[id] ?? []).some((t) => t.stride === stride);
  const comp = pos.get(sel)!;
  const threats = (THREATS[sel] ?? []).filter((t) => !stride || t.stride === stride);
  return (
    <div className="demo-grid" style={{ paddingTop: 14 }}>
      <div className="demo-ctrls" role="group" aria-label="Filter by STRIDE category">
        <button type="button" className="btn btn-sm" aria-pressed={!stride} onClick={() => setStride(null)}>All</button>
        {STRIDE.map((s) => <button key={s} type="button" className="btn btn-sm" aria-pressed={stride === s} onClick={() => setStride(stride === s ? null : s)}>{s}</button>)}
      </div>
      <div className="sm-tm">
        <section className="demo-card">
          <header><span><b>Reference architecture</b> · data flows &amp; trust boundaries</span><span>select a component</span></header>
          <div className="body">
            <svg className="sm-arch" viewBox="-20 0 680 340" role="group" aria-label="Architecture components">
              {[145, 315, 485].map((x) => <line key={x} x1={x} y1={8} x2={x} y2={250} className="tb" />)}
              {[['PUBLIC', 60], ['EDGE', 230], ['APPLICATION', 400], ['DATA', 570]].map(([l, x]) => <text key={l as string} x={x as number} y={14} className="zone" textAnchor="middle">{l}</text>)}
              <text x={230} y={334} className="zone" textAnchor="middle">DELIVERY</text>
              {FLOWS.map(([a, b]) => { const A = pos.get(a)!, B = pos.get(b)!; return <line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className={`fl${sel === a || sel === b ? ' on' : ''}`} />; })}
              {COMPONENTS.map((c) => (
                <g key={c.id} className={`cp${sel === c.id ? ' sel' : ''}${hit(c.id) ? '' : ' dim'}`} transform={`translate(${c.x - 66} ${c.y - 21})`}
                  role="button" tabIndex={0} aria-pressed={sel === c.id} aria-label={`${c.label}: ${(THREATS[c.id] ?? []).length} threats`}
                  onClick={() => setSel(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(c.id); } }}>
                  <rect width={132} height={42} rx={7} />
                  <text x={66} y={26} textAnchor="middle">{c.label}</text>
                  <circle cx={128} cy={4} r={9} className="cnt" /><text x={128} y={8} textAnchor="middle" className="cnt-t">{(THREATS[c.id] ?? []).length}</text>
                </g>
              ))}
            </svg>
          </div>
        </section>
        <section className="demo-card" aria-live="polite">
          <header><span><b>{comp.label}</b></span><span>{comp.zone}</span></header>
          <div className="body">
            {threats.length === 0 ? <p className="demo-note">No {stride?.toLowerCase()} threats modelled for this component.</p> : (
              <ul className="sm-threats">
                {threats.map((t) => (
                  <li key={t.threat}>
                    <span className="pill bad">{t.stride}</span>
                    <p><b>Threat:</b> {t.threat}</p>
                    <p><b>Mitigation:</b> {t.mitigation}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── MFA ──────────────────────────────────────────────────────────────
type Audit = { t: string; kind: 'ok' | 'err' | 'info'; text: string };
const USER = 'clinician', PASS = 'demo-passphrase';
const sid = () => `sid_${Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join('')}`;

function MfaLab() {
  const [secret, setSecret] = useState<string | null>(null);
  const [drift, setDrift] = useState(0); // seconds the visitor's "phone" clock is off
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState('------');
  const [stage, setStage] = useState<'password' | 'code' | 'in'>('password');
  const [user, setUser] = useState(USER);
  const [pass, setPass] = useState('');
  const [entry, setEntry] = useState('');
  const [audit, setAudit] = useState<Audit[]>([]);
  const [session, setSession] = useState(sid);
  const [prevSession, setPrevSession] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const failsRef = useRef(0);
  const lastStep = useRef(-1);
  const lastCode = useRef<string | null>(null);

  const log = useCallback((kind: Audit['kind'], text: string) => {
    setAudit((a) => [{ t: new Date().toISOString().slice(11, 19), kind, text }, ...a].slice(0, 40));
  }, []);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);
  useEffect(() => { if (secret) totp(secret, now + drift * 1000).then(setCode); }, [secret, now, drift]);

  const enrol = () => {
    const s = randomSecret();
    setSecret(s); lastStep.current = -1; lastCode.current = null;
    log('info', `enrolment: new 160-bit TOTP secret issued to ${USER} (shown once)`);
  };

  const submitPassword = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!secret) { log('err', 'login refused: MFA is mandatory and no authenticator is enrolled'); return; }
    if (user !== USER || pass !== PASS) { log('err', `password rejected for "${user.slice(0, 24)}" (generic error shown to user)`); return; }
    setStage('code'); log('info', 'password ok → mfa_required (no session yet)');
  };

  const verify = async (c: string, label?: string) => {
    if (!secret) return;
    const t = Date.now();
    if (t < lockedUntil) { log('err', `locked: ${Math.ceil((lockedUntil - t) / 1000)} s remaining${label ? ` (${label})` : ''}`); return; }
    const offset = await verifyTotp(secret, c, t, 1);
    const step = offset === null ? -1 : Math.floor(t / 30000) + offset;
    if (offset !== null && step <= lastStep.current) {
      log('err', `replay rejected: code for step ${step} was already used${label ? ` (${label})` : ''}`);
      return fail();
    }
    if (offset === null) { log('err', `code ${c.replace(/\d/g, '•')} invalid${label ? ` (${label})` : ''}`); return fail(); }
    lastStep.current = step; lastCode.current = c; failsRef.current = 0; setFails(0);
    const next = sid();
    setPrevSession(session); setSession(next); setStage('in'); setEntry('');
    log('ok', `totp ok (window offset ${offset > 0 ? '+' : ''}${offset}) → session rotated ${session} → ${next}`);
  };

  const fail = () => {
    failsRef.current += 1;
    if (failsRef.current >= 5) { failsRef.current = 0; setLockedUntil(Date.now() + 60_000); log('err', '5 consecutive failures → account locked for 60 s'); }
    setFails(failsRef.current);
  };

  const logout = () => { setStage('password'); setPass(''); setPrevSession(null); setSession(sid()); log('info', 'logout: session destroyed'); };
  const remaining = 30 - Math.floor(((now + drift * 1000) / 1000) % 30);
  const locked = now < lockedUntil;

  return (
    <div className="sm-mfa" style={{ paddingTop: 14 }}>
      <section className="demo-card">
        <header><span><b>1 · Authenticator</b> · your device</span><span>RFC 6238</span></header>
        <div className="body sm-auth">
          {!secret ? (
            <>
              <p className="demo-note">Enrol a virtual authenticator. The secret is generated with <code>crypto.getRandomValues</code> and never leaves this tab.</p>
              <button type="button" className="btn btn-sm btn-run" onClick={enrol}>Enrol authenticator</button>
            </>
          ) : (
            <>
              <div className="sm-code" aria-live="off">
                <svg viewBox="0 0 36 36" className="sm-ring" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.5" className="bg" />
                  <circle cx="18" cy="18" r="15.5" className="fg" style={{ strokeDasharray: `${(remaining / 30) * 97.4} 97.4` }} />
                </svg>
                <div>
                  <p className="sm-digits" aria-label={`Current code ${code.split('').join(' ')}`}>{code.slice(0, 3)} {code.slice(3)}</p>
                  <p className="demo-note">{remaining}s left · step {Math.floor((now + drift * 1000) / 30000)}</p>
                </div>
              </div>
              <label className="demo-lab sm-drift">Phone clock drift: <b>{drift > 0 ? '+' : ''}{drift}s</b>
                <input type="range" min={-120} max={120} step={10} value={drift} onChange={(e) => setDrift(Number(e.target.value))} />
              </label>
              <p className="demo-note">The server accepts the current step ±1 (±30 s). Push the drift past ±45 s and codes start failing.</p>
              <details className="sm-secret">
                <summary className="demo-lab">Show secret / otpauth URI</summary>
                <p className="mono">{secret.match(/.{1,4}/g)!.join(' ')}</p>
                <p className="mono demo-note" style={{ wordBreak: 'break-all' }}>{otpauthUri(secret)}</p>
                <p className="demo-note">You can type this secret into a real authenticator app; its codes will match.</p>
              </details>
              <button type="button" className="btn btn-sm" onClick={enrol}>Re-enrol (rotate secret)</button>
            </>
          )}
        </div>
      </section>

      <section className="demo-card">
        <header><span><b>2 · Login</b> · records portal</span><span className={stage === 'in' ? 'ok' : ''}>{stage === 'in' ? 'authenticated' : stage === 'code' ? 'mfa required' : 'anonymous'}</span></header>
        <div className="body sm-login">
          {stage === 'password' && (
            <form onSubmit={submitPassword} className="sm-form">
              <label><span className="demo-lab">Username</span><input className="field" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" /></label>
              <label><span className="demo-lab">Password</span><input className="field" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" placeholder={PASS} /></label>
              <button className="btn btn-sm btn-run" type="submit">Sign in</button>
              <p className="demo-note">Demo credentials: <b>{USER}</b> / <b>{PASS}</b>. {!secret && 'Enrol an authenticator first: MFA is mandatory.'}</p>
            </form>
          )}
          {stage === 'code' && (
            <form onSubmit={(e) => { e.preventDefault(); verify(entry); }} className="sm-form">
              <label><span className="demo-lab">6-digit code</span>
                <input className="field mono" inputMode="numeric" pattern="\d{6}" maxLength={6} value={entry} onChange={(e) => setEntry(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" disabled={locked} />
              </label>
              <div className="demo-ctrls">
                <button className="btn btn-sm btn-run" type="submit" disabled={locked || entry.length !== 6}>Verify</button>
                <button className="btn btn-sm" type="button" onClick={() => setEntry(code)} disabled={!secret || locked}>Copy from authenticator</button>
              </div>
              <p className="demo-note">{locked ? `Locked for ${Math.ceil((lockedUntil - now) / 1000)} s.` : `${5 - fails} attempts before lockout.`}</p>
            </form>
          )}
          {stage === 'in' && (
            <div className="sm-form">
              <p><span className="ok">●</span> Signed in as <b>{USER}</b>.</p>
              <p className="demo-note">Session id rotated on authentication: <span className="mono">{prevSession}</span> → <span className="mono ok">{session}</span>. A fixated pre-login id is now worthless.</p>
              <button type="button" className="btn btn-sm" onClick={logout}>Sign out</button>
            </div>
          )}
          <div className="sm-attacks">
            <p className="demo-lab">Attack the login</p>
            <div className="demo-ctrls">
              <button type="button" className="btn btn-sm" disabled={!lastCode.current} onClick={() => { setStage('code'); verify(lastCode.current!, 'replayed captured code'); }}>Replay last code</button>
              <button type="button" className="btn btn-sm" disabled={!secret} onClick={() => { setStage((s) => (s === 'in' ? 'code' : s === 'password' ? 'code' : s)); verify(String(Math.floor(Math.random() * 1e6)).padStart(6, '0'), 'guessed code'); }}>Guess a code</button>
              <button type="button" className="btn btn-sm" disabled={!secret} onClick={async () => { setStage((s) => (s === 'password' ? 'code' : s)); verify(await totp(secret!, Date.now() - 120_000), 'stale code from 2 min ago'); }}>Use a stale code</button>
            </div>
          </div>
        </div>
      </section>

      <section className="demo-card sm-audit">
        <header><span><b>3 · Audit log</b> · append-only</span><span>{audit.length} events</span></header>
        <div className="body">
          <ol className="demo-log" aria-live="polite">
            {audit.length === 0 && <li><span className="t">—</span><span>Every authentication decision lands here (actor, outcome, reason).</span></li>}
            {audit.map((a, i) => <li key={audit.length - i} className={`k-${a.kind}`}><span className="t">{a.t.slice(3)}</span><span>{a.text}</span></li>)}
          </ol>
        </div>
      </section>
    </div>
  );
}

// ── CI/CD gates ──────────────────────────────────────────────────────
function Pipeline() {
  const [inj, setInj] = useState<Injection[]>(['hardcoded-secret']);
  const [shown, setShown] = useState<GateResult[] | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => runPipeline(inj), [inj]);

  const run = async () => {
    setBusy(true); setShown(result.results); setCursor(-1);
    const delay = reducedMotion() ? 0 : 420;
    for (let i = 0; i < result.results.length; i++) {
      setCursor(i);
      if (delay) await new Promise((r) => setTimeout(r, delay));
    }
    setCursor(result.results.length); setBusy(false);
  };

  return (
    <div className="demo-grid" style={{ paddingTop: 14 }}>
      <section className="demo-card">
        <header><span><b>Commit contents</b> · choose what this change sneaks in</span><span>{inj.length} issue{inj.length === 1 ? '' : 's'}</span></header>
        <div className="body sm-inj">
          {INJECTIONS.map((i) => (
            <label key={i.id} className="sm-check">
              <input type="checkbox" checked={inj.includes(i.id)} onChange={(e) => { setShown(null); setInj((x) => (e.target.checked ? [...x, i.id] : x.filter((y) => y !== i.id))); }} />
              <span>{i.label}</span>
            </label>
          ))}
          <button type="button" className="btn btn-sm btn-run" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Push & run pipeline'}</button>
        </div>
      </section>
      <section className="demo-card" aria-live="polite">
        <header><span><b>Pipeline</b> · the first failing gate blocks everything after it</span>
          <span>{shown && cursor >= shown.length ? (result.shipped ? <span className="ok">shipped</span> : <span className="bad">blocked at {GATES.find((g) => g.id === result.blockedAt)!.label}</span>) : 'idle'}</span></header>
        <div className="body">
          <ol className="sm-gates">
            {GATES.map((g, i) => {
              const r = shown && i <= cursor ? shown[i] : null;
              return (
                <li key={g.id} className={`sm-gate ${r ? r.status : 'idle'}${i === cursor && busy ? ' running' : ''}`}>
                  <span className="gi" aria-hidden="true">{!r ? '○' : r.status === 'pass' ? '✓' : r.status === 'fail' ? '✕' : '–'}</span>
                  <span className="gl"><b>{g.label}</b><span className="demo-note">{g.tool}</span></span>
                  <span className="gs">{!r ? '' : r.status === 'fail' ? `caught: ${r.found.map((f) => INJECTIONS.find((x) => x.id === f)!.label.toLowerCase()).join(', ')}` : r.status}</span>
                </li>
              );
            })}
          </ol>
          {shown && cursor >= shown.length && !result.shipped && <p className="demo-note" style={{ marginTop: 10 }}>Deploy never ran. Fix the finding and push again; nothing reaches production behind a red gate.</p>}
          {shown && cursor >= shown.length && result.shipped && inj.length === 0 && <p className="demo-note" style={{ marginTop: 10 }}>Clean change: every gate passed and the release went out.</p>}
        </div>
      </section>
    </div>
  );
}
