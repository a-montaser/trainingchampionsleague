'use client';

import { Dropdown } from '@/components/Dropdown';

export function ManagerPicker({
  id,
  managers,
  current,
}: {
  id: string;
  managers: Array<{ id: string; name: string }>;
  current: string;
}) {
  return (
    <Dropdown
      id={id}
      name="managerId"
      defaultValue={current}
      placeholder="No manager"
      options={[
        { value: '', label: 'No manager' },
        ...managers.map((manager) => ({ value: manager.id, label: manager.name })),
      ]}
    />
  );
}
