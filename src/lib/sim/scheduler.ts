// Synthetic reservation scheduler. Demonstrates the problem class of allocating
// shared resources to automation agents: explicit lifecycle states, leases with
// heartbeats, expiry and reclaim, retries with backoff, and allocation strategies.
// It is NOT Nokia code, data or configuration: everything is generated from a seed.
import { rng, type Rng } from './rng';

export type ResState = 'queued' | 'reserved' | 'active' | 'releasing' | 'released' | 'expired' | 'failed';
export const TERMINAL: ResState[] = ['released', 'expired', 'failed'];

/** Allowed lifecycle transitions. Anything else is a bug and throws. */
export const TRANSITIONS: Record<ResState, ResState[]> = {
  queued: ['reserved', 'failed'],
  reserved: ['active', 'expired'],
  active: ['releasing', 'expired', 'failed'],
  releasing: ['released'],
  released: [], expired: [], failed: [],
};

export type Strategy = 'fifo' | 'priority' | 'best-fit';
export type Capability = 'optical' | 'traffic' | 'power' | 'timing';
const CAPS: Capability[] = ['optical', 'traffic', 'power', 'timing'];

export type Resource = { id: string; caps: Capability[]; online: boolean; offlineUntil: number; holder: string | null };
export type Agent = { id: string; alive: boolean; restartAt: number };
export type Reservation = {
  id: string; agent: string; need: Capability; priority: 1 | 2 | 3; duration: number;
  state: ResState; resource: string | null; createdAt: number; reservedAt?: number; startedAt?: number;
  lastHeartbeat?: number; endedAt?: number; attempt: number; notBefore: number; history: { t: number; state: ResState }[];
};
export type SimEvent = { t: number; kind: 'submit' | 'reserve' | 'start' | 'release' | 'expire' | 'fail' | 'retry' | 'fault' | 'recover'; text: string; rid?: string; resource?: string };
export type SimConfig = { seed: number; resources: number; agents: number; strategy: Strategy; arrival: number; leaseTtl: number; claimTimeout: number; maxRetries: number };
export type Metrics = { tick: number; completed: number; expired: number; failed: number; retries: number; queued: number; active: number; utilization: number; avgWait: number; maxQueue: number };

export const DEFAULT_CONFIG: SimConfig = { seed: 2026, resources: 8, agents: 6, strategy: 'priority', arrival: 0.16, leaseTtl: 3, claimTimeout: 2, maxRetries: 3 };

export class SchedulerSim {
  readonly cfg: SimConfig;
  private r: Rng;
  t = 0;
  resources: Resource[];
  agents: Agent[];
  reservations: Reservation[] = [];
  events: SimEvent[] = [];
  busyTicks = 0;
  maxQueue = 0;
  private seq = 0;

  constructor(cfg: Partial<SimConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.r = rng(this.cfg.seed);
    this.resources = Array.from({ length: this.cfg.resources }, (_, i) => {
      const caps = CAPS.filter(() => this.r.chance(0.45));
      if (!caps.length) caps.push(CAPS[i % CAPS.length]);
      return { id: `R-${String(i + 1).padStart(2, '0')}`, caps, online: true, offlineUntil: 0, holder: null };
    });
    this.agents = Array.from({ length: this.cfg.agents }, (_, i) => ({ id: `agent-${String.fromCharCode(97 + i)}`, alive: true, restartAt: 0 }));
  }

  private log(e: Omit<SimEvent, 't'>) { this.events.push({ t: this.t, ...e }); if (this.events.length > 400) this.events.shift(); }

  private set(res: Reservation, next: ResState) {
    if (!TRANSITIONS[res.state].includes(next)) throw new Error(`invalid transition ${res.state} → ${next} for ${res.id}`);
    res.state = next;
    res.history.push({ t: this.t, state: next });
  }

  private free(res: Reservation) {
    const r = this.resources.find((x) => x.id === res.resource);
    if (r && r.holder === res.id) r.holder = null;
  }

  submit(agent: string, need?: Capability, priority?: 1 | 2 | 3, duration?: number): Reservation {
    const capsAvailable = [...new Set(this.resources.flatMap((r) => r.caps))];
    const res: Reservation = {
      id: `RSV-${String(++this.seq).padStart(3, '0')}`, agent, need: need ?? this.r.pick(capsAvailable),
      priority: priority ?? (this.r.pick([1, 2, 2, 3, 3, 3]) as 1 | 2 | 3), duration: duration ?? this.r.int(3, 9),
      state: 'queued', resource: null, createdAt: this.t, attempt: 0, notBefore: this.t, history: [{ t: this.t, state: 'queued' }],
    };
    this.reservations.push(res);
    this.log({ kind: 'submit', text: `${agent} requests a ${res.need} resource (P${res.priority}, ${res.duration}t)`, rid: res.id });
    return res;
  }

  /** Inject a fault: crash an agent (stops heartbeats) or take a resource offline. */
  inject(kind: 'crash-agent' | 'resource-offline' | 'burst', target?: string) {
    if (kind === 'crash-agent') {
      const live = this.agents.filter((a) => a.alive && this.reservations.some((r) => r.agent === a.id && ['reserved', 'active'].includes(r.state)));
      const a = this.agents.find((x) => x.id === target) ?? live[0] ?? this.agents.find((x) => x.alive);
      if (!a) return;
      a.alive = false; a.restartAt = this.t + 8;
      this.log({ kind: 'fault', text: `${a.id} crashed: its leases will stop receiving heartbeats` });
    } else if (kind === 'resource-offline') {
      const busy = this.resources.filter((x) => x.online && x.holder);
      const r = this.resources.find((x) => x.id === target) ?? busy[0] ?? this.resources.find((x) => x.online);
      if (!r) return;
      r.online = false; r.offlineUntil = this.t + 10;
      this.log({ kind: 'fault', text: `${r.id} went offline (hardware fault)`, resource: r.id });
      const held = this.reservations.find((x) => x.id === r.holder);
      if (held && ['reserved', 'active'].includes(held.state)) this.failAndRetry(held, `${r.id} failed underneath it`);
      r.holder = null;
    } else {
      for (let i = 0; i < 6; i++) this.submit(this.r.pick(this.agents.filter((a) => a.alive).map((a) => a.id)) ?? this.agents[0].id);
      this.log({ kind: 'fault', text: 'burst: 6 simultaneous requests' });
    }
  }

  private failAndRetry(res: Reservation, why: string) {
    if (res.state === 'reserved') this.set(res, 'expired'); else this.set(res, 'failed');
    res.endedAt = this.t;
    this.free(res);
    this.log({ kind: 'fail', text: `${res.id} interrupted: ${why}`, rid: res.id, resource: res.resource ?? undefined });
    if (res.attempt < this.cfg.maxRetries) {
      const retry = this.submit(res.agent, res.need, res.priority, res.duration);
      retry.attempt = res.attempt + 1;
      retry.notBefore = this.t + 2 ** retry.attempt; // exponential backoff
      this.log({ kind: 'retry', text: `${retry.id} retries ${res.id} (attempt ${retry.attempt}, backoff ${2 ** retry.attempt}t)`, rid: retry.id });
    }
  }

  private pickResource(res: Reservation): Resource | undefined {
    const candidates = this.resources.filter((r) => r.online && !r.holder && r.caps.includes(res.need));
    if (!candidates.length) return undefined;
    if (this.cfg.strategy === 'best-fit') return [...candidates].sort((a, b) => a.caps.length - b.caps.length || a.id.localeCompare(b.id))[0];
    return candidates[0];
  }

  private queueOrder(): Reservation[] {
    const q = this.reservations.filter((r) => r.state === 'queued' && r.notBefore <= this.t);
    if (this.cfg.strategy === 'fifo') return q.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    // priority (and best-fit) order: priority first, then age, so nothing starves forever
    return q.sort((a, b) => (a.priority - (this.t - a.createdAt) / 12) - (b.priority - (this.t - b.createdAt) / 12) || a.id.localeCompare(b.id));
  }

  step(): void {
    this.t++;
    // 1. recover agents/resources
    for (const a of this.agents) if (!a.alive && a.restartAt <= this.t) { a.alive = true; this.log({ kind: 'recover', text: `${a.id} restarted` }); }
    for (const r of this.resources) if (!r.online && r.offlineUntil <= this.t) { r.online = true; this.log({ kind: 'recover', text: `${r.id} back online`, resource: r.id }); }
    // 2. heartbeats, claims, completion, lease expiry
    for (const res of this.reservations) {
      const agentAlive = this.agents.find((a) => a.id === res.agent)!.alive;
      if (res.state === 'releasing') { this.set(res, 'released'); res.endedAt = this.t; this.free(res); this.log({ kind: 'release', text: `${res.id} released ${res.resource}`, rid: res.id, resource: res.resource! }); continue; }
      if (res.state === 'reserved') {
        if (agentAlive) { this.set(res, 'active'); res.startedAt = this.t; res.lastHeartbeat = this.t; this.log({ kind: 'start', text: `${res.agent} claimed ${res.resource} for ${res.id}`, rid: res.id }); }
        else if (this.t - (res.reservedAt ?? this.t) >= this.cfg.claimTimeout) { this.set(res, 'expired'); res.endedAt = this.t; this.free(res); this.log({ kind: 'expire', text: `${res.id} never claimed: lease expired, ${res.resource} reclaimed`, rid: res.id, resource: res.resource! }); }
        continue;
      }
      if (res.state === 'active') {
        if (agentAlive) res.lastHeartbeat = this.t;
        if (this.t - (res.lastHeartbeat ?? this.t) > this.cfg.leaseTtl) {
          this.set(res, 'expired'); res.endedAt = this.t; this.free(res);
          this.log({ kind: 'expire', text: `${res.id} missed heartbeats for ${this.cfg.leaseTtl}t: lease expired, ${res.resource} reclaimed`, rid: res.id, resource: res.resource! });
        } else if (agentAlive && this.t - (res.startedAt ?? this.t) >= res.duration) {
          this.set(res, 'releasing');
        }
      }
    }
    // 3. arrivals
    for (const a of this.agents) {
      const inflight = this.reservations.filter((x) => x.agent === a.id && !TERMINAL.includes(x.state)).length;
      if (a.alive && inflight < 2 && this.r.chance(this.cfg.arrival)) this.submit(a.id);
    }
    // 4. allocate
    for (const res of this.queueOrder()) {
      const target = this.pickResource(res);
      if (!target) continue;
      target.holder = res.id;
      res.resource = target.id;
      res.reservedAt = this.t;
      this.set(res, 'reserved');
      this.log({ kind: 'reserve', text: `${res.id} → ${target.id} (${this.cfg.strategy})`, rid: res.id, resource: target.id });
    }
    // 5. bookkeeping
    this.busyTicks += this.resources.filter((r) => r.holder).length;
    this.maxQueue = Math.max(this.maxQueue, this.reservations.filter((r) => r.state === 'queued').length);
    this.assertInvariants();
  }

  run(ticks: number) { for (let i = 0; i < ticks; i++) this.step(); return this; }

  /** Safety properties checked every tick (and by the unit tests). */
  assertInvariants() {
    const holders = new Map<string, string>();
    for (const res of this.reservations) {
      if (['reserved', 'active', 'releasing'].includes(res.state)) {
        if (!res.resource) throw new Error(`${res.id} holds no resource in state ${res.state}`);
        const other = holders.get(res.resource);
        if (other) throw new Error(`double booking: ${res.resource} held by ${other} and ${res.id}`);
        holders.set(res.resource, res.id);
      }
    }
    for (const r of this.resources) if (r.holder && !holders.has(r.id)) throw new Error(`${r.id} has a stale holder ${r.holder}`);
  }

  metrics(): Metrics {
    const waits = this.reservations.filter((r) => r.reservedAt !== undefined).map((r) => r.reservedAt! - r.createdAt);
    return {
      tick: this.t,
      completed: this.reservations.filter((r) => r.state === 'released').length,
      expired: this.reservations.filter((r) => r.state === 'expired').length,
      failed: this.reservations.filter((r) => r.state === 'failed').length,
      retries: this.reservations.filter((r) => r.attempt > 0).length,
      queued: this.reservations.filter((r) => r.state === 'queued').length,
      active: this.reservations.filter((r) => ['reserved', 'active', 'releasing'].includes(r.state)).length,
      utilization: this.t ? this.busyTicks / (this.t * this.resources.length) : 0,
      avgWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
      maxQueue: this.maxQueue,
    };
  }
}
