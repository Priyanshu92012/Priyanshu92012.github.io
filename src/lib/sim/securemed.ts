// Reference security architecture + illustrative CI/CD security gates for the
// SecureMed walkthrough. Generic, textbook-level controls (STRIDE), NOT the course
// project's private implementation.

export type Component = { id: string; label: string; zone: 'public' | 'edge' | 'app' | 'data' | 'delivery'; x: number; y: number };
export const COMPONENTS: Component[] = [
  { id: 'browser', label: 'Clinician browser', zone: 'public', x: 60, y: 120 },
  { id: 'gateway', label: 'API gateway / WAF', zone: 'edge', x: 230, y: 120 },
  { id: 'auth', label: 'Auth service (MFA)', zone: 'app', x: 400, y: 50 },
  { id: 'api', label: 'Records API', zone: 'app', x: 400, y: 190 },
  { id: 'db', label: 'Encrypted records DB', zone: 'data', x: 570, y: 190 },
  { id: 'audit', label: 'Append-only audit log', zone: 'data', x: 570, y: 50 },
  { id: 'cicd', label: 'CI/CD pipeline', zone: 'delivery', x: 230, y: 290 },
];
export const FLOWS: [string, string][] = [['browser', 'gateway'], ['gateway', 'auth'], ['gateway', 'api'], ['api', 'db'], ['auth', 'audit'], ['api', 'audit'], ['cicd', 'api']];

export type Threat = { stride: 'Spoofing' | 'Tampering' | 'Repudiation' | 'Information disclosure' | 'Denial of service' | 'Elevation of privilege'; threat: string; mitigation: string };
export const THREATS: Record<string, Threat[]> = {
  browser: [
    { stride: 'Spoofing', threat: 'Stolen password used from another device', mitigation: 'TOTP second factor; lockout after repeated failures' },
    { stride: 'Information disclosure', threat: 'XSS exfiltrates session tokens', mitigation: 'HttpOnly + SameSite cookies, CSP, output encoding' },
  ],
  gateway: [
    { stride: 'Denial of service', threat: 'Credential-stuffing floods the login endpoint', mitigation: 'Rate limiting per IP and account, WAF rules' },
    { stride: 'Tampering', threat: 'Request manipulation in transit', mitigation: 'TLS everywhere, HSTS, strict input validation' },
  ],
  auth: [
    { stride: 'Spoofing', threat: 'Replay of a captured one-time code', mitigation: '30 s TOTP step, ±1 step window, reject reuse of a code' },
    { stride: 'Elevation of privilege', threat: 'Session fixation after login', mitigation: 'Rotate session id on authentication; short-lived tokens' },
  ],
  api: [
    { stride: 'Elevation of privilege', threat: 'Clinician reads records outside their care team (IDOR)', mitigation: 'Object-level authorisation on every request' },
    { stride: 'Tampering', threat: 'SQL injection', mitigation: 'Parameterised queries / ORM, least-privilege DB user' },
  ],
  db: [
    { stride: 'Information disclosure', threat: 'Backup or disk theft', mitigation: 'Encryption at rest, key separation, restricted backups' },
  ],
  audit: [
    { stride: 'Repudiation', threat: 'User denies having accessed a record', mitigation: 'Append-only audit trail with actor, record, time' },
    { stride: 'Tampering', threat: 'Attacker deletes their traces', mitigation: 'Write-once storage, separate permissions from the app' },
  ],
  cicd: [
    { stride: 'Tampering', threat: 'Vulnerable dependency or leaked secret ships to production', mitigation: 'Security gates: SAST, dependency audit, secret scan; block on failure' },
  ],
};

export type Injection = 'failing-test' | 'hardcoded-secret' | 'vulnerable-dependency' | 'sql-injection' | 'xss-sink' | 'misconfigured-header';
export const INJECTIONS: { id: Injection; label: string }[] = [
  { id: 'failing-test', label: 'Broken unit test' },
  { id: 'hardcoded-secret', label: 'API key committed in code' },
  { id: 'vulnerable-dependency', label: 'Dependency with a known CVE' },
  { id: 'sql-injection', label: 'String-built SQL query' },
  { id: 'xss-sink', label: 'Unescaped HTML output' },
  { id: 'misconfigured-header', label: 'Missing security headers' },
];

export type Gate = { id: string; label: string; catches: Injection[]; tool: string };
export const GATES: Gate[] = [
  { id: 'lint', label: 'Lint & types', catches: [], tool: 'static checks' },
  { id: 'test', label: 'Unit tests', catches: ['failing-test'], tool: 'test runner' },
  { id: 'secrets', label: 'Secret scan', catches: ['hardcoded-secret'], tool: 'secret scanner' },
  { id: 'sast', label: 'SAST', catches: ['sql-injection', 'xss-sink'], tool: 'static analysis' },
  { id: 'deps', label: 'Dependency audit', catches: ['vulnerable-dependency'], tool: 'SCA / advisory DB' },
  { id: 'dast', label: 'DAST on staging', catches: ['misconfigured-header', 'xss-sink'], tool: 'dynamic scan' },
  { id: 'deploy', label: 'Deploy', catches: [], tool: 'release' },
];

export type GateResult = { gate: Gate; status: 'pass' | 'fail' | 'skipped'; found: Injection[] };

/** Run the pipeline: the first failing gate blocks every later stage, including deploy. */
export function runPipeline(injected: Injection[]): { results: GateResult[]; shipped: boolean; blockedAt?: string } {
  let blocked: string | undefined;
  const results = GATES.map<GateResult>((gate) => {
    if (blocked) return { gate, status: 'skipped', found: [] };
    const found = gate.catches.filter((c) => injected.includes(c));
    if (found.length) { blocked = gate.id; return { gate, status: 'fail', found }; }
    return { gate, status: 'pass', found: [] };
  });
  return { results, shipped: !blocked, blockedAt: blocked };
}
