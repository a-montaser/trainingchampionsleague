import { Card, EmptyState, Table, TableScroll, Td, Th, cx } from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { formatHours, formatScoreLabel } from '@/lib/scoring';
import { loadManagerFor, loadManagerStandings } from '@/lib/services/managers';
import { getCurrentRound, listRounds } from '@/lib/services/rounds';
import { ALL_ROUNDS } from '../leaderboard/constants';
import { RoundFilter } from './RoundFilter';

export const metadata = { title: 'Managers · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

export default async function ManagersPage({ searchParams }: PageProps<'/managers'>) {
  const actor = await requireParticipant();
  const params = await searchParams;
  const roundParam = typeof params.round === 'string' ? params.round : '';

  const [rounds, currentRound] = await Promise.all([listRounds(), getCurrentRound()]);

  const selectedRound =
    roundParam === ALL_ROUNDS
      ? undefined
      : rounds.find((r) => r.id === roundParam) ?? currentRound ?? undefined;

  const [standings, me] = await Promise.all([
    loadManagerStandings({ round: selectedRound }),
    loadManagerFor(actor.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Manager leaderboard</h1>
        <p className="mt-0.5 text-sm text-muted">
          {selectedRound
            ? `${selectedRound.name} (${selectedRound.startsOn} to ${selectedRound.endsOn})`
            : 'Whole tournament'}{' '}
          · ranked on hours per person, the same way teams are.
        </p>
      </header>

      <RoundFilter
        rounds={rounds.map((r) => ({ id: r.id, name: r.name }))}
        round={selectedRound?.id ?? ALL_ROUNDS}
      />

      <Card>
        {standings.length === 0 ? (
          <EmptyState title="Nothing to show yet">
            <p>Once people register and log trainings, their managers appear here.</p>
          </EmptyState>
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Manager</Th>
                  <Th align="right">People</Th>
                  <Th align="right">Taking part</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">Score</Th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const mine = row.manager === me;
                  return (
                    <tr key={row.manager} className={cx(mine && 'bg-brand-tint/60')}>
                      <Td align="right" className="w-12 font-semibold">
                        {row.rank}
                      </Td>
                      <Td className={cx('font-medium', mine && 'text-brand-text')}>
                        {row.manager}
                        {mine && <span className="ml-1.5 text-xs font-normal">(your manager)</span>}
                      </Td>
                      <Td align="right">{row.people}</Td>
                      <Td align="right" className="text-muted">
                        {row.people > 0
                          ? `${row.contributors} of ${row.people}`
                          : '—'}
                      </Td>
                      <Td align="right">{formatHours(row.totalMinutes)}</Td>
                      <Td align="right" className="whitespace-nowrap font-semibold">
                        {formatScoreLabel(row.totalMinutes, row.people)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
