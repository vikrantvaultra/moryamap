import { getRedis } from '@/lib/redis';
import { type SevaConfig, sevaConfig } from '@/lib/seva';
import { createUnlock } from '@/lib/unlock';

/**
 * Bappa's ashirwad: a ₹501 offering that opens a digital darshan — the full
 * Bappa artwork with petals, light and a blessing, on this device.
 *
 * Separate from the ₹21 seva pass and the ₹500 darshan photo: own price, own
 * cookies, own /api/ashirwad/* routes, and scoped tokens (see @/lib/unlock),
 * so no other payment opens this one and this one opens nothing else.
 *
 * What it is, stated on the page and kept true here: a devotional artwork,
 * paid to SEVA_BENEFICIARY (the page names them, as the Razorpay sheet does).
 * Not a puja, and no promised outcome.
 */

/** ₹501, not ₹500: amounts ending in 1 are shagun — an offering, not a price. */
export const ASHIRWAD_AMOUNT = 501;

export const ashirwad = createUnlock({
  scope: 'ashirwad',
  amount: ASHIRWAD_AMOUNT,
  passCookie: 'morya_ashirwad',
  pendingCookie: 'morya_ashirwad_pending',
  apiPath: '/api/ashirwad',
  // An ashirwad is kept, not rented: a year on this device.
  passMaxAge: 60 * 60 * 24 * 365,
  qrName: 'Ganpati Bappa ashirwad',
  description: 'Offering: digital darshan of Ganpati Bappa',
});

/**
 * Local test mode: under `next dev` the ₹501 button opens the darshan
 * without Razorpay, so the whole experience can be tried on a laptop or a
 * phone on the same Wi-Fi without paying. Never on Vercel or `next start`:
 * both run with NODE_ENV=production. ASHIRWAD_DEV_PAYMENTS=1 turns it off,
 * to test the real Razorpay flow locally.
 */
export function devUnlockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && env.ASHIRWAD_DEV_PAYMENTS !== '1';
}

/** Signs local test passes when no Razorpay keys are set. Useless outside dev. */
const DEV_CONFIG: SevaConfig = {
  keyId: 'dev',
  keySecret: 'morya-ashirwad-local-test-only',
  webhookSecret: null,
  beneficiary: 'Local test (no payment)',
};

/**
 * Null when Razorpay isn't configured — the page then says so instead of
 * taking money. In local test mode it falls back to a dev-only signing key.
 */
export function ashirwadConfig(): SevaConfig | null {
  return sevaConfig() ?? (devUnlockEnabled() ? DEV_CONFIG : null);
}

/** The payment ref a local test pass carries; the receipt shows it. */
export const DEV_PAYMENT_REF = 'pay_LOCALTEST';

export function isAshirwadAmount(value: unknown): value is number {
  return value === ASHIRWAD_AMOUNT;
}

// --- How many have received it (real payments only) -------------------------

const BLESSED_KEY = 'morya:ashirwad:blessed';

/**
 * Below this the page shows no count at all. "3 devotees" reads as a warning,
 * and the only honest alternative to a small real number is no number.
 */
export const SHOW_COUNT_FROM = 21;

/** Idempotent per payment: status poll and checkout verify may both land. */
export async function recordBlessing(paymentId: string): Promise<void> {
  await getRedis()?.sadd(BLESSED_KEY, paymentId);
}

/** Real count of paid ashirwads, or null when unknown or too small to show. */
export async function blessingCount(): Promise<number | null> {
  try {
    const n = (await getRedis()?.scard(BLESSED_KEY)) ?? 0;
    return n >= SHOW_COUNT_FROM ? n : null;
  } catch {
    return null;
  }
}

// --- Where the festival is --------------------------------------------------

/** Anant Chaturdashi 2026, the 10-day visarjan: 25 September. */
const ANANT = { y: 2026, m: 9, d: 25 };

/**
 * Whole days until Bappa leaves (IST calendar days). 0 on Anant Chaturdashi
 * itself, negative after. The page's urgency is this real date — never a
 * made-up timer.
 */
export function daysUntilVisarjan(now: Date = new Date()): number {
  const ist = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = ist.split('-').map(Number);
  return Math.round((Date.UTC(ANANT.y, ANANT.m - 1, ANANT.d) - Date.UTC(y, m - 1, d)) / 86_400_000);
}

/**
 * Whether the rest of the site should point here: payments configured AND the
 * artwork in place. Every entry point checks this, so nobody is walked up to
 * an offering that can't be received.
 */
export async function ashirwadOpen(): Promise<boolean> {
  if (!ashirwadConfig()) return false;
  // Imported lazily: node:fs stays out of anything that only needs the price.
  const { hasAshirwadImage } = await import('@/lib/ashirwad-image');
  return hasAshirwadImage();
}
