import type {
  Division,
  IndividualStanding,
  RoundRow,
  RoundStartDivisionRow,
  TeamStanding,
} from './types';

export interface FrozenTeamResult {
  teamId: string;
  teamName: string;
  finalDivision: Division;
  rankOverall: number;
  rankInDivision: number;
  totalMinutes: number;
  headcountUsed: number | null;
  participationNumerator: number;
  participationDenominator: number;
  movement: TeamStanding['movement'];
}

export interface RoundClosePreview {
  round: RoundRow;
  teamResults: FrozenTeamResult[];
  individualResults: IndividualStanding[];
  promoted: FrozenTeamResult[];
  relegated: FrozenTeamResult[];
  unchanged: FrozenTeamResult[];
  /** The baseline the next round starts from — this round's final table. */
  nextRoundStartDivisions: RoundStartDivisionRow[];
}

/**
 * Closing a round does not move anyone. Divisions are live, so the table
 * already shows who is where; closing **freezes** that table so later edits to
 * headcounts or entries cannot silently rewrite history.
 *
 * Pure: the admin preview and the committed result come from this same call,
 * which is what guarantees the two always match.
 */
export function buildRoundClosePreview(
  round: RoundRow,
  standings: readonly TeamStanding[],
  individualResults: readonly IndividualStanding[],
): RoundClosePreview {
  const teamResults: FrozenTeamResult[] = standings.map((s) => ({
    teamId: s.teamId,
    teamName: s.teamName,
    finalDivision: s.division,
    rankOverall: s.rankOverall,
    rankInDivision: s.rankInDivision,
    totalMinutes: s.totalMinutes,
    headcountUsed: s.headcount,
    participationNumerator: s.participationNumerator,
    participationDenominator: s.participationDenominator,
    movement: s.movement,
  }));

  return {
    round,
    teamResults,
    individualResults: [...individualResults],
    promoted: teamResults.filter((t) => t.movement === 'promoted'),
    relegated: teamResults.filter((t) => t.movement === 'relegated'),
    unchanged: teamResults.filter((t) => t.movement === 'stayed'),
    nextRoundStartDivisions: teamResults.map((t) => ({
      teamId: t.teamId,
      division: t.finalDivision,
      rank: t.rankOverall,
    })),
  };
}
