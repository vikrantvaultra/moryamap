'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from '@/components/Logo';
import { SEVA_OPEN_EVENT, SEVA_PAID_EVENT, hasPass } from '@/lib/seva-client';

export interface SevaLabels {
  eyebrow: string;
  title: string;
  body: string;
  unlocks: string;
  unlockList: string;
  blessing: string;
  payOnPhone: string;
  appHint: string;
  inAppTitle: string;
  inAppAndroid: string;
  inAppIos: string;
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
  close: string;
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

const fill = (s: string, amount: number) => s.replaceAll('{amount}', String(amount));

/**
 * Payment sheet for the paid features. Hidden until a locked feature asks for
 * it (SEVA_OPEN_EVENT); once Razorpay confirms payment this device is unlocked
 * and every locked feature on the page opens (SEVA_PAID_EVENT).
 */
export default function SevaGate({ labels, amount }: { labels: SevaLabels; amount: number }) {
  const [phase, setPhase] = useState<'hidden' | 'open' | 'paid'>('hidden');
  const [qr, setQr] = useState<Qr | null>(null);
  const [qrState, setQrState] = useState<QrState>('loading');
  const [qrAttempt, setQrAttempt] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [inApp, setInApp] = useState<'android' | 'ios' | null>(null);
  const qrCache = useRef(new Map<number, Qr>());
  const dialogRef = useRef<HTMLDivElement>(null);

  // 1. Open when a locked feature is tapped.
  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    setInApp(inAppBrowser());
    const open = () => {
      if (hasPass()) window.dispatchEvent(new Event(SEVA_PAID_EVENT));
      else setPhase('open');
    };
    window.addEventListener(SEVA_OPEN_EVENT, open);
    return () => window.removeEventListener(SEVA_OPEN_EVENT, open);
  }, []);

  // 2. Hold the page behind the sheet while it's open; Escape closes it.
  useEffect(() => {
    if (phase === 'hidden') return;
    const shell = document.getElementById('site-shell');
    const root = document.documentElement;
    shell?.setAttribute('inert', '');
    shell?.setAttribute('aria-hidden', 'true');
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhase('hidden');
    };
    document.addEventListener('keydown', onKey);
    return () => {
      shell?.removeAttribute('inert');
      shell?.removeAttribute('aria-hidden');
      root.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [phase]);

  // 3. Tell locked features on the page to open.
  useEffect(() => {
    if (phase === 'paid') window.dispatchEvent(new Event(SEVA_PAID_EVENT));
  }, [phase]);

  // 4. A fresh single-use QR (cached while still valid).
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
    // Debounced so opening and closing the sheet doesn't mint a QR each time.
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

  // 5. Mark the QR expired when Razorpay closes it.
  useEffect(() => {
    if (!qr || qrState !== 'ready') return;
    const ms = qr.closeBy * 1000 - Date.now();
    const timer = setTimeout(() => {
      qrCache.current.delete(qr.amount);
      setQrState('expired');
    }, Math.max(0, ms));
    return () => clearTimeout(timer);
  }, [qr, qrState]);

  // 6. Poll for payment while the popup is open (QR scans, or a Checkout
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
        description: 'Morya Map: queue times & pandal-hopping routes',
        theme: { color: '#7c2d12' },
        config: {
          display: {
            blocks: { upi: { name: 'UPI', instruments: [{ method: 'upi' }] } },
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

  const inAppNotice = inApp && (
    <div className="rounded-xl border border-band-amber/40 bg-amber-50 px-3 py-2.5 text-center text-sm text-ink">
      <p className="font-semibold text-band-amber">⚠️ {labels.inAppTitle}</p>
      {inApp === 'android' ? (
        <a
          // Re-opens this page in Chrome, which can launch GPay/PhonePe/Paytm.
          href={`intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`}
          className="mt-2 inline-block rounded-full bg-maroon px-4 py-1.5 text-sm font-semibold text-amber-100"
        >
          {labels.inAppAndroid}
        </a>
      ) : (
        <p className="mt-1">{labels.inAppIos}</p>
      )}
    </div>
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
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-maroon-deep/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase === 'open') setPhase('hidden');
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seva-title"
        tabIndex={-1}
        className="seva-rise relative max-h-dvh w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-3xl"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-maroon-deep via-maroon to-flame px-5 pt-6 pb-5 text-center text-amber-50">
          {phase === 'open' && (
            <button
              type="button"
              onClick={() => setPhase('hidden')}
              aria-label={labels.close}
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/20 text-lg text-amber-50 hover:bg-black/35"
            >
              ✕
            </button>
          )}
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
            <div className="rounded-2xl border-2 border-flame/40 bg-flame/5 px-4 py-3">
              <p className="text-base font-bold text-maroon">🔓 {fill(labels.unlocks, amount)}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {labels.unlockList.split(' · ').map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="font-bold text-band-green">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="rounded-xl bg-cream-deep px-3 py-2 text-center text-sm font-semibold italic text-maroon">
              {labels.blessing}
            </p>

            {touch ? (
              <>
                {inAppNotice}
                {phoneButton}
                <p className="-mt-2 text-center text-xs text-ink-soft">{labels.appHint}</p>
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
              <p>{fill(labels.unlockNote, amount)}</p>
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
