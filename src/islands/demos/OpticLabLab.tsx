// OpticLab secure-controller lab: verified boot with real Web Crypto signatures, the kernel driver's
// lifecycle and test hook, the controller's strict line protocol, and the mutual-TLS decision path.
// Fictional hardware, synthetic images; the engine is src/lib/sim/opticlab.ts (unit-tested).
import { useEffect, useRef, useState } from 'react';
import {
  ATTACKS, BLOCKS, CERTS, VARIANTS, boot, buildFit, controllerStatus, handle, hex, makeKeyPair, makeRootfs, newDriver, probe,
  sha256, simulateSlot, sysfs, tlsDecision, unbind, verityTree, type Attack, type Board, type BootResult, type ClientCert, type Driver,
} from '../../lib/sim/opticlab';
import './demos.css';

type Tab = 'boot' | 'driver' | 'api' | 'tls';
const TABS: { id: Tab; label: string }[] = [
  { id: 'boot', label: 'Verified boot' },
  { id: 'driver', label: 'Driver & slots' },
  { id: 'api', label: 'Controller API' },
  { id: 'tls', label: 'mTLS access' },
];

export default function OpticLabLab() {
  const [tab, setTab] = useState<Tab>('boot');
  const [board, setBoard] = useState<Board>('olc4');
  const [driver, setDriver] = useState<Driver>(() => probe(newDriver('olc4'), { dtNode: true, gpioReady: true }));
  useEffect(() => setDriver(probe(newDriver(board), { dtNode: true, gpioReady: true })), [board]);
  return (
    <div className="demo d-security ol">
      <div className="demo-tabs" role="tablist" aria-label="OpticLab laboratory">
        {TABS.map((t) => (
          <button key={t.id} id={`ol-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`ol-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const i = TABS.findIndex((x) => x.id === tab);
              const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
              setTab(n.id); document.getElementById(`ol-tab-${n.id}`)?.focus();
            }}>{t.label}</button>
        ))}
      </div>
      <div className="demo-ctrls ol-board" role="group" aria-label="Board profile">
        <span className="mono muted">Board profile</span>
        {(Object.keys(VARIANTS) as Board[]).map((b) => (
          <button key={b} type="button" className="btn btn-sm" aria-pressed={board === b} onClick={() => setBoard(b)}>{VARIANTS[b].model} · {VARIANTS[b].slots} slots</button>
        ))}
      </div>
      <div id={`ol-panel-${tab}`} role="tabpanel" aria-labelledby={`ol-tab-${tab}`}>
        {tab === 'boot' && <BootChain board={board} />}
        {tab === 'driver' && <DriverPanel driver={driver} setDriver={setDriver} />}
        {tab === 'api' && <ApiConsole driver={driver} />}
        {tab === 'tls' && <TlsPanel />}
      </div>
    </div>
  );
}

// ── verified boot ───────────────────────────────────────────────────
function BootChain({ board }: { board: Board }) {
  const [attack, setAttack] = useState<Attack>('none');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BootResult | null>(null);
  const [keyInfo, setKeyInfo] = useState<string | null>(null);
  const ctx = useRef<{ keys: { trusted: CryptoKeyPair; attacker: CryptoKeyPair }; rootfs: Uint8Array[] } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      if (!ctx.current) {
        const keys = { trusted: await makeKeyPair(), attacker: await makeKeyPair() };
        const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keys.trusted.publicKey));
        setKeyInfo(hex(await sha256(spki), 8));
        ctx.current = { keys, rootfs: makeRootfs() };
      }
      const { keys, rootfs } = ctx.current;
      const fit = await buildFit(board, (await verityTree(rootfs)).root, keys.trusted.privateKey);
      setResult(await boot(fit, rootfs, attack, keys));
    } finally { setBusy(false); }
  };
  const a = ATTACKS.find((x) => x.id === attack)!;
  return (
    <div className="demo-grid ol-boot">
      <section className="demo-card">
        <header><span><b>Build, tamper, boot</b></span><span className="mono">{a.test}</span></header>
        <fieldset className="ol-attacks">
          <legend className="sr-only">Image to boot</legend>
          {ATTACKS.map((x) => (
            <label key={x.id} className={attack === x.id ? 'on' : ''}>
              <input type="radio" name="ol-attack" value={x.id} checked={attack === x.id} onChange={() => { setAttack(x.id); setResult(null); }} />
              <span><b>{x.label}</b><small>{x.how}</small></span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={busy}>{busy ? 'Signing and booting…' : `Boot ${VARIANTS[board].model}`}</button>
        <p className="demo-note">
          {keyInfo ? <>Trusted key generated in your browser: RSA-2048, fingerprint <code>{keyInfo}…</code>. A second key plays the attacker.</> : 'The first boot generates two RSA-2048 key pairs in your browser (one trusted, one attacker). Nothing leaves the page.'}
        </p>
      </section>
      <section className="demo-card" aria-live="polite">
        <header><span><b>Chain of trust</b></span><span>{result ? (result.booted ? 'booted' : 'refused') : 'not run'}</span></header>
        <ol className="ol-stages">
          {(result?.stages ?? [
            { id: 'uboot-sig', label: 'U-Boot · configuration signature', status: 'skipped', detail: '' },
            { id: 'uboot-hash', label: 'U-Boot · image hashes', status: 'skipped', detail: '' },
            { id: 'linux', label: 'Linux · signed device tree and boot arguments', status: 'skipped', detail: '' },
            { id: 'verity', label: `dm-verity · root filesystem (${BLOCKS} blocks)`, status: 'skipped', detail: '' },
            { id: 'driver', label: 'opticlab-ctrl driver · probe', status: 'skipped', detail: '' },
            { id: 'controllerd', label: 'controllerd · local socket and mTLS', status: 'skipped', detail: '' },
          ]).map((s) => (
            <li key={s.id} className={`ol-stage s-${result ? s.status : 'idle'}`}>
              <span className="ol-mark" aria-hidden="true">{!result ? '·' : s.status === 'ok' ? '✓' : s.status === 'fail' ? '✕' : '–'}</span>
              <span><b>{s.label}</b>{result && <small>{s.status === 'skipped' ? 'never reached' : s.detail}</small>}</span>
              {result && <span className="sr-only">{s.status}</span>}
            </li>
          ))}
        </ol>
        {result && <p className={`ol-verdict ${result.booted ? 'ok' : 'bad'}`}>{result.verdict}</p>}
      </section>
      {result && (
        <section className="demo-card ol-wide">
          <header><span><b>Serial console</b> · condensed</span><span className="mono">ttyAMA0</span></header>
          <pre className="demo-log ol-console">{result.console.join('\n')}</pre>
        </section>
      )}
    </div>
  );
}

// ── driver ──────────────────────────────────────────────────────────
function DriverPanel({ driver, setDriver }: { driver: Driver; setDriver: (d: Driver) => void }) {
  const [dtNode, setDtNode] = useState(true);
  const [gpioReady, setGpioReady] = useState(true);
  const [cmd, setCmd] = useState('3 fault');
  const [last, setLast] = useState<{ text: string; ok: boolean } | null>(null);
  const attrs = sysfs(driver);
  return (
    <div className="demo-grid ol-drv">
      <section className="demo-card">
        <header><span><b>Bind the platform driver</b></span><span className="mono">DRV-00 · DRV-06</span></header>
        <label className="ol-check"><input type="checkbox" checked={dtNode} onChange={(e) => setDtNode(e.target.checked)} /> Device-tree node <code>{VARIANTS[driver.board].compatible}</code></label>
        <label className="ol-check"><input type="checkbox" checked={gpioReady} onChange={(e) => setGpioReady(e.target.checked)} /> GPIO controller (PL061) ready</label>
        <div className="demo-ctrls">
          <button type="button" className="btn btn-sm btn-primary" disabled={driver.bound} onClick={() => setDriver(probe(newDriver(driver.board), { dtNode, gpioReady }))}>Load and probe</button>
          <button type="button" className="btn btn-sm" disabled={!driver.bound} onClick={() => setDriver(unbind(driver))}>Unbind</button>
        </div>
        <ol className="demo-log ol-klog" aria-label="Kernel log">{driver.log.slice(-5).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </section>
      <section className="demo-card" aria-live="polite">
        <header><span><b>Chassis</b> · {VARIANTS[driver.board].model}</span><span className={`pill ${attrs ? (controllerStatus(driver) === 'ok' ? 'ok' : 'warn') : ''}`}>{attrs ? controllerStatus(driver) : 'unbound'}</span></header>
        <ul className="ol-slots" aria-label="Slots (simulated presence)">
          {driver.slots.map((s, i) => <li key={i} className={`ol-slot s-${attrs ? s : 'off'}`}><span className="mono">{i + 1}</span><small>{attrs ? s : '—'}</small></li>)}
        </ul>
        <form className="ol-form" onSubmit={(e) => { e.preventDefault(); const r = simulateSlot(driver, cmd); setDriver(r.driver); setLast({ text: r.result, ok: r.ok }); }}>
          <label htmlFor="ol-sim">echo … &gt; simulate_slot</label>
          <input id="ol-sim" value={cmd} onChange={(e) => setCmd(e.target.value)} spellCheck={false} autoComplete="off" maxLength={40} />
          <button type="submit" className="btn btn-sm">Write</button>
        </form>
        <div className="demo-ctrls">
          {['3 fault', '3 present', '0 fault', `${driver.slots.length + 1} fault`, '2 broken'].map((c) => <button key={c} type="button" className="btn btn-sm btn-quiet" onClick={() => setCmd(c)}>{c}</button>)}
        </div>
        {last && <p className={`ol-res ${last.ok ? 'ok' : 'bad'}`} role="status">{last.text}</p>}
      </section>
      <section className="demo-card ol-wide">
        <header><span><b>sysfs</b> · /sys/bus/platform/drivers/opticlab-ctrl/chassis-controller/</span></header>
        {attrs ? (
          <dl className="ol-sysfs">{Object.entries(attrs).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        ) : <p className="demo-empty">No attributes: the driver is not bound.</p>}
      </section>
    </div>
  );
}

// ── controller protocol ─────────────────────────────────────────────
function ApiConsole({ driver }: { driver: Driver }) {
  const [line, setLine] = useState('GET info');
  const [hist, setHist] = useState<{ q: string; a: string }[]>([]);
  const send = (q: string) => setHist((h) => [...h.slice(-7), { q, a: handle(q, driver) }]);
  return (
    <div className="demo-grid ol-api">
      <section className="demo-card ol-wide">
        <header><span><b>controllerd</b> · Unix socket, one request per line, JSON replies</span><span className="mono">APP-02 · APP-03 · APP-04</span></header>
        <div className="demo-ctrls">
          {['PING', 'GET info', 'GET health', 'GET slots', `GET slot ${driver.slots.length}`, `GET slot ${driver.slots.length + 1}`, 'GET slot 1a', 'GET secrets', 'DELETE slot 1'].map((q) => (
            <button key={q} type="button" className="btn btn-sm btn-quiet" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
        <form className="ol-form" onSubmit={(e) => { e.preventDefault(); send(line); }}>
          <label htmlFor="ol-req">Request</label>
          <input id="ol-req" value={line} onChange={(e) => setLine(e.target.value)} spellCheck={false} autoComplete="off" maxLength={200} />
          <button type="submit" className="btn btn-sm btn-primary">Send</button>
        </form>
        <ol className="demo-log ol-rpc" aria-live="polite" aria-label="Requests and replies">
          {hist.length === 0 && <li className="muted">Send a request. Try a fault in “Driver &amp; slots” first, then ask for health.</li>}
          {hist.map((h, i) => <li key={i}><span className="q">&gt; {h.q.length > 60 ? `${h.q.slice(0, 60)}…` : h.q}</span><span className={JSON.parse(h.a).ok ? 'a ok' : 'a bad'}>{h.a}</span></li>)}
        </ol>
        <p className="demo-note">The parser is strict: 128 characters at most, printable ASCII only, a fixed set of commands, slot ids of one to three digits (range checked against the board afterwards). The original parser ran 32 million fuzz executions without a crash.</p>
      </section>
    </div>
  );
}

// ── mutual TLS ──────────────────────────────────────────────────────
function TlsPanel() {
  const [cert, setCert] = useState<ClientCert>('operator');
  const d = tlsDecision(cert);
  return (
    <div className="demo-grid ol-tls">
      <section className="demo-card">
        <header><span><b>Connect to tcp:8443</b></span><span className="mono">{CERTS.find((c) => c.id === cert)!.test}</span></header>
        <fieldset className="ol-attacks">
          <legend className="sr-only">Client certificate</legend>
          {CERTS.map((c) => (
            <label key={c.id} className={cert === c.id ? 'on' : ''}>
              <input type="radio" name="ol-cert" value={c.id} checked={cert === c.id} onChange={() => setCert(c.id)} />
              <span><b>{c.label}</b></span>
            </label>
          ))}
        </fieldset>
      </section>
      <section className="demo-card" aria-live="polite">
        <header><span><b>Decision path</b></span><span className={`pill ${d.accepted ? 'ok' : 'warn'}`}>{d.accepted ? 'accepted' : 'refused'}</span></header>
        <ol className="ol-stages">
          {d.checks.map((c) => (
            <li key={c.step} className={`ol-stage s-${c.ok === null ? 'skipped' : c.ok ? 'ok' : 'fail'}`}>
              <span className="ol-mark" aria-hidden="true">{c.ok === null ? '–' : c.ok ? '✓' : '✕'}</span>
              <span><b>{c.step}</b><small>{c.detail}</small></span>
            </li>
          ))}
        </ol>
        <p className={`ol-verdict ${d.accepted ? 'ok' : 'bad'}`}>{d.outcome}</p>
        <p className="demo-note">Simulated decision path. In the original suite each refusal is asserted by its exact reason, because an earlier test that accepted any refusal hid a bug.</p>
      </section>
    </div>
  );
}
