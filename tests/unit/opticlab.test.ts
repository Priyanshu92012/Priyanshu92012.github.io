// OpticLab lab engine (src/lib/sim/opticlab.ts): real crypto for the boot chain, strict parsing,
// and the same refusals the original integration suite asserts (VB-01..04, VER-03, DRV-05, TLS-01..06).
import { beforeAll, describe, expect, it } from 'vitest';
import { ATTACKS, boot, buildFit, handle, makeKeyPair, makeRootfs, newDriver, parseRequest, probe, simulateSlot, sysfs, tlsDecision, unbind, verityTree, CERTS, MAX_LINE, type Fit } from '../../src/lib/sim/opticlab';

let keys: { trusted: CryptoKeyPair; attacker: CryptoKeyPair };
let fit: Fit;
const rootfs = makeRootfs();

beforeAll(async () => {
  keys = { trusted: await makeKeyPair(), attacker: await makeKeyPair() };
  fit = await buildFit('olc4', (await verityTree(rootfs)).root, keys.trusted.privateKey);
}, 30_000);

describe('verified boot', () => {
  it('boots the genuine image through every stage', async () => {
    const r = await boot(fit, rootfs, 'none', keys);
    expect(r.booted).toBe(true);
    expect(r.stages.every((s) => s.status === 'ok')).toBe(true);
  });

  it('refuses every attack at the stage the original suite asserts', async () => {
    const where: Record<string, string> = { unsigned: 'uboot-sig', 'wrong-key': 'uboot-sig', 'kernel-bit': 'uboot-hash', entry: 'uboot-sig', 'rootfs-bit': 'verity' };
    for (const a of ATTACKS.filter((x) => x.id !== 'none')) {
      const r = await boot(fit, rootfs, a.id, keys);
      expect(r.booted, a.id).toBe(false);
      expect(r.stages.find((s) => s.status === 'fail')?.id, a.id).toBe(where[a.id]);
      expect(r.stages.filter((s) => s.status === 'skipped').length, a.id).toBeGreaterThan(0);
    }
  });

  it('never mutates the genuine image or rootfs', async () => {
    const before = [fit.kernel[100], rootfs[5][17]];
    await boot(fit, rootfs, 'kernel-bit', keys); await boot(fit, rootfs, 'rootfs-bit', keys);
    expect([fit.kernel[100], rootfs[5][17]]).toEqual(before);
  });
});

describe('driver', () => {
  it('binds only with a device-tree node, defers without the GPIO, and unbinds cleanly', () => {
    expect(probe(newDriver('olc4'), { dtNode: false, gpioReady: true }).bound).toBe(false);
    expect(probe(newDriver('olc4'), { dtNode: true, gpioReady: false }).log.at(-1)).toMatch(/EPROBE_DEFER/);
    const d = probe(newDriver('olc10'), { dtNode: true, gpioReady: true });
    expect(sysfs(d)).toMatchObject({ model: 'OLC-10', slot_count: '10', ready_gpio: '1', inventory_source: 'simulated' });
    const u = unbind(d);
    expect(sysfs(u)).toBeNull();
    expect(u.gpio).toBe(0);
  });

  it('validates simulate_slot like the driver (slot 0, slot 5 on OLC-4, bad state, junk) and degrades on a fault', () => {
    const d = probe(newDriver('olc4'), { dtNode: true, gpioReady: true });
    for (const bad of ['0 fault', '5 fault', '2 broken', 'junk', '']) expect(simulateSlot(d, bad).ok, bad).toBe(false);
    expect(simulateSlot(d, '5 fault').result).toMatch(/ERANGE/);
    const f = simulateSlot(d, '3 fault').driver;
    expect(sysfs(f)!.controller_status).toBe('degraded');
    expect(sysfs(simulateSlot(f, '3 present').driver)!.controller_status).toBe('ok');
  });
});

describe('controllerd protocol', () => {
  const d = probe(newDriver('olc4'), { dtNode: true, gpioReady: true });
  it('parses strictly', () => {
    expect(parseRequest('PING')).toEqual({ ok: true, cmd: 'ping' });
    expect(parseRequest('GET slot 12')).toEqual({ ok: true, cmd: 'slot', slot: 12 });
    for (const [line, err] of [['', 'empty request'], ['x'.repeat(MAX_LINE + 1), 'request too long'], ['GET\tinfo', 'invalid character in request'], ['DELETE slot 1', 'unknown command'], ['GET secrets', 'unknown GET target'], ['GET slot 1a', 'slot id must be 1-3 decimal digits'], ['GET slot 1000', 'slot id must be 1-3 decimal digits']] as const)
      expect(parseRequest(line), line.slice(0, 20)).toEqual({ ok: false, error: err });
  });
  it('answers with JSON and checks the slot range against the board', () => {
    expect(JSON.parse(handle('GET model', d))).toEqual({ ok: true, model: 'OLC-4' });
    expect(JSON.parse(handle('GET slot 5', d)).ok).toBe(false);
    expect(JSON.parse(handle('GET health', simulateSlot(d, '1 fault').driver)).health).toBe('degraded');
    expect(JSON.parse(handle('GET info', unbind(d))).ok).toBe(false);
  });
});

describe('mutual TLS', () => {
  it('accepts only the operator and refuses every other case for its own reason', () => {
    const r = Object.fromEntries(CERTS.map((c) => [c.id, tlsDecision(c.id)]));
    expect(r.operator.accepted).toBe(true);
    for (const c of CERTS.filter((x) => x.id !== 'operator')) expect(r[c.id].accepted, c.id).toBe(false);
    expect(r.observer.checks.at(-1)!.detail).toMatch(/forbidden/);
    expect(r['rogue-ca'].checks.find((x) => x.ok === false)!.detail).toMatch(/unknown ca/);
    expect(r.expired.checks.find((x) => x.ok === false)!.detail).toMatch(/expired/);
  });
});
