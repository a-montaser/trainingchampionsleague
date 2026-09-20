import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import {
  roundIndividualResults,
  roundStartDivisions,
  roundTeamResults,
  rounds,
  teams,
} from '../../db/schema';
import type { Actor } from '../auth/guards';
import { assertAdmin, NotFoundError } from '../auth/guards';
import {
  buildRoundClosePreview,
  scorePerPerson,
  type RoundClosePreview,
  type RoundRow,
} from '../scoring';
import { isWithin, todayInCairo, type DateOnly } from '../time';
import { recordAudit } from './audit';
import { getSettings } from './settings';
import { loadIndividualStandings, loadTeamStandings } from './standings';

export async function listRounds(exec: Executor = db): Promise<RoundRow[]> {
  return exec
    .select({
      id: rounds.id,
      index: rounds.index,
      name: rounds.name,
      startsOn: rounds.startsOn,
      endsOn: rounds.endsOn,
      status: rounds.status,
    })
    .from(rounds)
    .orderBy(asc(rounds.index));
}

export async function getRound(roundId: string, exec: Executor = db): Promise<RoundRow> {
  const [round] = await exec
    .select({
      id: rounds.id,
      index: rounds.index,
      name: rounds.name,
      startsOn: rounds.startsOn,
      endsOn: rounds.endsOn,
      status: rounds.status,
    })
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);

  if (!round) throw new NotFoundError('That round does not exist.');
  return round;
}

/**
 * The round to show by default: the one today falls inside, otherwise the open
 * one, otherwise the most recent.
 */
export async function getCurrentRound(exec: Executor = db): Promise<RoundRow | null> {
  const all = await listRounds(exec);
  if (all.length === 0) return null;

  const today = todayInCairo();
  return (
    all.find((r) => isWithin(today, r.startsOn, r.endsOn)) ??
    all.find((r) => r.status === 'open') ??
    all[all.length - 1]
  );
}

/**
 * Generates the round schedule from the tournament dates. Rounds are equal
 * calendar months; the last one absorbs any remainder so it ends exactly on the
 * tournament's final day.
 */
export function planRounds(
  start: DateOnly,
  end: DateOnly,
  lengthMonths: number,
): Array<{ index: number; name: string; startsOn: DateOnly; endsOn: DateOnly }> {
  if (lengthMonths < 1) throw new Error('Round length must be at least 1 month.');
  if (end < start) throw new Error('The tournament must end after it starts.');

  const plan: Array<{ index: number; name: string; startsOn: DateOnly; endsOn: DateOnly }> = [];
  let cursor = start;
  let index = 1;

  while (cursor <= end) {
    const [y, m, d] = cursor.split('-').map(Number);
    // The day before the same day-of-month, `lengthMonths` later.
    const nextStart = new Date(Date.UTC(y, m - 1 + lengthMonths, d));
    const lastDay = new Date(nextStart.getTime() - 86_400_000).toISOString().slice(0, 10);
    const endsOn = lastDay > end ? end : lastDay;

    plan.push({ index, name: `Round ${index}`, startsOn: cursor, endsOn });

    cursor = new Date(Date.parse(endsOn + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
    index += 1;
  }

  // Never leave a stub final round: fold anything shorter than half a round
  // into the one before it.
  if (plan.length > 1) {
    const last = plan[plan.length - 1];
    const lastDays = Date.parse(last.endsOn) - Date.parse(last.startsOn);
    if (lastDays < 14 * 86_400_000) {
      plan[plan.length - 2].endsOn = last.endsOn;
      plan.pop();
    }
  }

  return plan;
}

export async function generateSchedule(actor: Actor, lengthMonths = 3): Promise<RoundRow[]> {
  assertAdmin(actor);

  return db.transaction(async (tx) => {
    const settings = await getSettings(tx);
    const existing = await listRounds(tx);

    if (existing.some((r) => r.status === 'closed')) {
      throw new Error('The schedule cannot be regenerated once a round has been closed.');
    }

    const plan = planRounds(settings.tournamentStart, settings.tournamentEnd, lengthMonths);

    await tx.delete(rounds);
    const created = await tx
      .insert(rounds)
      .values(
        plan.map((p) => ({
          index: p.index,
          name: p.name,
          startsOn: p.startsOn,
          endsOn: p.endsOn,
          status: isWithin(todayInCairo(), p.startsOn, p.endsOn)
            ? ('open' as const)
            : ('scheduled' as const),
        })),
      )
      .returning();

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'rounds.generate_schedule',
      entityType: 'round',
      before: { rounds: existing.length },
      after: { rounds: created.length, lengthMonths },
    });

    return listRounds(tx);
  });
}

/** Sets the baseline table a round starts from. */
export async function setRoundStartDivisions(
  actor: Actor,
  roundId: string,
  assignments: Array<{ teamId: string; division: 1 | 2; rank: number }>,
): Promise<void> {
  assertAdmin(actor);

  await db.transaction(async (tx) => {
    const round = await getRound(roundId, tx);
    if (round.status === 'closed') {
      throw new Error('A closed round cannot have its starting divisions changed.');
    }

    const before = await tx
      .select()
      .from(roundStartDivisions)
      .where(eq(roundStartDivisions.roundId, roundId));

    await tx.delete(roundStartDivisions).where(eq(roundStartDivisions.roundId, roundId));
    if (assignments.length > 0) {
      await tx
        .insert(roundStartDivisions)
        .values(assignments.map((a) => ({ roundId, ...a })));
    }

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'round.set_start_divisions',
      entityType: 'round',
      entityId: roundId,
      before,
      after: assignments,
    });
  });
}

/**
 * The preview an admin sees before closing. Pure read — it writes nothing, and
 * it is the same call the commit uses, so the two always agree.
 */
export async function previewRoundClose(
  actor: Actor,
  roundId: string,
  exec: Executor = db,
): Promise<RoundClosePreview> {
  assertAdmin(actor);

  const round = await getRound(roundId, exec);
  const standings = await loadTeamStandings(round, exec);
  const individual = await loadIndividualForRound(round, exec);

  return buildRoundClosePreview(round, standings, individual);
}

async function loadIndividualForRound(round: RoundRow, exec: Executor) {
  const rows = await loadIndividualStandings({ round }, exec);
  return rows.map((r) => ({
    userId: r.userId,
    teamId: r.teamId,
    totalMinutes: r.totalMinutes,
    rank: r.rank,
  }));
}

/**
 * Freezes a round.
 *
 * Divisions are live, so this does not move anyone — the table already shows
 * who is where. Closing writes that table down so later edits to entries or
 * headcounts cannot silently rewrite it, and hands the next round its baseline.
 */
export async function closeRound(actor: Actor, roundId: string): Promise<RoundClosePreview> {
  assertAdmin(actor);

  return db.transaction(async (tx) => {
    const round = await getRound(roundId, tx);
    if (round.status === 'closed') throw new Error('That round is already closed.');

    const standings = await loadTeamStandings(round, tx);
    const individual = await loadIndividualForRound(round, tx);
    const preview = buildRoundClosePreview(round, standings, individual);

    await writeFrozenResults(tx, round, preview, standings, actor.id);

    await tx
      .update(rounds)
      .set({ status: 'closed', closedAt: new Date(), closedByUserId: actor.id })
      .where(eq(rounds.id, roundId));

    // Hand the next round its baseline and open it.
    const all = await listRounds(tx);
    const next = all.find((r) => r.index === round.index + 1);
    if (next) {
      await tx.delete(roundStartDivisions).where(eq(roundStartDivisions.roundId, next.id));
      await tx
        .insert(roundStartDivisions)
        .values(preview.nextRoundStartDivisions.map((d) => ({ roundId: next.id, ...d })));
      await tx.update(rounds).set({ status: 'open' }).where(eq(rounds.id, next.id));
    }

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'round.close',
      entityType: 'round',
      entityId: roundId,
      before: { status: round.status },
      after: {
        status: 'closed',
        standings: preview.teamResults,
        promoted: preview.promoted.map((t) => t.teamName),
        relegated: preview.relegated.map((t) => t.teamName),
        nextRoundOpened: next?.name ?? null,
      },
    });

    return preview;
  });
}

async function writeFrozenResults(
  tx: Executor,
  round: RoundRow,
  preview: RoundClosePreview,
  standings: Awaited<ReturnType<typeof loadTeamStandings>>,
  actorId: string,
) {
  await tx.delete(roundTeamResults).where(eq(roundTeamResults.roundId, round.id));
  await tx.delete(roundIndividualResults).where(eq(roundIndividualResults.roundId, round.id));

  if (preview.teamResults.length > 0) {
    await tx.insert(roundTeamResults).values(
      preview.teamResults.map((t) => {
        const live = standings.find((s) => s.teamId === t.teamId)!;
        return {
          roundId: round.id,
          teamId: t.teamId,
          finalDivision: t.finalDivision,
          rankOverall: t.rankOverall,
          rankInDivision: t.rankInDivision,
          totalMinutes: t.totalMinutes,
          headcountUsed: t.headcountUsed,
          scoreMinutesPerPerson: scorePerPerson(live.totalMinutes, live.headcount).toFixed(4),
          participationNumerator: t.participationNumerator,
          participationDenominator: t.participationDenominator,
          movement: t.movement,
          computedByUserId: actorId,
        };
      }),
    );
  }

  if (preview.individualResults.length > 0) {
    await tx.insert(roundIndividualResults).values(
      preview.individualResults.map((r) => ({
        roundId: round.id,
        userId: r.userId,
        teamId: r.teamId,
        totalMinutes: r.totalMinutes,
        rank: r.rank,
      })),
    );
  }
}

/**
 * Re-scores a closed round against current data, using the headcount that was
 * in effect on its last day. Frozen results only ever change through this call,
 * and only after the admin has confirmed the diff.
 */
export async function recalculateRound(
  actor: Actor,
  roundId: string,
  confirmed: boolean,
): Promise<RoundClosePreview> {
  assertAdmin(actor);

  const round = await getRound(roundId);
  if (round.status !== 'closed') {
    throw new Error('Only a closed round needs recalculating; open rounds are always live.');
  }

  const standings = await loadTeamStandings(round);
  const individual = await loadIndividualForRound(round, db);
  const preview = buildRoundClosePreview(round, standings, individual);

  if (!confirmed) return preview;

  return db.transaction(async (tx) => {
    const before = await tx
      .select()
      .from(roundTeamResults)
      .where(eq(roundTeamResults.roundId, roundId));

    await writeFrozenResults(tx, round, preview, standings, actor.id);

    // If the following round has not been closed yet, correct its baseline too.
    const all = await listRounds(tx);
    const next = all.find((r) => r.index === round.index + 1);
    if (next && next.status !== 'closed') {
      await tx.delete(roundStartDivisions).where(eq(roundStartDivisions.roundId, next.id));
      await tx
        .insert(roundStartDivisions)
        .values(preview.nextRoundStartDivisions.map((d) => ({ roundId: next.id, ...d })));
    }

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'round.recalculate',
      entityType: 'round',
      entityId: roundId,
      before: { standings: before },
      after: { standings: preview.teamResults },
    });

    return preview;
  });
}

export interface FrozenResultRow {
  teamId: string;
  teamName: string;
  finalDivision: number;
  rankOverall: number;
  rankInDivision: number;
  totalMinutes: number;
  headcountUsed: number | null;
  movement: 'promoted' | 'relegated' | 'stayed';
}

/** Public: past-round results shown on the participant standings page. */
export async function loadFrozenResults(
  roundId: string,
  exec: Executor = db,
): Promise<FrozenResultRow[]> {
  return exec
    .select({
      teamId: roundTeamResults.teamId,
      teamName: teams.name,
      finalDivision: roundTeamResults.finalDivision,
      rankOverall: roundTeamResults.rankOverall,
      rankInDivision: roundTeamResults.rankInDivision,
      totalMinutes: roundTeamResults.totalMinutes,
      headcountUsed: roundTeamResults.headcountUsed,
      movement: roundTeamResults.movement,
    })
    .from(roundTeamResults)
    .innerJoin(teams, eq(teams.id, roundTeamResults.teamId))
    .where(eq(roundTeamResults.roundId, roundId))
    .orderBy(asc(roundTeamResults.rankOverall));
}
