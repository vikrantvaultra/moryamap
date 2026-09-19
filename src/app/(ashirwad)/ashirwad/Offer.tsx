'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import UnlockGate from '@/components/UnlockGate';
import { primeSpeech } from '@/lib/chant';

/**
 * The offering button. Normally the Razorpay UPI flow; in local test mode
 * (`next dev`, see devUnlockEnabled) the same-looking button opens the
 * darshan straight away, so the whole experience can be tried without paying.
 *
 * Either way the tap primes speech (iOS only allows it from inside a tap),
 * and the page re-renders in place — the tap still counts, so the shankh and
 * the chant can play the moment the darshan opens.
 */
export default function Offer({ amount, devMode }: { amount: number; devMode: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pay = `🙏 ₹${amount} अर्पण करा · Receive Bappa’s ashirwad`;

  if (!devMode) {
    return (
      <UnlockGate
        amount={amount}
        api="/api/ashirwad"
        onStart={primeSpeech}
        // The standalone QR didn't work reliably; Checkout has its own UPI options.
        qrOption={false}
        labels={{
          pay,
          opening: 'Opening…',
          waiting: 'Waiting for your offering to confirm…',
          checkoutDescription: 'Offering · Bappa’s ashirwad',
        }}
      />
    );
  }

  const openForTest = async () => {
    primeSpeech();
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/ashirwad/dev-unlock', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={busy}
        onClick={openForTest}
        className="seva-shine relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-flame to-marigold px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-flame/30 active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? 'Opening…' : pay}
      </button>
      <p className="mt-2 rounded-xl border border-dashed border-sky-400/60 bg-sky-50 px-3 py-2 text-center text-xs text-sky-900">
        🧪 Local test mode: no payment is taken. Only under <code>npm run dev</code>, never on the
        live site.
      </p>
      {error && (
        <p className="mt-2 text-center text-xs text-band-red">Could not open the test darshan.</p>
      )}
    </div>
  );
}
