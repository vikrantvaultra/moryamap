# The paid darshan photo

Drop the mandal photograph in this directory (`.jpg`, `.jpeg`, `.png`, `.webp`
or `.avif`). The first image here, alphabetically, is the one `/darshan` sells.

This directory is **not** web-served. Nothing under `src/assets` is reachable by
URL — that is the point. The only way out is `/api/darshan/image`, which checks
the signed `morya_darshan` pass before it streams a byte. Do not copy the photo
into `public/`, or the paywall is decoration.

After adding or replacing the photo, regenerate the blurred teaser:

    npm run darshan:preview

That writes `public/darshan/preview.jpg` — a separate, genuinely destroyed
image (downscaled to 48px wide, then blurred and enlarged), not the original
under a CSS filter. Commit both the original and the regenerated preview.
