'use client';

import { useState } from 'react';

/** The message to send the user, with copy and WhatsApp buttons. */
export default function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <textarea
        readOnly
        value={text}
        rows={5}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded border border-stone-300 bg-stone-50 p-2 font-mono text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded bg-maroon px-3 py-1.5 text-xs font-semibold text-white"
        >
          {copied ? 'Copied ✓' : 'Copy message'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700"
        >
          Send on WhatsApp
        </a>
      </div>
    </div>
  );
}
