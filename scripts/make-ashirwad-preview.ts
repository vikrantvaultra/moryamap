/**
 * Build the blurred teaser for /ashirwad from the artwork.
 * Run with: npm run ashirwad:preview
 *
 * Reads ASHIRWAD_IMAGE_URL (from the environment or .env) or the first image
 * in src/assets/ashirwad, and writes public/ashirwad/preview.jpg. The preview
 * is a *different, destroyed* image: 48px wide, then blurred and enlarged, so
 * the detail is gone, not hidden under a CSS filter.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadArtwork } from '../src/lib/ashirwad-image';

const TEASER_WIDTH = 48;
const OUTPUT_WIDTH = 900;

async function main() {
  try {
    process.loadEnvFile?.('.env');
  } catch {
    // No .env: the environment or a local file will do.
  }

  const art = await loadArtwork();
  if (!art) {
    console.error(
      'No artwork found. Set ASHIRWAD_IMAGE_URL or drop the image into src/assets/ashirwad/.',
    );
    process.exit(1);
  }

  const out = path.join(process.cwd(), 'public/ashirwad/preview.jpg');
  await mkdir(path.dirname(out), { recursive: true });

  const tiny = await sharp(art.bytes)
    .rotate() // honour EXIF orientation before the metadata is dropped
    .resize({ width: TEASER_WIDTH })
    .toBuffer();

  const preview = await sharp(tiny)
    .resize({ width: OUTPUT_WIDTH })
    .blur(18)
    .modulate({ saturation: 1.1, brightness: 1.05 })
    .jpeg({ quality: 70 })
    .toBuffer();

  await writeFile(out, preview);
  console.log(`Preview written to public/ashirwad/preview.jpg (${(preview.byteLength / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
