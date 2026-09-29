import { describe, expect, it } from 'vitest';
import { JOB_ROLES } from '@/lib/job-roles';
import { LEAD_ROLES, isLeadRole, resolveManager } from '@/lib/managers';

const LEAD = 'Shaimaa Dwedar';

describe('mapping people to their manager', () => {
  it('maps a Product Owner to whoever owns their team', () => {
    expect(resolveManager('Product Owner', 'Mayar AbdElGaleel', LEAD)).toBe('Mayar AbdElGaleel');
    expect(resolveManager('Product Owner', 'Rehab Arafa', LEAD)).toBe('Rehab Arafa');
  });

  it('maps a UI/UX Designer the same way', () => {
    expect(resolveManager('UI/UX Designer', 'Maya Ammar', LEAD)).toBe('Maya Ammar');
  });

  it('maps both lead roles to the lead manager, ignoring their team', () => {
    for (const role of LEAD_ROLES) {
      expect(resolveManager(role, 'Khalid Osama', LEAD)).toBe(LEAD);
      expect(resolveManager(role, null, LEAD)).toBe(LEAD);
    }
  });

  it('knows which roles are lead roles', () => {
    expect(LEAD_ROLES).toEqual(['Product Lead/Manager', 'Design Lead']);
    expect(isLeadRole('Design Lead')).toBe(true);
    expect(isLeadRole('Product Owner')).toBe(false);
    expect(isLeadRole(null)).toBe(false);
  });

  it('returns nobody when the team has no manager set', () => {
    expect(resolveManager('Product Owner', null, LEAD)).toBeNull();
    expect(resolveManager('UI/UX Designer', undefined, LEAD)).toBeNull();
  });

  it('returns nobody for a lead role when no lead manager is set', () => {
    // Admins can delete the lead manager, and nothing should crash or quietly
    // reassign those people to somebody else.
    expect(resolveManager('Design Lead', 'Maya Ammar', null)).toBeNull();
    expect(resolveManager('Product Lead/Manager', 'Maya Ammar', undefined)).toBeNull();
  });

  it('falls back to the team for accounts with no role recorded', () => {
    // Registered before the role question existed; their team is still known.
    expect(resolveManager(null, 'Mayar AbdElGaleel', LEAD)).toBe('Mayar AbdElGaleel');
    expect(resolveManager(undefined, 'Mayar AbdElGaleel', LEAD)).toBe('Mayar AbdElGaleel');
    expect(resolveManager(null, null, LEAD)).toBeNull();
  });

  it('never invents a manager: the answer is always one of the two given', () => {
    for (const role of JOB_ROLES) {
      const answer = resolveManager(role, 'Team Owner', LEAD);
      expect([null, 'Team Owner', LEAD]).toContain(answer);
    }
  });
});
