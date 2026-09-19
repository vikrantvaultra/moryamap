'use client';

import { useEffect, useState } from 'react';

/** Kept on this device only — the name never leaves the browser. */
export const NAME_KEY = 'morya_ashirwad_name';

export function readName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? '').trim().slice(0, 60);
  } catch {
    return '';
  }
}

/** "Whose name should this ashirwad carry?" — optional, remembered for the reveal. */
export default function NameField() {
  const [name, setName] = useState('');
  useEffect(() => setName(readName()), []);

  return (
    <label className="block">
      <span className="block text-sm font-semibold text-maroon">
        हा आशीर्वाद कोणाच्या नावे? <span className="font-normal text-ink-soft">· Whose name should it carry?</span>
      </span>
      <input
        type="text"
        value={name}
        maxLength={60}
        autoComplete="name"
        placeholder="Your name, or your family’s — e.g. Patil parivaar"
        onChange={(e) => {
          setName(e.target.value);
          try {
            localStorage.setItem(NAME_KEY, e.target.value);
          } catch {
            // Private mode: the reveal simply won't carry a name.
          }
        }}
        className="mt-2 w-full rounded-2xl border border-amber-900/20 bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/30"
      />
    </label>
  );
}
