import { Redis } from '@upstash/redis';

let warned = false;

/**
 * Upstash is optional in local dev (rate limiting no-ops, snapshot falls
 * back to Postgres). In production it is REQUIRED — it is what keeps
 * /api/snapshot.json and the report endpoint off Postgres during spikes.
 */
export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warned && process.env.NODE_ENV === 'production') {
      console.warn('[redis] UPSTASH_REDIS_REST_URL/TOKEN not set — running without Redis!');
      warned = true;
    }
    return null;
  }
  return Redis.fromEnv();
}
