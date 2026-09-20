import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
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

/** Returns the signed-in participant, or null. Does not throw. */
export function getParticipant(): Promise<Actor | null> {
  return readActor('participant');
}

/** Returns the signed-in admin, or null. Does not throw. */
export function getAdmin(): Promise<Actor | null> {
  return readActor('admin');
}

/** Throws unless a participant is signed in and active. */
export async function requireParticipant(): Promise<Actor> {
  const actor = await readActor('participant');
  assertParticipant(actor);
  return actor;
}

/**
 * Throws unless an admin is signed in and active. A participant account is
 * rejected here — both because its cookie is a different name, and because the
 * role is re-read from the database on every call.
 */
export async function requireAdmin(): Promise<Actor> {
  const actor = await readActor('admin');
  assertAdmin(actor);
  return actor;
}
