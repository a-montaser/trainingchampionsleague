import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Actor, Role } from './guards';
import { assertAdmin, assertParticipant } from './guards';
import { COOKIE_NAMES, resolveSession } from './session';

/**
 * The single place the app learns who is making a request.
 *
 * Every page, server action and route handler calls one of these directly.
 * Authorisation deliberately does NOT live in a layout: Next layouts do not
 * re-render on navigation, so a check there would not run for every request.
 *
 * `cache()` dedupes the lookup within one render pass, not across requests.
 */

const readActor = cache(async (role: Role): Promise<Actor | null> => {
  const jar = await cookies();
  return resolveSession(jar.get(COOKIE_NAMES[role])?.value, role);
});

/** Returns the signed-in participant, or null. Does not throw or redirect. */
export function getParticipant(): Promise<Actor | null> {
  return readActor('participant');
}

/** Returns the signed-in admin, or null. Does not throw or redirect. */
export function getAdmin(): Promise<Actor | null> {
  return readActor('admin');
}

/**
 * For pages and server actions: sends anyone who is not a signed-in, active
 * participant to the login page.
 */
export async function requireParticipant(): Promise<Actor> {
  const actor = await readActor('participant');
  if (!actor || !actor.isActive || actor.role !== 'participant') redirect('/login');
  return actor;
}

/**
 * For admin pages and server actions. A participant account is rejected here —
 * its cookie is a different name, and the role is re-read from the database on
 * every call.
 */
export async function requireAdmin(): Promise<Actor> {
  const actor = await readActor('admin');
  if (!actor || !actor.isActive || actor.role !== 'admin') redirect('/admin/login');
  return actor;
}

/**
 * For route handlers, where an HTTP status is the right answer rather than a
 * redirect. Throws `UnauthenticatedError` or `ForbiddenError`, both of which
 * carry the status to return.
 */
export async function requireAdminApi(): Promise<Actor> {
  const actor = await readActor('admin');
  assertAdmin(actor);
  return actor;
}

export async function requireParticipantApi(): Promise<Actor> {
  const actor = await readActor('participant');
  assertParticipant(actor);
  return actor;
}
