import { describe, expect, it } from 'vitest';
import { SchedulerSim, TRANSITIONS, TERMINAL } from '../../src/lib/sim/scheduler';
import { generateDumps, ingest, emptyDb, corruptOne, repair, dashboard, sha256 } from '../../src/lib/sim/gmre';
import { shapley, lime, predict, tokenize, spearman, limeStability } from '../../src/lib/sim/xai';
import { hotp, totp, verifyTotp, base32Encode, base32Decode } from '../../src/lib/sim/totp';
import { runPipeline } from '../../src/lib/sim/securemed';
import { PACKAGES, REPOSITORY, compare, apply, defaultDecision } from '../../src/lib/sim/basyx';

describe('scheduler simulator', () => {
  it('is deterministic for a seed', () => {
    const a = new SchedulerSim({ seed: 7 }).run(120).metrics();
    const b = new SchedulerSim({ seed: 7 }).run(120).metrics();
    expect(a).toEqual(b);
  });
  it('never double-books and only makes legal transitions, even under faults', () => {
    for (const strategy of ['fifo', 'priority', 'best-fit'] as const) {
      const s = new SchedulerSim({ seed: 11, strategy });
      for (let t = 0; t < 300; t++) {
        if (t % 37 === 5) s.inject('crash-agent');
        if (t % 53 === 9) s.inject('resource-offline');
        if (t % 71 === 3) s.inject('burst');
        s.step(); // assertInvariants runs inside
      }
      for (const r of s.reservations) for (let i = 1; i < r.history.length; i++) {
        expect(TRANSITIONS[r.history[i - 1].state]).toContain(r.history[i].state);
      }
      expect(s.metrics().completed).toBeGreaterThan(10);
    }
  });
  it('reclaims resources from crashed agents via lease expiry', () => {
    const s = new SchedulerSim({ seed: 3, leaseTtl: 3 });
    s.run(25);
    const holder = s.reservations.find((r) => r.state === 'active')!;
    s.inject('crash-agent', holder.agent);
    s.run(6);
    expect(holder.state).toBe('expired');
    expect(s.resources.find((r) => r.id === holder.resource)!.holder).not.toBe(holder.id);
  });
  it('retries reservations hit by resource failure with exponential backoff', () => {
    const s = new SchedulerSim({ seed: 5 });
    s.run(25);
    const victim = s.reservations.find((r) => r.state === 'active')!;
    s.inject('resource-offline', victim.resource!);
    expect(victim.state).toBe('failed');
    const retry = s.reservations.find((r) => r.attempt === 1 && r.agent === victim.agent && r.need === victim.need)!;
    expect(retry.notBefore).toBe(s.t + 2);
    expect(TERMINAL).toContain(victim.state);
  });
});

describe('GMRE ingestion model', () => {
  it('computes real SHA-256', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('skips an exact re-upload by fingerprint and drops duplicate records', async () => {
    const dumps = generateDumps(42, { count: 3, depth: 4, dupRate: 1 });
    const db = emptyDb();
    const results = [];
    for (const d of dumps) for await (const e of ingest(d, db)) if (e.type === 'done') results.push(e);
    expect(results.at(-1)!.skipped).toBe(true); // the re-upload
    expect(results.slice(0, -1).every((r) => !r.skipped)).toBe(true);
    expect(results.reduce((a, r) => a + r.duplicates, 0)).toBeGreaterThan(0);
    const rowsBefore = db.rows.length;
    for await (const _ of ingest(dumps[0], db)) { /* re-run */ }
    expect(db.rows.length).toBe(rowsBefore); // idempotent
    expect(dashboard(db).rows).toBe(rowsBefore);
  });
  it('marks a plugin FAILED on a corrupt member and backfills only that plugin', async () => {
    const [d] = generateDumps(9, { count: 1 });
    const db = emptyDb();
    corruptOne(d);
    for await (const _ of ingest(d, db)) { /* ingest */ }
    expect(db.ledger.find((e) => e.plugin === 'AlarmHistoryPlugin')!.state).toBe('FAILED');
    expect(db.ledger.filter((e) => e.state === 'DONE').length).toBeGreaterThan(0);
    repair(d);
    for await (const _ of ingest(d, db, { onlyPlugin: 'AlarmHistoryPlugin' })) { /* backfill */ }
    expect(db.ledger.every((e) => e.state === 'DONE')).toBe(true);
  });
});

describe('XAI engine', () => {
  it('Shapley values satisfy efficiency: Σφ = f(x) − f(∅)', () => {
    for (const s of ['Revenue beat forecasts despite weak guidance', 'The company did not miss earnings expectations']) {
      const t = tokenize(s);
      const phi = shapley(t);
      const full = predict(t), empty = predict(t, t.map(() => false));
      expect(phi.reduce((a, b) => a + b, 0)).toBeCloseTo(full - empty, 10);
    }
  });
  it('Shapley gives zero to tokens the model ignores (dummy property)', () => {
    const t = tokenize('the quarterly report beat forecasts');
    const phi = shapley(t);
    expect(phi[0]).toBeCloseTo(0, 12); // "the"
  });
  it('LIME recovers the weights of an additive model', () => {
    const w = [0.3, -0.2, 0.5, 0.0, -0.4];
    const f = (m: boolean[]) => m.reduce((s, on, i) => s + (on ? w[i] : 0), 0);
    const est = lime(['a', 'b', 'c', 'd', 'e'], { samples: 800, seed: 3 }, f);
    est.forEach((v, i) => expect(v).toBeCloseTo(w[i], 2));
  });
  it('negation flips the attribution of the sentiment word', () => {
    const t = tokenize('The company did not miss earnings expectations');
    expect(predict(t)).toBeGreaterThan(0.5);
    expect(shapley(t)[t.indexOf('not')]).toBeGreaterThan(0);
  });
  it('reports rank agreement and LIME spread', () => {
    const t = tokenize('Margins improved but debt remains high');
    expect(spearman(shapley(t), lime(t))).toBeGreaterThan(0);
    for (const s of limeStability(t)) expect(s.max).toBeGreaterThanOrEqual(s.min);
  });
});

describe('TOTP (RFC 6238 / 4226 test vectors)', () => {
  const key = new TextEncoder().encode('12345678901234567890');
  it('matches RFC 4226 HOTP vectors', async () => {
    expect(await hotp(key, 0)).toBe('755224');
    expect(await hotp(key, 1)).toBe('287082');
    expect(await hotp(key, 9)).toBe('520489');
  });
  it('matches RFC 6238 SHA-1 vectors (8 digits)', async () => {
    const b32 = base32Encode(key);
    expect(await totp(b32, 59_000, { digits: 8 })).toBe('94287082');
    expect(await totp(b32, 1111111109_000, { digits: 8 })).toBe('07081804');
    expect(await totp(b32, 2000000000_000, { digits: 8 })).toBe('69279037');
  });
  it('round-trips base32 and verifies within ±1 step only', async () => {
    const b32 = base32Encode(key);
    expect(new TextDecoder().decode(base32Decode(b32))).toBe('12345678901234567890');
    const now = 1_700_000_000_000;
    const code = await totp(b32, now);
    expect(await verifyTotp(b32, code, now + 30_000)).toBe(-1);
    expect(await verifyTotp(b32, code, now + 120_000)).toBeNull();
    expect(await verifyTotp(b32, 'abcdef', now)).toBeNull();
  });
});

describe('SecureMed pipeline gates', () => {
  it('ships a clean change', () => expect(runPipeline([]).shipped).toBe(true));
  it('blocks at the first failing gate and skips everything after', () => {
    const r = runPipeline(['vulnerable-dependency', 'misconfigured-header']);
    expect(r.blockedAt).toBe('deps');
    expect(r.results.find((x) => x.gate.id === 'dast')!.status).toBe('skipped');
    expect(r.results.find((x) => x.gate.id === 'deploy')!.status).toBe('skipped');
  });
  it('catches a committed secret before SAST runs', () => expect(runPipeline(['hardcoded-secret', 'sql-injection']).blockedAt).toBe('secrets'));
});

describe('BaSyx import model', () => {
  it('classifies new, identical and conflicting ConceptDescriptions', () => {
    const e = compare(PACKAGES[0], REPOSITORY);
    expect(e.map((x) => x.status)).toEqual(['identical', 'conflict', 'new', 'new']);
    expect(e[1].diff.join(' ')).toMatch(/unit: "V" → "kV"/);
  });
  it('never overwrites a conflict without an explicit decision', () => {
    const entries = compare(PACKAGES[0], REPOSITORY);
    const { repo, report } = apply(REPOSITORY, entries, Object.fromEntries(entries.map((x) => [x.cd.id, defaultDecision(x)])));
    expect(report.overwritten).toHaveLength(0);
    expect(repo.find((r) => r.id === '0173-1#02-SIM002#002')!.unit).toBe('V');
    expect(report.imported).toHaveLength(2);
    const forced = apply(REPOSITORY, entries, { '0173-1#02-SIM002#002': 'import' });
    expect(forced.report.overwritten).toHaveLength(0); // "import" on a conflict is refused
    const ok = apply(REPOSITORY, entries, { '0173-1#02-SIM002#002': 'overwrite' });
    expect(ok.repo.find((r) => r.id === '0173-1#02-SIM002#002')!.unit).toBe('kV');
  });
});
