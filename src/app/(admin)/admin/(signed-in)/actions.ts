'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/dal';
import { AuthError } from '@/lib/auth/guards';
import { deleteEntry, reviewEntry, updateEntry, EntryValidationFailed } from '@/lib/services/entries';
import {
  closeRound,
  generateSchedule,
  recalculateRound,
  setRoundStartDivisions,
} from '@/lib/services/rounds';
import {
  createPeopleManager,
  deletePeopleManager,
  setLeadManager,
  setTeamManager,
} from '@/lib/services/people-managers';
import { updateSettings } from '@/lib/services/settings';
import { createTeam, deleteTeam, renameTeam, setHeadcount } from '@/lib/services/teams';
import {
  changeUserJobRole,
  changeUserTeam,
  resetUserPassword,
  setUserActive,
} from '@/lib/services/users';

/**
 * Every admin mutation.
 *
 * Each one calls `requireAdmin()` first: a server action is an ordinary POST
 * endpoint as far as an attacker is concerned, so nothing here relies on the
 * page that rendered the form, on the proxy redirect, or on the layout.
 */

export interface ActionState {
  error?: string;
  notice?: string;
}

/** Runs an admin mutation, turning thrown errors into a message on the page. */
async function run(
  work: () => Promise<string | void>,
  paths: string[] = [],
): Promise<ActionState> {
  await requireAdmin();

  try {
    const notice = await work();
    for (const path of paths) revalidatePath(path);
    return { notice: notice || 'Saved.' };
  } catch (error) {
    if (error instanceof EntryValidationFailed) {
      return { error: Object.values(error.errors)[0] ?? error.message };
    }
    if (error instanceof AuthError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

/** Standings appear on the participant site too, so those views refresh. */
const SCORING_VIEWS = ['/admin', '/admin/rounds', '/standings', '/leaderboard', '/managers', '/dashboard'];

// ── Teams ──────────────────────────────────────────────────────────────────

export async function renameTeamAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const teamId = String(formData.get('teamId') ?? '');
  const name = String(formData.get('name') ?? '');

  return run(
    async () => {
      await renameTeam(actor, teamId, name);
      return `Renamed to ${name.trim()}.`;
    },
    ['/admin/teams', ...SCORING_VIEWS],
  );
}

export async function createTeamAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const name = String(formData.get('name') ?? '');
  const headcountRaw = String(formData.get('headcount') ?? '').trim();
  const effectiveFrom = String(formData.get('effectiveFrom') ?? '');

  return run(
    async () => {
      await createTeam(actor, name, {
        headcount: headcountRaw === '' ? undefined : Number(headcountRaw),
        effectiveFrom: headcountRaw === '' ? undefined : effectiveFrom,
      });
      return `Added ${name.trim()}. It is in the standings from now.`;
    },
    ['/admin/teams', '/register', ...SCORING_VIEWS],
  );
}

/** Refused outright if it would erase logged hours or change a closed round. */
export async function deleteTeamAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const teamId = String(formData.get('teamId') ?? '');

  if (formData.get('confirm') !== 'yes') {
    return { error: 'Confirm to delete the team.' };
  }

  return run(
    async () => {
      const name = await deleteTeam(actor, teamId);
      return `Deleted ${name}.`;
    },
    ['/admin/teams', '/register', ...SCORING_VIEWS],
  );
}

export async function setHeadcountAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const teamId = String(formData.get('teamId') ?? '');
  const headcount = Number(formData.get('headcount'));
  const effectiveFrom = String(formData.get('effectiveFrom') ?? '');

  return run(
    async () => {
      await setHeadcount(actor, teamId, headcount, effectiveFrom);
      return `Headcount set to ${headcount} from ${effectiveFrom}.`;
    },
    ['/admin/teams', ...SCORING_VIEWS],
  );
}

// ── People managers ────────────────────────────────────────────────────────

/** Refreshes the manager leaderboard as well as the admin screen. */
const MANAGER_VIEWS = ['/admin/managers', '/managers'];

export async function setTeamManagerAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const teamId = String(formData.get('teamId') ?? '');
  const managerId = String(formData.get('managerId') ?? '');

  return run(async () => {
    await setTeamManager(actor, teamId, managerId || null);
    return managerId ? 'Manager set.' : 'Manager cleared.';
  }, MANAGER_VIEWS);
}

export async function createManagerAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const name = String(formData.get('name') ?? '');

  return run(async () => {
    await createPeopleManager(actor, name);
    return `Added ${name.trim()}.`;
  }, MANAGER_VIEWS);
}

export async function deleteManagerAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const managerId = String(formData.get('managerId') ?? '');

  if (formData.get('confirm') !== 'yes') {
    return { error: 'Confirm to remove this manager.' };
  }

  return run(() => deletePeopleManager(actor, managerId), MANAGER_VIEWS);
}

export async function setLeadManagerAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const managerId = String(formData.get('managerId') ?? '');

  return run(() => setLeadManager(actor, managerId), MANAGER_VIEWS);
}

// ── Rounds ─────────────────────────────────────────────────────────────────

export async function generateScheduleAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const months = Number(formData.get('lengthMonths') || 3);

  return run(
    async () => {
      const rounds = await generateSchedule(actor, months);
      return `Created ${rounds.length} rounds of ${months} months.`;
    },
    ['/admin/rounds', ...SCORING_VIEWS],
  );
}

export async function setStartDivisionsAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const roundId = String(formData.get('roundId') ?? '');
  const raw = String(formData.get('assignments') ?? '[]');

  return run(
    async () => {
      const assignments = JSON.parse(raw) as Array<{
        teamId: string;
        division: 1 | 2;
        rank: number;
      }>;
      await setRoundStartDivisions(actor, roundId, assignments);
      return 'Starting divisions saved.';
    },
    ['/admin/rounds', ...SCORING_VIEWS],
  );
}

/** Closing is irreversible, so the form must send an explicit confirmation. */
export async function closeRoundAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const roundId = String(formData.get('roundId') ?? '');

  if (formData.get('confirm') !== 'yes') {
    return { error: 'Confirm to close the round.' };
  }

  const result = await run(
    async () => {
      const preview = await closeRound(actor, roundId);
      const moved = preview.promoted.length + preview.relegated.length;
      return `${preview.round.name} closed. ${moved} ${moved === 1 ? 'team' : 'teams'} changed division.`;
    },
    ['/admin/rounds', ...SCORING_VIEWS],
  );

  if (result.error) return result;
  redirect(`/admin/rounds/${roundId}?closed=1`);
}

export async function recalculateRoundAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const roundId = String(formData.get('roundId') ?? '');

  if (formData.get('confirm') !== 'yes') {
    return { error: 'Confirm to rewrite the frozen results.' };
  }

  return run(
    async () => {
      await recalculateRound(actor, roundId, true);
      return 'Frozen results recalculated.';
    },
    ['/admin/rounds', `/admin/rounds/${roundId}`, ...SCORING_VIEWS],
  );
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function changeUserTeamAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const teamId = String(formData.get('teamId') ?? '');
  const effectiveFrom = String(formData.get('effectiveFrom') ?? '');

  return run(
    async () => {
      await changeUserTeam(actor, userId, teamId, effectiveFrom);
      return 'Team changed. Their existing entries stay with the old team.';
    },
    ['/admin/users', ...SCORING_VIEWS],
  );
}

/** The company role. Never the authorisation role — that is not editable here. */
export async function changeJobRoleAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const jobRole = String(formData.get('jobRole') ?? '');

  return run(
    async () => {
      await changeUserJobRole(actor, userId, jobRole || null);
      return jobRole
        ? `Role set to ${jobRole}.`
        : 'Role cleared. They are mapped by team until one is set.';
    },
    // A lead role reports to the lead manager, so this can move them.
    ['/admin/users', '/managers', '/admin/managers'],
  );
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');

  return run(async () => {
    const temporary = await resetUserPassword(actor, userId);
    return `Temporary password: ${temporary} — read it out now, it is not stored.`;
  }, ['/admin/users']);
}

export async function setUserActiveAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const isActive = formData.get('isActive') === 'yes';

  return run(
    async () => {
      await setUserActive(actor, userId, isActive);
      return isActive ? 'Account reactivated.' : 'Account deactivated and signed out.';
    },
    ['/admin/users', ...SCORING_VIEWS],
  );
}

// ── Entries ────────────────────────────────────────────────────────────────

export async function updateEntryAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const entryId = String(formData.get('entryId') ?? '');
  const hours = Number(formData.get('hours') ?? 0);
  const minutes = Number(formData.get('minutes') ?? 0);

  return run(
    async () => {
      await updateEntry(actor, entryId, {
        trainingName: String(formData.get('trainingName') ?? ''),
        completedOn: String(formData.get('completedOn') ?? ''),
        durationMinutes: hours * 60 + minutes,
        trainingUrl: String(formData.get('trainingUrl') ?? '').trim(),
        platform: String(formData.get('platform') ?? ''),
        platformOther: String(formData.get('platformOther') ?? ''),
        notes: String(formData.get('notes') ?? ''),
      });
      return 'Entry updated.';
    },
    ['/admin/entries', ...SCORING_VIEWS],
  );
}

export async function deleteEntryAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const entryId = String(formData.get('entryId') ?? '');

  return run(
    async () => {
      await deleteEntry(actor, entryId);
      return 'Entry deleted.';
    },
    ['/admin/entries', ...SCORING_VIEWS],
  );
}

export async function reviewEntryAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();
  const entryId = String(formData.get('entryId') ?? '');
  const status = formData.get('status') === 'counted' ? 'counted' : 'rejected';

  return run(
    async () => {
      await reviewEntry(actor, entryId, status);
      return status === 'counted' ? 'Entry approved.' : 'Entry rejected.';
    },
    ['/admin/entries', ...SCORING_VIEWS],
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function updateSettingsAction(_prev: ActionState, formData: FormData) {
  const actor = await requireAdmin();

  const maxRaw = String(formData.get('maxEntryMinutes') ?? '').trim();

  return run(
    async () => {
      await updateSettings(actor, {
        approvalRequired: formData.get('approvalRequired') === 'on',
        maxEntryMinutes: maxRaw === '' ? null : Number(maxRaw),
        dailyFlagMinutes: Number(formData.get('dailyFlagMinutes')),
        division1Size: Number(formData.get('division1Size')),
      });
      return 'Settings saved.';
    },
    ['/admin/settings', ...SCORING_VIEWS],
  );
}
