/**
 * Display formatting. Durations are stored and compared as integer minutes;
 * rounding happens here and nowhere else.
 */

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // The epsilon nudge keeps values like 2.675 from rounding down on binary floats.
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

/** Individual totals: hours to 1 decimal place. */
export function formatHours(minutes: number): string {
  return roundTo(minutes / 60, 1).toFixed(1);
}

/** Team score: hours per person to 2 decimal places. */
export function formatScore(totalMinutes: number, headcount: number | null): string {
  if (!headcount || headcount <= 0) return '0.00';
  return roundTo(totalMinutes / headcount / 60, 2).toFixed(2);
}

/** Signed hours per person, for "distance to the cut line". */
export function formatGap(minutesPerPerson: number): string {
  const hours = roundTo(minutesPerPerson / 60, 2);
  return `${hours >= 0 ? '+' : ''}${hours.toFixed(2)}`;
}

/** Splits stored minutes back into the hours + minutes the entry form uses. */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function joinDuration(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
