import type { DateOnly } from '../time';

export type EntryStatus = 'counted' | 'pending' | 'rejected';
export type RoundStatus = 'scheduled' | 'open' | 'closed';
export type Division = 1 | 2;
export type Movement = 'promoted' | 'relegated' | 'stayed';

/**
 * The scoring engine works on these plain shapes only — never on database
 * handles, `Date.now()`, or anything else it cannot be handed in a test.
 */

export interface TeamRow {
  id: string;
  name: string;
}

export interface EntryRow {
  id: string;
  userId: string;
  /** The team the user belonged to when the entry was created, never today's team. */
  teamId: string;
  roundId: string | null;
  completedOn: DateOnly;
  durationMinutes: number;
  status: EntryStatus;
}

export interface HeadcountRow {
  teamId: string;
  headcount: number;
  effectiveFrom: DateOnly;
}

export interface RoundRow {
  id: string;
  index: number;
  name: string;
  startsOn: DateOnly;
  endsOn: DateOnly;
  status: RoundStatus;
}

/** A user's *current* team membership, used for the participation tie-breaker. */
export interface MemberRow {
  userId: string;
  teamId: string | null;
  isActive: boolean;
}

/** The table as it stood when the round opened — the baseline for ▲/▼ badges. */
export interface RoundStartDivisionRow {
  teamId: string;
  division: Division;
  rank: number;
}

/** An exact rational score in minutes per person. Never rounded until display. */
export interface ExactScore {
  totalMinutes: number;
  headcount: number;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  totalMinutes: number;
  /** `null` when an admin has not set a headcount yet; the team then scores 0. */
  headcount: number | null;
  score: ExactScore;
  rankOverall: number;
  division: Division;
  rankInDivision: number;
  participationNumerator: number;
  participationDenominator: number;
  startDivision: Division | null;
  movement: Movement;
  /**
   * Minutes per person to the division cut line. Positive means "clear of the
   * line by this much"; negative means "this far short of crossing it".
   */
  gapToCutLine: number;
}

export interface IndividualStanding {
  userId: string;
  teamId: string | null;
  totalMinutes: number;
  rank: number;
}
