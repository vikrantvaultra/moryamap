'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Inline payment controls for a one-time unlock page (/darshan, /ashirwad).
 * Rendered on the page itself rather than as the site-wide seva sheet, and
 * talks only to its own flow's API: `${api}/start`, `/status`, `/verify`.
 * On success it re-renders the page, which reads the pass server-side.
 */

const POLL_MS = 4000;
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// In-app browsers (Instagram, Facebook, other WebViews) often can't hand off
// to a UPI app, so Checkout's intent payments time out there.
function inAppBrowser(): 'android' | 'ios' | null {
  const ua = navigator.userAgent;
  if (!/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Line\/|; wv\)/i.test(ua)) return null;
  return /Android/i.test(ua) ? 'android' : 'ios';
}

let checkoutScript: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  checkoutScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      checkoutScript = null;
      reject(new Error('checkout script failed'));
    };
    document.head.appendChild(s);
  });
  return checkoutScript;
}

interface Qr {
  imageUrl: string;
  closeBy: number;
}

export interface UnlockGateLabels {
  pay: string;
  opening: string;
  showQr: string;
  scanCaption: string;
  waiting: string;
  /** Shown in the Razorpay sheet under the beneficiary. */
  checkoutDescription: string;
}

export default function UnlockGate({
  amount,
  api,
  labels,
}: {
  amount: number;
  api: string;
  labels: UnlockGateLabels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<Qr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [touch, setTouch] = useState(false);
  const [webview, setWebview] = useState<'android' | 'ios' | null>(null);
  const done = useRef(false);

  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    setWebview(inAppBrowser());
  }, []);

  /** Re-render the page as a server component; the pass is read there. */
  const unlock = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setPolling(false);
    router.refresh();
  }, [router]);

  // Poll for a QR / order payment while one is outstanding and the tab is visible.
  useEffect(() => {
    if (!polling) return;
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden) return;
      try {
        const res = await fetch(`${api}/status`, { cache: 'no-store' });
        const data = (await res.json()) as { paid?: boolean };
        if (data.paid) unlock();
      } catch {
        // A transient error isn't a failed payment; keep polling.
      }
    };
    const id = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [polling, unlock, api]);

  const start = async (method: 'qr' | 'checkout') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const { error: code } = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          code === 'rate_limited'
            ? 'Too many attempts just now. Please try again in a little while.'
            : 'Could not reach the payment gateway. Please try again.',
        );
        return;
      }

      if (method === 'qr') {
        const data = (await res.json()) as { imageUrl: string; closeBy: number };
        setQr({ imageUrl: data.imageUrl, closeBy: data.closeBy });
        setPolling(true);
        return;
      }

      const order = (await res.json()) as {
        orderId: string;
        keyId: string;
        amountPaise: number;
        beneficiary: string;
      };
      await loadCheckout();
      if (!window.Razorpay) throw new Error('checkout unavailable');
      setPolling(true);
      new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        name: order.beneficiary,
        description: labels.checkoutDescription,
        theme: { color: '#7c2d12' },
        config: {
          display: {
            blocks: { upi: { name: 'UPI', instruments: [{ method: 'upi' }] } },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (response: Record<string, string>) => {
          try {
            const verify = await fetch(`${api}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            const data = (await verify.json()) as { paid?: boolean };
            if (data.paid) unlock();
          } catch {
            // The poller is still running and will catch it.
          }
        },
      }).open();
    } catch {
      setError('Could not open the payment sheet. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const payButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => start('checkout')}
      className="seva-shine relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-flame to-marigold px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-flame/30 active:scale-[0.98] disabled:opacity-60"
    >
      {busy ? labels.opening : labels.pay}
    </button>
  );

  const qrBlock = qr ? (
    <figure className="mt-4 rounded-2xl border-2 border-flame/40 bg-flame/5 p-4 text-center">
      {/* Razorpay-hosted QR image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr.imageUrl}
        alt={`UPI QR code for ₹${amount}`}
        className="mx-auto block h-52 w-52 rounded-lg bg-white"
      />
      <figcaption className="mt-3 text-xs text-ink-soft">
        {labels.scanCaption}
      </figcaption>
    </figure>
  ) : (
    <button
      type="button"
      disabled={busy}
      onClick={() => start('qr')}
      className="mt-3 w-full rounded-2xl border border-maroon/25 px-5 py-3 text-sm font-semibold text-maroon active:scale-[0.98] disabled:opacity-60"
    >
      {labels.showQr}
    </button>
  );

  return (
    <div className="mt-5">
      {webview && (
        <p className="mb-3 rounded-2xl bg-cream-deep px-4 py-3 text-xs text-ink-soft">
          You are in an in-app browser, which usually cannot hand off to a UPI app.
          {webview === 'android' ? (
            <>
              {' '}
              <a
                href="intent://#Intent;scheme=https;package=com.android.chrome;end"
                className="font-semibold text-maroon underline"
              >
                Open in Chrome
              </a>{' '}
              first.
            </>
          ) : (
            ' Tap the ⋯ menu and choose “Open in Safari” first.'
          )}
        </p>
      )}

      {touch ? (
        <>
          {payButton}
          {qrBlock}
        </>
      ) : (
        <>
          {qrBlock}
          <div className="mt-3">{payButton}</div>
        </>
      )}

      {polling && !qr && (
        <p className="mt-3 text-center text-xs text-ink-soft">{labels.waiting}</p>
      )}
      {error && <p className="mt-3 text-center text-xs text-band-red">{error}</p>}
    </div>
  );
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}
