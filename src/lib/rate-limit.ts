import { env } from "./config";
import { log } from "./log";

// Simple sliding-window rate limiter for abuse protection on expensive endpoints
// (upload). Uses Redis when REDIS_URL is set (multi-instance safe); otherwise an
// in-memory Map (fine for single-process / docker-compose local).

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

type Window = { count: number; resetAt: number };

const memory = new Map<string, Window>();

function memoryTake(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || now >= cur.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true, remaining: limit - cur.count };
}

let redis: import("ioredis").default | null | undefined;

async function getRedis(): Promise<import("ioredis").default | null> {
  if (redis !== undefined) return redis;
  if (!env.REDIS_URL) {
    redis = null;
    return null;
  }
  try {
    const Redis = (await import("ioredis")).default;
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    await redis.connect();
    return redis;
  } catch (err) {
    log.warn("ratelimit.redis_unavailable", { err });
    redis = null;
    return null;
  }
}

async function redisTake(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const r = await getRedis();
  if (!r) return null;
  const redisKey = `rl:${key}`;
  try {
    const count = await r.incr(redisKey);
    if (count === 1) await r.pexpire(redisKey, windowMs);
    if (count > limit) {
      const ttl = await r.pttl(redisKey);
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)),
      };
    }
    return { ok: true, remaining: Math.max(0, limit - count) };
  } catch (err) {
    log.warn("ratelimit.redis_error", { err });
    return null;
  }
}

export async function takeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const viaRedis = await redisTake(key, limit, windowMs);
  if (viaRedis) return viaRedis;
  return memoryTake(key, limit, windowMs);
}

/** Upload: short burst + hourly cap. Key should include userId (and optionally IP). */
export async function assertUploadRateLimit(userId: string, ip?: string): Promise<RateLimitResult> {
  const id = ip ? `${userId}:${ip}` : userId;
  const burst = await takeRateLimit(
    `upload:min:${id}`,
    env.RATE_LIMIT_UPLOAD_PER_MINUTE,
    60_000,
  );
  if (!burst.ok) return burst;
  return takeRateLimit(`upload:hr:${id}`, env.RATE_LIMIT_UPLOAD_PER_HOUR, 3_600_000);
}
