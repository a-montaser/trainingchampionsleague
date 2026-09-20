import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { teamHeadcounts, teams } from '../../db/schema';
import type { Actor } from '../auth/guards';
import { assertAdmin, NotFoundError } from '../auth/guards';
import { resolveHeadcount } from '../scoring/headcount';
import type { DateOnly } from '../time';
import { isValidDateOnly, todayInCairo } from '../time';
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
