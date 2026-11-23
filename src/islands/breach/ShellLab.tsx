// Command sandbox: a fictional Linux server with three misconfigurations to find and fix.
// Every command is interpreted by src/lib/sim/breach.ts; nothing executes on the visitor's machine.
import { useEffect, useRef, useState } from 'react';
import { newShell, run, type Shell } from '../../lib/sim/breach';

const HINTS = ['ls -l /opt/backup', 'cat /opt/backup/db-backup.sql', 'find / -perm -4000', 'cat /etc/ssh/sshd_config', 'audit'];

export default function ShellLab() {
  const [sh, setSh] = useState<Shell>(() => newShell());
  const [line, setLine] = useState('');
  const [out, setOut] = useState<{ cmd?: string; text: string }[]>([{ text: 'breachlab login: intern (fictional machine, simulated shell)' }, { text: 'Type help. Goal: find three misconfigurations, fix them, run audit.' }]);
  const [idx, setIdx] = useState<number | null>(null);
  const log = useRef<HTMLOListElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [out]);
  const exec = (cmd: string) => {
    const r = run(sh, cmd);
    setSh(r.shell); setIdx(null); setLine('');
    setOut((o) => (r.clear ? [] : [...o, { cmd: `${r.shell.cwd === '/srv/intern' ? '~' : r.shell.cwd} $ ${cmd}`, text: '' }, ...r.out.map((t) => ({ text: t }))]).slice(-200));
  };
  const done = Object.values(sh.fixed).filter(Boolean).length;
  return (
    <div className="br-mod">
      <div className="br-mod-head">
        <p>A fictional server. Commands are simulated in your browser: nothing runs on your machine.</p>
        <span className="pill">{done} / 3 fixed</span>
      </div>
      <div className="br-term">
        <ol ref={log} className="br-term-log" aria-live="polite" aria-label="Terminal output">
          {out.map((o, i) => <li key={i} className={o.cmd ? 'cmd' : ''}>{o.cmd ?? o.text}</li>)}
        </ol>
        <form onSubmit={(e) => { e.preventDefault(); if (line.trim()) exec(line); }} className="br-term-in">
          <label htmlFor="br-cmd" className="mono">intern@breachlab:{sh.cwd === '/srv/intern' ? '~' : sh.cwd}$</label>
          <input id="br-cmd" value={line} autoComplete="off" spellCheck={false} maxLength={120}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
              e.preventDefault();
              const h = sh.history; if (!h.length) return;
              const n = idx === null ? (e.key === 'ArrowUp' ? h.length - 1 : null) : Math.min(h.length - 1, Math.max(0, idx + (e.key === 'ArrowUp' ? -1 : 1)));
              setIdx(n); setLine(n === null ? '' : h[n]);
            }} />
        </form>
      </div>
      <div className="demo-ctrls" aria-label="Suggested commands">
        {HINTS.map((h) => <button key={h} type="button" className="btn btn-sm btn-quiet mono" onClick={() => exec(h)}>{h}</button>)}
      </div>
      <p className="demo-note">Fixes: <code>chmod 600 /opt/backup/db-backup.sql</code>, <code>chmod u-s /usr/local/bin/report-tool</code>, <code>sshd-harden</code>. The “password” in the dump is fake, and the IP in the log is from a documentation range.</p>
    </div>
  );
}
