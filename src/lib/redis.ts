import { Redis } from '@upstash/redis';

let warned = false;

/**
 * Upstash is optional in local dev (rate limiting no-ops, snapshot falls
 * back to Postgres). In production it is REQUIRED — it is what keeps
 * /api/snapshot.json and the report endpoint off Postgres during spikes.
 *
 * The Vercel Marketplace integration names them KV_REST_API_URL/TOKEN;
 * Redis.fromEnv() reads either pair.
 */
export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    if (!warned && process.env.NODE_ENV === 'production') {
      console.warn('[redis] UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN) not set — running without Redis!');
      warned = true;
    }
    return null;
  }
  return Redis.fromEnv();
}
