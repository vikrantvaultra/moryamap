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

## Mandal directory (hardcoded, no database)

The site serves `src/db/static-directory.json` — **417 mandals, every one of
them pinned and on both the map and the list**. Every pin is labelled by
precision (rooftop-verified, unverified street, or neighbourhood only) and
never as a queue start.

Four sources feed it, in this order of trust:

| Source | Rows | How |
|---|---|---|
| `curated-mandals.json` | 20 | Hand-curated: मराठी/हिंदी names, stations, tiers, queues, notes |
| `community-mandals.csv` | 127 | Verified community dataset — read `community-mandals.README.md`, including its Google Places licensing caveat |
| `osm-mandals.json` | 11 | OpenStreetMap features that are genuinely utsav mandals (`scripts/osm-mandals.ts` finds candidates; promoting one is a human call) |
| `scraped-mandals.json` | 278 | The public Ganeshotsav directories, via `scripts/scrape-mandals.ts` |

Rebuild in this order — the second step needs the slugs the first one mints:

```bash
npx tsx scripts/scrape-mandals.ts    # refresh the scraped set (network)
npx tsx scripts/build-directory.ts   # merge everything into the directory
npx tsx scripts/assign-wards.ts      # stamp each mandal's BMC ward (network)
npm test                             # the directory checks run here
```

`npm test` fails on a duplicate id/slug/name, a duplicate rooftop
address/pin, an unpinned mandal, or a mandal with no ward. Street and
neighbourhood pins are *allowed* to coincide: nine mandals share one
Khetwadi lane and pretending otherwise would mean inventing coordinates.

### Wards

Every mandal carries a `ward` — its BMC ward (`A`, `F/S`, `K/E`, …) or, for
the MMR ones, its municipal corporation (`Thane`, `Navi Mumbai`, `Panvel`,
`Mira-Bhayander`, `Dombivali`, …). `scripts/assign-wards.ts` derives it by
point-in-polygon against OpenStreetMap admin boundaries (ODbL) and records
the provenance in `ward-pins.json`; the boundaries are fetched at run time
rather than vendored, because 1.2 MB of ring coordinates has no business in
the repo when only the label ships.

Ward is the browse axis for the map and the list. `area` is free-text
locality — 174 distinct values across 417 mandals — which is too fine to
filter by; there are exactly 24 wards, and they're how BMC and the police
actually carve up Ganeshotsav. `src/lib/wards.ts` rolls them up into four
regions (Island City / Western Suburbs / Eastern Suburbs / Beyond Mumbai).

### Map and list at this size

The map plots a **clustered GeoJSON source**, not one DOM marker per pin —
417 markers janks a mid-range phone on pan, and the directory only grows.
Clusters break apart by zoom 14 (`clusterRadius: 38`) so the dense Khetwadi
and Lalbaug lanes separate rather than staying one dot. Both views filter by
region → ward and search across name, alias, area, ward and station; the
list groups by ward, then area, and has a "show all" escape hatch so nothing
is reachable only through pagination.

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

## Bappa's ashirwad (`/ashirwad`, ₹501)

A standalone page (outside the locale tree, like `/darshan`) that sells a
digital darshan for a ₹501 offering. The devotee writes the names they are
praying for. When the payment clears they see a receipt, the shankh is blown,
their name travels into Bappa's ear, and Bappa blesses them with light,
petals, the bell and "Ganpati Bappa Morya!".

- **Payment**: the same Razorpay UPI QR / Checkout machinery as seva and
  darshan, via `src/lib/unlock.ts`. Every signed token is scoped to its flow,
  so a ₹21 seva pass or order id cannot open the ₹501 page.
- **Honesty**: the only urgency is the real date (Anant Chaturdashi, 25
  September). The devotee count shows only real payments, and only from 21.
  The page names the payee and says plainly that this is not a puja.
- **Discovery**: a chip in the tools row and footer, a card on the home list
  and on every mandal page, and the home floating callout (immersion-day
  banners keep priority). These appear only once payments are configured and
  the artwork exists.
- **Artwork and sounds**: see `src/assets/ashirwad/README.md`, which covers
  licences, credits, swapping in your own image and adding a recorded chant.
- **Local test mode**: under `npm run dev`, the ₹501 button opens the
  darshan without payment, and a "Lock again" button resets it so you can
  retry. On a phone, open `http://<your-laptop-ip>:3000/ashirwad` on the same
  Wi-Fi. It never runs on Vercel or under `next start`, which both use
  NODE_ENV=production. To test real Razorpay payments locally, set
  `ASHIRWAD_DEV_PAYMENTS=1`.
- **The chant** uses the best Indian voice on the device (Google
  Marathi/Hindi first, then any Hindi/Marathi, then Indian English), spoken
  call-and-response. It never falls back to a US/UK voice.
  `public/ashirwad/morya.m4a` replaces it with a real recording.

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
| `RAZORPAY_KEY_ID` / `_SECRET` | Seva gate payments (the account must belong to `SEVA_BENEFICIARY`) |
| `SEVA_BENEFICIARY` | Mandal/trust named in the popup; gate is off unless all three are set |
| `RAZORPAY_WEBHOOK_SECRET` | Optional; webhook at `/api/donate/webhook` (`qr_code.credited`, `payment.captured`) |

## Seva gate

Five seconds after a visitor first arrives, `SevaGate` opens a popup that
can't be closed, asking for a UPI offering (₹11/21/51/101) to
`SEVA_BENEFICIARY`. On desktop it shows a single-use Razorpay UPI QR; on
phones it leads with Razorpay Checkout's UPI-app flow. Payment is confirmed
server-side (Checkout signature, webhook mark in Redis, or the Razorpay API,
throttled per id), then a signed `morya_seva` cookie unlocks that device for
a year. No login. Pages stay ISR: the gate is a client overlay, so it can be
bypassed with devtools or with JS disabled. The popup always shows a
tap-to-call 112 link.

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

**There is still no public list of every Mumbai mandal, and 417 is not it.**
Re-verified on 19 September 2026: the MCGM/BMC Ganeshotsav portal is an
application system with no downloadable register; `data.opencity.in` returns
zero datasets for *ganesh*, *mandal*, *pandal* or *ganeshotsav*; and an
Overpass sweep of the whole MMR bounding box returns ~440 features whose
name mentions Ganesh/Ganpati/mandal, of which about a dozen are actual utsav
mandals. BMC permits roughly 2,500–3,000 sarvajanik mandals a season — over
1,000 of them were still awaiting their 2026 permission four days before the
festival — and housing-society and galli installations aren't counted at all.

So what 417 means: **every Mumbai mandal that any public source lists
individually, with a location**, pulled from all four sources above. The
remaining routes to real completeness all need a person to ask:

1. **BMC one-window permission data** — the authoritative register, held per
   ward office. An RTI or a ward-level ask gets names and addresses.
2. **Mumbai Police zone lists**, published before visarjan for route planning.
3. **User submissions** — a moderated "add a missing mandal" form. For a
   wait-time product you need contributors anyway.
4. **Brihanmumbai Sarvajanik Ganeshotsav Samanvay Samiti**'s member roster.

The home page says a version of this to visitors, under "How complete is
this list?" — the count is not presented as the whole city.

What exists in the repo today:

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
