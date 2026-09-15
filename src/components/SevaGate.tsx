'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from '@/components/Logo';

export interface SevaLabels {
  eyebrow: string;
  title: string;
  body: string;
  blessing: string;
  chooseAmount: string;
  tiers: string[];
  payOnPhone: string;
  processing: string;
  scanTitle: string;
  scanOnOtherPhone: string;
  apps: string;
  loadingQr: string;
  waiting: string;
  expired: string;
  newQr: string;
  error: string;
  rateLimited: string;
  retry: string;
  unlockNote: string;
  secured: string;
  emergency: string;
  successTitle: string;
  successBody: string;
  paymentRef: string;
  enter: string;
}

interface Qr {
  id: string;
  imageUrl: string;
  amount: number;
  closeBy: number;
}

type QrState = 'loading' | 'ready' | 'expired' | 'error' | 'rate_limited' | 'unavailable';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

const GATE_DELAY_MS = 5000;
const POLL_MS = 4000;
const FIRST_SEEN_KEY = 'morya_seva_first_seen';
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

const hasPass = () => /(?:^|;\s*)morya_seva=[^;]+/.test(document.cookie);

/** Milliseconds since this device first opened the site (persisted). */
function msSinceFirstSeen(): number {
  const now = Date.now();
  // Count from navigation start, not hydration, so "5 seconds" is on the clock.
  let first = Math.round(performance.timeOrigin);
  try {
    const stored = Number(localStorage.getItem(FIRST_SEEN_KEY));
    if (stored > 0 && stored <= now) first = stored;
    else localStorage.setItem(FIRST_SEEN_KEY, String(first));
  } catch {
    // storage blocked — fall back to this page load
  }
  return now - first;
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

const fill = (s: string, amount: number) => s.replaceAll('{amount}', String(amount));

/**
 * Five seconds after a visitor first arrives, a non-dismissable popup asks for
 * a UPI offering to the configured mandal/trust. The rest of the page is made
 * inert until Razorpay confirms payment, then this device is unlocked.
 */
export default function SevaGate({
  labels,
  amounts,
  defaultAmount,
}: {
  labels: SevaLabels;
  amounts: readonly number[];
  defaultAmount: number;
}) {
  const [phase, setPhase] = useState<'hidden' | 'open' | 'paid'>('hidden');
  const [amount, setAmount] = useState(defaultAmount);
  const [qr, setQr] = useState<Qr | null>(null);
  const [qrState, setQrState] = useState<QrState>('loading');
  const [qrAttempt, setQrAttempt] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const qrCache = useRef(new Map<number, Qr>());
  const dialogRef = useRef<HTMLDivElement>(null);

  // 1. Start the clock.
  useEffect(() => {
    if (hasPass()) return;
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    const delay = Math.max(0, GATE_DELAY_MS - msSinceFirstSeen());
    const timer = setTimeout(() => {
      if (!hasPass()) setPhase('open');
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // 2. Lock the page behind the popup.
  useEffect(() => {
    if (phase === 'hidden') return;
    const shell = document.getElementById('site-shell');
    const root = document.documentElement;
    shell?.setAttribute('inert', '');
    shell?.setAttribute('aria-hidden', 'true');
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      shell?.removeAttribute('inert');
      shell?.removeAttribute('aria-hidden');
      root.style.overflow = prevOverflow;
    };
  }, [phase]);

  // 3. A fresh single-use QR for the chosen amount (cached while still valid).
  useEffect(() => {
    if (phase !== 'open' || qrState === 'unavailable') return;
    const cached = qrCache.current.get(amount);
    if (cached && cached.closeBy - 30 > Date.now() / 1000) {
      setQr(cached);
      setQrState('ready');
      return;
    }
    setQr(null);
    setQrState('loading');
    const ctrl = new AbortController();
    // Debounced so tapping through amounts doesn't mint a QR per tap.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/donate/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, method: 'qr' }),
          signal: ctrl.signal,
        });
        if (res.status === 429) return setQrState('rate_limited');
        // Razorpay refused (e.g. QR Codes not enabled on the account): drop the
        // QR for this page load; Checkout below still offers UPI.
        if (res.status === 502 || res.status === 503) return setQrState('unavailable');
        if (!res.ok) return setQrState('error');
        const next = (await res.json()) as Qr;
        qrCache.current.set(amount, next);
        setQr(next);
        setQrState('ready');
      } catch {
        if (!ctrl.signal.aborted) setQrState('error');
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // qrState is deliberately not a dependency: this effect sets it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, amount, qrAttempt]);

  // 4. Mark the QR expired when Razorpay closes it.
  useEffect(() => {
    if (!qr || qrState !== 'ready') return;
    const ms = qr.closeBy * 1000 - Date.now();
    const timer = setTimeout(() => {
      qrCache.current.delete(qr.amount);
      setQrState('expired');
    }, Math.max(0, ms));
    return () => clearTimeout(timer);
  }, [qr, qrState]);

  // 5. Poll for payment while the popup is open (QR scans, or a Checkout
  //    payment whose success callback never came back).
  useEffect(() => {
    if (phase !== 'open') return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/donate/status', { cache: 'no-store' });
        const data = (await res.json()) as { paid?: boolean; paymentId?: string };
        if (!stopped && data.paid) {
          setPaymentId(data.paymentId ?? null);
          setPhase('paid');
        }
      } catch {
        // offline for a moment — try again next tick
      }
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase]);

  const payOnPhone = useCallback(async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await loadCheckout();
      const res = await fetch('/api/donate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: 'checkout' }),
      });
      if (res.status === 429) throw new Error(labels.rateLimited);
      if (!res.ok || !window.Razorpay) throw new Error(labels.error);
      const order = (await res.json()) as {
        orderId: string;
        keyId: string;
        amountPaise: number;
        beneficiary: string;
      };
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        name: order.beneficiary,
        description: 'Ganeshotsav offering via Morya Map',
        theme: { color: '#7c2d12' },
        // No contact/email step. Razorpay only honours this once "optional
        // contact" is enabled on the account; until then it's ignored.
        hidden: { contact: true, email: true },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'UPI',
                // Phones: open GPay/PhonePe/Paytm directly. Desktop: a QR to scan.
                instruments: [{ method: 'upi', flows: ['intent', 'qrcode', 'collect'] }],
              },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (response: RazorpayResponse) => {
          try {
            const v = await fetch('/api/donate/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            if (v.ok) {
              setPaymentId(response.razorpay_payment_id);
              setPhase('paid');
            }
            // Not ok → the status poll still picks it up via Razorpay.
          } finally {
            setCheckoutBusy(false);
          }
        },
        modal: { ondismiss: () => setCheckoutBusy(false) },
      });
      checkout.open();
    } catch (err) {
      setCheckoutBusy(false);
      setCheckoutError(err instanceof Error && err.message ? err.message : labels.error);
    }
  }, [amount, labels.error, labels.rateLimited]);

  if (phase === 'hidden') return null;

  const phoneButton = (
    <button
      type="button"
      onClick={payOnPhone}
      disabled={checkoutBusy}
      className="seva-shine relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-flame to-marigold px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-flame/30 transition-transform active:scale-[0.98] disabled:opacity-70"
    >
      <span aria-hidden>📲</span>
      {checkoutBusy ? labels.processing : fill(labels.payOnPhone, amount)}
    </button>
  );

  const qrBlock = qrState === 'unavailable' ? null : (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-900/10 bg-white p-4">
      <p className="text-sm font-semibold text-maroon">
        {touch ? labels.scanOnOtherPhone : labels.scanTitle}
      </p>
      <div className="relative flex size-52 items-center justify-center overflow-hidden rounded-xl bg-cream-deep">
        {qrState === 'ready' && qr ? (
          // Razorpay-hosted image; next/image would need a remote pattern.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.imageUrl} alt={fill(labels.scanTitle, amount)} className="size-full object-contain" />
        ) : qrState === 'loading' ? (
          <span className="animate-pulse text-sm text-ink-soft">{labels.loadingQr}</span>
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 text-center text-sm text-ink-soft">
            <span>
              {qrState === 'expired'
                ? labels.expired
                : qrState === 'rate_limited'
                  ? labels.rateLimited
                  : labels.error}
            </span>
            <button
              type="button"
              onClick={() => setQrAttempt((n) => n + 1)}
              className="rounded-full bg-maroon px-3 py-1.5 text-xs font-semibold text-amber-100"
            >
              {qrState === 'expired' ? labels.newQr : labels.retry}
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-ink-soft">{labels.apps}</p>
      {qrState === 'ready' && (
        <p className="flex items-center gap-2 text-xs font-medium text-band-green" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-band-green opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-band-green" />
          </span>
          {labels.waiting}
        </p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-maroon-deep/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seva-title"
        tabIndex={-1}
        className="seva-rise relative max-h-dvh w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-3xl"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-maroon-deep via-maroon to-flame px-5 pt-6 pb-5 text-center text-amber-50">
          <div aria-hidden className="seva-halo pointer-events-none absolute left-1/2 top-2 size-40 -translate-x-1/2 rounded-full" />
          <div className="relative mx-auto mb-3 w-fit rounded-2xl p-1 ring-2 ring-marigold/60">
            <Logo size={52} />
          </div>
          <p className="relative text-sm font-semibold tracking-wide text-marigold">{labels.eyebrow}</p>
          <h2 id="seva-title" className="relative mt-1 text-2xl font-bold leading-tight">
            {phase === 'paid' ? labels.successTitle : labels.title}
          </h2>
        </div>
        <div className="garland" />

        {phase === 'paid' ? (
          <div className="space-y-4 px-5 py-6 text-center">
            <p className="text-5xl" aria-hidden>
              🪔
            </p>
            <p className="text-base leading-relaxed text-ink">{labels.successBody}</p>
            {paymentId && (
              <p className="text-xs text-ink-soft">
                {labels.paymentRef}: <span className="font-mono">{paymentId}</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => setPhase('hidden')}
              className="w-full rounded-2xl bg-maroon px-4 py-3.5 text-base font-bold text-amber-100 shadow-lg"
            >
              {labels.enter}
            </button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <p className="text-[15px] leading-relaxed text-ink">{labels.body}</p>
            <p className="rounded-xl bg-cream-deep px-3 py-2 text-center text-sm font-semibold italic text-maroon">
              {labels.blessing}
            </p>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink-soft">{labels.chooseAmount}</legend>
              <div className="grid grid-cols-4 gap-2">
                {amounts.map((a, i) => {
                  const active = a === amount;
                  return (
                    <label
                      key={a}
                      className={`flex cursor-pointer flex-col items-center rounded-xl border-2 px-1 py-2 text-center transition-colors ${
                        active
                          ? 'border-flame bg-flame/10 text-maroon'
                          : 'border-amber-900/10 bg-white text-ink hover:border-marigold'
                      }`}
                    >
                      <input
                        type="radio"
                        name="seva-amount"
                        value={a}
                        checked={active}
                        onChange={() => setAmount(a)}
                        className="sr-only"
                      />
                      <span className="text-lg font-bold leading-none">₹{a}</span>
                      <span className="mt-1 text-[11px] leading-tight text-ink-soft">{labels.tiers[i]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {touch ? (
              <>
                {phoneButton}
                {checkoutError && <p className="text-center text-sm text-band-red">{checkoutError}</p>}
                {qrBlock}
              </>
            ) : (
              <>
                {qrBlock}
                {phoneButton}
                {checkoutError && <p className="text-center text-sm text-band-red">{checkoutError}</p>}
              </>
            )}

            <div className="space-y-1.5 border-t border-amber-900/10 pt-3 text-center text-xs text-ink-soft">
              <p>{labels.unlockNote}</p>
              <p>🔒 {labels.secured}</p>
              <p>
                <a href="tel:112" className="font-semibold text-band-red underline">
                  {labels.emergency}
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
