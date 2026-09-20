import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { auditLog, users } from '../../db/schema';
import type { Actor } from '../auth/guards';
import { assertAdmin } from '../auth/guards';

/**
 * Every admin action is recorded with who did it, what changed, and the values
 * on either side. Writes take an executor so they can join the same transaction
 * as the change they describe — an action and its audit row are never split.
 */

export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(exec: Executor, input: AuditInput): Promise<void> {
  await exec.insert(auditLog).values({
    actorUserId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

export interface AuditPage {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
}

export async function listAuditLog(
  actor: Actor,
  options: { limit?: number; offset?: number } = {},
): Promise<AuditPage[]> {
  assertAdmin(actor);

  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
      actorName: users.fullName,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .orderBy(desc(auditLog.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
}
