// Abuse and spend protection for the experimental Worker.
// LIMITATION: Workers KV is eventually consistent and these counters are read-modify-write,
// so concurrent requests (or requests in different locations) can all pass the same check.
// The daily budget is therefore a SOFT guard, not a guaranteed hard cap. A real hard cap needs
// an atomic admission point (one Durable Object that reserves worst-case cost per request) plus
// a spend limit on the provider workspace. See worker/README.md.
import type { Usage } from './agent';

export type Limits = { perMinute: number; perHour: number; perDay: number; dailyBudgetUsd: number };
export const DEFAULT_LIMITS: Limits = { perMinute: 4, perHour: 20, perDay: 400, dailyBudgetUsd: 3 };

// USD per million tokens. Unknown models are priced like the most expensive listed one (fail safe).
// Source: platform.claude.com/docs/en/about-claude/pricing (checked 2026-11-18; Haiku 5.5 prompts ≤ 100K tokens).
const PRICES: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  'claude-sonnet-5-5': { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-opus-5-5': { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 },
};
const FALLBACK_PRICE = { in: 10, out: 50, cacheWrite: 12.5, cacheRead: 1 };

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  return (u.input * p.in + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead + u.output * p.out) / 1e6;
}

const day = (now: number) => new Date(now).toISOString().slice(0, 10);

export type LimitResult = { ok: true } | { ok: false; status: 429; retryAfter: number; message: string };

/** Check and count one request for `ip`. Budget is checked against what has been spent today. */
export async function checkLimits(kv: KVNamespace, ip: string, limits: Limits, now = Date.now()): Promise<LimitResult> {
  const minute = Math.floor(now / 60_000), hour = Math.floor(now / 3_600_000), d = day(now);
  const keys = { min: `rl:${ip}:m:${minute}`, hr: `rl:${ip}:h:${hour}`, day: `rl:global:d:${d}`, spend: `spend:${d}` };
  const [m, h, g, spend] = await Promise.all([kv.get(keys.min), kv.get(keys.hr), kv.get(keys.day), kv.get(keys.spend)]);
  const n = (v: string | null) => Number.parseFloat(v ?? '0') || 0;
  if (n(spend) >= limits.dailyBudgetUsd) return { ok: false, status: 429, retryAfter: 3600, message: 'The live agent has used today’s budget.' };
  if (n(g) >= limits.perDay) return { ok: false, status: 429, retryAfter: 3600, message: 'The live agent has reached today’s request limit.' };
  if (n(m) >= limits.perMinute) return { ok: false, status: 429, retryAfter: 60, message: 'Too many questions in a minute.' };
  if (n(h) >= limits.perHour) return { ok: false, status: 429, retryAfter: 1800, message: 'Hourly question limit reached.' };
  await Promise.all([
    kv.put(keys.min, String(n(m) + 1), { expirationTtl: 120 }),
    kv.put(keys.hr, String(n(h) + 1), { expirationTtl: 7200 }),
    kv.put(keys.day, String(n(g) + 1), { expirationTtl: 172_800 }),
  ]);
  return { ok: true };
}

export async function recordSpend(kv: KVNamespace, usd: number, now = Date.now()): Promise<number> {
  const key = `spend:${day(now)}`;
  const total = (Number.parseFloat((await kv.get(key)) ?? '0') || 0) + usd;
  await kv.put(key, total.toFixed(6), { expirationTtl: 172_800 });
  return total;
}

export function limitsFrom(env: { RL_PER_MINUTE?: string; RL_PER_HOUR?: string; RL_PER_DAY?: string; DAILY_BUDGET_USD?: string }): Limits {
  const num = (v: string | undefined, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  return {
    perMinute: num(env.RL_PER_MINUTE, DEFAULT_LIMITS.perMinute),
    perHour: num(env.RL_PER_HOUR, DEFAULT_LIMITS.perHour),
    perDay: num(env.RL_PER_DAY, DEFAULT_LIMITS.perDay),
    dailyBudgetUsd: num(env.DAILY_BUDGET_USD, DEFAULT_LIMITS.dailyBudgetUsd),
  };
}
