'use client';

import { Dropdown } from '@/components/Dropdown';
import { Field } from '@/components/ui';

export function TeamPicker({
  id,
  teams,
  current,
}: {
  id: string;
  teams: Array<{ id: string; name: string }>;
  current: string;
}) {
  return (
    <Field label="Team" htmlFor={id} required>
      <Dropdown
        id={id}
        name="teamId"
        defaultValue={current}
        placeholder="Select a team…"
        options={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
    </Field>
  );
}
