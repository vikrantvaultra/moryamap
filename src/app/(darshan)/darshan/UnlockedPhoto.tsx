/** Shown only after the server has verified the pass. */
export default function UnlockedPhoto() {
  return (
    <>
      <figure className="overflow-hidden rounded-2xl bg-cream-deep">
        {/* Served by /api/darshan/image, which re-checks the pass on every request. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/darshan/image"
          alt="The mandal photograph, in full resolution"
          className="block w-full"
        />
      </figure>
      <a
        href="/api/darshan/image"
        download="mandal-darshan.jpg"
        className="mt-5 block w-full rounded-2xl bg-gradient-to-r from-flame to-marigold px-5 py-3.5 text-center text-base font-bold text-white shadow-lg shadow-flame/30 active:scale-[0.98]"
      >
        Download the photograph
      </a>
      <p className="mt-3 text-center text-xs text-ink-soft">
        Unlocked on this device for a year. Clearing your browser data clears it.
      </p>
    </>
  );
}
