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

## Festival tools (all hardcoded, no database)

| Page | What it does | Data |
|---|---|---|
| `/routes`, `/routes/[circuit]` | Curated pandal-hopping circuits: map, stop-by-stop waits, walking links | `src/lib/routes.ts` (`CIRCUITS`) |
| `/plan` → `/r/1-5-7` | Route builder; the whole route lives in the URL | mandal directory |
| `/visarjan` | Immersion dates, Lalbaugcha Raja procession route (not live), closures, old bridges, helplines | `src/data/visarjan.json` |
| `/visarjan/ponds` | Immersion spot finder, "near me" sorted in the browser | `src/data/immersion-sites.json` |
| `/trains` | Night special locals, metro/BEST hours, railway advisories | `src/data/trains.json` |
| `/guide` | First-timer guide: mukh darshan vs navas line, safety | `src/messages/*.json` (`guide`) |

**Data rules** for `src/data/*.json`: every record has a `sourceId` that
points at an entry in that file's `sources` (with a URL) and a `year`.
Anything not from 2026 is labelled as such in the UI. If the 2026 notice
isn't out, keep last year's data *labelled*, never re-dated. `npm test`
fails on a dangling `sourceId`. To update, edit the JSON and redeploy.

**Sharing**: every shareable page sets an explicit `og:image` served from
`/api/og/…` (1200×630) and offers WhatsApp / share-sheet / copy buttons.
Mandal and route pages also get a 1080×1920 status image at `/api/story/…`.
Images are English-only because Satori can't shape Devanagari; the
WhatsApp message text is localized. Mandal cards embed a time-stamped
estimate, so they're cached for 5 minutes only.

**Analytics**: share links carry `utm_source` (`whatsapp`, `native`, `copy`)
+ `utm_medium=share`, and clicks fire a Vercel Web Analytics `share` event.
Enable Web Analytics on the Vercel project; nothing is stored by the app.
Set `NEXT_PUBLIC_SITE_URL` to the production domain so previews and share
links use it.

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

## Getting more mandals in (the "BMC list")

The MCGM/BMC Ganeshotsav portal is an **application system, not a public
dataset** — there is no downloadable list of the ~2,500 approved mandals
(verified: BMC portal, data.gov.in/opencity, BGSS, OSM Overpass, Wikipedia
were all checked). What exists instead:

- `src/db/press-mandals.json` — a press/official-site-verified dataset
  (every entry carries its source URLs). Apply it with
  `npx tsx scripts/import-press.ts` **after** `db:seed`: it inserts the
  sourced mandals, applies sourced corrections, and geocodes stated venues
  into approximate "≈" pins (strict name-match only).
- The CSV importer below, for the day you obtain the real ward-wise list
  (ward office, RTI, or portal access):

```bash
npm run db:import -- path/to/mandals.csv
# columns: name,area[,nameMr,nameHi,tier,nearestStation,lat,lng]
```

Imported `lat`/`lng` are treated as **approximate mandal locations** (shown
as distinct "≈" ring markers), never as queue-start pins. Two helper scripts
try open sources for locations — `npm run geocode` (OSM/Nominatim) — but
accept a result only when the name genuinely matches; everything else stays
unpinned until someone drops a verified pin in `/admin` (each editor row has
a "Find on Google Maps" cross-check link, so pinning all 15 seeded mandals
takes ~10 minutes).

## Operating during the festival

- Reports land as `pending`; accept/reject in `/admin`. Accepting one flips
  that queue to `Reported N min ago` for 90 minutes and refreshes ISR + Redis.
- `completed_wait` reports store the heuristic's claim at report time — the
  calibration paper trail for next year. Don't delete them.
