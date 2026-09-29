import 'server-only';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { entries, peopleManagers, teams, users } from '../../db/schema';
import { resolveManager } from '../managers';
import { compareRatios, type RoundRow } from '../scoring';
import { getLeadManagerName, listPeopleManagers } from './people-managers';

export interface ManagerStanding {
  manager: string;
  /** Registered, active people who roll up to this manager. */
  people: number;
  /** How many of them logged at least one training in the scope. */
  contributors: number;
  totalMinutes: number;
  rank: number;
}

/**
 * Totals by people manager.
 *
 * People are grouped by their **current** team and job role, so moving someone
 * moves their whole total with them — unlike the team standings, where each
 * entry keeps the team it was logged under. That is deliberate: this table
 * answers "whose people are training?", which is about who they report to now.
 */
export async function loadManagerStandings(
  options: { round?: RoundRow } = {},
  exec: Executor = db,
): Promise<ManagerStanding[]> {
  const { round } = options;

  const [people, entryRows, managers, leadManager] = await Promise.all([
    exec
      .select({
        userId: users.id,
        jobRole: users.jobRole,
        teamManager: peopleManagers.name,
      })
      .from(users)
      .leftJoin(teams, eq(teams.id, users.teamId))
      .leftJoin(peopleManagers, eq(peopleManagers.id, teams.managerId))
      .where(and(eq(users.role, 'participant'), eq(users.isActive, true))),
    exec
      .select({ userId: entries.userId, durationMinutes: entries.durationMinutes })
      .from(entries)
      .where(
        round
          ? and(
              eq(entries.status, 'counted'),
              gte(entries.completedOn, round.startsOn),
              lte(entries.completedOn, round.endsOn),
            )
          : eq(entries.status, 'counted'),
      ),
    listPeopleManagers(exec),
    getLeadManagerName(exec),
  ]);

  const managerOf = new Map<string, string>();
  const totals = new Map<string, { people: number; minutes: number; contributors: Set<string> }>();

  function bucket(manager: string) {
    let row = totals.get(manager);
    if (!row) totals.set(manager, (row = { people: 0, minutes: 0, contributors: new Set() }));
    return row;
  }

  // Every manager appears, even with nobody registered under them yet, so the
  // table is the full list from the first day rather than filling in over time.
  for (const manager of managers) bucket(manager.name);

  for (const person of people) {
    const manager = resolveManager(person.jobRole, person.teamManager, leadManager);
    if (!manager) continue; // Their team has no manager set.
    managerOf.set(person.userId, manager);
    bucket(manager).people += 1;
  }

  for (const entry of entryRows) {
    const manager = managerOf.get(entry.userId);
    if (!manager) continue;
    const row = bucket(manager);
    row.minutes += entry.durationMinutes;
    row.contributors.add(entry.userId);
  }

  const sorted = [...totals.entries()]
    .map(([manager, row]) => ({
      manager,
      people: row.people,
      contributors: row.contributors.size,
      totalMinutes: row.minutes,
      rank: 0,
    }))
    .sort((a, b) => {
      // Ranked on points — hours per person — exactly as teams are, compared as
      // an exact ratio so nothing is rounded before the order is decided.
      const byPoints = compareRatios(a.totalMinutes, a.people, b.totalMinutes, b.people);
      if (byPoints !== 0) return -byPoints;
      // Then raw hours, then name, so the order never wobbles.
      return b.totalMinutes - a.totalMinutes || a.manager.localeCompare(b.manager);
    });

  // Equal points share a rank (1, 2, 2, 4).
  let previous: (typeof sorted)[number] | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    const tied =
      previous !== null &&
      compareRatios(row.totalMinutes, row.people, previous.totalMinutes, previous.people) === 0;

    if (!tied) lastRank = index + 1;
    previous = row;
    return { ...row, rank: lastRank };
  });
}

/** Teams with no manager set, for the note on the page. */
export async function findUnmanagedTeams(exec: Executor = db): Promise<string[]> {
  const rows = await exec
    .select({ name: teams.name, managerId: teams.managerId })
    .from(teams);

  return rows
    .filter((row) => !row.managerId)
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b));
}

/** The manager a given person rolls up to, so their row can be highlighted. */
export async function loadManagerFor(
  userId: string,
  exec: Executor = db,
): Promise<string | null> {
  const [[row], leadManager] = await Promise.all([
    exec
      .select({ jobRole: users.jobRole, teamManager: peopleManagers.name })
      .from(users)
      .leftJoin(teams, eq(teams.id, users.teamId))
      .leftJoin(peopleManagers, eq(peopleManagers.id, teams.managerId))
      .where(eq(users.id, userId))
      .limit(1),
    getLeadManagerName(exec),
  ]);

  return row ? resolveManager(row.jobRole, row.teamManager, leadManager) : null;
}
