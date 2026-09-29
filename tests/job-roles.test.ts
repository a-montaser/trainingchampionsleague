import { describe, expect, it } from 'vitest';
import { JOB_ROLES, isJobRole } from '@/lib/job-roles';

describe('company roles', () => {
  it('offers exactly the four roles, in order', () => {
    expect([...JOB_ROLES]).toEqual([
      'Product Owner',
      'UI/UX Designer',
      'Product Lead/Manager',
      'Design Lead',
    ]);
  });

  it('accepts only those values', () => {
    for (const role of JOB_ROLES) expect(isJobRole(role)).toBe(true);
    expect(isJobRole('Admin')).toBe(false);
    expect(isJobRole('product owner')).toBe(false); // case matters
    expect(isJobRole('')).toBe(false);
    expect(isJobRole(undefined)).toBe(false);
  });

  it('cannot be used to claim an access role', () => {
    // The authorisation roles are 'participant' and 'admin'. Neither may ever
    // appear here, or self-selecting a job role could grant admin access.
    expect(isJobRole('admin')).toBe(false);
    expect(isJobRole('participant')).toBe(false);
  });
});
