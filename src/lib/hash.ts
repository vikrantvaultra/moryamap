import { createHash } from 'node:crypto';

/** Salted, truncated hashes — enough for rate limiting and moderation, no PII stored. */
export function hashWithSalt(value: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'morya-dev-salt';
  return createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 32);
}

export function clientIpFrom(h: Headers): string {
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}
