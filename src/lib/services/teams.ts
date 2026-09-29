import 'server-only';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import {
  entries,
  roundStartDivisions,
  roundTeamResults,
  teamHeadcounts,
  teams,
  userTeamHistory,
  users,
} from '../../db/schema';
import type { Actor } from '../auth/guards';
import { assertAdmin, NotFoundError } from '../auth/guards';
import { resolveHeadcount } from '../scoring/headcount';
import type { DateOnly } from '../time';
import { isValidDateOnly, todayInCairo } from '../time';
import { whyTeamCannotBeDeleted, type TeamUsage } from '../team-deletion';
import { recordAudit } from './audit';

export interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  currentHeadcount: number | null;
}

/** Public: the team dropdown on registration and every leaderboard need this. */
export async function listTeams(exec: Executor = db): Promise<TeamSummary[]> {
  const today = todayInCairo();
  const [rows, history] = await Promise.all([
    exec.select().from(teams).orderBy(asc(teams.name)),
    exec.select().from(teamHeadcounts),
  ]);

  return rows.map((team) => ({
    id: team.id,
    name: team.name,
    slug: team.slug,
    currentHeadcount: resolveHeadcount(history, team.id, today),
  }));
}

export async function getTeam(teamId: string, exec: Executor = db) {
  const [team] = await exec.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new NotFoundError('That team does not exist.');
  return team;
}

export async function renameTeam(actor: Actor, teamId: string, name: string): Promise<void> {
  assertAdmin(actor);

  const trimmed = name.trim();
  if (!trimmed) throw new Error('A team needs a name.');
  if (trimmed.length > 100) throw new Error('Keep the team name under 100 characters.');

  await db.transaction(async (tx) => {
    const before = await getTeam(teamId, tx);
    await tx.update(teams).set({ name: trimmed }).where(eq(teams.id, teamId));
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'team.rename',
      entityType: 'team',
      entityId: teamId,
      before: { name: before.name },
      after: { name: trimmed },
    });
  });
}

/**
 * Sets a headcount from a given date. History is append-only: an existing row
 * for the same date is replaced, but earlier values are never touched, so a
 * closed round keeps the number it was scored with.
 */
export async function setHeadcount(
  actor: Actor,
  teamId: string,
  headcount: number,
  effectiveFrom: DateOnly,
): Promise<void> {
  assertAdmin(actor);

  if (!Number.isInteger(headcount) || headcount < 1) {
    throw new Error('Headcount must be a whole number of at least 1.');
  }
  if (!isValidDateOnly(effectiveFrom)) {
    throw new Error('Enter a valid effective-from date.');
  }

  await db.transaction(async (tx) => {
    await getTeam(teamId, tx);

    const history = await tx
      .select()
      .from(teamHeadcounts)
      .where(eq(teamHeadcounts.teamId, teamId));
    const previous = resolveHeadcount(history, teamId, effectiveFrom);

    await tx
      .insert(teamHeadcounts)
      .values({ teamId, headcount, effectiveFrom, createdByUserId: actor.id })
      .onConflictDoUpdate({
        target: [teamHeadcounts.teamId, teamHeadcounts.effectiveFrom],
        set: { headcount, createdByUserId: actor.id },
      });

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'team.headcount.set',
      entityType: 'team',
      entityId: teamId,
      before: { headcount: previous, effectiveFrom },
      after: { headcount, effectiveFrom },
    });
  });
}

export interface HeadcountHistoryRow {
  id: string;
  headcount: number;
  effectiveFrom: DateOnly;
  createdAt: Date;
}

export async function getHeadcountHistory(
  actor: Actor,
  teamId: string,
): Promise<HeadcountHistoryRow[]> {
  assertAdmin(actor);

  return db
    .select({
      id: teamHeadcounts.id,
      headcount: teamHeadcounts.headcount,
      effectiveFrom: teamHeadcounts.effectiveFrom,
      createdAt: teamHeadcounts.createdAt,
    })
    .from(teamHeadcounts)
    .where(eq(teamHeadcounts.teamId, teamId))
    .orderBy(desc(teamHeadcounts.effectiveFrom));
}

/** All headcount rows, for the scoring engine. */
export function loadHeadcountHistory(exec: Executor = db) {
  return exec
    .select({
      teamId: teamHeadcounts.teamId,
      headcount: teamHeadcounts.headcount,
      effectiveFrom: teamHeadcounts.effectiveFrom,
    })
    .from(teamHeadcounts);
}

/**
 * Creates a team.
 *
 * It joins the live standings straight away. With no starting-division row it
 * has no prior standing to break a tie on, so until it scores it sorts
 * alphabetically among the other teams on zero.
 */
export async function createTeam(
  actor: Actor,
  name: string,
  options: { headcount?: number; effectiveFrom?: DateOnly } = {},
): Promise<{ id: string }> {
  assertAdmin(actor);

  const trimmed = name.trim();
  if (!trimmed) throw new Error('A team needs a name.');
  if (trimmed.length > 100) throw new Error('Keep the team name under 100 characters.');

  const { headcount, effectiveFrom } = options;
  if (headcount !== undefined && (!Number.isInteger(headcount) || headcount < 1)) {
    throw new Error('Headcount must be a whole number of at least 1.');
  }
  if (effectiveFrom !== undefined && !isValidDateOnly(effectiveFrom)) {
    throw new Error('Enter a valid effective-from date.');
  }

  return db.transaction(async (tx) => {
    const existing = await tx.select({ name: teams.name, slug: teams.slug }).from(teams);
    if (existing.some((team) => team.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`There is already a team called ${trimmed}.`);
    }

    const [created] = await tx
      .insert(teams)
      .values({ name: trimmed, slug: uniqueSlug(trimmed, existing.map((t) => t.slug)) })
      .returning({ id: teams.id });

    if (headcount !== undefined && effectiveFrom !== undefined) {
      await tx
        .insert(teamHeadcounts)
        .values({ teamId: created.id, headcount, effectiveFrom, createdByUserId: actor.id });
    }

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'team.create',
      entityType: 'team',
      entityId: created.id,
      before: null,
      after: { name: trimmed, headcount: headcount ?? null, effectiveFrom: effectiveFrom ?? null },
    });

    return created;
  });
}

function uniqueSlug(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'team';

  if (!taken.includes(base)) return base;

  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** How much a team is used, for deciding whether it can be deleted. */
export async function getTeamUsage(
  actor: Actor,
  exec: Executor = db,
): Promise<Map<string, TeamUsage>> {
  assertAdmin(actor);

  const [userCounts, entryCounts, resultCounts, allTeams] = await Promise.all([
    exec
      .select({ teamId: users.teamId, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.teamId),
    exec
      .select({ teamId: entries.teamId, count: sql<number>`count(*)::int` })
      .from(entries)
      .groupBy(entries.teamId),
    exec
      .select({ teamId: roundTeamResults.teamId, count: sql<number>`count(*)::int` })
      .from(roundTeamResults)
      .groupBy(roundTeamResults.teamId),
    exec.select({ id: teams.id }).from(teams),
  ]);

  const usage = new Map<string, TeamUsage>(
    allTeams.map((team) => [team.id, { users: 0, entries: 0, frozenResults: 0 }]),
  );

  for (const row of userCounts) {
    if (row.teamId && usage.has(row.teamId)) usage.get(row.teamId)!.users = row.count;
  }
  for (const row of entryCounts) {
    if (usage.has(row.teamId)) usage.get(row.teamId)!.entries = row.count;
  }
  for (const row of resultCounts) {
    if (usage.has(row.teamId)) usage.get(row.teamId)!.frozenResults = row.count;
  }

  return usage;
}

/**
 * Deletes a team, but only one that nothing depends on. Anything that would
 * erase logged hours or change a closed round is refused rather than cascaded.
 */
export async function deleteTeam(actor: Actor, teamId: string): Promise<string> {
  assertAdmin(actor);

  return db.transaction(async (tx) => {
    const team = await getTeam(teamId, tx);
    const usage = (await getTeamUsage(actor, tx)).get(teamId) ?? {
      users: 0,
      entries: 0,
      frozenResults: 0,
    };

    const reason = whyTeamCannotBeDeleted(usage);
    if (reason) throw new Error(reason);

    // Only the team's own bookkeeping is removed with it.
    await tx.delete(teamHeadcounts).where(eq(teamHeadcounts.teamId, teamId));
    await tx.delete(userTeamHistory).where(eq(userTeamHistory.teamId, teamId));
    await tx.delete(roundStartDivisions).where(eq(roundStartDivisions.teamId, teamId));
    await tx.delete(teams).where(eq(teams.id, teamId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'team.delete',
      entityType: 'team',
      entityId: teamId,
      before: { name: team.name, slug: team.slug },
      after: null,
    });

    return team.name;
  });
}
