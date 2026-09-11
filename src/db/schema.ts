import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export type Tier = 's' | 'a' | 'b' | 'c';
export type QueueKind = 'mukh_darshan' | 'navas_charansparsh' | 'general';
export type ReportKind = 'entry_point' | 'completed_wait';
export type ReportStatus = 'pending' | 'accepted' | 'rejected';

export const mandals = pgTable('mandals', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  nameMr: text('name_mr'),
  nameHi: text('name_hi'),
  area: text('area').notNull(),
  /** Drives the wait baseline. s = Lalbaugcha Raja class. */
  tier: text('tier').$type<Tier>().notNull(),
  // Coordinates are nullable ON PURPOSE. Never invent them — a wrong pin in a
  // crowd is worse than no pin. They are set via the admin pin-drop form.
  idolLat: doublePrecision('idol_lat'),
  idolLng: doublePrecision('idol_lng'),
  nearestStation: text('nearest_station'),
  stationWalkMinutes: integer('station_walk_minutes'),
  /** Markdown, admin-editable. */
  notes: text('notes').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
});

export const queues = pgTable(
  'queues',
  {
    id: serial('id').primaryKey(),
    mandalId: integer('mandal_id')
      .notNull()
      .references(() => mandals.id),
    kind: text('kind').$type<QueueKind>().notNull(),
    label: text('label').notNull(),
    labelMr: text('label_mr'),
    // DEFAULT queue start point (where you join on a normal hour).
    entryLat: doublePrecision('entry_lat'),
    entryLng: doublePrecision('entry_lng'),
    /** Baseline wait in minutes at a neutral hour/day (factor = 1.0). */
    baseMinutes: integer('base_minutes').notNull(),
  },
  (t) => [index('queues_mandal_idx').on(t.mandalId)],
);

/**
 * Ordered holding points — the line grows BACKWARDS through these.
 * sequence 1 = closest to the idol. Police extend the queue through a known
 * sequence of streets, so "where does the line start?" maps monotonically to
 * wait length. This is the core insight of the reporting flow.
 */
export const queueEntryPoints = pgTable(
  'queue_entry_points',
  {
    id: serial('id').primaryKey(),
    queueId: integer('queue_id')
      .notNull()
      .references(() => queues.id),
    sequence: integer('sequence').notNull(),
    landmark: text('landmark').notNull(),
    landmarkMr: text('landmark_mr'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    /** Rough wait in minutes when the line starts HERE. Null until calibrated. */
    impliedMinutes: integer('implied_minutes'),
  },
  (t) => [index('qep_queue_idx').on(t.queueId)],
);

export const crowdReports = pgTable(
  'crowd_reports',
  {
    id: serial('id').primaryKey(),
    queueId: integer('queue_id')
      .notNull()
      .references(() => queues.id),
    kind: text('kind').$type<ReportKind>().notNull(),
    /** For kind = 'entry_point'. */
    entryPointId: integer('entry_point_id').references(() => queueEntryPoints.id),
    /** For kind = 'completed_wait'. */
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    darshanAt: timestamp('darshan_at', { withTimezone: true }),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash').notNull(),
    userAgentHash: text('user_agent_hash').notNull(),
    status: text('status').$type<ReportStatus>().notNull().default('pending'),
    // Snapshot of what the heuristic said at report time — the paper trail
    // for next year's calibration.
    heuristicLowMinutes: integer('heuristic_low_minutes'),
    heuristicHighMinutes: integer('heuristic_high_minutes'),
    heuristicProvenance: text('heuristic_provenance'),
  },
  (t) => [index('reports_queue_status_time_idx').on(t.queueId, t.status, t.reportedAt)],
);

export type Mandal = typeof mandals.$inferSelect;
export type Queue = typeof queues.$inferSelect;
export type QueueEntryPoint = typeof queueEntryPoints.$inferSelect;
export type CrowdReport = typeof crowdReports.$inferSelect;
