# Mumbai Ganesh Mandals — dataset notes

Rebuilt 13 Sep 2026, one day before Ganesh Chaturthi (14 Sep; visarjan 25 Sep).

## Files

| File | Rows | Use |
|---|---|---|
| `Mumbai-Ganesh-Mandals-With-Coords.csv` | 127 | Ship this. 105 rooftop-verified + 22 unverified-but-real-name |
| `Mumbai-Ganesh-Mandals-NEEDS-REVIEW.csv` | 56 | Do not ship. Placeholder names pulled out of the original file |

Launch set: `WHERE verification = 'verified'` → 105 pins you can defend.

## Schema

| Column | Notes |
|---|---|
| `mandal_name` | Primary name as listed on Google |
| `also_known_as` | Popular alias — `Mumbaicha Raja`, `Fortcha Raja`, `Andheri Cha Morya`. Index this for search |
| `area` | Locality, for filters and clustering |
| `address` | Full street address |
| `latitude` / `longitude` | WGS84 |
| `place_id` | Google Place ID. Stable, permanently storable, and your re-query key |
| `coord_source` | `google_places` or `prior_file` |
| `coord_precision` | `rooftop`, `area_centroid`, `unknown` |
| `verification` | `verified` or `unverified` |
| `qa_flag` | Populated when a row failed a sanity check |

## What changed

- **105 rows replaced with rooftop coordinates** resolved via Google Places, each carrying a `place_id`.
- **41 duplicate rows collapsed.** The original had the same mandal under several names — `Mumbai Cha Raja` / `Lalbaug Sarvajanik Utsav Mandal` / `Mumbaicha Raja` are one mandal at Ganesh Galli; `Sahyadri Krida Mandal` appeared twice at identical coordinates; `Andhericha Raja` / `Azad Nagar Sarvajanik Utsav Samiti` / `Andheri West Sarvajanik Ganeshotsav Mandal` were three rows for one pandal.
- **56 rows quarantined.** Names of the form `<Locality> Sarvajanik Ganeshotsav Mandal` — `Worli Sarvajanik Ganeshotsav Mandal`, `Bandra West Sarvajanik Ganeshotsav Mandal` — are not mandals that exist under those names. They look like generated filler. Several sat on area centroids, so the pin was fabricated too.
- **One bad coordinate caught.** `Bhandup Jay Bajrang Mitra Mandal` was plotted 7.8 km from Bhandup, down near Chembur. Flagged, not fixed.

## Genuinely new entries

Names absent from the original that are among the city's most-visited: Kalachowkicha Mahaganpati, Abhyudaya Nagar cha Raja, Girgaon Cha Maharaja (Mugbhat Lane), Khetwadicha Raja, Khetwadi Cha Moraya, Khetwadi Cha Ganadhish, Mumbai cha Samrat, Colaba Cha Raja, Colabacha Yuvraj, Colaba cha Samrat, Chembur Cha Raja, Ghatkopar Cha Raja, Powaicha Raja, Mulund Cha Raja, Upnagarcha Raja, Borivalicha Maharaja, Charkop Cha Raja, Goregaoncha Raja, Maladcha Raja, Dahisar Cha Raja, Cotton Cha Raja, Dukes Cha Raja, Bhoiwadyacha Maharaja, Parelcha Maharaja.

## Coverage — read this before claiming completeness

This is **not** every mandal in Mumbai and cannot be made into that from public sources. BMC permits roughly 2,500–3,000 sarvajanik mandals each season; adding housing-society and galli installations pushes the real number far higher. What is in here is the set that is individually findable and locatable — the ones people actually travel to.

Paths to broader coverage, in order of value:

1. **BMC one-window permission data.** The single authoritative list. Ganesh Utsav permissions go through the BMC one-window system and each ward office holds its own register. An RTI or a ward-level ask gets you names and addresses; you geocode from there. This is the only route to genuine completeness.
2. **Mumbai Police mandal registration lists**, published per zone ahead of visarjan for route planning.
3. **User submissions.** A "add a missing mandal" form with a map pin, moderated. For a wait-time product you need contributors anyway — the same people who report a queue can report a pandal.
4. **Brihanmumbai Sarvajanik Ganeshotsav Samanvay Samiti**, the coordinating federation, holds a member roster.

## Licensing caveat

Coordinates, names, and addresses here came from the Google Places API. Google's terms permit indefinite storage of `place_id` but **restrict caching of other place content beyond 30 days**, and pre-fetching to build a standalone database is separately restricted. If moryamap.in is public and you are not rendering on a Google Map, this matters. Options:

- Render on Google Maps and re-fetch details by `place_id` at request time — compliant, costs per call.
- Re-verify the 105 rows against OpenStreetMap or geocode from the addresses independently, keep `place_id` only as an internal join key, and ship the OSM-derived coordinates.

Option two is the cleaner base for a project you want to keep running past this season.
