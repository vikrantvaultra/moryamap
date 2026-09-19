/**
 * "Ganpati Bappa Morya!" in the device's own voice — always an Indian one.
 *
 * The browser's speech voices differ per device, so this picks the best
 * Indian voice available and never falls back to a US/UK one: an American
 * voice reading "Morya" breaks the moment worse than silence. A real
 * recording (public/ashirwad/morya.m4a) beats all of this when provided.
 */

export interface VoiceLike {
  name: string;
  lang: string;
}

export type ChantScript = 'marathi' | 'hindi' | 'latin';

export interface ChantLine {
  text: string;
  rate: number;
  pitch: number;
}

/** "hi_IN" (Android) and "hi-in" both mean hi-IN. */
function langOf(v: VoiceLike): string {
  return v.lang.replace('_', '-').toLowerCase();
}

const isGoogle = (v: VoiceLike) => /google/i.test(v.name);

/**
 * Best Indian voice, in order: Google Marathi, Google Hindi, any Hindi, any
 * Marathi (Google's voices are the most natural where present), then Indian
 * English reading the words romanised. Null when the device has none.
 */
export function pickChantVoice<V extends VoiceLike>(
  voices: readonly V[],
): { voice: V; script: ChantScript } | null {
  const by = (prefix: string, google?: boolean) =>
    voices.find((v) => langOf(v).startsWith(prefix) && (google === undefined || isGoogle(v) === google));
  const mrG = by('mr', true);
  if (mrG) return { voice: mrG, script: 'marathi' };
  const hiG = by('hi', true);
  if (hiG) return { voice: hiG, script: 'hindi' };
  const hi = by('hi');
  if (hi) return { voice: hi, script: 'hindi' };
  const mr = by('mr');
  if (mr) return { voice: mr, script: 'marathi' };
  const enIn = voices.find((v) => langOf(v) === 'en-in');
  if (enIn) return { voice: enIn, script: 'latin' };
  return null;
}

/**
 * Call and response, the way the crowd says it: the call steady, "Morya!"
 * slower and higher. Spelled for the voice that reads it — Hindi voices say
 * "बप्पा", Marathi ones "बाप्पा".
 */
export function chantLines(script: ChantScript): ChantLine[] {
  const call = { rate: 0.9, pitch: 1.0 };
  const answer = { rate: 0.72, pitch: 1.25 };
  const words: Record<ChantScript, [string, string, string]> = {
    marathi: ['गणपती बाप्पा', 'मंगलमूर्ती', 'मोरया!'],
    hindi: ['गणपति बप्पा', 'मंगलमूर्ति', 'मोरया!'],
    latin: ['Ganpati Bappa', 'Mangal moorti', 'Morya!'],
  };
  const [first, second, morya] = words[script];
  return [
    { text: first, ...call },
    { text: morya, ...answer },
    { text: second, ...call },
    { text: morya, ...answer },
  ];
}

// --- Browser side ----------------------------------------------------------

/**
 * iOS only lets speech start from inside a tap. Call this from the tap that
 * leads to the darshan (the offering, or "begin darshan"); the chant that
 * plays seconds later is then allowed.
 */
export function primeSpeech(): void {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
    synth.getVoices(); // starts the async voice load in Chrome
  } catch {
    // Speech not available; the chant is still shown on screen.
  }
}

/** Voices load asynchronously and Safari doesn't always say when: poll briefly. */
async function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  for (let i = 0; i < 15; i++) {
    const voices = synth.getVoices();
    if (voices.length) return voices;
    await new Promise((r) => setTimeout(r, 100));
  }
  return synth.getVoices();
}

/** Speak the chant in the best Indian voice. Resolves false when there is none. */
export async function speakChant(): Promise<boolean> {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const pick = pickChantVoice(await loadVoices(synth));
  if (!pick) {
    console.info('[ashirwad] no Indian voice on this device; the chant is shown, not spoken');
    return false;
  }
  console.info(`[ashirwad] chant voice: ${pick.voice.name} (${pick.voice.lang})`);
  synth.cancel();
  for (const line of chantLines(pick.script)) {
    const u = new SpeechSynthesisUtterance(line.text);
    u.voice = pick.voice;
    u.lang = pick.voice.lang;
    u.rate = line.rate;
    u.pitch = line.pitch;
    synth.speak(u);
  }
  return true;
}
