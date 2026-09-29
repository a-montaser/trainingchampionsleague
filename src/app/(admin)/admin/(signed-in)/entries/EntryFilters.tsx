'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from '@/components/Dropdown';

export function EntryFilters({
  teams,
  rounds,
  approvalRequired,
  team,
  round,
  status,
}: {
  teams: Array<{ id: string; name: string }>;
  rounds: Array<{ id: string; name: string }>;
  approvalRequired: boolean;
  team: string;
  round: string;
  status: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/entries?${next.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="team" className="mb-1 block text-xs font-medium text-muted">
          Team
        </label>
        <Dropdown
          id="team"
          value={team}
          onChange={(value) => apply('team', value)}
          options={[
            { value: '', label: 'All teams' },
            ...teams.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
      </div>

      <div>
        <label htmlFor="round" className="mb-1 block text-xs font-medium text-muted">
          Round
        </label>
        <Dropdown
          id="round"
          value={round}
          onChange={(value) => apply('round', value)}
          options={[
            { value: '', label: 'All rounds' },
            ...rounds.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">
          Status
        </label>
        <Dropdown
          id="status"
          value={status}
          // With approval off every entry is counted, so the filter is inert.
          disabled={!approvalRequired}
          onChange={(value) => apply('status', value)}
          options={[
            { value: '', label: 'Any status' },
            { value: 'counted', label: 'Counted' },
            { value: 'pending', label: 'Pending' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>
    </div>
  );
}
