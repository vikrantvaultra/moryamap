'use client';

import { useEffect, useState } from 'react';
import { SEVA_PAID_EVENT, hasPass } from '@/lib/seva-client';

export interface RestoreLabels {
  label: string;
  placeholder: string;
  submit: string;
  checking: string;
  note: string;
  invalid: string;
  used: string;
  rateLimited: string;
  error: string;
  successTitle: string;
  successBody: string;
  already: string;
  goHome: string;
}

type State = 'idle' | 'busy' | 'done' | 'already' | 'invalid' | 'used' | 'rateLimited' | 'error';

/** Enter an admin-issued restore code to unlock this browser (see lib/restore). */
export default function RestoreForm({ labels, homeHref }: { labels: RestoreLabels; homeHref: string }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    // The code comes pre-filled from the link the admin sends: /restore?code=K7QM-3XPA
    const fromLink = new URLSearchParams(window.location.search).get('code');
    if (fromLink) setCode(fromLink.toUpperCase());
    if (hasPass()) setState('already');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/donate/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { paid?: boolean; error?: string };
      if (data.paid) {
        window.dispatchEvent(new Event(SEVA_PAID_EVENT));
        return setState('done');
      }
      if (res.status === 429) return setState('rateLimited');
      if (data.error === 'invalid' || data.error === 'used') return setState(data.error);
      setState('error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done' || state === 'already') {
    return (
      <div className="card mt-5 space-y-3 p-5 text-center">
        <p className="text-5xl" aria-hidden>
          🪔
        </p>
        <p className="text-lg font-bold text-maroon">
          {state === 'done' ? labels.successTitle : labels.already}
        </p>
        <p className="text-sm leading-relaxed text-ink">{labels.successBody}</p>
        <a
          href={homeHref}
          className="inline-block rounded-2xl bg-maroon px-5 py-3 text-sm font-bold text-amber-100"
        >
          {labels.goHome}
        </a>
      </div>
    );
  }

  const problem =
    state === 'invalid' || state === 'used' || state === 'rateLimited' || state === 'error'
      ? labels[state]
      : null;

  return (
    <form onSubmit={submit} className="card mt-5 space-y-3 p-5">
      <label htmlFor="restore-code" className="block text-sm font-bold text-maroon">
        {labels.label}
      </label>
      <input
        id="restore-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder={labels.placeholder}
        required
        maxLength={12}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        className="w-full rounded-xl border-2 border-amber-900/15 bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-ink outline-none focus:border-flame"
      />
      <button
        type="submit"
        disabled={state === 'busy'}
        className="seva-shine relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-flame to-marigold px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-flame/30 active:scale-[0.98] disabled:opacity-70"
      >
        {state === 'busy' ? labels.checking : labels.submit}
      </button>
      {problem && (
        <p role="alert" className="text-center text-sm font-medium text-band-red">
          {problem}
        </p>
      )}
      <p className="text-center text-xs text-ink-soft">🔒 {labels.note}</p>
    </form>
  );
}
