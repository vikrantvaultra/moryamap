import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * DATABASE_URL must be Neon's POOLED (pgbouncer) connection string in
 * production — a direct connection exhausts Postgres the moment serverless
 * concurrency rises. `prepare: false` is required for pgbouncer transaction
 * pooling; `max: 1` because each serverless instance is single-request.
 */
export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Use the pooled (pgbouncer) Neon connection string.',
      );
    }
    const client = postgres(url, { prepare: false, max: 1 });
    _db = drizzle(client, { schema });
  }
  return _db;
}
