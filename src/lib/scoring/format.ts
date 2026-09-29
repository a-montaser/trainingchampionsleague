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

/**
 * Team score is displayed as hours ÷ headcount × 100, rounded to the nearest
 * whole number (halves round up).
 *
 * This is display only. Ranking compares exact minutes-per-person values, and
 * scaling every team by the same constant cannot change their order. Rounding
 * can make two teams *show* the same score while one still ranks above the
 * other — the tie-breakers decide, exactly as before.
 */
export const SCORE_MULTIPLIER = 100;

/**
 * The displayed score as an integer.
 *
 * hours ÷ headcount × 100 = minutes × 100 ÷ (60 × headcount)
 *                         = minutes × 5   ÷ (3 × headcount)
 *
 * Rounded with integer arithmetic on that exact fraction, so a true half
 * (e.g. 238.5) always rounds up instead of falling to 238.49999… as a float.
 */
export function scorePoints(totalMinutes: number, headcount: number | null): number {
  if (!headcount || headcount <= 0 || totalMinutes <= 0) return 0;

  const numerator = totalMinutes * 5;
  const denominator = 3 * headcount;
  // round-half-up(n / d) = floor((2n + d) / 2d)
  const twice = 2 * numerator + denominator;
  return (twice - (twice % (2 * denominator))) / (2 * denominator);
}

/** Team score as a bare whole number — for exports and sorting. */
export function formatScore(totalMinutes: number, headcount: number | null): string {
  return String(scorePoints(totalMinutes, headcount));
}

/** Team score as shown on screen: "238 points", or "1 point". */
export function formatScoreLabel(totalMinutes: number, headcount: number | null): string {
  const points = scorePoints(totalMinutes, headcount);
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

/**
 * Distance to the cut line, in the same whole-number points the tables show.
 *
 * Computed from the two *displayed* scores, so it always equals the difference
 * a participant would work out by reading the table.
 */
export function scoreGap(
  team: { totalMinutes: number; headcount: number | null },
  rival: { totalMinutes: number; headcount: number | null },
): number {
  return Math.abs(
    scorePoints(team.totalMinutes, team.headcount) -
      scorePoints(rival.totalMinutes, rival.headcount),
  );
}

/** Splits stored minutes back into the hours + minutes the entry form uses. */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function joinDuration(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
