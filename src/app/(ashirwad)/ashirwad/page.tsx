import { cookies } from 'next/headers';
import {
  ASHIRWAD_AMOUNT,
  ashirwad,
  ashirwadConfig,
  blessingCount,
  daysUntilVisarjan,
  devUnlockEnabled,
} from '@/lib/ashirwad';
import {
  PREVIEW_PATH,
  SHANKH_CREDIT,
  SHANKH_SOURCES,
  artworkCredit,
  artworkEar,
  chantSrc,
  hasAshirwadImage,
  hasAshirwadPreview,
} from '@/lib/ashirwad-image';
import AshirwadReveal from './AshirwadReveal';
import NameField from './NameField';
import Offer from './Offer';
import Petals from './Petals';

// Dynamic on purpose: the pass is read here, on the server, so a visitor who
// hasn't offered is never sent the real image in the first place.
export const dynamic = 'force-dynamic';

/**
 * The urgency on this page is the real calendar — Anant Chaturdashi, 25
 * September — never a made-up countdown or a "only 3 left".
 */
function farewell(days: number): { mr: string; en: string } {
  if (days > 1) {
    return {
      mr: `अजून फक्त ${days} दिवस… मग बाप्पा घरी परततील.`,
      en: `In ${days} days, Bappa goes home.`,
    };
  }
  if (days === 1) return { mr: 'उद्या बाप्पा घरी परततील.', en: 'Tomorrow, Bappa goes home.' };
  if (days === 0) return { mr: 'आज बाप्पा घरी परतत आहेत.', en: 'Today, Bappa goes home.' };
  return {
    mr: 'बाप्पा घरी परतले… पुढच्या वर्षी लवकर या!',
    en: 'Bappa has gone home. Until He comes again next year, keep His ashirwad close.',
  };
}

export default async function AshirwadPage() {
  const cfg = ashirwadConfig();
  const pass = (await cookies()).get(ashirwad.passCookie)?.value;
  const credit = artworkCredit();
  const devMode = devUnlockEnabled();
  if (cfg && ashirwad.hasPass(pass, cfg)) {
    return (
      <AshirwadReveal
        ear={artworkEar()}
        receipt={ashirwad.passRef(pass, cfg)}
        amount={ASHIRWAD_AMOUNT}
        shankh={SHANKH_SOURCES}
        chant={chantSrc()}
        credits={[credit, SHANKH_CREDIT].filter((c): c is string => Boolean(c))}
        devMode={devMode}
      />
    );
  }

  const ready = hasAshirwadImage();
  const preview = hasAshirwadPreview();
  const days = daysUntilVisarjan();
  const bye = farewell(days);
  const count = await blessingCount();

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col overflow-hidden px-4 pb-12 pt-6">
      <Petals count={16} slow />

      <p className="relative text-center text-sm font-semibold tracking-[0.2em] text-amber-200/90">
        ॥ श्री गणेशाय नमः ॥
      </p>

      <header className="relative mt-4 text-center">
        <h1 className="text-[2rem] font-bold leading-tight text-amber-50">
          बाप्पा तुमची वाट पाहत आहेत
        </h1>
        <p className="mt-1 text-lg font-medium text-amber-100/90">Bappa is waiting for you.</p>
      </header>

      {/* The murti, behind a veil. The veil is a genuinely destroyed 48px
          image, not the original under a CSS blur. */}
      <figure className="relative mx-auto mt-6 w-full">
        <div aria-hidden className="ashirwad-aura absolute -inset-[10%] rounded-full" />
        <div className="relative overflow-hidden rounded-[2rem] shadow-[0_0_60px_rgb(245_158_11/0.35)] ring-2 ring-amber-300/40">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={PREVIEW_PATH}
              alt="Bappa, veiled until your offering"
              className="block aspect-[4/5] w-full scale-110 object-cover"
            />
          ) : (
            <div className="aspect-[4/5] w-full bg-[radial-gradient(circle_at_50%_40%,#fde68a_0%,#f59e0b_30%,#7c2d12_70%,#2a0d04_100%)]" />
          )}
          <figcaption className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/60 via-black/10 to-black/30 p-6 text-center">
            <span>
              <span className="ashirwad-flicker text-5xl" aria-hidden>
                🪔
              </span>
              <span className="mt-3 block text-xl font-bold text-amber-50 drop-shadow">
                तुमच्यासाठी एक आशीर्वाद
              </span>
              <span className="mt-1 block text-sm font-medium text-amber-100/90 drop-shadow">
                A blessing is waiting, in your name
              </span>
            </span>
          </figcaption>
        </div>
      </figure>

      <section className="relative mt-8 space-y-4 text-center text-[1.05rem] leading-relaxed text-amber-50/90">
        <p className="text-xl font-bold text-marigold">
          {bye.mr}
          <span className="mt-1 block text-base font-semibold text-amber-100/90">{bye.en}</span>
        </p>
        <p>
          Maybe you couldn’t reach the pandal this year. Maybe the queue was too long for Aai’s
          knees, or you are far from Mumbai, far from home. Bappa doesn’t count the kilometres.
        </p>
        <p>
          Close your eyes for a moment. Think of the people you love — your parents, your children,
          the one you have been quietly worried about. <strong className="text-amber-100">Bring
          their names to Him.</strong>
        </p>
        <p className="text-amber-100">
          Write their names below and offer ₹{ASHIRWAD_AMOUNT} with a full heart. The shankh is
          blown, the veil lifts, and <strong>your names are carried into Bappa’s ear</strong>.
          Then He blesses you — in full light, as the petals fall, to “Ganpati Bappa Morya!”
        </p>
      </section>

      <div className="card relative mt-8 p-5 text-ink">
        <NameField />

        <p className="mt-2 text-xs text-ink-soft">
          This name is carried to Bappa’s ear. It stays on your phone and is never sent anywhere.
        </p>

        {cfg && ready ? (
          <Offer amount={ASHIRWAD_AMOUNT} devMode={devMode} />
        ) : (
          <p className="mt-5 rounded-2xl bg-cream-deep px-4 py-3 text-center text-sm text-ink-soft">
            {cfg
              ? 'Bappa’s darshan is being prepared. Please come back in a little while.'
              : 'Offerings are not switched on yet.'}
          </p>
        )}

        {cfg && ready && (
          <ul className="mt-4 space-y-1.5 text-sm text-ink">
            <li>
              <span aria-hidden className="mr-2 text-band-green">✓</span>
              The darshan opens the moment your UPI payment lands
            </li>
            <li>
              <span aria-hidden className="mr-2 text-band-green">✓</span>
              Secure UPI, processed by Razorpay · you see a receipt on screen
            </li>
            <li>
              <span aria-hidden className="mr-2 text-band-green">✓</span>
              Yours on this phone for a year — come back to it any time
            </li>
          </ul>
        )}

        {/* What the ₹501 is and who receives it, in plain words. Names the
            real payee — the same name the Razorpay sheet shows — and says
            what it is not, so nobody mistakes it for a puja. */}
        <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
          ₹{ASHIRWAD_AMOUNT} is shagun, not a price.
          {cfg && <> Your offering goes to {cfg.beneficiary}, the name on the payment screen.</>}{' '}
          It opens a digital darshan on this device: an artwork of Bappa blessing you, yours to
          keep and share. It is not a puja performed at any pandal.
        </p>
      </div>

      {count && (
        <p className="relative mt-5 text-center text-sm font-semibold text-amber-100/90">
          <span aria-hidden>🌼 </span>
          {count.toLocaleString('en-IN')} devotees have received Bappa’s ashirwad here
        </p>
      )}

      <p className="relative mt-8 text-center text-2xl font-bold text-marigold">
        गणपती बाप्पा मोरया!
      </p>

      {credit && preview && (
        <p className="relative mt-6 text-center text-[10px] text-amber-100/40">{credit}</p>
      )}
    </main>
  );
}
