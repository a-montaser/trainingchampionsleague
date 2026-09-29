import type { DateOnly } from '../time';

export interface PlannedRound {
  index: number;
  name: string;
  startsOn: DateOnly;
  endsOn: DateOnly;
}

/**
 * Splits the tournament period into rounds of equal calendar months.
 *
 * Pure, and free of any server-only import, so the seed script and the admin
 * "generate schedule" action can share it.
 */
export function planRounds(
  start: DateOnly,
  end: DateOnly,
  lengthMonths: number,
): PlannedRound[] {
  if (lengthMonths < 1) throw new Error('Round length must be at least 1 month.');
  if (end < start) throw new Error('The tournament must end after it starts.');

  const plan: PlannedRound[] = [];
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

  // Never leave a stub final round: fold anything shorter than two weeks into
  // the round before it.
  if (plan.length > 1) {
    const last = plan[plan.length - 1];
    if (Date.parse(last.endsOn) - Date.parse(last.startsOn) < 14 * 86_400_000) {
      plan[plan.length - 2].endsOn = last.endsOn;
      plan.pop();
    }
  }

  return plan;
}
