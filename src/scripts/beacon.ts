// One page-view beacon per page load, as an image request (no script from a third party, no cookies,
// no storage). Respects Do Not Track and Global Privacy Control, counts only the production host, and
// sends only: the path (no query, no hash), the page title, the referring *site* (origin only) and the
// screen width (for a device category). GoatCounter does the counting; this sends nothing else.
export function sendBeacon(origin: string, host: string): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return false;
  if (location.hostname !== host) return false;
  const u = new URL('/count', origin);
  u.searchParams.set('p', location.pathname);
  u.searchParams.set('t', document.title.slice(0, 120));
  try { const r = document.referrer ? new URL(document.referrer) : null; if (r && r.hostname !== location.hostname) u.searchParams.set('r', r.origin); } catch { /* malformed referrer */ }
  u.searchParams.set('s', String(Math.round(screen.width)));
  u.searchParams.set('rnd', Math.random().toString(36).slice(2, 10));
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.src = u.href;
  return true;
}

/** The public total from GoatCounter's opt-in counter endpoint, or null (then nothing is shown). */
export async function fetchTotal(origin: string): Promise<string | null> {
  try {
    const r = await fetch(new URL('/counter/TOTAL.json', origin), { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) return null;
    const j = (await r.json()) as { count?: unknown };
    return typeof j.count === 'string' && /^[\d.,\s]+$/.test(j.count) ? j.count : null;
  } catch { return null; }
}
