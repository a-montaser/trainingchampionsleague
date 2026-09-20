import { z } from 'zod';
import type { DateOnly } from '../time';
import { isValidDateOnly, isWithin } from '../time';
import type { RoundRow } from '../scoring/types';

export const MAX_URL_LENGTH = 2048;
export const MAX_NAME_LENGTH = 200;
export const MAX_NOTES_LENGTH = 2000;

/**
 * Shape-level rules. Everything that depends on the tournament's state (today's
 * date, which rounds are open, the configured cap) is applied separately in
 * `validateEntry`, so it stays testable without a database.
 */
export const entryInputSchema = z.object({
  trainingName: z
    .string()
    .trim()
    .min(1, 'Enter the name of the training.')
    .max(MAX_NAME_LENGTH, `Keep the name under ${MAX_NAME_LENGTH} characters.`),
  completedOn: z
    .string()
    .trim()
    .refine(isValidDateOnly, 'Enter a valid date.'),
  durationMinutes: z
    .number()
    .int('Enter whole minutes.')
    .min(1, 'A training must be longer than 0 minutes.'),
  trainingUrl: z
    .url({ protocol: /^https?$/, error: 'Enter a link starting with http:// or https://' })
    .max(MAX_URL_LENGTH, 'That link is too long.'),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH, `Keep notes under ${MAX_NOTES_LENGTH} characters.`)
    .optional()
    .or(z.literal('')),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

export interface EntryValidationContext {
  today: DateOnly;
  tournamentStart: DateOnly;
  tournamentEnd: DateOnly;
  rounds: readonly RoundRow[];
  /** `null` means no cap, which is the configured default. */
  maxEntryMinutes: number | null;
  /** Admins may write into closed rounds; participants may not. */
  actorRole: 'participant' | 'admin';
}

export type FieldErrors = Partial<Record<keyof EntryInput, string>>;

export type EntryValidationResult =
  | { ok: true; value: EntryInput; roundId: string; affectsClosedRound: boolean }
  | { ok: false; errors: FieldErrors };

/**
 * Validates one training entry and resolves which round it belongs to.
 *
 * A participant may only log a training dated inside an **open** round, which
 * is what keeps closed rounds frozen. Admins may edit into a closed round, but
 * the caller is told so via `affectsClosedRound` and must run "recalculate
 * round" before the frozen results change.
 */
export function validateEntry(
  raw: unknown,
  context: EntryValidationContext,
): EntryValidationResult {
  const parsed = entryInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof EntryInput | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { ok: false, errors };
  }

  const value = parsed.data;
  const errors: FieldErrors = {};

  if (value.completedOn > context.today) {
    errors.completedOn = 'You cannot log a training in the future.';
  } else if (!isWithin(value.completedOn, context.tournamentStart, context.tournamentEnd)) {
    errors.completedOn = `Pick a date between ${context.tournamentStart} and ${context.tournamentEnd}.`;
  }

  if (context.maxEntryMinutes !== null && value.durationMinutes > context.maxEntryMinutes) {
    const hours = (context.maxEntryMinutes / 60).toFixed(1);
    errors.durationMinutes = `A single entry cannot be longer than ${hours} hours.`;
  }

  const round = errors.completedOn
    ? undefined
    : findRoundForDate(context.rounds, value.completedOn);

  if (!errors.completedOn && !round) {
    errors.completedOn = 'That date is not part of any round.';
  } else if (round && context.actorRole === 'participant' && round.status !== 'open') {
    errors.completedOn =
      round.status === 'closed'
        ? `${round.name} is closed, so its entries can no longer be changed.`
        : `${round.name} has not started yet.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value,
    roundId: round!.id,
    affectsClosedRound: round!.status === 'closed',
  };
}

export function findRoundForDate(
  rounds: readonly RoundRow[],
  date: DateOnly,
): RoundRow | undefined {
  return rounds.find((round) => isWithin(date, round.startsOn, round.endsOn));
}

/**
 * Whether a participant is still allowed to edit or delete an existing entry:
 * only while the round it falls in is open.
 */
export function canParticipantMutateEntry(
  rounds: readonly RoundRow[],
  completedOn: DateOnly,
): boolean {
  return findRoundForDate(rounds, completedOn)?.status === 'open';
}
