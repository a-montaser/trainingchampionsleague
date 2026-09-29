import { describe, expect, it } from 'vitest';
import {
  COOKIE_MAX_DAYS,
  REMEMBERED_TTL_DAYS,
  SESSION_TTL_DAYS,
  sessionTtlMs,
} from '@/lib/auth/session';

const DAY = 86_400_000;

describe('how long a sign-in lasts', () => {
  it('does not expire on its own when the user ticks Remember me', () => {
    // A century stands in for "indefinite": the session ends when the user
    // signs out, or an admin deactivates them or resets their password.
    expect(sessionTtlMs(true)).toBe(REMEMBERED_TTL_DAYS * DAY);
    expect(sessionTtlMs(true)).toBeGreaterThan(50 * 365 * DAY);
  });

  it('lasts a day otherwise, with a cookie the browser drops on close', () => {
    expect(SESSION_TTL_DAYS).toBe(1);
    expect(sessionTtlMs(false)).toBe(DAY);
  });

  it('caps the cookie at what browsers actually accept', () => {
    // Chrome and Edge refuse anything beyond 400 days, so the cookie is capped
    // even though the session behind it never expires.
    expect(COOKIE_MAX_DAYS).toBe(400);
    expect(COOKIE_MAX_DAYS * DAY).toBeLessThan(sessionTtlMs(true));
  });
});
