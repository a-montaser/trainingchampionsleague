import type { DateOnly } from '../time';
import type { HeadcountRow, RoundRow } from './types';

/**
 * The headcount in effect for a team on a given date: the most recent entry
 * whose effective-from date is on or before it.
 *
 * History is append-only, so past values are never lost — this is what lets a
 * closed round keep the headcount it was scored with even after an admin
 * changes the current one.
 */
export function resolveHeadcount(
  history: readonly HeadcountRow[],
  teamId: string,
  asOf: DateOnly,
): number | null {
  let best: HeadcountRow | null = null;

  for (const row of history) {
    if (row.teamId !== teamId) continue;
    if (row.effectiveFrom > asOf) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }

  return best ? best.headcount : null;
}

/**
 * Which date a round's headcount is read at.
 *
 *  - An open round uses **today**, so changing a headcount moves the live score.
 *  - A closed round uses its **last day**, so its final score is frozen against
 *    the headcount that was in effect back then.
 */
export function headcountAsOfForRound(round: RoundRow, today: DateOnly): DateOnly {
  return round.status === 'closed' ? round.endsOn : today;
}
