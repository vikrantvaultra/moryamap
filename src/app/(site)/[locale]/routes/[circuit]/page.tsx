import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import RouteView from '@/components/RouteView';
import { shareMetadata } from '@/lib/metadata';
import { getMandalDirectory } from '@/lib/queries';
import { CIRCUITS, getCircuit, l10n, resolveCircuit } from '@/lib/routes';
import { localePath } from '@/lib/site';

// Waits on each stop come from the estimator, so refresh like the home page.
export const revalidate = 60;

export function generateStaticParams() {
  return CIRCUITS.map((c) => ({ circuit: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; circuit: string }>;
}): Promise<Metadata> {
  const { locale, circuit: id } = await params;
  const circuit = getCircuit(id);
  if (!circuit) return {};
  return shareMetadata({
    locale,
    path: `/routes/${id}`,
    title: l10n(circuit.title, locale),
    description: l10n(circuit.blurb, locale),
    image: `/api/og/route/${id}`,
    imageAlt: `${circuit.title.en}: pandal-hopping route`,
  });
}

export default async function CircuitPage({
  params,
}: {
  params: Promise<{ locale: string; circuit: string }>;
}) {
  const { locale, circuit: id } = await params;
  setRequestLocale(locale);
  const circuit = getCircuit(id);
  if (!circuit) notFound();
  const stops = resolveCircuit(circuit, await getMandalDirectory());
  if (stops.length < 2) notFound();
  const t = await getTranslations('routes');
  const title = l10n(circuit.title, locale);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <PageHeader
        backHref={localePath(locale, '/routes')}
        backLabel={t('allRoutes')}
        eyebrow={
          <span className="text-xs font-bold uppercase tracking-wide text-flame">
            <span aria-hidden className="mr-1.5">
              🪔
            </span>
            {t('title')}
          </span>
        }
        title={title}
        subtitle={l10n(circuit.blurb, locale)}
      />
      <RouteView
        locale={locale}
        stops={stops}
        sharePath={`/routes/${id}`}
        shareTitle={title}
        imageKey={id}
      />
    </div>
  );
}
