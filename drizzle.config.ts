import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Migrations use the UNPOOLED (direct) connection string — pgbouncer's
// transaction pooling breaks DDL in migrations. Runtime uses the pooled one.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
