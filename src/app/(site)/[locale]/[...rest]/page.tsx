import { notFound } from 'next/navigation';

// Unknown paths under a locale render the branded not-found page (with the
// site header and language switcher) instead of Next's bare default.
export default function CatchAll() {
  notFound();
}
