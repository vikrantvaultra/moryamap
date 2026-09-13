import { getTranslations } from 'next-intl/server';
import type { PaginationLabels } from '@/components/Pagination';

/** Localized labels for <Pagination>/<PagedList>, reusing the home list's wording. */
export async function paginationLabels(): Promise<PaginationLabels> {
  const th = await getTranslations('home');
  const tc = await getTranslations('common');
  return { pageOf: th.raw('pageOf'), prev: tc('prevPage'), next: tc('nextPage') };
}
