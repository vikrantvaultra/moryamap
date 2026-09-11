'use client';

import dynamic from 'next/dynamic';
import type { MapStrings } from './MapView';

// MapLibre is ~200KB — keep it out of the shared bundle and off the server.
// The page (waits, list, directions) is fully usable before/without the map.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="h-[56dvh] min-h-[340px] w-full animate-pulse bg-cream-deep" />,
});

export default function MapShell(props: { strings: MapStrings; locale: string }) {
  return <MapView {...props} />;
}
