import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { JOB_ROLES } from '../lib/job-roles';

export const roleEnum = pgEnum('role', ['participant', 'admin']);
/** What the person does in the company. Never used for authorisation. */
export const jobRoleEnum = pgEnum('job_role', JOB_ROLES);
export const roundStatusEnum = pgEnum('round_status', ['scheduled', 'open', 'closed']);
export const entryStatusEnum = pgEnum('entry_status', ['counted', 'pending', 'rejected']);
export const movementEnum = pgEnum('movement', ['promoted', 'relegated', 'stayed']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/**
 * The people managers teams roll up to. Editable by admins, so the org chart
 * can change without a code release.
 */
export const peopleManagers = pgTable('people_managers', {
  id: id(),
  name: text('name').notNull().unique(),
  /**
   * Exactly one manager is the lead: everyone in a lead job role reports to
   * them whatever their team. Enforced in the service, not by a constraint.
   */
  isLead: boolean('is_lead').notNull().default(false),
  createdAt: createdAt(),
});

export const teams = pgTable('teams', {
  id: id(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  /** Null when no manager owns this team yet. */
  managerId: uuid('manager_id').references(() => peopleManagers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

/**
 * Append-only headcount history. Rows are never updated or deleted, so a closed
 * round can always be re-scored against the headcount it actually used.
 */
export const teamHeadcounts = pgTable(
  'team_headcounts',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    headcount: integer('headcount').notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    createdAt: createdAt(),
    createdByUserId: uuid('created_by_user_id'),
  },
  (t) => [unique('team_headcounts_team_date').on(t.teamId, t.effectiveFrom)],
);

export const users = pgTable(
  'users',
  {
    id: id(),
    fullName: text('full_name').notNull(),
    /** Always stored lower-cased; callers normalise before writing. */
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('participant'),
    /** Self-selected at registration; informational only. */
    jobRole: jobRoleEnum('job_role'),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    /**
     * Unused. Left in place from a removed email-verification feature so this
     * schema still matches the live database; dropping it would generate a
     * destructive migration for no gain. Nothing reads it.
     */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email), index('users_team_idx').on(t.teamId)],
);

/** Append-only record of every team move, for the audit trail. */
export const userTeamHistory = pgTable('user_team_history', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'restrict' }),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  createdAt: createdAt(),
  createdByUserId: uuid('created_by_user_id'),
});

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    /** Only the SHA-256 of the cookie value is stored. */
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * Unused. Left in place from a removed email-verification feature so this
 * schema still matches the live database. The table is empty and nothing reads
 * or writes it.
 */
export const emailVerificationCodes = pgTable('email_verification_codes', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  /** Wrong guesses, so a code cannot be brute-forced within its 10 minutes. */
  attempts: integer('attempts').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
});

export const rounds = pgTable(
  'rounds',
  {
    id: id(),
    index: integer('index').notNull().unique(),
    name: text('name').notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    status: roundStatusEnum('status').notNull().default('scheduled'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [unique('rounds_starts_on').on(t.startsOn)],
);

/**
 * The table as it stood when the round opened. This is *not* the live division
 * — that is always computed from current scores — it is the baseline used to
 * badge teams as promoted/relegated and to break day-one all-zero ties.
 */
export const roundStartDivisions = pgTable(
  'round_start_divisions',
  {
    id: id(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    division: smallint('division').notNull(),
    rank: integer('rank').notNull(),
  },
  (t) => [unique('round_start_divisions_round_team').on(t.roundId, t.teamId)],
);

export const entries = pgTable(
  'entries',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Snapshot of the user's team at creation time. Never rewritten. */
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    roundId: uuid('round_id').references(() => rounds.id, { onDelete: 'set null' }),
    trainingName: text('training_name').notNull(),
    completedOn: date('completed_on', { mode: 'string' }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    /** Required link to the training itself. */
    trainingUrl: text('training_url').notNull(),
    notes: text('notes'),
    status: entryStatusEnum('status').notNull().default('counted'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entries_user_idx').on(t.userId),
    index('entries_team_round_idx').on(t.teamId, t.roundId),
    index('entries_completed_idx').on(t.completedOn),
  ],
);

/** Frozen at round close. Later edits do not touch these until "recalculate". */
export const roundTeamResults = pgTable(
  'round_team_results',
  {
    id: id(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    finalDivision: smallint('final_division').notNull(),
    rankOverall: integer('rank_overall').notNull(),
    rankInDivision: integer('rank_in_division').notNull(),
    totalMinutes: integer('total_minutes').notNull(),
    headcountUsed: integer('headcount_used'),
    scoreMinutesPerPerson: numeric('score_minutes_per_person', { precision: 12, scale: 4 }).notNull(),
    participationNumerator: integer('participation_numerator').notNull(),
    participationDenominator: integer('participation_denominator').notNull(),
    movement: movementEnum('movement').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    computedByUserId: uuid('computed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [unique('round_team_results_round_team').on(t.roundId, t.teamId)],
);

export const roundIndividualResults = pgTable(
  'round_individual_results',
  {
    id: id(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    totalMinutes: integer('total_minutes').notNull(),
    rank: integer('rank').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('round_individual_results_round_user').on(t.roundId, t.userId)],
);

/** Single row, id = 1. */
export const settings = pgTable('settings', {
  id: smallint('id').primaryKey().default(1),
  approvalRequired: boolean('approval_required').notNull().default(false),
  /** null = no cap, which is the configured default. */
  maxEntryMinutes: integer('max_entry_minutes'),
  dailyFlagMinutes: integer('daily_flag_minutes').notNull().default(600),
  division1Size: integer('division_1_size').notNull().default(5),
  tournamentStart: date('tournament_start', { mode: 'string' }).notNull(),
  tournamentEnd: date('tournament_end', { mode: 'string' }).notNull(),
  timezone: text('timezone').notNull().default('Africa/Cairo'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt), index('audit_log_actor_idx').on(t.actorUserId)],
);

export type TeamRecord = typeof teams.$inferSelect;
export type UserRecord = typeof users.$inferSelect;
export type EntryRecord = typeof entries.$inferSelect;
export type RoundRecord = typeof rounds.$inferSelect;
export type SettingsRecord = typeof settings.$inferSelect;
