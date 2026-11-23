// Attack & defend: two deliberately vulnerable toys. SQL injection runs against a tiny simulated SQL
// engine; XSS renders into this real page, where the site's CSP is the second line of defence.
// Flow for each: identify the weakness → run the exploit → apply the fix → validate with a test set.
import { useState } from 'react';
import { login, escapeHtml, XSS_PAYLOADS, type LoginResult } from '../../lib/sim/breach';

export default function AttackDefend() {
  return (
    <div className="br-mod br-ad">
      <SqlLogin />
      <XssSearch />
    </div>
  );
}

const SQL_TESTS = ["' OR '1'='1' --", "ada' --", "' OR 1=1 --", "x' OR username = 'ada"];

function SqlLogin() {
  const [mode, setMode] = useState<'concat' | 'param'>('concat');
  const [u, setU] = useState("' OR '1'='1' --");
  const [p, setP] = useState('anything');
  const [res, setRes] = useState<LoginResult | null>(null);
  const [suite, setSuite] = useState<{ payload: string; bypass: boolean }[] | null>(null);
  return (
    <section className="demo-card">
      <header><span><b>1 · Login form</b> · simulated SQL engine</span><span className={`pill ${mode === 'param' ? 'ok' : 'bad'}`}>{mode === 'param' ? 'parameterised' : 'string concatenation'}</span></header>
      <div className="body">
        <p className="br-step"><b>Identify.</b> The server builds its query by pasting input into SQL:</p>
        <pre className="br-code">{mode === 'concat' ? "query = \"SELECT * FROM users WHERE username = '\" + user + \"' AND password = '\" + pass + \"'\"" : 'db.query("SELECT * FROM users WHERE username = ? AND password = ?", [user, pass])'}</pre>
        <form className="br-form" onSubmit={(e) => { e.preventDefault(); setRes(login(u, p, mode)); }}>
          <label>Username<input value={u} onChange={(e) => setU(e.target.value)} spellCheck={false} autoComplete="off" maxLength={80} /></label>
          <label>Password<input value={p} onChange={(e) => setP(e.target.value)} spellCheck={false} autoComplete="off" maxLength={80} /></label>
          <button type="submit" className="btn btn-sm btn-primary">{mode === 'concat' ? 'Exploit: log in' : 'Log in'}</button>
        </form>
        {res && (
          <div className={`br-result ${res.loggedInAs ? 'bad' : 'ok'}`} aria-live="polite">
            <code>{res.query}</code>
            {res.bound && <small>bound values: {JSON.stringify(res.bound)}</small>}
            <b>{res.error ? `Query error: ${res.error}` : res.loggedInAs ? `Logged in as ${res.loggedInAs} without a password` : 'Login refused'}</b>
          </div>
        )}
        <div className="demo-ctrls">
          <button type="button" className="btn btn-sm" aria-pressed={mode === 'param'} onClick={() => { setMode(mode === 'concat' ? 'param' : 'concat'); setRes(null); setSuite(null); }}>{mode === 'concat' ? 'Defend: use parameters' : 'Undo the fix'}</button>
          <button type="button" className="btn btn-sm" onClick={() => setSuite(SQL_TESTS.map((t) => ({ payload: t, bypass: Boolean(login(t, 'x', mode).loggedInAs) })))}>Validate: run {SQL_TESTS.length} attack tests</button>
        </div>
        {suite && <ul className="br-probes">{suite.map((t) => <li key={t.payload} className={t.bypass ? 'bad' : 'ok'}><b>{t.bypass ? 'Bypassed' : 'Refused'}</b><span className="mono">{t.payload}</span></li>)}</ul>}
      </div>
    </section>
  );
}

function XssSearch() {
  const [fixed, setFixed] = useState(false);
  const [q, setQ] = useState(XSS_PAYLOADS[0]);
  const [out, setOut] = useState<{ html: string; injected: number; blocked: string[]; ran: boolean } | null>(null);
  const [suite, setSuite] = useState<{ payload: string; injected: number }[] | null>(null);

  /** Renders like the vulnerable page would, into a detached-but-live node, and counts what got injected. */
  const render = async (input: string) => {
    const blocked: string[] = [];
    const w = window as Window & { __pwned?: number };
    delete w.__pwned;
    const onV = (e: SecurityPolicyViolationEvent) => blocked.push(e.effectiveDirective);
    document.addEventListener('securitypolicyviolation', onV);
    const host = document.createElement('div'); host.hidden = true; document.body.appendChild(host);
    const html = `<p>No notes match ${fixed ? escapeHtml(input) : input}</p>`;
    host.innerHTML = html;
    const injected = host.querySelectorAll('img,svg,script,a[href^="javascript:"],[onerror],[onload],[onmouseover]').length;
    await new Promise((r) => setTimeout(r, 120));
    host.remove(); document.removeEventListener('securitypolicyviolation', onV);
    return { html, injected, blocked, ran: w.__pwned === 1 };
  };
  return (
    <section className="demo-card">
      <header><span><b>2 · Search page</b> · real DOM, real CSP</span><span className={`pill ${fixed ? 'ok' : 'bad'}`}>{fixed ? 'output escaped' : 'raw innerHTML'}</span></header>
      <div className="body">
        <p className="br-step"><b>Identify.</b> The page echoes the search term into HTML:</p>
        <pre className="br-code">{fixed ? 'results.textContent = `No notes match ${q}`   // or escape before building HTML' : 'results.innerHTML = `<p>No notes match ${q}</p>`'}</pre>
        <form className="br-form" onSubmit={async (e) => { e.preventDefault(); setOut(await render(q)); }}>
          <label className="br-grow">Search<input value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} autoComplete="off" maxLength={160} /></label>
          <button type="submit" className="btn btn-sm btn-primary">{fixed ? 'Search' : 'Exploit: search'}</button>
        </form>
        {out && (
          <div className={`br-result ${out.injected ? 'bad' : 'ok'}`} aria-live="polite">
            <code>{out.html}</code>
            <b>{out.injected ? `${out.injected} attacker element${out.injected > 1 ? 's' : ''} entered the page` : 'Rendered as text: nothing entered the page'}</b>
            {out.ran && <small>The payload ran (no CSP on this server): it set a harmless marker; a real one would act as you.</small>}
            {out.injected > 0 && !out.ran && <small>{out.blocked.length ? `…but this site’s CSP refused to run it (${[...new Set(out.blocked)].join(', ')}). Without a CSP, the payload would run with the page’s privileges.` : 'Some payloads need a click or hover to fire; the injected element is the vulnerability either way.'}</small>}
          </div>
        )}
        <div className="demo-ctrls">
          <button type="button" className="btn btn-sm" aria-pressed={fixed} onClick={() => { setFixed(!fixed); setOut(null); setSuite(null); }}>{fixed ? 'Undo the fix' : 'Defend: escape output'}</button>
          <button type="button" className="btn btn-sm" onClick={async () => { const r = []; for (const p of XSS_PAYLOADS) r.push({ payload: p, injected: (await render(p)).injected }); setSuite(r); }}>Validate: run {XSS_PAYLOADS.length} payloads</button>
        </div>
        {suite && <ul className="br-probes">{suite.map((t) => <li key={t.payload} className={t.injected ? 'bad' : 'ok'}><b>{t.injected ? 'Injected' : 'Neutralised'}</b><span className="mono">{t.payload}</span></li>)}</ul>}
        <p className="demo-note">Defence in depth: escaping fixes the bug; the CSP limits the damage if a bug slips through. The payloads only reach a hidden, temporary element of this page.</p>
      </div>
    </section>
  );
}
