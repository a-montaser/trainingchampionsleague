'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from '@/components/Dropdown';
import { ALL_ROUNDS } from '../leaderboard/constants';

/** Same round filter as the individual leaderboard, applied on change. */
export function RoundFilter({
  rounds,
  round,
}: {
  rounds: Array<{ id: string; name: string }>;
  round: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set('round', value);
    else next.delete('round');
    router.push(`/managers?${next.toString()}`);
  }

  return (
    <div className="max-w-xs">
      <label htmlFor="round" className="mb-1 block text-xs font-medium text-muted">
        Round
      </label>
      <Dropdown
        id="round"
        value={round}
        onChange={apply}
        options={[
          { value: ALL_ROUNDS, label: 'Whole tournament' },
          ...rounds.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />
    </div>
  );
}
