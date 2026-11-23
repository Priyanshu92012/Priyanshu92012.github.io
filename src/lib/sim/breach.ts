// BREACH MODE engines (consent-based security lab). Pure and unit-tested. Everything here is either a
// faithful model of a browser/server rule (CORS), a deliberately vulnerable toy (the SQL login), or
// fiction (the shell). Nothing touches the visitor's machine or the network.

// ── CORS: the browser's decision for one cross-origin request ────────
export type CorsServer = { allowOrigin: string | null; allowMethods: string[]; allowHeaders: string[]; allowCredentials: boolean };
export type CorsRequest = { origin: string; method: string; headers: string[]; credentials: boolean };
export type CorsStep = { step: string; ok: boolean; detail: string };

const SIMPLE_METHODS = ['GET', 'HEAD', 'POST'];
const SIMPLE_HEADERS = ['accept', 'accept-language', 'content-language', 'content-type'];

/** Fetch-standard rules, simplified: preflight when needed, then origin/credentials checks. */
export function corsDecision(req: CorsRequest, srv: CorsServer): { allowed: boolean; preflight: boolean; steps: CorsStep[] } {
  const steps: CorsStep[] = [];
  const custom = req.headers.map((h) => h.toLowerCase()).filter((h) => !SIMPLE_HEADERS.includes(h));
  const preflight = !SIMPLE_METHODS.includes(req.method) || custom.length > 0;
  steps.push({ step: 'Simple request?', ok: true, detail: preflight ? `No: ${!SIMPLE_METHODS.includes(req.method) ? `method ${req.method}` : `header ${custom.join(', ')}`} needs an OPTIONS preflight first` : 'Yes: sent directly, the response is checked afterwards' });
  const originOk = srv.allowOrigin === '*' ? !req.credentials : srv.allowOrigin === req.origin;
  const originDetail = srv.allowOrigin === null ? 'no Access-Control-Allow-Origin header'
    : srv.allowOrigin === '*' && req.credentials ? 'wildcard “*” is not allowed when credentials are sent'
      : srv.allowOrigin === '*' ? 'wildcard “*” allows any origin (without credentials)'
        : srv.allowOrigin === req.origin ? `matches ${req.origin}` : `${srv.allowOrigin} ≠ ${req.origin}`;
  if (preflight) {
    const mOk = SIMPLE_METHODS.includes(req.method) || srv.allowMethods.includes(req.method);
    const hOk = custom.every((h) => srv.allowHeaders.map((x) => x.toLowerCase()).includes(h));
    steps.push({ step: 'Preflight: Allow-Origin', ok: originOk, detail: originDetail });
    if (!originOk) return { allowed: false, preflight, steps };
    steps.push({ step: 'Preflight: Allow-Methods', ok: mOk, detail: mOk ? `${req.method} allowed` : `${req.method} not in [${srv.allowMethods.join(', ') || '—'}]` });
    if (!mOk) return { allowed: false, preflight, steps };
    steps.push({ step: 'Preflight: Allow-Headers', ok: hOk, detail: hOk ? (custom.length ? `${custom.join(', ')} allowed` : 'no custom headers') : `${custom.join(', ')} not allowed` });
    if (!hOk) return { allowed: false, preflight, steps };
  }
  steps.push({ step: 'Response: Allow-Origin', ok: originOk, detail: originDetail });
  if (!originOk) return { allowed: false, preflight, steps };
  if (req.credentials) {
    steps.push({ step: 'Response: Allow-Credentials', ok: srv.allowCredentials, detail: srv.allowCredentials ? 'true: cookies may be used' : 'missing: the response is hidden from the page' });
    if (!srv.allowCredentials) return { allowed: false, preflight, steps };
  }
  return { allowed: true, preflight, steps };
}

// ── SQL injection: a deliberately vulnerable login and its fix ───────
export type User = { username: string; password: string; role: string };
export const USERS: User[] = [
  { username: 'ada', password: 'correct-horse-7', role: 'admin' },
  { username: 'linus', password: 'kernel-panic-2', role: 'operator' },
];

export const concatQuery = (u: string, p: string) => `SELECT * FROM users WHERE username = '${u}' AND password = '${p}'`;

/** A tiny WHERE evaluator: col = 'str' | 'a' = 'b', AND/OR (AND binds tighter), `--` comments. */
export function evalWhere(where: string, row: User): boolean {
  const src = where.replace(/--.*$/s, '').trim();
  const toks: string[] = [];
  const re = /\s*('(?:[^']*)'|\w+|=|\(|\))/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`syntax error near “${src.slice(i, i + 12)}”`);
    toks.push(m[1]); i = re.lastIndex;
    while (src[i] === ' ') i++;
  }
  let k = 0;
  const val = (t: string) => (t.startsWith("'") ? t.slice(1, -1) : t in row ? String(row[t as keyof User]) : (() => { throw new Error(`unknown column ${t}`); })());
  const cmp = (): boolean => {
    if (toks[k] === '(') { k++; const v = or(); if (toks[k++] !== ')') throw new Error('missing )'); return v; }
    const a = toks[k++]; if (toks[k++] !== '=') throw new Error('expected ='); const b = toks[k++];
    if (a === undefined || b === undefined) throw new Error('incomplete comparison');
    return val(a) === val(b);
  };
  const and = (): boolean => { let v = cmp(); while (toks[k]?.toUpperCase() === 'AND') { k++; const r = cmp(); v = v && r; } return v; };
  const or = (): boolean => { let v = and(); while (toks[k]?.toUpperCase() === 'OR') { k++; const r = and(); v = v || r; } return v; };
  const v = or();
  if (k !== toks.length) throw new Error(`unexpected “${toks[k]}”`);
  return v;
}

export type LoginResult = { query: string; bound?: [string, string]; rows: User[]; error?: string; loggedInAs?: string };

export function login(u: string, p: string, mode: 'concat' | 'param'): LoginResult {
  if (mode === 'param') {
    const rows = USERS.filter((r) => r.username === u && r.password === p);
    return { query: "SELECT * FROM users WHERE username = ? AND password = ?", bound: [u, p], rows, loggedInAs: rows[0]?.username };
  }
  const query = concatQuery(u, p);
  try {
    const where = query.slice(query.indexOf('WHERE') + 5);
    const rows = USERS.filter((r) => evalWhere(where, r));
    return { query, rows, loggedInAs: rows[0]?.username };
  } catch (e) { return { query, rows: [], error: (e as Error).message }; }
}

// ── XSS: payloads and the fix ────────────────────────────────────────
export const XSS_PAYLOADS = [
  '<img src="data:," onerror="window.__pwned = 1">',
  '<svg onload="window.__pwned = 1"></svg>',
  '<a href="javascript:window.__pwned = 1">click me</a>',
  '<script>window.__pwned = 1</script>',
  '"><b onmouseover="window.__pwned = 1">hover</b>',
];
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// ── fictional shell ──────────────────────────────────────────────────
type Node = { type: 'dir'; children: Record<string, Node>; mode: string; owner: string } | { type: 'file'; content: string; mode: string; owner: string };
const f = (content: string, mode = '-rw-r--r--', owner = 'root'): Node => ({ type: 'file', content, mode, owner });
const d = (children: Record<string, Node>, mode = 'drwxr-xr-x', owner = 'root'): Node => ({ type: 'dir', children, mode, owner });

export type Shell = { cwd: string; fs: Node; fixed: { backup: boolean; suid: boolean; ssh: boolean }; history: string[] };

export function newShell(): Shell {
  return {
    cwd: '/srv/intern', history: [], fixed: { backup: false, suid: false, ssh: false },
    fs: d({
      etc: d({ 'os-release': f('NAME="BreachLab OS (fictional)"\nVERSION="1.0"'), passwd: f('root:x:0:0:root:/root:/bin/sh\nintern:x:1000:1000::/srv/intern:/bin/sh'), ssh: d({ sshd_config: f('PermitRootLogin yes\nPasswordAuthentication yes') }) }),
      srv: d({ intern: d({ 'notes.txt': f('TODO: ask ops why the nightly backup is world-readable', '-rw-r--r--', 'intern') }, 'drwxr-xr-x', 'intern') }),
      opt: d({ backup: d({ 'db-backup.sql': f("-- fictional dump\nINSERT INTO users VALUES ('admin', 'FAKE-PASSWORD-NOT-REAL');", '-rw-r--rw-') }) }),
      usr: d({ local: d({ bin: d({ 'report-tool': f('<binary: fictional report tool>', '-rwsr-xr-x') }) }) }),
      var: d({ log: d({ 'auth.log': f('Nov 21 03:12 sshd: Failed password for root from 203.0.113.7 (TEST-NET-3)\nNov 21 03:12 sshd: Failed password for root from 203.0.113.7 (TEST-NET-3)', '-rw-r-----') }) }),
    }),
  };
}

function resolve(cwd: string, p: string): string {
  const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/');
  const out: string[] = [];
  for (const x of parts) { if (!x || x === '.') continue; if (x === '..') out.pop(); else out.push(x); }
  return `/${out.join('/')}`;
}
function lookup(fs: Node, path: string): Node | null {
  let n: Node = fs;
  for (const x of path.split('/').filter(Boolean)) { if (n.type !== 'dir' || !n.children[x]) return null; n = n.children[x]; }
  return n;
}
const worldReadable = (n: Node) => n.mode[7] === 'r';

export const SHELL_HELP = 'help · ls [-l] · cd · pwd · cat · whoami · id · uname -a · ps · ss -tlnp · find / -perm -4000 · sudo -l · chmod <mode> <file> · audit · history · clear';

/** One command → output lines. The machine is fictional; nothing runs on the visitor's computer. */
export function run(sh: Shell, line: string): { shell: Shell; out: string[]; clear?: boolean } {
  const cmd = line.trim();
  const s: Shell = { ...sh, history: [...sh.history, cmd].slice(-50) };
  if (!cmd) return { shell: sh, out: [] };
  const [name, ...args] = cmd.split(/\s+/);
  const err = (m: string) => ({ shell: s, out: [m] });
  switch (name) {
    case 'help': return { shell: s, out: [SHELL_HELP, 'Goal: find three misconfigurations, fix them, then run audit.'] };
    case 'clear': return { shell: s, out: [], clear: true };
    case 'pwd': return { shell: s, out: [s.cwd] };
    case 'whoami': return { shell: s, out: ['intern'] };
    case 'id': return { shell: s, out: ['uid=1000(intern) gid=1000(intern) groups=1000(intern)'] };
    case 'uname': return { shell: s, out: ['BreachLab 6.1.0-fictional #1 SMP x86_64 GNU/Linux'] };
    case 'history': return { shell: s, out: s.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`) };
    case 'ps': return { shell: s, out: ['  PID USER     COMMAND', '    1 root     /sbin/init', '  212 root     sshd: /usr/sbin/sshd -D', '  388 root     cron', ' 1043 intern   -sh'] };
    case 'ss': return { shell: s, out: ['State  Local Address:Port  Process', 'LISTEN 0.0.0.0:22           sshd', 'LISTEN 127.0.0.1:5432      postgres (fictional)'] };
    case 'sudo': return { shell: s, out: args[0] === '-l' ? ['Sorry, user intern may not run sudo on breachlab.'] : ['intern is not in the sudoers file. This incident will be reported (to nobody: it is fictional).'] };
    case 'cd': {
      const p = resolve(s.cwd, args[0] ?? '/srv/intern'); const n = lookup(s.fs, p);
      if (!n) return err(`cd: ${args[0]}: No such file or directory`);
      if (n.type !== 'dir') return err(`cd: ${args[0]}: Not a directory`);
      return { shell: { ...s, cwd: p }, out: [] };
    }
    case 'ls': {
      const long = args.includes('-l'); const target = args.find((a) => !a.startsWith('-'));
      const n = lookup(s.fs, resolve(s.cwd, target ?? '.'));
      if (!n) return err(`ls: cannot access '${target}': No such file or directory`);
      if (n.type === 'file') return { shell: s, out: [long ? `${n.mode} ${n.owner} ${target}` : target!] };
      const names = Object.keys(n.children).sort();
      return { shell: s, out: long ? names.map((x) => `${n.children[x].mode} ${n.children[x].owner.padEnd(6)} ${x}`) : [names.join('  ')] };
    }
    case 'cat': {
      if (!args[0]) return err('cat: missing operand');
      const p = resolve(s.cwd, args[0]); const n = lookup(s.fs, p);
      if (!n) return err(`cat: ${args[0]}: No such file or directory`);
      if (n.type === 'dir') return err(`cat: ${args[0]}: Is a directory`);
      if (!worldReadable(n) && n.owner !== 'intern') return err(`cat: ${args[0]}: Permission denied`);
      return { shell: s, out: n.content.split('\n') };
    }
    case 'find': {
      if (!(args.includes('-perm') && args.includes('-4000'))) return err('find: try “find / -perm -4000” (SUID files)');
      return { shell: s, out: s.fixed.suid ? [] : ['/usr/local/bin/report-tool'] };
    }
    case 'chmod': {
      const [mode, target] = args;
      if (!mode || !target) return err('chmod: usage: chmod <mode> <file>');
      const p = resolve(s.cwd, target); const n = lookup(s.fs, p);
      if (!n || n.type !== 'file') return err(`chmod: cannot access '${target}': No such file`);
      const fixed = { ...s.fixed };
      if (p === '/opt/backup/db-backup.sql' && /^(600|640|0600|0640|o-rw|o-r)$/.test(mode)) { n.mode = mode === '640' || mode === '0640' ? '-rw-r-----' : '-rw-------'; fixed.backup = true; }
      else if (p === '/usr/local/bin/report-tool' && /^(755|0755|u-s)$/.test(mode)) { n.mode = '-rwxr-xr-x'; fixed.suid = true; }
      else return err(`chmod: (simulated) changed ${target} to ${mode}, but that is not one of the findings`);
      return { shell: { ...s, fixed }, out: [`mode of '${target}' changed (simulated, as root via the lab's admin role)`] };
    }
    case 'sshd-harden': {
      const fixed = { ...s.fixed, ssh: true };
      const n = lookup(s.fs, '/etc/ssh/sshd_config'); if (n && n.type === 'file') n.content = 'PermitRootLogin no\nPasswordAuthentication no';
      return { shell: { ...s, fixed }, out: ['sshd_config: PermitRootLogin no, PasswordAuthentication no (simulated)'] };
    }
    case 'audit': {
      const lines = [
        `${s.fixed.backup ? 'PASS' : 'FAIL'}  /opt/backup/db-backup.sql is ${s.fixed.backup ? 'not ' : ''}world-readable`,
        `${s.fixed.suid ? 'PASS' : 'FAIL'}  /usr/local/bin/report-tool ${s.fixed.suid ? 'has no' : 'has the'} SUID bit`,
        `${s.fixed.ssh ? 'PASS' : 'FAIL'}  sshd ${s.fixed.ssh ? 'refuses' : 'allows'} root and password logins${s.fixed.ssh ? '' : ' (fix: sshd-harden)'}`,
      ];
      return { shell: s, out: [...lines, Object.values(s.fixed).every(Boolean) ? 'All findings fixed.' : `${Object.values(s.fixed).filter((x) => !x).length} finding(s) open.`] };
    }
    default: return err(`${name}: command not found (type help)`);
  }
}
