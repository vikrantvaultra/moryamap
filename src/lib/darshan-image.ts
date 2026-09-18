import { readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Where the photo lives. The original sits under src/assets — deliberately
 * NOT in /public, because anything in /public is served to anyone who guesses
 * the URL, paywall or no paywall. The only way out of this directory is
 * /api/darshan/image, which checks the signed pass first.
 */
export const ORIGINAL_DIR = path.join(process.cwd(), 'src/assets/darshan');

/** The blurred teaser, generated from the original by scripts/make-darshan-preview.ts. */
export const PREVIEW_PATH = '/darshan/preview.jpg';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export interface Original {
  file: string;
  contentType: string;
}

/**
 * The first image in ORIGINAL_DIR, or null if none has been added yet — the
 * page and the API both need to degrade politely until the photo is dropped in.
 */
export async function findOriginal(): Promise<Original | null> {
  let names: string[];
  try {
    names = await readdir(ORIGINAL_DIR);
  } catch {
    return null;
  }
  const name = names
    .filter((n) => !n.startsWith('.') && TYPES[path.extname(n).toLowerCase()])
    .sort()[0];
  if (!name) return null;
  return {
    file: path.join(ORIGINAL_DIR, name),
    contentType: TYPES[path.extname(name).toLowerCase()],
  };
}
