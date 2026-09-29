/**
 * Shared by the server page and the client filters, so it lives outside the
 * `'use client'` module: a plain value exported from a client module does not
 * survive the boundary when the server imports it.
 */

/** Sentinel round value meaning "score the whole tournament". */
export const ALL_ROUNDS = 'all';
