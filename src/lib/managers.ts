import type { JobRole } from './job-roles';

/**
 * Who reports to whom.
 *
 * Two rules:
 *  - A **Product Owner** or **UI/UX Designer** reports to the manager who owns
 *    the team they chose at registration.
 *  - A **Product Lead/Manager** or **Design Lead** reports to the lead manager,
 *    whatever their team.
 *
 * The mapping itself is data — admins set it on /admin/managers — so only the
 * rules live here. Pure, so the page, the service and the tests agree.
 */

/** The roles that report to the lead manager rather than by team. */
export const LEAD_ROLES: readonly JobRole[] = ['Product Lead/Manager', 'Design Lead'];

export function isLeadRole(jobRole: string | null | undefined): boolean {
  return Boolean(jobRole) && (LEAD_ROLES as readonly string[]).includes(jobRole as string);
}

/**
 * The manager a person rolls up to.
 *
 * `teamManager` is whoever owns their team, `leadManager` whoever lead roles
 * report to — both `null` when nobody is set. A missing job role is mapped by
 * team: those accounts predate the role question, and their team is known.
 */
export function resolveManager(
  jobRole: string | null | undefined,
  teamManager: string | null | undefined,
  leadManager: string | null | undefined,
): string | null {
  if (isLeadRole(jobRole)) return leadManager ?? null;
  return teamManager ?? null;
}
