import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { peopleManagers, teams } from '../../db/schema';
import type { Actor } from '../auth/guards';
import { assertAdmin, NotFoundError } from '../auth/guards';
import { recordAudit } from './audit';

/**
 * The people managers teams roll up to, and which teams each one owns.
 *
 * Admin-editable, so the org chart can change without a code release.
 */

export interface ManagerRecord {
  id: string;
  name: string;
  isLead: boolean;
  teams: Array<{ id: string; name: string }>;
}

/** Public: the manager leaderboard and the mapping both need this. */
export async function listPeopleManagers(exec: Executor = db): Promise<ManagerRecord[]> {
  const [managers, teamRows] = await Promise.all([
    exec.select().from(peopleManagers).orderBy(asc(peopleManagers.name)),
    exec
      .select({ id: teams.id, name: teams.name, managerId: teams.managerId })
      .from(teams)
      .orderBy(asc(teams.name)),
  ]);

  return managers.map((manager) => ({
    id: manager.id,
    name: manager.name,
    isLead: manager.isLead,
    teams: teamRows
      .filter((team) => team.managerId === manager.id)
      .map((team) => ({ id: team.id, name: team.name })),
  }));
}

/** Whoever every lead role reports to, or null if none is set. */
export async function getLeadManagerName(exec: Executor = db): Promise<string | null> {
  const [lead] = await exec
    .select({ name: peopleManagers.name })
    .from(peopleManagers)
    .where(eq(peopleManagers.isLead, true))
    .limit(1);

  return lead?.name ?? null;
}

export async function createPeopleManager(actor: Actor, name: string): Promise<void> {
  assertAdmin(actor);

  const trimmed = name.trim();
  if (!trimmed) throw new Error('A manager needs a name.');
  if (trimmed.length > 120) throw new Error('Keep the name under 120 characters.');

  await db.transaction(async (tx) => {
    const existing = await tx.select({ name: peopleManagers.name }).from(peopleManagers);
    if (existing.some((row) => row.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`${trimmed} is already a manager.`);
    }

    await tx.insert(peopleManagers).values({ name: trimmed });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'manager.create',
      entityType: 'people_manager',
      before: null,
      after: { name: trimmed },
    });
  });
}

/**
 * Removes a manager. Their teams are left without one rather than reassigned,
 * so nobody is silently moved under someone else.
 */
export async function deletePeopleManager(actor: Actor, managerId: string): Promise<string> {
  assertAdmin(actor);

  return db.transaction(async (tx) => {
    const [manager] = await tx
      .select()
      .from(peopleManagers)
      .where(eq(peopleManagers.id, managerId))
      .limit(1);
    if (!manager) throw new NotFoundError('That manager does not exist.');

    const [{ count } = { count: 0 }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.managerId, managerId));

    // The foreign key nulls the teams out, which is what we want — but say so.
    await tx.delete(peopleManagers).where(eq(peopleManagers.id, managerId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'manager.delete',
      entityType: 'people_manager',
      entityId: managerId,
      before: { name: manager.name, isLead: manager.isLead, teams: count },
      after: null,
    });

    return count > 0
      ? `Removed ${manager.name}. ${count} ${count === 1 ? 'team is' : 'teams are'} now without a manager.`
      : `Removed ${manager.name}.`;
  });
}

/** Points a team at a manager, or at nobody when `managerId` is empty. */
export async function setTeamManager(
  actor: Actor,
  teamId: string,
  managerId: string | null,
): Promise<void> {
  assertAdmin(actor);

  await db.transaction(async (tx) => {
    const [team] = await tx
      .select({ id: teams.id, name: teams.name, managerId: teams.managerId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) throw new NotFoundError('That team does not exist.');

    if (managerId) {
      const [manager] = await tx
        .select({ id: peopleManagers.id })
        .from(peopleManagers)
        .where(eq(peopleManagers.id, managerId))
        .limit(1);
      if (!manager) throw new NotFoundError('That manager does not exist.');
    }

    await tx.update(teams).set({ managerId }).where(eq(teams.id, teamId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'team.set_manager',
      entityType: 'team',
      entityId: teamId,
      before: { managerId: team.managerId },
      after: { managerId },
    });
  });
}

/**
 * Makes one manager the lead. Exactly one holds it, so the previous lead is
 * cleared in the same transaction.
 */
export async function setLeadManager(actor: Actor, managerId: string): Promise<string> {
  assertAdmin(actor);

  return db.transaction(async (tx) => {
    const [manager] = await tx
      .select()
      .from(peopleManagers)
      .where(eq(peopleManagers.id, managerId))
      .limit(1);
    if (!manager) throw new NotFoundError('That manager does not exist.');

    const previous = await tx
      .select({ id: peopleManagers.id, name: peopleManagers.name })
      .from(peopleManagers)
      .where(eq(peopleManagers.isLead, true));

    await tx.update(peopleManagers).set({ isLead: false }).where(eq(peopleManagers.isLead, true));
    await tx.update(peopleManagers).set({ isLead: true }).where(eq(peopleManagers.id, managerId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'manager.set_lead',
      entityType: 'people_manager',
      entityId: managerId,
      before: { lead: previous.map((p) => p.name) },
      after: { lead: manager.name },
    });

    return `${manager.name} now has every Product Lead/Manager and Design Lead.`;
  });
}
