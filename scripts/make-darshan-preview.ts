/**
 * Build the blurred teaser for /darshan from the original photo.
 * Run with: npm run darshan:preview
 *
 * Why this exists: a CSS blur over the real image is not a paywall. The
 * browser has already been handed every pixel, and devtools removes the
 * filter in one click. So the preview is a *different, destroyed* image —
 * downscaled to a few dozen pixels wide (the detail is gone, not hidden),
 * blurred, and re-enlarged. The original never leaves src/assets/darshan,
 * which is not web-served; only /api/darshan/image can read it, and only
 * for a request carrying a valid signed pass.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { findOriginal } from '../src/lib/darshan-image';

/** Small enough that no detail survives; the blur only smooths the blocks. */
const TEASER_WIDTH = 48;
const OUTPUT_WIDTH = 900;

async function main() {
  const original = await findOriginal();
  if (!original) {
    console.error(
      'No photo found. Drop the mandal image into src/assets/darshan/ and run this again.',
    );
    process.exit(1);
  }

  const out = path.join(process.cwd(), 'public/darshan/preview.jpg');
  await mkdir(path.dirname(out), { recursive: true });

  const tiny = await sharp(original.file)
    .rotate() // honour EXIF orientation before we throw the metadata away
    .resize({ width: TEASER_WIDTH })
    .toBuffer();

  const preview = await sharp(tiny)
    .resize({ width: OUTPUT_WIDTH })
    .blur(18)
    .modulate({ saturation: 1.05 })
    .jpeg({ quality: 70 })
    .toBuffer();

  await writeFile(out, preview);
  console.log(
    `Preview written to public/darshan/preview.jpg (${(preview.byteLength / 1024).toFixed(0)} KB) ` +
      `from ${path.basename(original.file)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
