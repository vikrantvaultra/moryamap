import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import RestoreForm from '@/components/RestoreForm';
import { SEVA_AMOUNT } from '@/lib/seva';
import { localePath } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'restore' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function RestorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('restore');
  const tc = await getTranslations('common');
  const home = localePath(locale, '/');

  return (
    <div className="mx-auto w-full max-w-md px-4 py-5">
      <PageHeader
        backHref={home}
        backLabel={tc('backToMap')}
        title={`🔓 ${t('title')}`}
        subtitle={t('subtitle', { amount: SEVA_AMOUNT })}
      />
      <RestoreForm
        homeHref={home}
        labels={{
          label: t('label'),
          placeholder: t('placeholder'),
          submit: t('submit'),
          checking: t('checking'),
          note: t('note'),
          invalid: t('invalid'),
          used: t('used'),
          rateLimited: t('rateLimited'),
          error: t('error'),
          successTitle: t('successTitle'),
          successBody: t('successBody'),
          already: t('already'),
          goHome: t('goHome'),
        }}
      />
      <section className="mt-6 rounded-2xl bg-cream-deep p-4 text-sm leading-relaxed text-ink">
        <h2 className="font-bold text-maroon">{t('howTitle')}</h2>
        <p className="mt-1">{t('howBody')}</p>
      </section>
    </div>
  );
}
