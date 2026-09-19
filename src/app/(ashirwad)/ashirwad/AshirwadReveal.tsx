'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Petals from './Petals';
import { readName } from './NameField';

/**
 * Shown only after the server has verified the pass. The artwork itself comes
 * from /api/ashirwad/image, which re-checks that pass on every request.
 *
 * The darshan is staged, in this order:
 *   1. The receipt, first — so the devotee knows the offering landed.
 *   2. The shankh is blown.
 *   3. Their name rises from below and travels into Bappa's ear.
 *   4. The ear receives it — a soft golden pulse.
 *   5. Bappa blesses: light pours out, the bell rings, petals shower, and the
 *      blessing appears line by line.
 *   6. "Ganpati Bappa Morya! Mangalmurti Morya!" — a recording if one is
 *      provided, otherwise the phone's own Marathi/Hindi voice.
 *
 * Browsers only allow sound after a tap. Straight after paying, the payment
 * tap still counts and everything plays at once; on a later visit the page
 * asks for one tap first rather than playing a silent darshan.
 */

type Stage = 'ready' | 'tap' | 'whisper' | 'heard' | 'blessed';

interface Point {
  x: number;
  y: number;
}

/** When each step starts, in ms from the shankh. */
const AT = { whisper: 900, heard: 4300, blessed: 5000, chant: 7300 } as const;

const CHANT = 'गणपती बाप्पा मोरया! मंगलमूर्ती मोरया!';

/** A temple bell, synthesised: inharmonic partials with a long decay. No audio file to ship. */
function ringBell(ctx: AudioContext) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
  const partials: [ratio: number, gain: number, decay: number][] = [
    [1, 1, 4.2],
    [2.0, 0.55, 3.2],
    [2.76, 0.42, 2.6],
    [5.4, 0.22, 1.6],
    [8.93, 0.12, 0.9],
  ];
  for (const [ratio, gain, decay] of partials) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 392 * ratio;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(env).connect(master);
    osc.start(now);
    osc.stop(now + decay + 0.1);
  }
}

/**
 * The chant in the device's own Marathi or Hindi voice. With neither, stay
 * silent: an English voice mangling "Morya" would break the moment.
 */
function speakChant() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const say = () => {
    // Google's Indic voices sound the most natural where a device has them.
    const voices = [...synth.getVoices()].sort(
      (a, b) => Number(b.name.includes('Google')) - Number(a.name.includes('Google')),
    );
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith('mr')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('hi'));
    if (!voice) return;
    const u = new SpeechSynthesisUtterance(CHANT);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.88;
    u.pitch = 1.05;
    synth.cancel();
    synth.speak(u);
  };
  // Voices load asynchronously on first use in Chrome.
  if (synth.getVoices().length) say();
  else synth.addEventListener('voiceschanged', say, { once: true });
}

export default function AshirwadReveal({
  ear,
  receipt,
  amount,
  shankh,
  chant,
  credits,
}: {
  ear: Point;
  receipt: string | null;
  amount: number;
  shankh: readonly string[];
  chant: string | null;
  credits: string[];
}) {
  const [stage, setStage] = useState<Stage>('ready');
  const [name, setName] = useState('');
  const [chanting, setChanting] = useState(false);
  const [motes, setMotes] = useState<{ id: number; x: number; y: number }[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const shankhEl = useRef<HTMLAudioElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const whisper = useRef<HTMLSpanElement | null>(null);
  const words = useRef<HTMLElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(false);

  // The payment was made down at the button; the darshan happens up in the
  // image. Bring them to it, or they'd miss their name reaching Bappa.
  // Manual restoration too: on a reload the browser would otherwise jump back
  // down as soon as the blessing makes the page tall enough.
  useEffect(() => {
    setName(readName());
    history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0 });
    return () => {
      history.scrollRestoration = 'auto';
    };
  }, []);

  const bell = useCallback(() => {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      ringBell(audio.current);
    } catch {
      // No Web Audio: the blessing stands without the bell.
    }
  }, []);

  const playChant = useCallback(() => {
    setChanting(true);
    if (chant) {
      new Audio(chant).play().catch(speakChant);
    } else {
      speakChant();
    }
  }, [chant]);

  /** Run the whole darshan from the shankh onwards. */
  const begin = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(AT.whisper, () => setStage('whisper'));
    at(AT.heard, () => setStage('heard'));
    at(AT.blessed, () => {
      setStage('blessed');
      bell();
    });
    // Let the light pour out over the image first, then bring the blessing
    // itself into view — on a phone it sits below the fold.
    at(AT.blessed + 1500, () =>
      words.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
    at(AT.chant, playChant);
  }, [bell, playChant]);

  // Try the shankh straight away. If the browser allows it (it does right
  // after paying), the darshan runs; if not, ask for one tap.
  useEffect(() => {
    const el = shankhEl.current;
    if (!el) return;
    el.volume = 0.85;
    el.play().then(begin, () => setStage('tap'));
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      window.speechSynthesis?.cancel();
    };
  }, [begin]);

  const tapToBegin = () => {
    setStage('ready');
    void shankhEl.current?.play().catch(() => undefined);
    begin();
  };

  // Golden motes left behind along the name's path to the ear.
  useEffect(() => {
    if (stage !== 'whisper') return;
    let id = 0;
    const iv = setInterval(() => {
      const box = frame.current?.getBoundingClientRect();
      const w = whisper.current?.getBoundingClientRect();
      if (!box || !w || box.width === 0) return;
      const x = ((w.left + w.width / 2 - box.left) / box.width) * 100;
      const y = ((w.top + w.height / 2 - box.top) / box.height) * 100;
      const mote = { id: ++id, x, y };
      setMotes((m) => [...m.slice(-24), mote]);
    }, 110);
    return () => clearInterval(iv);
  }, [stage]);

  const blessed = stage === 'blessed';
  const offered = name || 'तुमची प्रार्थना';

  const share = () => {
    const url = `${location.origin}/ashirwad`;
    const text =
      `🙏 गणपती बाप्पा मोरया!\n` +
      `मी माझं नाव बाप्पाच्या कानात सांगितलं आणि आशीर्वाद घेतला.\n` +
      `Whisper your name to Bappa and receive His ashirwad before He goes home:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col overflow-hidden px-4 pb-12 pt-5">
      <audio ref={shankhEl} preload="auto">
        {shankh.map((src) => (
          <source key={src} src={src} type={src.endsWith('.ogg') ? 'audio/ogg' : 'audio/mp4'} />
        ))}
      </audio>

      {blessed ? <Petals count={46} /> : <Petals count={10} slow />}

      {/* Relief first: the offering landed. */}
      <p className="ashirwad-rise relative mx-auto flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-900/40 px-4 py-1.5 text-sm font-semibold text-emerald-100">
        <span aria-hidden className="grid size-5 place-items-center rounded-full bg-emerald-500 text-xs text-white">
          ✓
        </span>
        ₹{amount} अर्पण स्वीकारले · Offering received
      </p>
      {receipt && (
        <p className="relative mt-1 text-center text-[11px] text-amber-100/50">Ref {receipt}</p>
      )}

      <p className="relative mt-4 text-center text-sm font-semibold tracking-[0.2em] text-amber-200/90">
        ॥ श्री गणेशाय नमः ॥
      </p>

      <figure className="relative mx-auto mt-3 w-full">
        <div
          aria-hidden
          className="ashirwad-rays absolute -inset-[30%] transition-opacity duration-1000"
          style={{ opacity: blessed ? 1 : 0.45 }}
        />
        <div aria-hidden className="ashirwad-aura absolute -inset-[12%] rounded-full" />
        <div
          ref={frame}
          className="relative overflow-hidden rounded-[2rem] shadow-[0_0_80px_rgb(245_158_11/0.45)] ring-2 ring-amber-300/60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/ashirwad/image"
            alt="Ganpati Bappa, in full light, blessing you"
            className={`ashirwad-approach block w-full ${blessed ? 'ashirwad-blessed' : ''}`}
          />
          <div aria-hidden className="ashirwad-flash pointer-events-none absolute inset-0" />

          {/* 3. The name, carried up into Bappa's ear. */}
          {stage === 'whisper' && (
            <span
              ref={whisper}
              className="ashirwad-whisper z-10 max-w-[80%] truncate whitespace-nowrap rounded-full bg-amber-50/95 px-4 py-1.5 text-lg font-bold text-maroon shadow-[0_0_28px_rgb(251_191_36/0.95)]"
              style={{ '--ex': `${ear.x}%`, '--ey': `${ear.y}%` } as React.CSSProperties}
            >
              🙏 {offered}
            </span>
          )}
          {motes.map((m) => (
            <span
              key={m.id}
              aria-hidden
              className="ashirwad-mote"
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            />
          ))}

          {/* 4. Heard. */}
          {(stage === 'heard' || blessed) && (
            <span aria-hidden className="ashirwad-ear" style={{ left: `${ear.x}%`, top: `${ear.y}%` }} />
          )}

          {/* 5. The blessing pours out. */}
          {blessed && <span aria-hidden className="ashirwad-bless" />}
          {blessed && <Petals count={20} />}
        </div>
      </figure>

      <section ref={words} className="relative mt-6 min-h-[18rem] scroll-mt-6 text-center">
        {(stage === 'ready' || stage === 'whisper' || stage === 'heard') && (
          <div className="ashirwad-rise">
            <p className="text-xl font-bold text-amber-50">
              {stage === 'heard' ? 'बाप्पांनी ऐकलं…' : 'बाप्पाच्या कानात तुमचं नाव…'}
            </p>
            <p className="mt-1 text-sm text-amber-100/80">
              {stage === 'heard'
                ? 'Bappa has heard you.'
                : `Carrying ${name ? name : 'your prayer'} to Bappa’s ear…`}
            </p>
          </div>
        )}

        {blessed && (
          <>
            {name && <p className="ashirwad-rise text-2xl font-bold text-amber-100">{name},</p>}
            <p
              className="ashirwad-rise mt-1 text-[1.65rem] font-bold leading-snug text-amber-50"
              style={{ '--at': '0.3s' } as React.CSSProperties}
            >
              बाप्पाचा आशीर्वाद सदैव तुमच्या पाठीशी आहे.
            </p>
            <p
              className="ashirwad-rise mt-2 text-base text-amber-100/85"
              style={{ '--at': '0.8s' } as React.CSSProperties}
            >
              Bappa heard your name. His blessing is with you — and with everyone you carried to
              Him today.
            </p>

            {chanting && (
              <p className="ashirwad-chant mt-6 text-[1.7rem] font-bold leading-tight text-marigold drop-shadow-[0_0_18px_rgb(245_158_11/0.6)]">
                गणपती बाप्पा मोरया!
                <span className="block text-xl text-amber-200">मंगलमूर्ती मोरया!</span>
              </p>
            )}

            <blockquote
              className="ashirwad-rise mx-auto mt-7 max-w-md rounded-3xl border border-amber-300/25 bg-black/25 px-5 py-4 backdrop-blur-sm"
              style={{ '--at': '1.6s' } as React.CSSProperties}
            >
              <p className="text-lg font-semibold leading-relaxed text-amber-100">
                वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ ।<br />
                निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा ॥
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/75">
                O Lord of the curved trunk and mighty form, radiant as a million suns — keep my
                path free of obstacles, in everything I do, always.
              </p>
            </blockquote>
          </>
        )}
      </section>

      {blessed && (
        <div
          className="ashirwad-rise relative mt-8 space-y-3"
          style={{ '--at': '2.6s' } as React.CSSProperties}
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (shankhEl.current) {
                  shankhEl.current.currentTime = 0;
                  void shankhEl.current.play().catch(() => undefined);
                }
              }}
              className="rounded-2xl border border-amber-300/40 bg-amber-100/10 px-3 py-3 text-sm font-semibold text-amber-100 active:scale-[0.98]"
            >
              🐚 शंख · Shankh
            </button>
            <button
              type="button"
              onClick={() => {
                bell();
                playChant();
              }}
              className="rounded-2xl border border-amber-300/40 bg-amber-100/10 px-3 py-3 text-sm font-semibold text-amber-100 active:scale-[0.98]"
            >
              🔔 मोरया! · Morya
            </button>
          </div>
          <button
            type="button"
            onClick={share}
            className="seva-shine relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-flame to-marigold px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-flame/30 active:scale-[0.98]"
          >
            📲 Share Bappa’s ashirwad with your family
          </button>
          <a
            href="/api/ashirwad/image?download"
            download="bappa-ashirwad.jpg"
            className="block w-full rounded-2xl border border-amber-300/40 px-5 py-3 text-center text-sm font-semibold text-amber-100 active:scale-[0.98]"
          >
            ⬇ Keep this darshan on your phone
          </a>
          <p className="pt-1 text-center text-xs text-amber-100/60">
            Open on this device for a year. Clearing your browser data clears it.
          </p>
        </div>
      )}

      {credits.length > 0 && (
        <p className="relative mt-8 text-center text-[10px] leading-relaxed text-amber-100/40">
          {credits.join(' · ')}
        </p>
      )}

      {/* One tap, when the browser wouldn't let the shankh sound by itself. */}
      {stage === 'tap' && (
        <button
          type="button"
          onClick={tapToBegin}
          className="ashirwad-sanctum fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-8 text-center"
        >
          <span className="ashirwad-flicker text-6xl" aria-hidden>
            🪔
          </span>
          <span className="text-2xl font-bold text-amber-50">बाप्पासमोर उभे राहा</span>
          <span className="text-base text-amber-100/85">Tap to stand before Bappa</span>
          <span className="mt-2 rounded-full bg-gradient-to-r from-flame to-marigold px-6 py-3 text-base font-bold text-white shadow-lg shadow-flame/30">
            🐚 दर्शन घ्या · Begin darshan
          </span>
        </button>
      )}
    </main>
  );
}
