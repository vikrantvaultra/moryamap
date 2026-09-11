import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { landmarkName, mandalName, queueLabel } from '@/lib/names';
import { getQueueContext } from '@/lib/queries';
import { submitCompletedWait, submitEntryPointReport } from './actions';

// Static + ISR like every public page. Submission feedback lives on the
// static /report/[queueId]/[outcome] pages, so this page reads no
// searchParams and stays cacheable.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Report the queue', robots: { index: false } };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; queueId: string }>;
}) {
  const { locale, queueId: rawId } = await params;
  setRequestLocale(locale);
  const queueId = Number(rawId);
  if (!Number.isInteger(queueId)) notFound();

  const ctx = await getQueueContext(queueId);
  if (!ctx) notFound();
  const { mandal, queue } = ctx;

  const t = await getTranslations('report');
  const landmarks = queue.entryPoints.filter((ep) => !ep.landmark.startsWith('TODO'));
  const prefix = locale === 'en' ? '' : `/${locale}`;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-5">
      <Link
        href={`${prefix}/m/${mandal.slug}`}
        className="text-sm font-medium text-flame hover:text-maroon"
      >
        ← {mandalName(mandal, locale)}
      </Link>

      <h1 className="mt-3 text-2xl font-bold leading-tight text-maroon">{t('title')}</h1>
      <p className="mt-0.5 text-sm font-medium text-ink-soft">
        {queueLabel(queue, locale)} · {mandalName(mandal, locale)}
      </p>

      {landmarks.length === 0 ? (
        <p className="card mt-5 p-4 text-sm text-ink-soft">{t('noLandmarks')}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-ink">{t('instructions')}</p>
          <form action={submitEntryPointReport} className="mt-3">
            <input type="hidden" name="queueId" value={queue.id} />
            <input type="hidden" name="locale" value={locale} />
            <div className="space-y-2">
              {landmarks.map((ep, i) => (
                <label
                  key={ep.id}
                  className="card flex cursor-pointer items-center gap-3 p-3.5 transition-colors has-checked:border-flame has-checked:bg-amber-50 has-focus-visible:outline-2 has-focus-visible:outline-flame"
                >
                  <input
                    type="radio"
                    name="entryPointId"
                    value={ep.id}
                    required
                    className="sr-only"
                  />
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream-deep text-sm font-bold text-maroon">
                    {ep.sequence}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold text-ink">
                      {landmarkName(ep, locale)}
                    </span>
                    {i === 0 && (
                      <span className="text-xs text-band-green">{t('closest')}</span>
                    )}
                    {i === landmarks.length - 1 && landmarks.length > 1 && (
                      <span className="text-xs text-band-red">{t('farthest')}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-maroon px-4 py-3 text-base font-bold text-amber-50 shadow-sm transition-colors hover:bg-maroon-deep"
            >
              {t('submit')}
            </button>
            <p className="mt-2 text-center text-xs text-ink-soft">{t('moderation')}</p>
          </form>
        </>
      )}

      <section className="card mt-8 p-4">
        <h2 className="text-base font-bold text-ink">{t('completedTitle')}</h2>
        <p className="mt-1 text-xs text-ink-soft">{t('completedHint')}</p>
        <form action={submitCompletedWait} className="mt-3 space-y-3">
          <input type="hidden" name="queueId" value={queue.id} />
          <input type="hidden" name="locale" value={locale} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
              {t('joinedAt')}
              <input
                type="time"
                name="joined"
                required
                className="rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-base text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
              {t('darshanAt')}
              <input
                type="time"
                name="darshan"
                required
                className="rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-base text-ink"
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl border-2 border-maroon px-4 py-2.5 text-sm font-bold text-maroon transition-colors hover:bg-maroon hover:text-amber-50"
          >
            {t('submitCompleted')}
          </button>
        </form>
      </section>
    </div>
  );
}
