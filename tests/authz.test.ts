import { describe, expect, it } from 'vitest';
import {
  assertAdmin,
  assertCanMutateEntry,
  assertParticipant,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  type Actor,
} from '@/lib/auth/guards';
import { listAuditLog } from '@/lib/services/audit';
import {
  exportEntries,
  findFlaggedDays,
  listAllEntries,
  reviewEntry,
} from '@/lib/services/entries';
import {
  closeRound,
  generateSchedule,
  previewRoundClose,
  recalculateRound,
  setRoundStartDivisions,
} from '@/lib/services/rounds';
import { updateSettings } from '@/lib/services/settings';
import { getHeadcountHistory, renameTeam, setHeadcount } from '@/lib/services/teams';
import {
  changeUserTeam,
  listUsers,
  resetUserPassword,
  setUserActive,
} from '@/lib/services/users';

const participant: Actor = {
  id: 'participant-1',
  role: 'participant',
  isActive: true,
  teamId: 'team-1',
};
const admin: Actor = { id: 'admin-1', role: 'admin', isActive: true, teamId: null };
const deactivated: Actor = { ...participant, isActive: false };

describe('guards', () => {
  it('rejects a signed-out visitor', () => {
    expect(() => assertAdmin(null)).toThrow(UnauthenticatedError);
    expect(() => assertParticipant(undefined)).toThrow(UnauthenticatedError);
  });

  it('rejects a deactivated account on both sites', () => {
    expect(() => assertParticipant(deactivated)).toThrow(ForbiddenError);
    expect(() => assertAdmin({ ...admin, isActive: false })).toThrow(ForbiddenError);
  });

  it('rejects a participant from admin-only code, and an admin from participant-only code', () => {
    expect(() => assertAdmin(participant)).toThrow(ForbiddenError);
    expect(() => assertParticipant(admin)).toThrow(ForbiddenError);
    expect(() => assertAdmin(admin)).not.toThrow();
    expect(() => assertParticipant(participant)).not.toThrow();
  });
});

describe('entry ownership', () => {
  it('stops a participant touching another user’s entry', () => {
    expect(() => assertCanMutateEntry(participant, 'someone-else')).toThrow(NotFoundError);
  });

  it('reports someone else’s entry as not found rather than forbidden', () => {
    // A 403 would confirm the id exists; a 404 leaks nothing.
    try {
      assertCanMutateEntry(participant, 'someone-else');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as NotFoundError).status).toBe(404);
    }
  });

  it('allows a participant their own entry, and an admin any entry', () => {
    expect(() => assertCanMutateEntry(participant, participant.id)).not.toThrow();
    expect(() => assertCanMutateEntry(admin, 'anyone')).not.toThrow();
  });
});

/**
 * Every admin-only service, called with a participant account.
 *
 * The guard runs before any database work, so these assert the rejection
 * without needing a live database — if one of them ever reached a query, the
 * test would fail on a connection error instead, which is also a failure.
 */
const adminOnlyServices: Array<[string, (actor: Actor) => Promise<unknown>]> = [
  ['audit.list', (a) => listAuditLog(a)],
  ['settings.update', (a) => updateSettings(a, { approvalRequired: true })],
  ['teams.rename', (a) => renameTeam(a, 'team-1', 'Renamed')],
  ['teams.setHeadcount', (a) => setHeadcount(a, 'team-1', 12, '2026-11-01')],
  ['teams.headcountHistory', (a) => getHeadcountHistory(a, 'team-1')],
  ['users.list', (a) => listUsers(a)],
  ['users.changeTeam', (a) => changeUserTeam(a, 'u1', 'team-2', '2026-11-01')],
  ['users.resetPassword', (a) => resetUserPassword(a, 'u1')],
  ['users.setActive', (a) => setUserActive(a, 'u1', false)],
  ['rounds.generateSchedule', (a) => generateSchedule(a)],
  ['rounds.setStartDivisions', (a) => setRoundStartDivisions(a, 'r1', [])],
  ['rounds.previewClose', (a) => previewRoundClose(a, 'r1')],
  ['rounds.close', (a) => closeRound(a, 'r1')],
  ['rounds.recalculate', (a) => recalculateRound(a, 'r1', true)],
  ['entries.listAll', (a) => listAllEntries(a)],
  ['entries.review', (a) => reviewEntry(a, 'e1', 'counted')],
  ['entries.flaggedDays', (a) => findFlaggedDays(a)],
  ['entries.export', (a) => exportEntries(a)],
];

describe('admin services reject participant accounts', () => {
  it.each(adminOnlyServices)('%s', async (_name, call) => {
    await expect(call(participant)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(adminOnlyServices)('%s rejects a signed-out visitor', async (_name, call) => {
    await expect(call(null as unknown as Actor)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
