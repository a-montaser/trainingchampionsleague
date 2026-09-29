import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../../db';
import { sessions, users } from '../../db/schema';
import { env } from '../../env';
import type { Actor, Role } from './guards';

/**
 * Sessions are opaque random tokens. Only an HMAC of the token is stored, so a
 * leaked database still does not yield a usable cookie. Rows live in the
 * database rather than in a signed JWT so that deactivating a user or resetting
 * a password can revoke their access immediately.
 */

/**
 * How long a sign-in lasts.
 *
 * "Remember me" never expires on its own — the session ends only when the
 * person signs out, or when an admin deactivates them or resets their password.
 * Without it the session lasts a day AND the cookie is a session cookie, which
 * the browser discards when it closes — the safer default on a shared machine.
 */
export const REMEMBERED_TTL_DAYS = 365 * 100;
export const SESSION_TTL_DAYS = 1;

/**
 * Browsers refuse to keep a cookie longer than this (Chrome and Edge cap at
 * 400 days), so the cookie is capped here while the session itself does not
 * expire. Signing in again issues a fresh cookie.
 */
export const COOKIE_MAX_DAYS = 400;

export function sessionTtlMs(remember: boolean): number {
  return (remember ? REMEMBERED_TTL_DAYS : SESSION_TTL_DAYS) * 86_400_000;
}

/**
 * The two sites use different cookie names, so a participant's cookie is never
 * even presented to an admin route.
 */
export const COOKIE_NAMES: Record<Role, string> = {
  participant: 'tcl_p_session',
  admin: 'tcl_a_session',
};

/**
 * Omitting `expires` makes it a session cookie, cleared when the browser
 * closes. The database row still has its own expiry either way, so a forgotten
 * cookie can never outlive the session it points at.
 */
export function cookieOptions(expiresAt: Date, remember = true) {
  const cap = new Date(Date.now() + COOKIE_MAX_DAYS * 86_400_000);
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    ...(remember ? { expires: expiresAt < cap ? expiresAt : cap } : {}),
  };
}

function hashToken(token: string): string {
  return createHmac('sha256', env.sessionSecret).update(token).digest('hex');
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  cookieName: string;
  remember: boolean;
}

export async function createSession(
  userId: string,
  role: Role,
  remember = false,
): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionTtlMs(remember));

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    role,
    expiresAt,
  });

  return { token, expiresAt, cookieName: COOKIE_NAMES[role], remember };
}

/**
 * Resolves a cookie value to an actor, re-reading the user's role and active
 * flag from the database every time. A session issued for one role can never be
 * used as the other.
 */
export async function resolveSession(
  token: string | undefined,
  expectedRole: Role,
): Promise<Actor | null> {
  if (!token) return null;

  const [found] = await db
    .select({
      userId: users.id,
      role: users.role,
      isActive: users.isActive,
      teamId: users.teamId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!found) return null;
  if (found.role !== expectedRole) return null;
  if (!found.isActive) return null;

  return { id: found.userId, role: found.role, isActive: found.isActive, teamId: found.teamId };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Used when an admin deactivates a user or resets their password. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** Constant-time compare, for callers that need to match tokens directly. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
