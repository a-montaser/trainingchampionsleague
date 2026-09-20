import type { DateOnly } from '../time';
import { isWithin } from '../time';
import { headcountAsOfForRound, resolveHeadcount } from './headcount';
import type {
  Division,
  EntryRow,
  HeadcountRow,
  IndividualStanding,
  MemberRow,
  Movement,
  RoundRow,
  RoundStartDivisionRow,
  TeamRow,
  TeamStanding,
} from './types';

export const DEFAULT_DIVISION_1_SIZE = 5;

export interface TeamStandingsInput {
  teams: readonly TeamRow[];
  entries: readonly EntryRow[];
  headcounts: readonly HeadcountRow[];
  /** Current team membership, for the participation tie-breaker denominator. */
  members: readonly MemberRow[];
  round: RoundRow;
  roundStartDivisions: readonly RoundStartDivisionRow[];
  today: DateOnly;
  division1Size?: number;
}

/** Only counted entries score. Pending and rejected ones never do. */
function countsTowardScore(entry: EntryRow, round: RoundRow): boolean {
  return (
    entry.status === 'counted' && isWithin(entry.completedOn, round.startsOn, round.endsOn)
  );
}

/** Minutes per person, as a float. Exact comparison never goes through this. */
export function scorePerPerson(totalMinutes: number, headcount: number | null): number {
  if (!headcount || headcount <= 0) return 0;
  return totalMinutes / headcount;
}

/**
 * The live table.
 *
 * All teams are ranked together in one list; the top `division1Size` *are*
 * Division 1 and the rest are Division 2. Promotion and relegation are
 * therefore continuous — a team changes division the moment its score crosses
 * the cut line, with no admin action and no waiting for the round to close.
 */
export function computeTeamStandings(input: TeamStandingsInput): TeamStanding[] {
  const {
    teams,
    entries,
    headcounts,
    members,
    round,
    roundStartDivisions,
    today,
    division1Size = DEFAULT_DIVISION_1_SIZE,
  } = input;

  const asOf = headcountAsOfForRound(round, today);
  const startByTeam = new Map(roundStartDivisions.map((r) => [r.teamId, r]));

  const totals = new Map<string, number>();
  const contributors = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (!countsTowardScore(entry, round)) continue;
    totals.set(entry.teamId, (totals.get(entry.teamId) ?? 0) + entry.durationMinutes);
    let set = contributors.get(entry.teamId);
    if (!set) contributors.set(entry.teamId, (set = new Set()));
    set.add(entry.userId);
  }

  const registered = new Map<string, number>();
  for (const member of members) {
    if (!member.isActive || !member.teamId) continue;
    registered.set(member.teamId, (registered.get(member.teamId) ?? 0) + 1);
  }

  type Draft = Omit<TeamStanding, 'rankOverall' | 'division' | 'rankInDivision' | 'gapToCutLine'>;

  const drafts: Draft[] = teams.map((team) => {
    const totalMinutes = totals.get(team.id) ?? 0;
    const headcount = resolveHeadcount(headcounts, team.id, asOf);
    const start = startByTeam.get(team.id) ?? null;

    return {
      teamId: team.id,
      teamName: team.name,
      totalMinutes,
      headcount,
      score: { totalMinutes, headcount: headcount ?? 0 },
      participationNumerator: contributors.get(team.id)?.size ?? 0,
      participationDenominator: registered.get(team.id) ?? 0,
      startDivision: start ? start.division : null,
      movement: 'stayed' as Movement,
    };
  });

  const startRank = (teamId: string) => startByTeam.get(teamId)?.rank ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...drafts].sort((a, b) => compareTeams(a, b, startRank));

  const cutIndex = Math.max(0, Math.min(division1Size, sorted.length));

  return sorted.map((draft, index) => {
    const division: Division = index < cutIndex ? 1 : 2;

    // Everyone measures themselves against the team on the other side of the
    // line: Division 1 teams against the best Division 2 team, and vice versa.
    const opponent = division === 1 ? sorted[cutIndex] : sorted[cutIndex - 1];
    const mine = scorePerPerson(draft.totalMinutes, draft.headcount);
    const theirs = opponent
      ? scorePerPerson(opponent.totalMinutes, opponent.headcount)
      : mine;

    let movement: Movement = 'stayed';
    if (draft.startDivision !== null && draft.startDivision !== division) {
      movement = division === 1 ? 'promoted' : 'relegated';
    }

    return {
      ...draft,
      movement,
      division,
      rankOverall: index + 1,
      rankInDivision: division === 1 ? index + 1 : index + 1 - cutIndex,
      gapToCutLine: mine - theirs,
    };
  });
}

/**
 * Tie-breakers, in order:
 *   1. higher score (minutes per person)
 *   2. higher total minutes
 *   3. higher participation rate
 *   4. better standing when the round opened
 *   5. team name, alphabetically
 *
 * Step 4 is what keeps the seeded starting divisions intact on day one, when
 * every team is on zero and steps 1-3 are all ties. Step 5 is a guaranteed
 * total order, since team names are unique.
 */
function compareTeams(
  a: {
    totalMinutes: number;
    headcount: number | null;
    participationNumerator: number;
    participationDenominator: number;
    teamId: string;
    teamName: string;
  },
  b: typeof a,
  startRank: (teamId: string) => number,
): number {
  const byScore = compareRatios(
    a.totalMinutes,
    a.headcount ?? 0,
    b.totalMinutes,
    b.headcount ?? 0,
  );
  if (byScore !== 0) return -byScore;

  if (a.totalMinutes !== b.totalMinutes) return b.totalMinutes - a.totalMinutes;

  const byParticipation = compareRatios(
    a.participationNumerator,
    a.participationDenominator,
    b.participationNumerator,
    b.participationDenominator,
  );
  if (byParticipation !== 0) return -byParticipation;

  const rankDelta = startRank(a.teamId) - startRank(b.teamId);
  if (rankDelta !== 0) return rankDelta;

  return a.teamName.localeCompare(b.teamName);
}

/**
 * Compares `an/ad` with `bn/bd` using integer cross-multiplication, so scores
 * are never rounded before ranking. A zero or missing denominator scores 0.
 */
export function compareRatios(an: number, ad: number, bn: number, bd: number): number {
  const aZero = !ad || ad <= 0;
  const bZero = !bd || bd <= 0;
  if (aZero && bZero) return 0;
  if (aZero) return bn > 0 ? -1 : 0;
  if (bZero) return an > 0 ? 1 : 0;

  const left = an * bd;
  const right = bn * ad;
  return left === right ? 0 : left < right ? -1 : 1;
}

export interface IndividualStandingsInput {
  entries: readonly EntryRow[];
  members: readonly MemberRow[];
  /** Omit to score the whole tournament rather than a single round. */
  round?: RoundRow;
  /** Users with no counted entries are included on zero when true. */
  includeZero?: boolean;
}

/**
 * Individual score is simply total counted minutes. Ties share a rank
 * (1, 2, 2, 4), since there is no cut line to force apart.
 */
export function computeIndividualStandings(
  input: IndividualStandingsInput,
): IndividualStanding[] {
  const { entries, members, round, includeZero = true } = input;

  const teamOf = new Map(members.map((m) => [m.userId, m.teamId]));
  const totals = new Map<string, number>();

  if (includeZero) {
    for (const member of members) {
      if (member.isActive) totals.set(member.userId, 0);
    }
  }

  for (const entry of entries) {
    if (entry.status !== 'counted') continue;
    if (round && !isWithin(entry.completedOn, round.startsOn, round.endsOn)) continue;
    totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.durationMinutes);
  }

  const rows = [...totals.entries()]
    .map(([userId, totalMinutes]) => ({
      userId,
      teamId: teamOf.get(userId) ?? null,
      totalMinutes,
      rank: 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.userId.localeCompare(b.userId));

  let lastMinutes: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (row.totalMinutes === lastMinutes) {
      row.rank = lastRank;
    } else {
      row.rank = index + 1;
      lastRank = row.rank;
      lastMinutes = row.totalMinutes;
    }
  });

  return rows;
}
