/**
 * Whether a team can be deleted.
 *
 * Pure, so the rule is tested directly and the admin page and the service read
 * the same answer — the page can explain why a delete button is disabled
 * without guessing what the service would do.
 */

export interface TeamUsage {
  /** Accounts whose current team this is. */
  users: number;
  /** Entries logged under this team, including by people who have since moved. */
  entries: number;
  /** Rows in a closed round's frozen results. */
  frozenResults: number;
}

/** `null` means it can be deleted; otherwise the reason it cannot. */
export function whyTeamCannotBeDeleted(usage: TeamUsage): string | null {
  if (usage.entries > 0) {
    return `${usage.entries} logged ${usage.entries === 1 ? 'training' : 'trainings'} belong to this team. Deleting it would erase those hours.`;
  }

  if (usage.frozenResults > 0) {
    return 'This team appears in a closed round’s final results, which must not change.';
  }

  if (usage.users > 0) {
    return `${usage.users} ${usage.users === 1 ? 'person is' : 'people are'} on this team. Move them to another team first.`;
  }

  return null;
}

export function canDeleteTeam(usage: TeamUsage): boolean {
  return whyTeamCannotBeDeleted(usage) === null;
}
