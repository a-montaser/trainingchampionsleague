import 'server-only';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Executor } from '../../db';
import { teams, userTeamHistory, users } from '../../db/schema';
import { env } from '../../env';
import type { Actor } from '../auth/guards';
import { assertAdmin, ForbiddenError, NotFoundError } from '../auth/guards';
import { generateTemporaryPassword, hashPassword, MIN_PASSWORD_LENGTH } from '../auth/password';
import { destroyAllSessionsForUser } from '../auth/session';
import { JOB_ROLES, isJobRole } from '../job-roles';
import { isValidDateOnly, todayInCairo, type DateOnly } from '../time';
import { recordAudit } from './audit';

export const registrationSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name.').max(120, 'That name is too long.'),
  email: z.email('Enter a valid email address.').max(254).transform((v) => v.trim().toLowerCase()),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(200, 'That password is too long.'),
  teamId: z.uuid('Choose your team.'),
  jobRole: z.enum(JOB_ROLES, { error: 'Choose your role.' }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly field: keyof RegistrationInput,
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

/**
 * Self-registration, participant accounts only. The team is chosen here and
 * then locked — only an admin can change it afterwards.
 */
export async function registerParticipant(input: RegistrationInput): Promise<{ userId: string }> {
  const domain = env.allowedEmailDomain;
  if (!input.email.endsWith(domain)) {
    throw new RegistrationError(`Sign up with your ${domain} address.`, 'email');
  }

  return db.transaction(async (tx) => {
    const [team] = await tx.select().from(teams).where(eq(teams.id, input.teamId)).limit(1);
    if (!team) throw new RegistrationError('Choose your team.', 'teamId');

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing) {
      throw new RegistrationError('An account with that email already exists.', 'email');
    }

    const [created] = await tx
      .insert(users)
      .values({
        fullName: input.fullName,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'participant',
        teamId: team.id,
        jobRole: input.jobRole,
      })
      .returning({ id: users.id });

    await tx.insert(userTeamHistory).values({
      userId: created.id,
      teamId: team.id,
      effectiveFrom: todayInCairo(),
      createdByUserId: created.id,
    });

    return { userId: created.id };
  });
}

/** Current membership for every active participant — the scoring engine's `members`. */
export function loadMembers(exec: Executor = db) {
  return exec
    .select({ userId: users.id, teamId: users.teamId, isActive: users.isActive })
    .from(users)
    .where(eq(users.role, 'participant'));
}

export interface UserListRow {
  id: string;
  fullName: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  jobRole: string | null;
  isActive: boolean;
  createdAt: Date;
}

export async function listUsers(
  actor: Actor,
  options: { search?: string; teamId?: string } = {},
): Promise<UserListRow[]> {
  assertAdmin(actor);

  const filters = [eq(users.role, 'participant')];
  if (options.search?.trim()) {
    const needle = `%${options.search.trim()}%`;
    filters.push(or(ilike(users.fullName, needle), ilike(users.email, needle))!);
  }
  if (options.teamId) filters.push(eq(users.teamId, options.teamId));

  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      teamId: users.teamId,
      teamName: teams.name,
      jobRole: users.jobRole,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(and(...filters))
    .orderBy(asc(users.fullName));
}

async function requireUser(userId: string, exec: Executor) {
  const [user] = await exec.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('That user does not exist.');
  return user;
}

/**
 * Moves a participant to another team from a given date.
 *
 * Existing entries keep the team they were logged under — the move only affects
 * entries created from now on, which is what keeps past results stable.
 */
export async function changeUserTeam(
  actor: Actor,
  userId: string,
  teamId: string,
  effectiveFrom: DateOnly,
): Promise<void> {
  assertAdmin(actor);
  if (!isValidDateOnly(effectiveFrom)) throw new Error('Enter a valid effective-from date.');

  await db.transaction(async (tx) => {
    const user = await requireUser(userId, tx);
    if (user.role !== 'participant') {
      throw new ForbiddenError('Only participant accounts belong to a team.');
    }

    const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) throw new NotFoundError('That team does not exist.');

    await tx.update(users).set({ teamId, updatedAt: new Date() }).where(eq(users.id, userId));
    await tx
      .insert(userTeamHistory)
      .values({ userId, teamId, effectiveFrom, createdByUserId: actor.id });

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'user.change_team',
      entityType: 'user',
      entityId: userId,
      before: { teamId: user.teamId },
      after: { teamId, effectiveFrom },
    });
  });
}

/**
 * There is no email service, so an admin resets a password and reads the
 * temporary one out to the person. All their sessions are dropped.
 */
export async function resetUserPassword(actor: Actor, userId: string): Promise<string> {
  assertAdmin(actor);
  const temporary = generateTemporaryPassword();

  await db.transaction(async (tx) => {
    await requireUser(userId, tx);
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(temporary), updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'user.reset_password',
      entityType: 'user',
      entityId: userId,
      before: null,
      after: { passwordReset: true },
    });
  });

  await destroyAllSessionsForUser(userId);
  return temporary;
}

export async function setUserActive(
  actor: Actor,
  userId: string,
  isActive: boolean,
): Promise<void> {
  assertAdmin(actor);

  await db.transaction(async (tx) => {
    const user = await requireUser(userId, tx);
    await tx.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: isActive ? 'user.activate' : 'user.deactivate',
      entityType: 'user',
      entityId: userId,
      before: { isActive: user.isActive },
      after: { isActive },
    });
  });

  if (!isActive) await destroyAllSessionsForUser(userId);
}

/** Registered, active members per team — the participation tie-breaker's denominator. */
export function countActiveMembersByTeam(exec: Executor = db) {
  return exec
    .select({ teamId: users.teamId, count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, 'participant'), eq(users.isActive, true)))
    .groupBy(users.teamId);
}

/**
 * Sets what someone does in the company.
 *
 * This is the informational job role, never the `role` column that drives
 * authorisation — an admin cannot make someone an organiser from here. Passing
 * `null` clears it.
 *
 * It does change who they report to: a lead role reports to the lead manager
 * rather than to their team's manager.
 */
export async function changeUserJobRole(
  actor: Actor,
  userId: string,
  jobRole: string | null,
): Promise<void> {
  assertAdmin(actor);

  if (jobRole !== null && !isJobRole(jobRole)) {
    throw new Error('Choose one of the listed roles.');
  }

  await db.transaction(async (tx) => {
    const user = await requireUser(userId, tx);
    if (user.role !== 'participant') {
      throw new ForbiddenError('Organiser accounts do not have a company role.');
    }

    await tx
      .update(users)
      .set({ jobRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'user.change_job_role',
      entityType: 'user',
      entityId: userId,
      before: { jobRole: user.jobRole },
      after: { jobRole },
    });
  });
}
