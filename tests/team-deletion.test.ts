import { describe, expect, it } from 'vitest';
import { canDeleteTeam, whyTeamCannotBeDeleted } from '@/lib/team-deletion';

const clean = { users: 0, entries: 0, frozenResults: 0 };

describe('deleting a team', () => {
  it('is allowed when nothing depends on it', () => {
    expect(whyTeamCannotBeDeleted(clean)).toBeNull();
    expect(canDeleteTeam(clean)).toBe(true);
  });

  it('is refused when hours have been logged against it', () => {
    // The strongest guard: deleting would erase training that really happened.
    expect(whyTeamCannotBeDeleted({ ...clean, entries: 1 })).toMatch(/erase those hours/);
    expect(canDeleteTeam({ ...clean, entries: 42 })).toBe(false);
  });

  it('is refused when it appears in a closed round', () => {
    expect(whyTeamCannotBeDeleted({ ...clean, frozenResults: 1 })).toMatch(/closed round/);
  });

  it('is refused while people are still on it', () => {
    expect(whyTeamCannotBeDeleted({ ...clean, users: 3 })).toMatch(/Move them to another team/);
  });

  it('reports the most serious reason first', () => {
    // A team with everything against it should mention the hours, not the
    // people — moving people would not make it deletable.
    expect(whyTeamCannotBeDeleted({ users: 5, entries: 9, frozenResults: 2 })).toMatch(
      /erase those hours/,
    );
  });

  it('gets the singular and plural right', () => {
    expect(whyTeamCannotBeDeleted({ ...clean, entries: 1 })).toContain('1 logged training');
    expect(whyTeamCannotBeDeleted({ ...clean, entries: 2 })).toContain('2 logged trainings');
    expect(whyTeamCannotBeDeleted({ ...clean, users: 1 })).toContain('1 person is');
    expect(whyTeamCannotBeDeleted({ ...clean, users: 2 })).toContain('2 people are');
  });
});
