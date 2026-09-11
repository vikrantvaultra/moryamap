# Morya Map

Mobile-first web app for Ganesh Chaturthi 2026 in Mumbai (**14–25 September**).
Three jobs: where the famous mandals are (and where their **darshan queue
starts**), logistics to get there, and an **honest** queue-time estimate.

## Honesty rules (product requirements, not suggestions)

- **No fabricated live data. Ever.** No random numbers, no seeded fake reports.
- Every wait figure is a **range** (`3–7 hrs`, never `4 hrs 20 min`) with an
  always-visible provenance label:
  - `Estimate — based on past festivals, not live`
  - `Reported 25 min ago by a visitor`
- Crowd reports **expire after 90 minutes** → automatic fallback to heuristic.
- Mandals are **never ranked by shortest queue** — steering crowds is a safety
  hazard. Area/popularity order only.
- The elders/children disclaimer accompanies every wait figure.
- Coordinates are seeded `NULL`; pins are dropped in `/admin` after ground
  verification. **A wrong pin in a crowd is worse than no pin.**

## Stack

Next.js 15 (App Router, RSC), Tailwind v4, Drizzle + Postgres (Neon),
Upstash Redis, MapLibre GL + OpenFreeMap tiles, next-intl (en / मराठी / हिंदी),
Vitest. Deployed on Vercel pinned to `bom1`.

## Architecture in one paragraph

Public pages are **ISR (`revalidate = 60`)** — the CDN absorbs festival-evening
spikes and the origin sees ~1 req/min/page; nothing public is force-dynamic.
`/api/snapshot.json` serves from an Upstash-cached state blob (5-min TTL,
rebuilt on any accepted report or admin edit via `revalidateTag('queues')`)
with `s-maxage=60` CDN caching, so Postgres is nearly idle even during spikes.
Wait figures are computed from the pure estimator in `src/lib/wait.ts` at
serve time, so hour factors and report expiry always use the current clock.
MapLibre is code-split (`next/dynamic`, `ssr: false`); every page is fully
usable with JS disabled except the map itself.

## Local setup

```bash
cp .env.example .env          # fill in values (see below)
npm install
npm run db:migrate            # uses DATABASE_URL_UNPOOLED (direct)
npm run db:seed               # 15 mandals, null coords by design
npm run dev
```

Local Postgres via Docker if you don't want Neon yet:

```bash
docker run -d --name moryamap-pg -e POSTGRES_PASSWORD=morya \
  -e POSTGRES_DB=moryamap -p 54329:5432 postgres:16-alpine
# .env:
# DATABASE_URL=postgres://postgres:morya@localhost:54329/moryamap
# DATABASE_URL_UNPOOLED=postgres://postgres:morya@localhost:54329/moryamap
```

Upstash vars are optional in dev (rate limiting no-ops, snapshot falls back to
Postgres) but **required in production**.

## Tests

```bash
npm test        # Vitest — the estimator is fully unit-tested
npm run build   # must stay green; survives a missing DATABASE_URL
```

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | **Pooled** (pgbouncer) Neon string — runtime |
| `DATABASE_URL_UNPOOLED` | Direct Neon string — migrations only |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Snapshot cache + rate limiting |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Basic auth for `/admin` |
| `IP_HASH_SALT` | Long random string; salts reporter IP/UA hashes |

## Deploy checklist (before 14 Sep)

1. Neon project → copy **pooled** and direct connection strings.
2. Upstash Redis (region: `ap-south-1` ideally) → REST URL + token.
3. Vercel project → set all env vars → deploy. `vercel.json` pins `bom1`.
4. **Upgrade to Vercel Pro before 14 September.** Hobby has no headroom and no
   support path at 9pm on day one.
5. `npm run db:migrate && npm run db:seed` against Neon (unpooled URL).
6. Open `/admin` → drop verified pins, fill Lalbaugcha Raja's holding-point
   landmarks + implied minutes.
7. Sanity-check `/api/snapshot.json` returns `provenance: "estimate"` figures.

## Operating during the festival

- Reports land as `pending`; accept/reject in `/admin`. Accepting one flips
  that queue to `Reported N min ago` for 90 minutes and refreshes ISR + Redis.
- `completed_wait` reports store the heuristic's claim at report time — the
  calibration paper trail for next year. Don't delete them.
