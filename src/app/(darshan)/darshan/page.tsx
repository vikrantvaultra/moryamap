import { cookies } from 'next/headers';
import { DARSHAN_AMOUNT, DARSHAN_PASS_COOKIE, darshanConfig, hasDarshanPass } from '@/lib/darshan';
import { PREVIEW_PATH, findOriginal } from '@/lib/darshan-image';
import UnlockGate from '@/components/UnlockGate';
import UnlockedPhoto from './UnlockedPhoto';

// Dynamic on purpose: the pass is read here, on the server, so a locked visitor
// is never sent the real image in the first place.
export const dynamic = 'force-dynamic';

export default async function DarshanPage() {
  const cfg = darshanConfig();
  const paid = cfg ? hasDarshanPass((await cookies()).get(DARSHAN_PASS_COOKIE)?.value, cfg) : false;
  const hasPhoto = (await findOriginal()) !== null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-maroon-deep via-maroon to-flame px-6 py-7 text-center text-amber-50">
          <h1 className="text-2xl font-bold tracking-tight">Mandal Darshan</h1>
          <p className="mt-1 text-sm text-amber-100/90">
            {paid ? 'The photograph is yours.' : 'One photograph, in full resolution.'}
          </p>
        </div>
        <div className="garland" />

        <div className="p-5">
          {paid ? (
            <UnlockedPhoto />
          ) : (
            <>
              <figure className="relative overflow-hidden rounded-2xl bg-cream-deep">
                {hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={PREVIEW_PATH}
                    alt="A blurred preview of the mandal photograph"
                    className="block aspect-[4/5] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[4/5] w-full place-items-center px-6 text-center text-sm text-ink-soft">
                    The photograph has not been added yet.
                  </div>
                )}
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-maroon-deep/85 to-transparent px-4 pb-4 pt-10 text-center">
                  <span className="text-sm font-semibold text-amber-50">
                    To see this image, pay ₹{DARSHAN_AMOUNT}
                  </span>
                </figcaption>
              </figure>

              <p className="mt-4 text-center text-sm text-ink-soft">
                A one-time payment of{' '}
                <strong className="text-ink">₹{DARSHAN_AMOUNT}</strong> reveals the full-resolution
                photograph on this device, and lets you download it.
              </p>

              {cfg ? (
                hasPhoto ? (
                  <UnlockGate
                    amount={DARSHAN_AMOUNT}
                    api="/api/darshan"
                    labels={{
                      pay: `Pay ₹${DARSHAN_AMOUNT} to see the image`,
                      opening: 'Opening…',
                      showQr: 'Show a UPI QR code instead',
                      scanCaption:
                        'Scan with any UPI app. The image unlocks by itself once the payment lands.',
                      waiting: 'Waiting for the payment to confirm…',
                      checkoutDescription: 'Mandal darshan photograph',
                    }}
                  />
                ) : (
                  <p className="mt-5 rounded-2xl bg-cream-deep px-4 py-3 text-center text-xs text-ink-soft">
                    Payment is switched off until the photograph is in place.
                  </p>
                )
              ) : (
                <p className="mt-5 rounded-2xl bg-cream-deep px-4 py-3 text-center text-xs text-ink-soft">
                  Payments are not configured, so nothing can be bought here yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
