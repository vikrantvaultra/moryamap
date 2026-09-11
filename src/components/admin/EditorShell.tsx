'use client';

import dynamic from 'next/dynamic';
import type { EditorMandal, EditorQueue } from './MandalEditor';

const MandalEditor = dynamic(() => import('./MandalEditor'), {
  ssr: false,
  loading: () => <p className="text-sm text-stone-500">Loading editor…</p>,
});

export default function EditorShell(props: {
  mandal: EditorMandal;
  queues: EditorQueue[];
  saved: boolean;
  err: string | null;
}) {
  return <MandalEditor {...props} />;
}
