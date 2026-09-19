import Link from 'next/link';
import {
  type CodeStatus,
  type PaymentProblem,
  checkSevaPayment,
  codesForPayment,
  formatCode,
  isPaymentId,
  normalizeCode,
} from '@/lib/restore';
import { getRedis } from '@/lib/redis';
import { SEVA_AMOUNT, sevaConfig } from '@/lib/seva';
import { siteUrl } from '@/lib/site';
import { issueRestoreCode, revokeRestoreCode } from './actions';
import CopyBox from './CopyBox';

export const dynamic = 'force-dynamic';

const PROBLEMS: Record<PaymentProblem | 'not_configured', string> = {
  not_configured: 'Razorpay or Upstash Redis is not configured, so codes cannot be issued here.',
  bad_id: 'That is not a Razorpay payment ID. It starts with pay_ (e.g. pay_Q1a2B3c4D5e6F7).',
  not_found: 'Razorpay has no payment with that ID on this account.',
  not_captured: 'This payment was not completed (not captured). No code.',
  refunded: 'This payment has been refunded. No code.',
  wrong_amount: `This payment is not the ₹${SEVA_AMOUNT} unlock (darshan / ashirwad are separate).`,
};

const STATUS: Record<CodeStatus, { label: string; className: string }> = {
  unused: { label: 'Not used yet', className: 'bg-amber-100 text-amber-800' },
  used: { label: 'Used — locked to one browser', className: 'bg-green-100 text-green-800' },
  revoked: { label: 'Revoked / expired', className: 'bg-stone-200 text-stone-600' },
};

function fmtIst(unixSeconds: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

function message(code: string): string {
  const pretty = formatCode(code);
  return [
    'Ganpati Bappa Morya! 🙏',
    `Your Morya Map restore code: ${pretty}`,
    `Open this link in the browser you want to use and tap Unlock: ${siteUrl()}/restore?code=${pretty}`,
    'The code works in ONE browser only. Once used, it will not work anywhere else.',
  ].join('\n');
}

export default async function RestorePage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string; code?: string; err?: string }>;
}) {
  const { pay: rawPay = '', code: rawCode, err } = await searchParams;
  const pay = rawPay.trim();
  const cfg = sevaConfig();
  const ready = Boolean(cfg && getRedis());
  const newCode = normalizeCode(rawCode);

  const payment = ready && isPaymentId(pay) && !err ? await checkSevaPayment(cfg!, pay) : null;
  const codes = ready && isPaymentId(pay) ? await codesForPayment(pay) : [];
  const used = codes.filter((c) => c.status === 'used').length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-stone-500 hover:text-stone-800">
          ← Admin
        </Link>
        <h1 className="mt-1 text-lg font-bold">Restore a ₹{SEVA_AMOUNT} unlock</h1>
        <p className="mt-1 text-sm text-stone-600">
          For someone who paid but switched browser or phone. Enter their Razorpay payment ID:
          it&apos;s shown as “Payment reference” on the success screen, or find it in the Razorpay
          dashboard (Transactions → Payments, search by the UPI reference / UTR from their
          screenshot). The payment is checked on Razorpay before a code is issued.
        </p>
      </div>

      {!ready && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {PROBLEMS.not_configured}
        </p>
      )}

      <form action={issueRestoreCode} className="flex flex-wrap gap-2">
        <input
          name="pay"
          defaultValue={pay}
          required
          placeholder="pay_…"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={!ready}
          className="rounded bg-maroon px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Verify &amp; generate code
        </button>
      </form>

      {err && err in PROBLEMS && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {PROBLEMS[err as keyof typeof PROBLEMS]}
        </p>
      )}

      {payment?.ok && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          ✓ ₹{payment.payment.amount / 100} captured on {fmtIst(payment.payment.createdAt)} IST
          {payment.payment.vpa ? ` from ${payment.payment.vpa}` : ''} ({payment.payment.id})
        </p>
      )}

      {newCode && (
        <section className="space-y-3 rounded-lg border border-stone-300 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">New code</p>
          <p className="font-mono text-3xl font-bold tracking-widest text-maroon">
            {formatCode(newCode)}
          </p>
          <p className="text-xs text-stone-600">
            Works in one browser only: the first browser to use it keeps it, every other browser is
            refused. Any older unused code for this payment has stopped working.
          </p>
          <CopyBox text={message(newCode)} />
        </section>
      )}

      {codes.length > 0 && (
        <section>
          <h2 className="text-sm font-bold">
            Codes for this payment ({codes.length})
          </h2>
          {used >= 2 && (
            <p className="mt-1 text-xs font-semibold text-red-700">
              {used} browsers have already been restored for this one payment (plus the one they
              paid on). Think twice before issuing another.
            </p>
          )}
          <ul className="mt-2 divide-y divide-stone-200 rounded-lg border border-stone-300 bg-white">
            {codes.map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-mono">{formatCode(c.code)}</span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[c.status].className}`}>
                    {STATUS[c.status].label}
                  </span>
                  {c.status === 'unused' && (
                    <form action={revokeRestoreCode}>
                      <input type="hidden" name="pay" value={pay} />
                      <input type="hidden" name="code" value={c.code} />
                      <button type="submit" className="text-xs text-red-700 underline">
                        Revoke
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
