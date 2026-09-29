/**
 * What someone does in the company, chosen at registration.
 *
 * Deliberately separate from the `role` column that drives authorisation
 * (`participant` / `admin`). This one is self-selected, so it must never grant
 * any access — it is recorded and displayed, nothing more.
 *
 * Pure, so the database schema, the registration form and the tests all read
 * the same list.
 */
export const JOB_ROLES = [
  'Product Owner',
  'UI/UX Designer',
  'Product Lead/Manager',
  'Design Lead',
] as const;

export type JobRole = (typeof JOB_ROLES)[number];

export function isJobRole(value: unknown): value is JobRole {
  return typeof value === 'string' && (JOB_ROLES as readonly string[]).includes(value);
}
