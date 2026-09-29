import {
  Card,
  EmptyState,
  Table,
  TableScroll,
  Td,
  Th,
  cx,
} from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { formatHours } from '@/lib/scoring';
import { getCurrentRound, listRounds } from '@/lib/services/rounds';
import { loadIndividualStandings } from '@/lib/services/standings';
import { listTeams } from '@/lib/services/teams';
import { ALL_ROUNDS } from './constants';
import { LeaderboardFilters } from './LeaderboardFilters';

export const metadata = { title: 'Leaderboard · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({ searchParams }: PageProps<'/leaderboard'>) {
  const actor = await requireParticipant();
  const params = await searchParams;

  const teamFilter = typeof params.team === 'string' ? params.team : '';
  // "Whole tournament" is an option in the round list rather than its own filter.
  const roundParam = typeof params.round === 'string' ? params.round : '';

  const [teams, rounds, currentRound] = await Promise.all([
    listTeams(),
    listRounds(),
    getCurrentRound(),
  ]);

  const selectedRound =
    roundParam === ALL_ROUNDS
      ? undefined
      : rounds.find((r) => r.id === roundParam) ?? currentRound ?? undefined;

  const rows = await loadIndividualStandings({
    round: selectedRound,
    teamId: teamFilter || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Individual leaderboard</h1>
        <p className="mt-0.5 text-sm text-muted">
          {selectedRound
            ? `${selectedRound.name} (${selectedRound.startsOn} to ${selectedRound.endsOn})`
            : 'Whole tournament'}
          {teamFilter && ' · filtered by team'}
        </p>
      </header>

      <LeaderboardFilters
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        rounds={rounds.map((r) => ({ id: r.id, name: r.name }))}
        team={teamFilter}
        round={selectedRound?.id ?? ALL_ROUNDS}
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nobody has logged a training yet">
            <p>Be the first — your hours appear here the moment you save an entry.</p>
          </EmptyState>
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Name</Th>
                  <Th>Team</Th>
                  <Th align="right">Hours</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isMe = row.userId === actor.id;
                  return (
                    <tr key={row.userId} className={cx(isMe && 'bg-brand-tint/60')}>
                      <Td align="right" className="w-12 font-semibold">
                        {row.rank}
                      </Td>
                      <Td className={cx('font-medium', isMe && 'text-brand-text')}>
                        {row.fullName}
                        {isMe && <span className="ml-1.5 text-xs font-normal">(you)</span>}
                      </Td>
                      <Td className="text-muted">{row.teamName ?? '—'}</Td>
                      <Td align="right" className="font-semibold">
                        {formatHours(row.totalMinutes)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Card>

      <p className="text-sm text-muted">
        Ranks are worked out across everyone, so filtering by team still shows each person&rsquo;s
        true position overall.
      </p>
    </div>
  );
}
