/**
 * Authorisation primitives.
 *
 * These are pure so that every service, server action and route handler can
 * share exactly one enforcement path, and so the "a participant is rejected
 * everywhere" requirement can be tested without a database or a browser.
 */

export type Role = 'participant' | 'admin';

export interface Actor {
  id: string;
  role: Role;
  isActive: boolean;
  teamId: string | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class UnauthenticatedError extends AuthError {
  constructor(message = 'You need to sign in.') {
    super(message, 401);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'You do not have access to this.') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Deliberately a 404, not a 403: a participant probing another user's entry id
 * learns nothing about whether it exists.
 */
export class NotFoundError extends AuthError {
  constructor(message = 'Not found.') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export function assertActive(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw new UnauthenticatedError();
  if (!actor.isActive) throw new ForbiddenError('This account has been deactivated.');
}

/** Admin-only. A participant account is rejected here, wherever it is called. */
export function assertAdmin(actor: Actor | null | undefined): asserts actor is Actor {
  assertActive(actor);
  if (actor.role !== 'admin') {
    throw new ForbiddenError('This area is for tournament organisers only.');
  }
}

/** Participant-only. Admins do not log trainings or appear on leaderboards. */
export function assertParticipant(actor: Actor | null | undefined): asserts actor is Actor {
  assertActive(actor);
  if (actor.role !== 'participant') {
    throw new ForbiddenError('Organiser accounts cannot log trainings.');
  }
}

/**
 * A participant may only ever touch their own entries. Admins may touch any.
 */
export function assertCanMutateEntry(actor: Actor, entryOwnerId: string): void {
  assertActive(actor);
  if (actor.role === 'admin') return;
  if (actor.id !== entryOwnerId) throw new NotFoundError();
}
