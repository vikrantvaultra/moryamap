'use client';

import dynamic from 'next/dynamic';
import type { RouteMapPoint } from './RouteMap';

// Same code-split as the home map: MapLibre stays out of the page bundle.
const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-cream-deep" />,
});

export default function RouteMapShell({
  points,
  line,
}: {
  points: RouteMapPoint[];
  line?: boolean;
}) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-2xl border border-amber-900/10 bg-cream-deep sm:h-80">
      <RouteMap points={points} line={line} />
    </div>
  );
}
