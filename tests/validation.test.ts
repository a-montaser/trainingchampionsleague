import { describe, expect, it } from 'vitest';
import {
  canParticipantMutateEntry,
  validateEntry,
  type EntryValidationContext,
} from '@/lib/validation/entry';
import { round1, round2 } from './fixtures';

const closedRound1 = { ...round1, status: 'closed' as const };

function context(overrides: Partial<EntryValidationContext> = {}): EntryValidationContext {
  return {
    today: '2026-11-15',
    tournamentStart: '2026-10-01',
    tournamentEnd: '2027-03-31',
    rounds: [round1, round2],
    maxEntryMinutes: null,
    actorRole: 'participant',
    ...overrides,
  };
}

const valid = {
  trainingName: 'Secure coding fundamentals',
  completedOn: '2026-11-10',
  durationMinutes: 90,
  trainingUrl: 'https://learn.example.com/secure-coding',
  platform: 'udemy',
  notes: 'Module 3',
};

describe('entry validation', () => {
  it('accepts a complete entry and resolves its round', () => {
    const result = validateEntry(valid, context());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.roundId).toBe(round1.id);
      expect(result.affectsClosedRound).toBe(false);
    }
  });

  it('rejects a date in the future', () => {
    const result = validateEntry({ ...valid, completedOn: '2026-11-16' }, context());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.completedOn).toMatch(/future/i);
  });

  it('rejects a date outside the tournament', () => {
    const before = validateEntry({ ...valid, completedOn: '2026-09-30' }, context());
    expect(before.ok).toBe(false);

    const after = validateEntry(
      { ...valid, completedOn: '2027-04-01' },
      context({ today: '2027-04-05' }),
    );
    expect(after.ok).toBe(false);
  });

  it('rejects a zero or negative duration', () => {
    for (const durationMinutes of [0, -30]) {
      const result = validateEntry({ ...valid, durationMinutes }, context());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.durationMinutes).toBeTruthy();
    }
  });

  it('allows any duration when no maximum is configured, and enforces one when it is', () => {
    expect(validateEntry({ ...valid, durationMinutes: 6_000 }, context()).ok).toBe(true);

    const capped = validateEntry(
      { ...valid, durationMinutes: 600 },
      context({ maxEntryMinutes: 480 }),
    );
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.errors.durationMinutes).toMatch(/8\.0 hours/);
  });

  it('makes the link optional, but rejects anything that is not an http(s) link', () => {
    expect(validateEntry({ ...valid, trainingUrl: '' }, context()).ok).toBe(true);
    expect(validateEntry({ ...valid, trainingUrl: undefined }, context()).ok).toBe(true);

    const notAUrl = validateEntry({ ...valid, trainingUrl: 'my intranet page' }, context());
    expect(notAUrl.ok).toBe(false);

    // Only http(s) — a javascript: URL must never be stored and rendered.
    const dangerous = validateEntry(
      { ...valid, trainingUrl: 'javascript:alert(1)' },
      context(),
    );
    expect(dangerous.ok).toBe(false);
  });

  it('requires a platform from the list', () => {
    const missing = validateEntry({ ...valid, platform: '' }, context());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.platform).toBeTruthy();

    expect(validateEntry({ ...valid, platform: 'coursera' }, context()).ok).toBe(false);
  });

  it('requires a name when the platform is "Other"', () => {
    const unnamed = validateEntry({ ...valid, platform: 'other', platformOther: '  ' }, context());
    expect(unnamed.ok).toBe(false);
    if (!unnamed.ok) expect(unnamed.errors.platformOther).toBeTruthy();

    const named = validateEntry({ ...valid, platform: 'other', platformOther: 'Coursera' }, context());
    expect(named.ok).toBe(true);
  });

  it('accepts an entry with no notes, since notes are optional', () => {
    const withoutNotes = { ...valid, notes: undefined };
    expect(validateEntry(withoutNotes, context()).ok).toBe(true);
    expect(validateEntry({ ...valid, notes: '' }, context()).ok).toBe(true);
  });

  it('stops a participant logging into a closed round', () => {
    const result = validateEntry(
      valid,
      context({ rounds: [closedRound1, round2], today: '2027-01-20' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.completedOn).toMatch(/closed/i);
  });

  it('stops a participant logging into a round that has not started', () => {
    const result = validateEntry(
      { ...valid, completedOn: '2027-02-01' },
      context({ today: '2027-02-05' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.completedOn).toMatch(/not started/i);
  });

  it('lets an admin write into a closed round, but flags that it needs recalculating', () => {
    const result = validateEntry(
      valid,
      context({ rounds: [closedRound1, round2], today: '2027-01-20', actorRole: 'admin' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.affectsClosedRound).toBe(true);
  });

  it('reports which fields failed rather than only the first', () => {
    const result = validateEntry(
      {
        trainingName: '',
        completedOn: 'not-a-date',
        durationMinutes: 0,
        trainingUrl: 'nope',
        platform: '',
      },
      context(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'completedOn',
        'durationMinutes',
        'platform',
        'trainingName',
        'trainingUrl',
      ]);
    }
  });
});

describe('editing an existing entry', () => {
  it('is allowed only while the entry’s round is open', () => {
    expect(canParticipantMutateEntry([round1, round2], '2026-11-10')).toBe(true);
    expect(canParticipantMutateEntry([closedRound1, round2], '2026-11-10')).toBe(false);
    // Round 2 is scheduled, not yet open.
    expect(canParticipantMutateEntry([round1, round2], '2027-02-01')).toBe(false);
    expect(canParticipantMutateEntry([round1, round2], '2025-01-01')).toBe(false);
  });
});
