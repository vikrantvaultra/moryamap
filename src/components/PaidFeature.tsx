import { getTranslations } from 'next-intl/server';
import Locked from '@/components/Locked';
import { SEVA_AMOUNT, sevaConfig } from '@/lib/seva';

const LOCK_TITLE = { queue: 'lockQueue', routes: 'lockRoutes', ponds: 'lockPonds' } as const;

/**
 * Locks its children behind the one-time payment. Renders them as-is when
 * payments aren't configured, since the payment sheet then isn't mounted.
 */
export default async function PaidFeature({
  kind,
  tall,
  children,
}: {
  kind: 'queue' | 'routes' | 'ponds';
  tall?: boolean;
  children: React.ReactNode;
}) {
  if (!sevaConfig()) return <>{children}</>;
  const t = await getTranslations('seva');
  return (
    <Locked
      tall={tall}
      labels={{
        title: t(LOCK_TITLE[kind]),
        cta: t('lockCta', { amount: SEVA_AMOUNT }),
        hint: t('lockHint'),
      }}
    >
      {children}
    </Locked>
  );
}
