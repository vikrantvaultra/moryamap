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
