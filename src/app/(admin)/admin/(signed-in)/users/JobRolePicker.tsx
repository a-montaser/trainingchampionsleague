'use client';

import { Dropdown } from '@/components/Dropdown';
import { Field } from '@/components/ui';
import { JOB_ROLES } from '@/lib/job-roles';

export function JobRolePicker({ id, current }: { id: string; current: string }) {
  return (
    <Field label="Company role" htmlFor={id}>
      <Dropdown
        id={id}
        name="jobRole"
        defaultValue={current}
        placeholder="Not set"
        options={[
          { value: '', label: 'Not set' },
          ...JOB_ROLES.map((role) => ({ value: role, label: role })),
        ]}
      />
    </Field>
  );
}
