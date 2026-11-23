// OpticLab secure-controller lab: a browser re-creation of the documented behaviour of a personal
// embedded-Linux project (fictional optical-shelf controller on emulated ARM64). Written from the
// project's architecture notes and recorded test evidence, not from its source.
//
// Real here: SHA-256 hashing, the dm-verity-style hash tree and RSA-2048 PKCS#1 v1.5 signatures
// (Web Crypto). Simulated: the boot stages, the kernel driver, line-card presence and certificates.
import { rng } from './rng';

// ── shared ───────────────────────────────────────────────────────────
export type Board = 'olc4' | 'olc10';
export const VARIANTS: Record<Board, { model: string; slots: number; compatible: string }> = {
  olc4: { model: 'OLC-4', slots: 4, compatible: 'opticlab,olc4-chassis' },
  olc10: { model: 'OLC-10', slots: 10, compatible: 'opticlab,olc10-chassis' },
};

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest('SHA-256', data as BufferSource));
}
export const hex = (b: Uint8Array, n = b.length) => [...b.slice(0, n)].map((x) => x.toString(16).padStart(2, '0')).join('');
const concat = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

function bytes(seed: number, n: number): Uint8Array {
  const r = rng(seed); const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = r.int(0, 255);
  return out;
}

// ── root filesystem + verity tree ────────────────────────────────────
export const BLOCK = 512;   // the real lab uses 4 KiB blocks; small blocks keep the demo light
export const BLOCKS = 8;

export function makeRootfs(seed = 7): Uint8Array[] {
  return Array.from({ length: BLOCKS }, (_, i) => bytes(seed * 101 + i, BLOCK));
}

/** Leaf hashes, then pairwise parents up to one root (the role of dm-verity's hash tree). */
export async function verityTree(blocks: Uint8Array[]): Promise<{ leaves: Uint8Array[]; root: Uint8Array }> {
  const leaves = await Promise.all(blocks.map((b) => sha256(b)));
  let level = leaves;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(await sha256(concat(level[i], level[i + 1] ?? level[i])));
    level = next;
  }
  return { leaves, root: level[0] };
}

// ── signed FIT image ─────────────────────────────────────────────────
export type Fit = {
  board: Board;
  kernel: Uint8Array;
  dtb: Uint8Array;          // carries the signed boot arguments, including the verity root hash
  entry: number;
  kernelHash: Uint8Array;   // recorded in the configuration at signing time
  dtbHash: Uint8Array;
  signature: Uint8Array | null;
  signedBy: string | null;
};

export const DEFAULT_ENTRY = 0x40480000;

/** The bytes a configuration signature covers: kernel hash + DTB hash + metadata (board, entry). */
export function configBytes(f: Pick<Fit, 'board' | 'entry' | 'kernelHash' | 'dtbHash'>): Uint8Array {
  return concat(enc.encode(`conf-${f.board};entry=0x${f.entry.toString(16)};`), f.kernelHash, f.dtbHash);
}

export async function makeKeyPair(): Promise<CryptoKeyPair> {
  return subtle().generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  ) as Promise<CryptoKeyPair>;
}

export async function buildFit(board: Board, rootHash: Uint8Array, key: CryptoKey | null, keyName = 'dev'): Promise<Fit> {
  const kernel = bytes(board === 'olc4' ? 41 : 42, 2048);
  const dtb = enc.encode(`/ { compatible = "${VARIANTS[board].compatible}"; chosen { bootargs = "root=/dev/dm-0 ro dm-mod.create=verity,root_hash=${hex(rootHash)}"; }; };`);
  const f: Fit = { board, kernel, dtb, entry: DEFAULT_ENTRY, kernelHash: await sha256(kernel), dtbHash: await sha256(dtb), signature: null, signedBy: null };
  if (key) {
    f.signature = new Uint8Array(await subtle().sign('RSASSA-PKCS1-v1_5', key, configBytes(f) as BufferSource));
    f.signedBy = keyName;
  }
  return f;
}

// ── attacks (each one is a test case in the original suite) ──────────
export type Attack = 'none' | 'unsigned' | 'wrong-key' | 'kernel-bit' | 'entry' | 'rootfs-bit';
export const ATTACKS: { id: Attack; label: string; how: string; test: string }[] = [
  { id: 'none', label: 'Genuine image', how: 'Signed by the trusted key, nothing modified.', test: 'BOOT-02' },
  { id: 'unsigned', label: 'Unsigned image', how: 'The configuration carries no signature.', test: 'VB-01' },
  { id: 'wrong-key', label: 'Wrong key', how: 'Signed correctly, but by a key U-Boot does not trust.', test: 'VB-02' },
  { id: 'kernel-bit', label: 'Flip one kernel bit', how: 'One bit of the kernel changed after signing.', test: 'VB-03' },
  { id: 'entry', label: 'Change entry address', how: 'The load/entry address in the configuration changed after signing.', test: 'VB-04' },
  { id: 'rootfs-bit', label: 'Flip one rootfs bit', how: 'One bit of the root filesystem changed offline.', test: 'VER-03' },
];

export type StageId = 'uboot-sig' | 'uboot-hash' | 'linux' | 'verity' | 'driver' | 'controllerd';
export type Stage = { id: StageId; label: string; status: 'ok' | 'fail' | 'skipped'; detail: string };
export type BootResult = { booted: boolean; stages: Stage[]; console: string[]; verdict: string };

const STAGE_LABEL: Record<StageId, string> = {
  'uboot-sig': 'U-Boot · configuration signature',
  'uboot-hash': 'U-Boot · image hashes',
  linux: 'Linux · signed device tree and boot arguments',
  verity: 'dm-verity · root filesystem',
  driver: 'opticlab-ctrl driver · probe',
  controllerd: 'controllerd · local socket and mTLS',
};

/** Boots a (possibly tampered) image against the trusted public key. Every check is real crypto. */
export async function boot(
  genuine: Fit, rootfs: Uint8Array[], attack: Attack,
  keys: { trusted: CryptoKeyPair; attacker: CryptoKeyPair },
): Promise<BootResult> {
  // apply the attack to copies
  let fit: Fit = { ...genuine, kernel: genuine.kernel.slice(), dtb: genuine.dtb.slice() };
  const blocks = rootfs.map((b) => b.slice());
  if (attack === 'unsigned') fit = { ...fit, signature: null, signedBy: null };
  if (attack === 'wrong-key') fit = await buildFit(genuine.board, await rootHashOf(rootfs), keys.attacker.privateKey, 'attacker');
  if (attack === 'kernel-bit') fit.kernel[100] ^= 0x01;
  if (attack === 'entry') fit = { ...fit, entry: fit.entry + 0x1000 };
  if (attack === 'rootfs-bit') blocks[5][17] ^= 0x01;

  const stages: Stage[] = [];
  const con: string[] = [`U-Boot 2026.01 · loading image.itb · bootm #conf-${fit.board}`];
  const put = (id: StageId, status: Stage['status'], detail: string) => stages.push({ id, label: STAGE_LABEL[id], status, detail });
  const fail = (verdict: string) => {
    for (const id of Object.keys(STAGE_LABEL) as StageId[]) if (!stages.some((s) => s.id === id)) put(id, 'skipped', 'never reached');
    return { booted: false, stages, console: con, verdict };
  };

  // 1. configuration signature (required = "conf")
  if (!fit.signature) {
    put('uboot-sig', 'fail', `required key 'dev' · no signature on conf-${fit.board}`);
    con.push(`   Verifying Hash Integrity ... sha256,rsa2048:dev- error!`, `Failed to verify required signature 'key-dev'`, 'Bad Data Hash', 'BOOT FAILED');
    return fail('Rejected by U-Boot: the configuration is not signed, and a signature is required.');
  }
  const sigOk = await subtle().verify('RSASSA-PKCS1-v1_5', keys.trusted.publicKey, fit.signature as BufferSource, configBytes(fit) as BufferSource);
  if (!sigOk) {
    put('uboot-sig', 'fail', attack === 'wrong-key' ? 'signature does not verify against the trusted public key' : 'signature does not match the configuration (its metadata changed)');
    con.push(`   Verifying Hash Integrity ... sha256,rsa2048:dev- error!`, `Failed to verify required signature 'key-dev'`, 'BOOT FAILED');
    return fail(attack === 'wrong-key' ? 'Rejected by U-Boot: signed by a key it does not trust.' : 'Rejected by U-Boot: the signed configuration was modified (entry address).');
  }
  put('uboot-sig', 'ok', `RSA-2048 / SHA-256 signature verified (key ‘${fit.signedBy}’)`);
  con.push('   Verifying Hash Integrity ... sha256,rsa2048:dev+ OK');

  // 2. image hashes recorded in the signed configuration
  const kh = await sha256(fit.kernel); const dh = await sha256(fit.dtb);
  if (hex(kh) !== hex(fit.kernelHash) || hex(dh) !== hex(fit.dtbHash)) {
    put('uboot-hash', 'fail', `kernel sha256 ${hex(kh, 6)}… ≠ signed ${hex(fit.kernelHash, 6)}…`);
    con.push(`   Verifying Hash Integrity ... sha256 error!`, `Bad hash value for 'hash' hash node in 'kernel' image node`, 'BOOT FAILED');
    return fail('Rejected by U-Boot: the kernel no longer matches the hash in the signed configuration.');
  }
  put('uboot-hash', 'ok', `kernel ${hex(kh, 6)}… and DTB ${hex(dh, 6)}… match the signed hashes`);
  con.push('   Verifying Hash Integrity ... sha256+ OK', 'Starting kernel ...');

  // 3. Linux takes its command line (with the verity root hash) from the signed DTB
  const expectedRoot = new TextDecoder().decode(fit.dtb).match(/root_hash=([0-9a-f]+)/)?.[1] ?? '';
  put('linux', 'ok', `Linux 6.18 · bootargs from the signed DTB · root_hash=${expectedRoot.slice(0, 12)}…`);
  con.push('Booting Linux on physical CPU 0x0', `Kernel command line: root=/dev/dm-0 ro dm-mod.create=verity,…`);

  // 4. dm-verity: every block read is hashed up to the root in the signed command line
  const { leaves, root } = await verityTree(blocks);
  if (hex(root) !== expectedRoot) {
    const genuineLeaves = (await verityTree(rootfs)).leaves;
    const bad = leaves.findIndex((l, i) => hex(l) !== hex(genuineLeaves[i]));
    put('verity', 'fail', `block ${bad} hashes to ${hex(leaves[bad], 6)}…; the tree no longer reaches the signed root`);
    con.push(`device-mapper: verity: 254:0: data block ${bad} is corrupted`, 'VFS: Cannot open root device "dm-0"', 'Kernel panic - not syncing: VFS: Unable to mount root fs');
    return fail('Stopped by dm-verity: one modified bit in the root filesystem, and the root is never mounted.');
  }
  put('verity', 'ok', `${BLOCKS} blocks verified up to root ${hex(root, 6)}… · mounted read-only`);
  con.push('device-mapper: verity: sha256 using implementation "sha256-ce"', 'VFS: Mounted root (squashfs filesystem) readonly on device 254:0.');

  // 5–6. driver and daemon
  const v = VARIANTS[fit.board];
  put('driver', 'ok', `matched ${v.compatible} → ${v.model}, ${v.slots} slots · ready GPIO high`);
  con.push(`opticlab-ctrl chassis-controller: OpticLab ${v.model} controller ready: ${v.slots} slots, ready-gpio=1, inventory=simulated`);
  put('controllerd', 'ok', 'listening on /run/opticlab/controllerd.sock and tcp:8443 (mTLS)');
  con.push("controllerd: listening on tcp:8443 (mTLS, client OU must be 'opticlab-operator')", 'opticlab login:');
  return { booted: true, stages, console: con, verdict: `Booted ${v.model}: every stage verified the next.` };
}

async function rootHashOf(rootfs: Uint8Array[]) { return (await verityTree(rootfs)).root; }

// ── kernel driver model ──────────────────────────────────────────────
export type SlotState = 'empty' | 'present' | 'fault';
export type Driver = { board: Board; bound: boolean; gpio: 0 | 1; slots: SlotState[]; log: string[] };

export function newDriver(board: Board): Driver {
  return { board, bound: false, gpio: 0, slots: Array(VARIANTS[board].slots).fill('empty'), log: [] };
}

/** probe(): bind through the device tree; without the GPIO controller the core defers and retries. */
export function probe(d: Driver, opts: { dtNode: boolean; gpioReady: boolean }): Driver {
  const v = VARIANTS[d.board];
  if (!opts.dtNode) return { ...d, log: [...d.log, 'module loaded · no matching device-tree node, so probe() never runs (DRV-00)'] };
  if (!opts.gpioReady) return { ...d, log: [...d.log, 'probe(): ready GPIO not available yet → -EPROBE_DEFER; the driver core retries silently'] };
  return { ...d, bound: true, gpio: 1, slots: Array(v.slots).fill('present').map((s, i) => (i < 2 ? s : 'empty')) as SlotState[],
    log: [...d.log, `probe(): ${v.compatible} → {${v.model}, ${v.slots}} · devm alloc + mutex · GPIO "ready" driven high · sysfs attributes created`] };
}

export function unbind(d: Driver): Driver {
  return { ...d, bound: false, gpio: 0, log: [...d.log, 'remove(): attributes gone, ready GPIO low (devm frees the rest) (DRV-06)'] };
}

/** simulate_slot (root-only test hook): "<slot> <empty|present|fault>", slots numbered from 1. */
export function simulateSlot(d: Driver, input: string): { driver: Driver; result: string; ok: boolean } {
  if (!d.bound) return { driver: d, result: 'No such file or directory (driver not bound)', ok: false };
  const m = /^\s*(\d+)\s+(\S{1,15})\s*$/.exec(input);
  if (!m) return { driver: d, result: '-EINVAL: expected "<slot> <state>"', ok: false };
  const slot = Number(m[1]);
  if (slot < 1 || slot > d.slots.length) return { driver: d, result: `-ERANGE: slot must be 1–${d.slots.length}`, ok: false };
  if (!['empty', 'present', 'fault'].includes(m[2])) return { driver: d, result: '-EINVAL: state must be empty, present or fault', ok: false };
  const slots = d.slots.slice(); slots[slot - 1] = m[2] as SlotState;
  return { driver: { ...d, slots, log: [...d.log, `slot ${slot} -> ${m[2]} (simulated)`] }, result: `slot ${slot} -> ${m[2]} (simulated)`, ok: true };
}

export const controllerStatus = (d: Driver) => (d.slots.includes('fault') ? 'degraded' : 'ok');

export function sysfs(d: Driver): Record<string, string> | null {
  if (!d.bound) return null;
  const v = VARIANTS[d.board];
  return { model: v.model, slot_count: String(v.slots), slot_status: d.slots.join(' '), controller_status: controllerStatus(d), ready_gpio: String(d.gpio), inventory_source: 'simulated' };
}

// ── controllerd line protocol ────────────────────────────────────────
export const MAX_LINE = 128;
type Cmd = 'ping' | 'info' | 'model' | 'slot_count' | 'slots' | 'health' | 'slot';

export function parseRequest(line: string): { ok: true; cmd: Cmd; slot?: number } | { ok: false; error: string } {
  if (!line) return { ok: false, error: 'empty request' };
  if (line.length > MAX_LINE) return { ok: false, error: 'request too long' };
  if ([...line].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) >= 0x7f)) return { ok: false, error: 'invalid character in request' };
  if (line === 'PING') return { ok: true, cmd: 'ping' };
  if (!line.startsWith('GET ')) return { ok: false, error: 'unknown command' };
  const arg = line.slice(4);
  if (['info', 'model', 'slot_count', 'slots', 'health'].includes(arg)) return { ok: true, cmd: arg as Cmd };
  if (arg.startsWith('slot ')) {
    const num = arg.slice(5);
    if (!/^\d{1,3}$/.test(num)) return { ok: false, error: 'slot id must be 1-3 decimal digits' };
    return { ok: true, cmd: 'slot', slot: Number(num) };
  }
  return { ok: false, error: 'unknown GET target' };
}

function health(d: Driver): { health: 'ok' | 'degraded' | 'error'; health_detail: string } {
  if (!d.bound) return { health: 'error', health_detail: "no device bound to 'opticlab-ctrl'" };
  if (d.gpio === 0) return { health: 'error', health_detail: 'ready GPIO is low' };
  if (controllerStatus(d) === 'degraded') return { health: 'degraded', health_detail: 'one or more slots report a fault' };
  return { health: 'ok', health_detail: 'all slots nominal' };
}

/** One request → one JSON line, like the daemon (strict parse first, board range checked after). */
export function handle(line: string, d: Driver): string {
  const req = parseRequest(line);
  if (!req.ok) return JSON.stringify({ ok: false, error: req.error });
  if (req.cmd === 'ping') return JSON.stringify({ ok: true, pong: true });
  if (!d.bound) return JSON.stringify({ ok: false, error: `controller error: no device bound to 'opticlab-ctrl'` });
  const v = VARIANTS[d.board];
  switch (req.cmd) {
    case 'model': return JSON.stringify({ ok: true, model: v.model });
    case 'slot_count': return JSON.stringify({ ok: true, slot_count: v.slots });
    case 'slots': return JSON.stringify({ ok: true, slots: d.slots, inventory_source: 'simulated' });
    case 'health': return JSON.stringify({ ok: true, ...health(d) });
    case 'info': return JSON.stringify({ ok: true, model: v.model, slot_count: v.slots, slots: d.slots, ...health(d), inventory_source: 'simulated' });
    case 'slot':
      if (req.slot! < 1 || req.slot! > v.slots) return JSON.stringify({ ok: false, error: `slot ${req.slot} out of range 1-${v.slots}` });
      return JSON.stringify({ ok: true, slot: req.slot, state: d.slots[req.slot! - 1] });
  }
}

// ── mutual TLS: who may talk to the controller ───────────────────────
export type ClientCert = 'operator' | 'none' | 'rogue-ca' | 'expired' | 'observer' | 'client-distrusts-server';
export const CERTS: { id: ClientCert; label: string; test: string }[] = [
  { id: 'operator', label: 'Operator certificate (trusted CA, OU=opticlab-operator)', test: 'TLS-01' },
  { id: 'none', label: 'No client certificate', test: 'TLS-02' },
  { id: 'rogue-ca', label: 'Certificate from an unknown (rogue) CA', test: 'TLS-03' },
  { id: 'expired', label: 'Expired certificate from the trusted CA', test: 'TLS-04' },
  { id: 'observer', label: 'Trusted CA, but OU=opticlab-observer', test: 'TLS-05' },
  { id: 'client-distrusts-server', label: 'Client trusts a different CA than the server’s', test: 'TLS-06' },
];
export type TlsCheck = { step: string; ok: boolean | null; detail: string };

/** The server's decision path for one client: chain → validity → EKU → role (authZ). */
export function tlsDecision(c: ClientCert): { accepted: boolean; checks: TlsCheck[]; outcome: string } {
  const steps: TlsCheck[] = [];
  const add = (step: string, ok: boolean | null, detail: string) => steps.push({ step, ok, detail });
  const rest = (from: number) => { const names = ['Server certificate (client side)', 'Client certificate presented', 'Chain to OpticLab DEV CA', 'Validity period', 'Extended key usage: clientAuth', 'Role (subject OU)']; for (const n of names.slice(from)) add(n, null, 'not reached'); };
  if (c === 'client-distrusts-server') { add('Server certificate (client side)', false, 'client trusts another CA: certificate verify failed'); rest(1); return { accepted: false, checks: steps, outcome: 'The client refuses the server: TLS works in both directions.' }; }
  add('Server certificate (client side)', true, 'server chain verifies against the client’s CA file');
  if (c === 'none') { add('Client certificate presented', false, 'handshake failure: peer did not return a certificate'); rest(2); return { accepted: false, checks: steps, outcome: 'Handshake rejected before any request is read.' }; }
  add('Client certificate presented', true, 'certificate received');
  if (c === 'rogue-ca') { add('Chain to OpticLab DEV CA', false, 'tlsv1 alert unknown ca'); rest(3); return { accepted: false, checks: steps, outcome: 'Handshake rejected: unknown CA.' }; }
  add('Chain to OpticLab DEV CA', true, 'issuer: OpticLab DEV CA');
  if (c === 'expired') { add('Validity period', false, 'certificate expired'); rest(4); return { accepted: false, checks: steps, outcome: 'Handshake rejected: certificate expired.' }; }
  add('Validity period', true, 'within notBefore / notAfter');
  add('Extended key usage: clientAuth', true, 'clientAuth present');
  if (c === 'observer') { add('Role (subject OU)', false, "forbidden: certificate role 'opticlab-observer' not authorized"); return { accepted: false, checks: steps, outcome: 'Authenticated but not authorised: the request is refused with “forbidden”.' }; }
  add('Role (subject OU)', true, 'OU=opticlab-operator');
  return { accepted: true, checks: steps, outcome: 'Accepted: requests are served over TLS 1.3.' };
}
