import 'server-only';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { entries, roundStartDivisions, teams, users } from '../../db/schema';
import {
  computeIndividualStandings,
  computeTeamStandings,
  type IndividualStanding,
  type RoundRow,
  type TeamStanding,
} from '../scoring';
import { todayInCairo } from '../time';
import { loadHeadcountHistory } from './teams';
import { loadMembers } from './users';
import { getSettings } from './settings';

/**
 * Loads everything the scoring engine needs and runs it.
 *
 * The engine itself is pure, so this is the only place that touches the
 * database — and both the live standings page and the admin close-round preview
 * go through it, which is why the two can never disagree.
 */
export async function loadTeamStandings(
  round: RoundRow,
  exec: Executor = db,
): Promise<TeamStanding[]> {
  const [teamRows, entryRows, headcounts, members, startDivisions, settings] = await Promise.all([
    exec.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name)),
    exec
      .select({
        id: entries.id,
        userId: entries.userId,
        teamId: entries.teamId,
        roundId: entries.roundId,
        completedOn: entries.completedOn,
        durationMinutes: entries.durationMinutes,
        status: entries.status,
      })
      .from(entries)
      .where(and(gte(entries.completedOn, round.startsOn), lte(entries.completedOn, round.endsOn))),
    loadHeadcountHistory(exec),
    loadMembers(exec),
    exec
      .select({
        teamId: roundStartDivisions.teamId,
        division: roundStartDivisions.division,
        rank: roundStartDivisions.rank,
      })
      .from(roundStartDivisions)
      .where(eq(roundStartDivisions.roundId, round.id)),
    getSettings(exec),
  ]);

  return computeTeamStandings({
    teams: teamRows,
    entries: entryRows,
    headcounts,
    members,
    round,
    roundStartDivisions: startDivisions.map((d) => ({
      teamId: d.teamId,
      division: d.division === 1 ? 1 : 2,
      rank: d.rank,
    })),
    today: todayInCairo(),
    division1Size: settings.division1Size,
  });
}

export interface IndividualRow extends IndividualStanding {
  fullName: string;
  teamName: string | null;
}

/**
 * The individual leaderboard. Pass a round to score just that round, or omit it
 * for the whole tournament. `teamId` filters the table by the entrant's current
 * team without changing anyone's score.
 */
export async function loadIndividualStandings(
  options: { round?: RoundRow; teamId?: string } = {},
  exec: Executor = db,
): Promise<IndividualRow[]> {
  const { round, teamId } = options;

  const where = round
    ? and(gte(entries.completedOn, round.startsOn), lte(entries.completedOn, round.endsOn))
    : undefined;

  const [entryRows, participantRows] = await Promise.all([
    exec
      .select({
        id: entries.id,
        userId: entries.userId,
        teamId: entries.teamId,
        roundId: entries.roundId,
        completedOn: entries.completedOn,
        durationMinutes: entries.durationMinutes,
        status: entries.status,
      })
      .from(entries)
      .where(where),
    exec
      .select({
        userId: users.id,
        fullName: users.fullName,
        teamId: users.teamId,
        teamName: teams.name,
        isActive: users.isActive,
      })
      .from(users)
      .leftJoin(teams, eq(teams.id, users.teamId))
      .where(eq(users.role, 'participant')),
  ]);

  const byUser = new Map(participantRows.map((p) => [p.userId, p]));

  const ranked = computeIndividualStandings({
    entries: entryRows,
    members: participantRows.map((p) => ({
      userId: p.userId,
      teamId: p.teamId,
      isActive: p.isActive,
    })),
    round,
  });

  return ranked
    .map((row) => {
      const person = byUser.get(row.userId);
      return {
        ...row,
        fullName: person?.fullName ?? 'Unknown',
        teamName: person?.teamName ?? null,
      };
    })
    // Ranks are assigned across everyone first, then the view is filtered, so a
    // filtered table still shows each person's true position overall.
    .filter((row) => !teamId || row.teamId === teamId);
}
