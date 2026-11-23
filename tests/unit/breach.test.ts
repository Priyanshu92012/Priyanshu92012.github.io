// BREACH MODE engines (src/lib/sim/breach.ts): CORS rules, the vulnerable login and its fix, the shell.
import { describe, expect, it } from 'vitest';
import { corsDecision, evalWhere, login, newShell, run, escapeHtml, XSS_PAYLOADS, USERS } from '../../src/lib/sim/breach';

const srv = { allowOrigin: 'https://app.example', allowMethods: ['PUT'], allowHeaders: ['X-Token'], allowCredentials: true };
const req = { origin: 'https://app.example', method: 'GET', headers: [], credentials: false };

describe('CORS', () => {
  it('simple requests skip the preflight; custom methods and headers need one', () => {
    expect(corsDecision(req, srv)).toMatchObject({ allowed: true, preflight: false });
    expect(corsDecision({ ...req, method: 'PUT' }, srv)).toMatchObject({ allowed: true, preflight: true });
    expect(corsDecision({ ...req, method: 'DELETE' }, srv).allowed).toBe(false);
    expect(corsDecision({ ...req, headers: ['X-Other'] }, srv).allowed).toBe(false);
  });
  it('rejects a wrong origin, a missing header, and “*” with credentials', () => {
    expect(corsDecision({ ...req, origin: 'https://evil.example' }, srv).allowed).toBe(false);
    expect(corsDecision(req, { ...srv, allowOrigin: null }).allowed).toBe(false);
    expect(corsDecision({ ...req, credentials: true }, { ...srv, allowOrigin: '*' }).allowed).toBe(false);
    expect(corsDecision(req, { ...srv, allowOrigin: '*' }).allowed).toBe(true);
    expect(corsDecision({ ...req, credentials: true }, { ...srv, allowCredentials: false }).allowed).toBe(false);
  });
});

describe('SQL injection', () => {
  it('the evaluator handles AND/OR precedence, literals and comments', () => {
    expect(evalWhere("username = 'ada' AND password = 'x'", USERS[0])).toBe(false);
    expect(evalWhere("username = 'ada' OR '1' = '1' -- rest", USERS[1])).toBe(true);
    expect(() => evalWhere("username = 'ada", USERS[0])).toThrow();
  });
  it('concatenation is bypassed by a classic payload; parameters are not', () => {
    expect(login('ada', 'correct-horse-7', 'concat').loggedInAs).toBe('ada');
    expect(login('ada', 'wrong', 'concat').loggedInAs).toBeUndefined();
    expect(login("' OR '1'='1' --", 'x', 'concat').loggedInAs).toBe('ada');
    expect(login("ada' --", 'x', 'concat').loggedInAs).toBe('ada');
    expect(login("' OR '1'='1' --", 'x', 'param').loggedInAs).toBeUndefined();
    expect(login("ada' --", 'x', 'param').loggedInAs).toBeUndefined();
    expect(login('ada', 'correct-horse-7', 'param').loggedInAs).toBe('ada');
  });
});

describe('XSS', () => {
  it('escaping leaves no markup in any payload', () => {
    for (const p of XSS_PAYLOADS) expect(escapeHtml(p)).not.toMatch(/[<>"]/);
  });
});

describe('fictional shell', () => {
  it('finds, fixes and audits the three misconfigurations', () => {
    let sh = newShell();
    const go = (l: string) => { const r = run(sh, l); sh = r.shell; return r.out.join('\n'); };
    expect(go('cat /opt/backup/db-backup.sql')).toMatch(/FAKE-PASSWORD-NOT-REAL/);
    expect(go('cat /var/log/auth.log')).toMatch(/Permission denied/);
    expect(go('find / -perm -4000')).toContain('/usr/local/bin/report-tool');
    expect(go('audit')).toMatch(/3 finding/);
    go('chmod 600 /opt/backup/db-backup.sql'); go('chmod u-s /usr/local/bin/report-tool'); go('sshd-harden');
    expect(go('audit')).toMatch(/All findings fixed/);
    expect(go('find / -perm -4000')).toBe('');
    expect(go('rm -rf /')).toMatch(/command not found/);
  });
});
