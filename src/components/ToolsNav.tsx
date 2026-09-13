import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localePath } from '@/lib/site';

export const TOOLS = [
  { key: 'map', path: '/', icon: '📍' },
  { key: 'routes', path: '/routes', icon: '🪔' },
  { key: 'guide', path: '/guide', icon: '🙏' },
  { key: 'trains', path: '/trains', icon: '🚆' },
  { key: 'visarjan', path: '/visarjan', icon: '🌊' },
  { key: 'ponds', path: '/visarjan/ponds', icon: '🪷' },
] as const;

export type ToolKey = (typeof TOOLS)[number]['key'];

/**
 * Festival tools as a swipeable chip row. On phones it scrolls sideways
 * edge to edge; on wider screens the chips simply wrap.
 */
export default async function ToolsNav({
  locale,
  current,
  hideMap = false,
}: {
  locale: string;
  current?: ToolKey;
  hideMap?: boolean;
}) {
  const t = await getTranslations('nav');
  const items = hideMap ? TOOLS.filter((x) => x.key !== 'map') : TOOLS;
  return (
    <nav
      aria-label={t('title')}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-2 pb-1 sm:w-auto sm:flex-wrap">
        {items.map((item) => {
          const active = item.key === current;
          return (
            <li key={item.key}>
              <Link
                href={localePath(locale, item.path)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? 'border-maroon bg-maroon text-amber-50'
                    : 'border-amber-900/15 bg-white text-maroon hover:border-flame'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
