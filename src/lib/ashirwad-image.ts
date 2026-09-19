import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Where the Bappa artwork comes from, in order:
 *
 *   1. ASHIRWAD_IMAGE_URL — a secret, unguessable URL, for an exclusive image
 *      of your own. Never commit one of those: this repository is public.
 *   2. src/assets/ashirwad/bappa.jpg — the committed default: a CC BY-SA 4.0
 *      pandal photograph from Wikimedia Commons, colour-graded (see
 *      artworkCredit()). It is freely available on Commons anyway, so what the
 *      ₹501 opens is the darshan experience, not a secret file.
 *
 * Either way the bytes only leave through /api/ashirwad/image, which checks
 * the signed pass first, and never sit in /public.
 */
const LOCAL_DIR = path.join(process.cwd(), 'src/assets/ashirwad');

/** The blurred teaser, built from the original by scripts/make-ashirwad-preview.ts. */
export const PREVIEW_PATH = '/ashirwad/preview.jpg';
const PREVIEW_FILE = path.join(process.cwd(), 'public', PREVIEW_PATH);

/** The shankh blown when the darshan opens (public: it is not the paid part). */
export const SHANKH_SOURCES = ['/ashirwad/shankh.m4a', '/ashirwad/shankh.ogg'] as const;

/**
 * An optional real recording of "Ganpati Bappa Morya!" — your own, or one you
 * have the rights to. Without it the phone's own Marathi/Hindi voice says it.
 */
const CHANT_PATH = '/ashirwad/morya.m4a';

export function chantSrc(): string | null {
  return existsSync(path.join(process.cwd(), 'public', CHANT_PATH)) ? CHANT_PATH : null;
}

/** Where Bappa's ear is, in % of the artwork — the name is carried there. */
export interface Point {
  x: number;
  y: number;
}

/** Bappa's left ear (viewer's right) in the committed default bappa.jpg. */
const DEFAULT_EAR: Point = { x: 62.5, y: 47 };

/**
 * ASHIRWAD_EAR="x,y" (percent) when ASHIRWAD_IMAGE_URL points at a different
 * image; otherwise the default image's ear.
 */
export function artworkEar(): Point {
  const [x, y] = (process.env.ASHIRWAD_EAR ?? '').split(',').map(Number);
  if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100) {
    return { x, y };
  }
  return DEFAULT_EAR;
}

/** Attribution the licences require, shown on the page. */
export function artworkCredit(): string | null {
  if (process.env.ASHIRWAD_IMAGE_URL?.trim()) return process.env.ASHIRWAD_CREDIT?.trim() || null;
  return 'Photo: AjayDas, CC BY-SA 4.0, Wikimedia Commons (cropped, colour-graded)';
}

export const SHANKH_CREDIT = 'Shankh: David Bolton, CC BY 2.5, Wikimedia Commons';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

function localFile(): string | null {
  try {
    const name = readdirSync(LOCAL_DIR)
      .filter((n) => !n.startsWith('.') && TYPES[path.extname(n).toLowerCase()])
      .sort()[0];
    return name ? path.join(LOCAL_DIR, name) : null;
  } catch {
    return null;
  }
}

/**
 * True when there is something to sell. Checked by the page before it takes
 * money, and by every entry point before it links here — nobody should be
 * sent to pay for an image that isn't in place.
 */
export function hasAshirwadImage(): boolean {
  return Boolean(process.env.ASHIRWAD_IMAGE_URL?.trim()) || localFile() !== null;
}

export function hasAshirwadPreview(): boolean {
  return existsSync(PREVIEW_FILE);
}

export interface Artwork {
  bytes: Uint8Array;
  contentType: string;
}

// Warm instances serve the artwork from memory instead of refetching it.
let cached: Artwork | null = null;

export async function loadArtwork(): Promise<Artwork | null> {
  if (cached) return cached;
  const url = process.env.ASHIRWAD_IMAGE_URL?.trim();
  if (url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`[ashirwad] image source → ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    cached = {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: type.startsWith('image/') ? type : 'image/jpeg',
    };
    return cached;
  }
  const file = localFile();
  if (!file) return null;
  cached = {
    bytes: new Uint8Array(await readFile(file)),
    contentType: TYPES[path.extname(file).toLowerCase()],
  };
  return cached;
}
