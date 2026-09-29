import 'server-only';
import { db } from '../../db';
import type { Actor } from '../auth/guards';
import { assertParticipant } from '../auth/guards';
import type { RoundRow, TeamStanding } from '../scoring';
import { cairoEndOfDay, daysBetween, todayInCairo } from '../time';
import { getCurrentRound } from './rounds';
import { loadIndividualStandings, loadTeamStandings } from './standings';

export interface DashboardData {
  round: RoundRow | null;
  /** Whole days left in the round, counting today. */
  daysLeft: number;
  roundEndsAt: Date | null;
  me: {
    roundMinutes: number;
    roundRank: number | null;
    tournamentMinutes: number;
    tournamentRank: number | null;
    entrantCount: number;
  };
  team: TeamStanding | null;
  /** The team immediately on the other side of the promotion/relegation line. */
  cutLineRival: {
    teamName: string;
    division: 1 | 2;
    totalMinutes: number;
    headcount: number | null;
  } | null;
}

/**
 * Everything the participant dashboard shows, in one pass: the person's own
 * total and rank, their team's live position, and how far the team is from
 * crossing the division line.
 */
export async function loadDashboard(actor: Actor): Promise<DashboardData> {
  assertParticipant(actor);

  const round = await getCurrentRound();
  const today = todayInCairo();

  const [roundRows, tournamentRows, standings] = await Promise.all([
    round ? loadIndividualStandings({ round }) : Promise.resolve([]),
    loadIndividualStandings({}),
    round ? loadTeamStandings(round, db) : Promise.resolve([]),
  ]);

  const mineThisRound = roundRows.find((r) => r.userId === actor.id);
  const mineOverall = tournamentRows.find((r) => r.userId === actor.id);
  const team = standings.find((s) => s.teamId === actor.teamId) ?? null;

  // The team on the other side of the line is the one this team is racing.
  let cutLineRival: DashboardData['cutLineRival'] = null;
  if (team) {
    const cutIndex = standings.findIndex((s) => s.division === 2);
    const rival = team.division === 1 ? standings[cutIndex] : standings[cutIndex - 1];
    if (rival && rival.teamId !== team.teamId) {
      cutLineRival = {
        teamName: rival.teamName,
        division: rival.division,
        totalMinutes: rival.totalMinutes,
        headcount: rival.headcount,
      };
    }
  }

  return {
    round,
    daysLeft: round ? Math.max(0, daysBetween(today, round.endsOn) + 1) : 0,
    roundEndsAt: round ? cairoEndOfDay(round.endsOn) : null,
    me: {
      roundMinutes: mineThisRound?.totalMinutes ?? 0,
      roundRank: mineThisRound?.rank ?? null,
      tournamentMinutes: mineOverall?.totalMinutes ?? 0,
      tournamentRank: mineOverall?.rank ?? null,
      entrantCount: tournamentRows.length,
    },
    team,
    cutLineRival,
  };
}
