/**
 * All tournament dates are Cairo calendar dates.
 *
 * Calendar dates are handled as `YYYY-MM-DD` strings rather than `Date` objects.
 * ISO date strings sort lexicographically, so range checks and "which round is
 * this?" become plain string comparisons with no timezone drift possible.
 */

export const TOURNAMENT_TIMEZONE = 'Africa/Cairo';

/** A calendar date in `YYYY-MM-DD` form. */
export type DateOnly = string;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const cairoParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TOURNAMENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The current calendar date in Cairo. */
export function todayInCairo(now: Date = new Date()): DateOnly {
  // en-CA formats as YYYY-MM-DD.
  return cairoParts.format(now);
}

export function isValidDateOnly(value: string): value is DateOnly {
  if (!DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-trips only for real calendar dates (rejects 2026-02-30).
  const asUtc = new Date(Date.UTC(y, m - 1, d));
  return (
    asUtc.getUTCFullYear() === y &&
    asUtc.getUTCMonth() === m - 1 &&
    asUtc.getUTCDate() === d
  );
}

/** Inclusive on both ends. */
export function isWithin(date: DateOnly, start: DateOnly, end: DateOnly): boolean {
  return date >= start && date <= end;
}

/**
 * The instant a Cairo calendar day ends, as a real UTC timestamp. Used for
 * "time left in the round" countdowns.
 */
export function cairoEndOfDay(date: DateOnly): Date {
  return new Date(nextDay(date) + 'T00:00:00' + cairoOffset(date));
}

export function nextDay(date: DateOnly): DateOnly {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

export function daysBetween(from: DateOnly, to: DateOnly): number {
  const ms = Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z');
  return Math.round(ms / 86_400_000);
}

/**
 * Cairo's UTC offset on a given date, as `+HH:MM`. Egypt observes DST, so this
 * is resolved per-date rather than hard-coded.
 */
function cairoOffset(date: DateOnly): string {
  const probe = new Date(date + 'T12:00:00Z');
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: TOURNAMENT_TIMEZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value;

  // Shaped like "GMT+03:00"; "GMT" alone means +00:00.
  const match = tzName?.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : '+00:00';
}
