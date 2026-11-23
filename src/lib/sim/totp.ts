// RFC 6238 TOTP (HMAC-SHA1) + RFC 4648 base32, via Web Crypto. Runs entirely locally.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$|\s/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`invalid base32 character "${ch}"`);
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function randomSecret(bytes = 20): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hotp(key: Uint8Array, counter: number, digits = 6): Promise<string> {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg as BufferSource));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export async function totp(secretB32: string, timeMs = Date.now(), opts: { step?: number; digits?: number } = {}): Promise<string> {
  const step = opts.step ?? 30;
  return hotp(base32Decode(secretB32), Math.floor(timeMs / 1000 / step), opts.digits ?? 6);
}

/** Verify with a ±window of time steps to tolerate clock drift. Returns the matched offset or null. */
export async function verifyTotp(secretB32: string, code: string, timeMs = Date.now(), window = 1): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  for (let w = -window; w <= window; w++) {
    if ((await totp(secretB32, timeMs + w * 30_000)) === code) return w;
  }
  return null;
}

export function otpauthUri(secretB32: string, label = 'SecureMed demo:visitor', issuer = 'SecureMed demo'): string {
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
