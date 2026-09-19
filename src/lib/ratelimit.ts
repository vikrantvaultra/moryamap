import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';

let limiter: Ratelimit | null | undefined;

/** 3 reports per IP hash per hour per queue. Null (no-op) when Redis is absent in dev. */
export function getReportLimiter(): Ratelimit | null {
  if (limiter === undefined) {
    const redis = getRedis();
    limiter = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(3, '1 h'),
          prefix: 'morya:rl:report',
        })
      : null;
  }
  return limiter;
}

let sevaLimiter: Ratelimit | null | undefined;

/** 12 Razorpay QR codes / orders per IP hash per hour. Null (no-op) without Redis. */
export function getSevaLimiter(): Ratelimit | null {
  if (sevaLimiter === undefined) {
    const redis = getRedis();
    sevaLimiter = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(12, '1 h'),
          prefix: 'morya:rl:seva',
        })
      : null;
  }
  return sevaLimiter;
}

let restoreLimiter: Ratelimit | null | undefined;

/** 10 restore-code attempts per IP hash per hour, so codes can't be guessed. */
export function getRestoreLimiter(): Ratelimit | null {
  if (restoreLimiter === undefined) {
    const redis = getRedis();
    restoreLimiter = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(10, '1 h'),
          prefix: 'morya:rl:restore',
        })
      : null;
  }
  return restoreLimiter;
}
