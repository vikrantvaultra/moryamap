'use server';

import { redirect } from 'next/navigation';
import { checkSevaPayment, issueCode, normalizeCode, revokeCode } from '@/lib/restore';
import { getRedis } from '@/lib/redis';
import { sevaConfig } from '@/lib/seva';

function back(params: Record<string, string>): never {
  redirect(`/admin/restore?${new URLSearchParams(params).toString()}`);
}

/** Verifies the payment on Razorpay, then issues a one-browser restore code for it. */
export async function issueRestoreCode(formData: FormData) {
  const pay = String(formData.get('pay') ?? '').trim();
  const cfg = sevaConfig();
  if (!cfg || !getRedis()) back({ pay, err: 'not_configured' });

  const check = await checkSevaPayment(cfg, pay);
  if (!check.ok) back({ pay, err: check.problem });

  const code = await issueCode(pay);
  back({ pay, code });
}

export async function revokeRestoreCode(formData: FormData) {
  const pay = String(formData.get('pay') ?? '');
  const code = normalizeCode(formData.get('code'));
  if (code) await revokeCode(code);
  back({ pay });
}
