/**
 * Seed data. Run with: npm run db:seed
 *
 * HONESTY RULE: coordinates are seeded as NULL on purpose. Do not invent
 * lat/lng — a wrong pin in a festival crowd is worse than no pin. Drop pins
 * via /admin once you have stood at the spot (or verified it properly).
 * Station names are well-known public facts; walk minutes are left null
 * until measured.
 */
import 'dotenv/config';
import { getDb } from './index';
import { mandals, queueEntryPoints, queues, type QueueKind, type Tier } from './schema';
import { eq } from 'drizzle-orm';

interface QueueSeed {
  kind: QueueKind;
  label: string;
  labelMr: string;
  baseMinutes: number;
  entryPointScaffold?: number; // how many TODO holding-point rows to create
}

interface MandalSeed {
  slug: string;
  name: string;
  nameMr: string;
  nameHi: string;
  area: string;
  tier: Tier;
  nearestStation: string | null;
  notes: string;
  queues: QueueSeed[];
}

const MUKH = (baseMinutes: number): QueueSeed => ({
  kind: 'mukh_darshan',
  label: 'Mukh Darshan',
  labelMr: 'मुख दर्शन',
  baseMinutes,
});

const SEED: MandalSeed[] = [
  {
    slug: 'lalbaugcha-raja',
    name: 'Lalbaugcha Raja',
    nameMr: 'लालबागचा राजा',
    nameHi: 'लालबाग का राजा',
    area: 'Lalbaug',
    tier: 's',
    nearestStation: 'Chinchpokli / Currey Road (Central), Lower Parel (Western)',
    notes: '',
    queues: [
      { ...MUKH(240), entryPointScaffold: 6 },
      {
        kind: 'navas_charansparsh',
        label: 'Navas / Charansparsh',
        labelMr: 'नवस / चरणस्पर्श',
        baseMinutes: 600,
        entryPointScaffold: 6,
      },
    ],
  },
  {
    slug: 'mumbaicha-raja',
    name: 'Mumbaicha Raja (Ganesh Galli)',
    nameMr: 'मुंबईचा राजा (गणेश गल्ली)',
    nameHi: 'मुंबई का राजा (गणेश गली)',
    area: 'Lalbaug',
    tier: 'a',
    nearestStation: 'Chinchpokli / Currey Road (Central), Lower Parel (Western)',
    notes: '',
    queues: [MUKH(90)],
  },
  {
    slug: 'gsb-seva-mandal',
    name: 'GSB Seva Mandal',
    nameMr: 'जीएसबी सेवा मंडळ',
    nameHi: 'जीएसबी सेवा मंडल',
    area: "King's Circle",
    tier: 'a',
    nearestStation: "King's Circle (Harbour), Matunga (Central)",
    notes: '',
    queues: [MUKH(90)],
  },
  {
    slug: 'andhericha-raja',
    name: 'Andhericha Raja',
    nameMr: 'अंधेरीचा राजा',
    nameHi: 'अंधेरी का राजा',
    area: 'Andheri East',
    tier: 'a',
    nearestStation: 'Andheri (Western / Metro)',
    notes: '',
    queues: [MUKH(90)],
  },
  {
    slug: 'chinchpoklicha-chintamani',
    name: 'Chinchpoklicha Chintamani',
    nameMr: 'चिंचपोकळीचा चिंतामणी',
    nameHi: 'चिंचपोकली का चिंतामणि',
    area: 'Chinchpokli',
    tier: 'a',
    nearestStation: 'Chinchpokli (Central)',
    notes: '',
    queues: [MUKH(90)],
  },
  {
    slug: 'khetwadicha-ganraj',
    name: 'Khetwadicha Ganraj',
    nameMr: 'खेतवाडीचा गणराज',
    nameHi: 'खेतवाड़ी का गणराज',
    area: 'Khetwadi',
    tier: 'a',
    nearestStation: 'Charni Road / Grant Road (Western)',
    notes: '',
    queues: [MUKH(90)],
  },
  {
    slug: 'tejukaya',
    name: 'Tejukaya Mandal',
    nameMr: 'तेजुकाया मंडळ',
    nameHi: 'तेजुकाया मंडल',
    area: 'Lalbaug',
    tier: 'b',
    nearestStation: 'Currey Road / Chinchpokli (Central)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'girgaoncha-raja',
    name: 'Girgaoncha Raja',
    nameMr: 'गिरगावचा राजा',
    nameHi: 'गिरगांव का राजा',
    area: 'Girgaon',
    tier: 'b',
    nearestStation: 'Charni Road (Western)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'fort-cha-raja',
    name: 'Fort cha Raja',
    nameMr: 'फोर्टचा राजा',
    nameHi: 'फोर्ट का राजा',
    area: 'Fort',
    tier: 'b',
    nearestStation: 'CSMT (Central), Churchgate (Western)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'keshavji-naik-chawl',
    name: 'Keshavji Naik Chawl',
    nameMr: 'केशवजी नाईक चाळ',
    nameHi: 'केशवजी नाईक चॉल',
    area: 'Girgaon',
    tier: 'b',
    nearestStation: 'Charni Road / Grant Road (Western)',
    notes: 'One of the oldest sarvajanik Ganeshotsav mandals in Mumbai.',
    queues: [MUKH(35)],
  },
  {
    slug: 'sahyadri-krida-mandal',
    name: 'Sahyadri Krida Mandal',
    nameMr: 'सह्याद्री क्रीडा मंडळ',
    nameHi: 'सह्याद्री क्रीड़ा मंडल',
    area: 'Tilak Nagar',
    tier: 'b',
    nearestStation: 'Tilak Nagar (Harbour)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'parel-cha-raja',
    name: 'Parel cha Raja',
    nameMr: 'परळचा राजा',
    nameHi: 'परेल का राजा',
    area: 'Parel',
    tier: 'b',
    nearestStation: 'Parel (Central), Prabhadevi (Western)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'chembur-cha-raja',
    name: 'Chembur cha Raja',
    nameMr: 'चेंबूरचा राजा',
    nameHi: 'चेंबूर का राजा',
    area: 'Chembur',
    tier: 'b',
    nearestStation: 'Chembur (Harbour)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'borivali-cha-raja',
    name: 'Borivali cha Raja',
    nameMr: 'बोरिवलीचा राजा',
    nameHi: 'बोरिवली का राजा',
    area: 'Borivali',
    tier: 'b',
    nearestStation: 'Borivali (Western)',
    notes: '',
    queues: [MUKH(35)],
  },
  {
    slug: 'thane-cha-raja',
    name: 'Thane cha Raja',
    nameMr: 'ठाण्याचा राजा',
    nameHi: 'ठाणे का राजा',
    area: 'Thane',
    tier: 'b',
    nearestStation: 'Thane (Central)',
    notes: '',
    queues: [MUKH(35)],
  },
];

async function main() {
  const db = getDb();

  for (const m of SEED) {
    const existing = await db.select().from(mandals).where(eq(mandals.slug, m.slug));
    if (existing.length > 0) {
      console.log(`skip (exists): ${m.slug}`);
      continue;
    }

    const [mandal] = await db
      .insert(mandals)
      .values({
        slug: m.slug,
        name: m.name,
        nameMr: m.nameMr,
        nameHi: m.nameHi,
        area: m.area,
        tier: m.tier,
        // TODO: set idolLat/idolLng via /admin pin-drop. Do NOT hardcode.
        nearestStation: m.nearestStation,
        // TODO: stationWalkMinutes — measure, then set via /admin.
        notes: m.notes,
      })
      .returning();

    for (const q of m.queues) {
      const [queue] = await db
        .insert(queues)
        .values({
          mandalId: mandal.id,
          kind: q.kind,
          label: q.label,
          labelMr: q.labelMr,
          // TODO: entryLat/entryLng via /admin — the QUEUE START, not the idol.
          baseMinutes: q.baseMinutes,
        })
        .returning();

      if (q.entryPointScaffold) {
        // Scaffold holding points; landmarks + impliedMinutes to be filled in
        // via /admin. sequence 1 = closest to the idol.
        await db.insert(queueEntryPoints).values(
          Array.from({ length: q.entryPointScaffold }, (_, i) => ({
            queueId: queue.id,
            sequence: i + 1,
            landmark: `TODO: landmark ${i + 1}`,
            landmarkMr: null,
          })),
        );
      }
    }
    console.log(`seeded: ${m.slug} (${m.queues.length} queue${m.queues.length > 1 ? 's' : ''})`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
