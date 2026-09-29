'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from '@/components/Dropdown';
import { ALL_ROUNDS } from './constants';

/**
 * Filters apply on change rather than behind a "Go" button — one tap instead of
 * two, which matters most on a phone.
 */
export function LeaderboardFilters({
  teams,
  rounds,
  team,
  round,
}: {
  teams: Array<{ id: string; name: string }>;
  rounds: Array<{ id: string; name: string }>;
  team: string;
  round: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/leaderboard?${next.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="round" className="mb-1 block text-xs font-medium text-muted">
          Round
        </label>
        <Dropdown
          id="round"
          value={round}
          onChange={(value) => apply('round', value)}
          options={[
            { value: ALL_ROUNDS, label: 'Whole tournament' },
            ...rounds.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
      </div>

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
    </div>
  );
}
