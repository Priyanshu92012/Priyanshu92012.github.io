// Analytics privacy: the beacon respects DNT/GPC, counts only production, and sends only the path,
// title, referring origin and screen width. The public counter shows only a well-formed number.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendBeacon, fetchTotal } from '../../src/scripts/beacon';

const ORIGIN = 'https://example-code.goatcounter.com';
function env({ host = 'priyanshu92012.github.io', dnt = null as string | null, gpc = false, ref = '' } = {}) {
  const sent: string[] = [];
  vi.stubGlobal('navigator', { doNotTrack: dnt, globalPrivacyControl: gpc });
  vi.stubGlobal('location', { hostname: host, pathname: '/work/opticlab/', search: '?secret=1', hash: '#demo' });
  vi.stubGlobal('document', { title: 'OpticLab · PRIYANSHU.EXE', referrer: ref, cookie: 'should-not-be-sent=1' });
  vi.stubGlobal('screen', { width: 1440, height: 900 });
  vi.stubGlobal('Image', class { referrerPolicy = ''; set src(v: string) { sent.push(v); } });
  return sent;
}
afterEach(() => vi.unstubAllGlobals());

describe('beacon', () => {
  it('sends one request with only path, title, referring origin and screen width', () => {
    const sent = env({ ref: 'https://www.linkedin.com/in/someone/?trk=abc' });
    expect(sendBeacon(ORIGIN, 'priyanshu92012.github.io')).toBe(true);
    expect(sent).toHaveLength(1);
    const u = new URL(sent[0]);
    expect(u.origin).toBe(ORIGIN);
    expect(u.searchParams.get('p')).toBe('/work/opticlab/');
    expect(u.searchParams.get('r')).toBe('https://www.linkedin.com');
    expect(u.searchParams.get('s')).toBe('1440');
    expect(sent[0]).not.toMatch(/secret|demo|cookie|should-not|linkedin\.com\/in/);
    expect([...u.searchParams.keys()].sort()).toEqual(['p', 'r', 'rnd', 's', 't']);
  });
  it('sends nothing with Do Not Track, Global Privacy Control, or off the production host', () => {
    for (const e of [{ dnt: '1' }, { gpc: true }, { host: 'localhost' }, { host: 'someone.github.io' }]) {
      const sent = env(e);
      expect(sendBeacon(ORIGIN, 'priyanshu92012.github.io'), JSON.stringify(e)).toBe(false);
      expect(sent).toEqual([]);
    }
  });
});

describe('public counter', () => {
  it('returns the count only when it is a well-formed number, otherwise nothing', async () => {
    for (const [body, ok, want] of [[{ count: '1,234' }, true, '1,234'], [{ count: '<img src=x>' }, true, null], [{}, true, null], [{ count: '5' }, false, null]] as const) {
      vi.stubGlobal('fetch', async () => ({ ok, json: async () => body }));
      expect(await fetchTotal(ORIGIN)).toBe(want);
    }
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    expect(await fetchTotal(ORIGIN)).toBeNull();
  });
});
