// SecureMed showcase: a real RFC 6238 TOTP (Web Crypto, local) and the illustrative release-gate
// pipeline from src/lib/sim/securemed.ts. A portfolio simulation, not the course application.
import { useEffect, useRef, useState } from 'react';
import { randomSecret, totp, verifyTotp } from '../../lib/sim/totp';
import { GATES, runPipeline } from '../../lib/sim/securemed';

type Check = { ok: boolean; text: string } | null;

export default function SecureViz({ onInteract }: { onInteract?: () => void }) {
  const secret = useRef<string>('');
  const [code, setCode] = useState<string | null>(null);
  const [left, setLeft] = useState(30);
  const [check, setCheck] = useState<Check>(null);
  const [leak, setLeak] = useState(false);
  const pipe = runPipeline(leak ? ['hardcoded-secret'] : []);

  useEffect(() => {
    secret.current = randomSecret();
    let alive = true;
    const update = async () => {
      const now = Date.now();
      const c = await totp(secret.current, now);
      if (!alive) return;
      setCode(c);
      setLeft(30 - (Math.floor(now / 1000) % 30));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const verify = async (stale: boolean) => {
    onInteract?.();
    if (!secret.current) return;
    const attempt = stale ? await totp(secret.current, Date.now() - 120_000) : code ?? '';
    const w = await verifyTotp(secret.current, attempt);
    setCheck(w !== null
      ? { ok: true, text: `Code ${attempt} accepted. Session issued with a fresh ID.` }
      : { ok: false, text: `Code ${attempt} rejected: it expired two minutes ago (window ±30 s).` });
  };

  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="viz viz-sec">
      <div className="viz-sec-mfa">
        <svg viewBox="0 0 64 64" className="viz-ring" aria-hidden="true">
          <circle cx="32" cy="32" r={R} className="viz-ring-bg" />
          <circle cx="32" cy="32" r={R} className="viz-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - left / 30)} transform="rotate(-90 32 32)" />
        </svg>
        <div className="viz-otp">
          <span className="viz-k">One-time code · rotates in {left}s</span>
          <span className="viz-code" aria-live="off">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : '··· ···'}</span>
        </div>
      </div>
      <div className="viz-flow" aria-label="Login flow">
        <span className="ok">Password</span><i aria-hidden="true" /><span className={check ? (check.ok ? 'ok' : 'bad') : ''}>TOTP</span><i aria-hidden="true" /><span className={check?.ok ? 'ok' : ''}>Session</span>
      </div>
      <div className="viz-controls">
        <button type="button" onClick={() => verify(false)}>Verify current code</button>
        <button type="button" onClick={() => verify(true)}>Replay an old code</button>
      </div>
      <p className="viz-note" aria-live="polite">{check ? check.text : 'A real RFC 6238 generator and verifier, running only in your browser with a throwaway secret.'}</p>

      <div className="viz-gates" role="list" aria-label="Release pipeline gates">
        {pipe.results.map((r) => (
          <span key={r.gate.id} role="listitem" className={`g-${r.status}`} title={r.gate.tool}>{r.gate.label}</span>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" aria-pressed={leak} onClick={() => { setLeak((x) => !x); onInteract?.(); }}>{leak ? 'Remove the committed key' : 'Commit an API key'}</button>
      </div>
      <p className="viz-note" aria-live="polite">{leak ? `Blocked at “${GATES.find((g) => g.id === pipe.blockedAt)?.label}”. Every later stage is skipped, so nothing ships.` : 'All gates pass, so the release ships.'}</p>
      <p className="viz-cap">Portfolio simulation, not the course application · illustrative pipeline · no patient data</p>
    </div>
  );
}
