import 'server-only';
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { entries, teams, users } from '../../db/schema';
import type { Actor } from '../auth/guards';
import {
  assertAdmin,
  assertCanMutateEntry,
  assertParticipant,
  ForbiddenError,
  NotFoundError,
} from '../auth/guards';
import type { EntryStatus } from '../scoring/types';
import { todayInCairo } from '../time';
import {
  canParticipantMutateEntry,
  validateEntry,
  type EntryValidationContext,
  type FieldErrors,
} from '../validation/entry';
import { recordAudit } from './audit';
import { listRounds } from './rounds';
import { getSettings, type TournamentSettings } from './settings';

export class EntryValidationFailed extends Error {
  constructor(readonly errors: FieldErrors) {
    super('That entry could not be saved.');
    this.name = 'EntryValidationFailed';
  }
}

async function validationContext(
  actor: Actor,
  exec: Executor = db,
): Promise<{ context: EntryValidationContext; settings: TournamentSettings }> {
  const [settings, rounds] = await Promise.all([getSettings(exec), listRounds(exec)]);

  const context: EntryValidationContext = {
    today: todayInCairo(),
    tournamentStart: settings.tournamentStart,
    tournamentEnd: settings.tournamentEnd,
    rounds,
    maxEntryMinutes: settings.maxEntryMinutes,
    actorRole: actor.role,
  };

  return { context, settings };
}

export interface EntryDraft {
  trainingName: string;
  completedOn: string;
  durationMinutes: number;
  trainingUrl: string;
  notes?: string;
}

/**
 * Logs a training. The entry snapshots the team the user is in right now, so
 * moving them later never rewrites past results.
 */
export async function createEntry(actor: Actor, draft: EntryDraft): Promise<{ id: string }> {
  assertParticipant(actor);
  if (!actor.teamId) throw new ForbiddenError('Your account is not assigned to a team yet.');

  return db.transaction(async (tx) => {
    const { context, settings } = await validationContext(actor, tx);
    const result = validateEntry(draft, context);
    if (!result.ok) throw new EntryValidationFailed(result.errors);

    const [created] = await tx
      .insert(entries)
      .values({
        userId: actor.id,
        teamId: actor.teamId!,
        roundId: result.roundId,
        trainingName: result.value.trainingName,
        completedOn: result.value.completedOn,
        durationMinutes: result.value.durationMinutes,
        trainingUrl: result.value.trainingUrl,
        notes: result.value.notes || null,
        // With approval switched off, an entry counts the moment it is saved.
        status: settings.approvalRequired ? 'pending' : 'counted',
      })
      .returning({ id: entries.id });

    return created;
  });
}

async function loadEntry(entryId: string, exec: Executor) {
  const [row] = await exec.select().from(entries).where(eq(entries.id, entryId)).limit(1);
  if (!row) throw new NotFoundError('That entry does not exist.');
  return row;
}

/**
 * Edits an entry.
 *
 * A participant may only touch their own, and only while the round it falls in
 * is open. Both the old and the new date are checked, so an entry cannot be
 * dragged out of a closed round or dropped into one.
 */
export async function updateEntry(
  actor: Actor,
  entryId: string,
  draft: EntryDraft,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await loadEntry(entryId, tx);
    assertCanMutateEntry(actor, existing.userId);

    const { context } = await validationContext(actor, tx);

    if (actor.role === 'participant' && !canParticipantMutateEntry(context.rounds, existing.completedOn)) {
      throw new ForbiddenError('That round is closed, so this entry can no longer be changed.');
    }

    const result = validateEntry(draft, context);
    if (!result.ok) throw new EntryValidationFailed(result.errors);

    await tx
      .update(entries)
      .set({
        trainingName: result.value.trainingName,
        completedOn: result.value.completedOn,
        durationMinutes: result.value.durationMinutes,
        trainingUrl: result.value.trainingUrl,
        notes: result.value.notes || null,
        roundId: result.roundId,
        updatedAt: new Date(),
      })
      .where(eq(entries.id, entryId));

    if (actor.role === 'admin') {
      await recordAudit(tx, {
        actorId: actor.id,
        action: 'entry.update',
        entityType: 'entry',
        entityId: entryId,
        before: existing,
        after: { ...result.value, roundId: result.roundId },
      });
    }
  });
}

export async function deleteEntry(actor: Actor, entryId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await loadEntry(entryId, tx);
    assertCanMutateEntry(actor, existing.userId);

    if (actor.role === 'participant') {
      const rounds = await listRounds(tx);
      if (!canParticipantMutateEntry(rounds, existing.completedOn)) {
        throw new ForbiddenError('That round is closed, so this entry can no longer be deleted.');
      }
    }

    await tx.delete(entries).where(eq(entries.id, entryId));

    if (actor.role === 'admin') {
      await recordAudit(tx, {
        actorId: actor.id,
        action: 'entry.delete',
        entityType: 'entry',
        entityId: entryId,
        before: existing,
        after: null,
      });
    }
  });
}

export interface EntryView {
  id: string;
  userId: string;
  userName: string;
  teamId: string;
  teamName: string | null;
  roundId: string | null;
  trainingName: string;
  trainingUrl: string;
  notes: string | null;
  completedOn: string;
  durationMinutes: number;
  status: EntryStatus;
  createdAt: Date;
}

const entryView = {
  id: entries.id,
  userId: entries.userId,
  userName: users.fullName,
  teamId: entries.teamId,
  teamName: teams.name,
  roundId: entries.roundId,
  trainingName: entries.trainingName,
  trainingUrl: entries.trainingUrl,
  notes: entries.notes,
  completedOn: entries.completedOn,
  durationMinutes: entries.durationMinutes,
  status: entries.status,
  createdAt: entries.createdAt,
};

/** A participant's own entries. Scoped to the actor — never accepts a user id. */
export async function listMyEntries(actor: Actor): Promise<EntryView[]> {
  assertParticipant(actor);

  return db
    .select(entryView)
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .leftJoin(teams, eq(teams.id, entries.teamId))
    .where(eq(entries.userId, actor.id))
    .orderBy(desc(entries.completedOn), desc(entries.createdAt));
}

export interface AdminEntryFilters {
  userId?: string;
  teamId?: string;
  roundId?: string;
  status?: EntryStatus;
  limit?: number;
  offset?: number;
}

export async function listAllEntries(
  actor: Actor,
  filters: AdminEntryFilters = {},
): Promise<EntryView[]> {
  assertAdmin(actor);

  const where: SQL[] = [];
  if (filters.userId) where.push(eq(entries.userId, filters.userId));
  if (filters.teamId) where.push(eq(entries.teamId, filters.teamId));
  if (filters.roundId) where.push(eq(entries.roundId, filters.roundId));
  if (filters.status) where.push(eq(entries.status, filters.status));

  return db
    .select(entryView)
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .leftJoin(teams, eq(teams.id, entries.teamId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(entries.completedOn), desc(entries.createdAt))
    .limit(filters.limit ?? 200)
    .offset(filters.offset ?? 0);
}

/** Approve or reject, available only while approval is switched on. */
export async function reviewEntry(
  actor: Actor,
  entryId: string,
  status: Extract<EntryStatus, 'counted' | 'rejected'>,
): Promise<void> {
  assertAdmin(actor);

  await db.transaction(async (tx) => {
    const settings = await getSettings(tx);
    if (!settings.approvalRequired) {
      throw new Error('Approval is switched off, so entries count as soon as they are logged.');
    }

    const existing = await loadEntry(entryId, tx);
    await tx
      .update(entries)
      .set({ status, reviewedByUserId: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(entries.id, entryId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: status === 'counted' ? 'entry.approve' : 'entry.reject',
      entityType: 'entry',
      entityId: entryId,
      before: { status: existing.status },
      after: { status },
    });
  });
}

export interface FlaggedDay {
  userId: string;
  userName: string;
  completedOn: string;
  totalMinutes: number;
}

/**
 * Days where one person logged more than the configured threshold, for the
 * admin entries screen to highlight.
 */
export async function findFlaggedDays(actor: Actor): Promise<FlaggedDay[]> {
  assertAdmin(actor);
  const settings = await getSettings();

  return db
    .select({
      userId: entries.userId,
      userName: users.fullName,
      completedOn: entries.completedOn,
      totalMinutes: sql<number>`sum(${entries.durationMinutes})::int`,
    })
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .where(eq(entries.status, 'counted'))
    .groupBy(entries.userId, users.fullName, entries.completedOn)
    .having(sql`sum(${entries.durationMinutes}) > ${settings.dailyFlagMinutes}`)
    .orderBy(desc(sql`sum(${entries.durationMinutes})`));
}

/** Entries for CSV export, optionally narrowed to one round. */
export async function exportEntries(
  actor: Actor,
  options: { roundIds?: string[]; from?: string; to?: string } = {},
): Promise<EntryView[]> {
  assertAdmin(actor);

  const where: SQL[] = [];
  if (options.roundIds?.length) where.push(inArray(entries.roundId, options.roundIds));
  if (options.from) where.push(gte(entries.completedOn, options.from));
  if (options.to) where.push(lte(entries.completedOn, options.to));

  return db
    .select(entryView)
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .leftJoin(teams, eq(teams.id, entries.teamId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(entries.completedOn));
}

/**
 * Loads one entry for editing. Scoped to the actor, so a participant asking for
 * another user's id gets "not found" rather than their data.
 */
export async function getEntryForEdit(actor: Actor, entryId: string): Promise<EntryView> {
  const [row] = await db
    .select(entryView)
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .leftJoin(teams, eq(teams.id, entries.teamId))
    .where(eq(entries.id, entryId))
    .limit(1);

  if (!row) throw new NotFoundError('That entry does not exist.');
  assertCanMutateEntry(actor, row.userId);
  return row;
}
