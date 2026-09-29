import {
  Card,
  EmptyState,
  MovementBadge,
  Table,
  TableScroll,
  Td,
  Th,
  cx,
} from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { formatHours, formatScoreLabel, type TeamStanding } from '@/lib/scoring';
import { getCurrentRound, listRounds, loadFrozenResults } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { loadTeamStandings } from '@/lib/services/standings';

export const metadata = { title: 'Team standings · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  const actor = await requireParticipant();
  const [round, rounds, settings] = await Promise.all([
    getCurrentRound(),
    listRounds(),
    getSettings(),
  ]);

  if (!round) {
    return <EmptyState title="The tournament has not been scheduled yet." />;
  }

  const standings = await loadTeamStandings(round);
  const closed = rounds.filter((r) => r.status === 'closed');
  const pastResults = await Promise.all(
    closed.map(async (r) => ({ round: r, rows: await loadFrozenResults(r.id) })),
  );

  const division1 = standings.filter((s) => s.division === 1);
  const division2 = standings.filter((s) => s.division === 2);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Team standings</h1>
        <p className="mt-0.5 text-sm text-muted">
          {round.name} · live. The top {settings.division1Size} teams are Division 1 — teams move
          the moment their score crosses the line.
        </p>
        <p className="mt-1 text-sm text-muted">
          Score = team hours ÷ headcount × 100.
        </p>
      </header>

      <DivisionTable
        title="Division 1"
        note={`Bottom of this table drops to Division 2.`}
        rows={division1}
        myTeamId={actor.teamId}
        cutFrom={division1.length - 1}
      />

      <DivisionTable
        title="Division 2"
        note="Top of this table climbs to Division 1."
        rows={division2}
        myTeamId={actor.teamId}
        cutTo={0}
      />

      {pastResults.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Past rounds</h2>
          {pastResults.map(({ round: past, rows }) => (
            <Card key={past.id} title={past.name} description={`${past.startsOn} to ${past.endsOn}`}>
              <TableScroll>
                <Table>
                  <thead>
                    <tr>
                      <Th align="right">#</Th>
                      <Th>Team</Th>
                      <Th align="right">Division</Th>
                      <Th align="right">Hours</Th>
                      <Th align="right">Headcount</Th>
                      <Th align="right">Score</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.teamId}>
                        <Td align="right" className="w-12 font-semibold">
                          {row.rankOverall}
                        </Td>
                        <Td className="font-medium">
                          {row.teamName}
                          <MovementBadge movement={row.movement} />
                        </Td>
                        <Td align="right">{row.finalDivision}</Td>
                        <Td align="right">{formatHours(row.totalMinutes)}</Td>
                        <Td align="right">{row.headcountUsed ?? '—'}</Td>
                        <Td align="right" className="whitespace-nowrap font-semibold">
                          {formatScoreLabel(row.totalMinutes, row.headcountUsed)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function DivisionTable({
  title,
  note,
  rows,
  myTeamId,
  cutFrom,
  cutTo,
}: {
  title: string;
  note: string;
  rows: TeamStanding[];
  myTeamId: string | null;
  /** Index from which rows sit in the relegation zone. */
  cutFrom?: number;
  /** Index up to which rows sit in the promotion zone. */
  cutTo?: number;
}) {
  return (
    <Card title={title} description={note}>
      {rows.length === 0 ? (
        <EmptyState title="No teams here." />
      ) : (
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <Th align="right">#</Th>
                <Th>Team</Th>
                <Th align="right">Hours</Th>
                <Th align="right">People</Th>
                <Th align="right">Score</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const inDropZone = cutFrom !== undefined && index >= cutFrom;
                const inRiseZone = cutTo !== undefined && index <= cutTo;
                const mine = row.teamId === myTeamId;

                return (
                  <tr
                    key={row.teamId}
                    className={cx(
                      mine && 'bg-brand-tint/60',
                      !mine && inDropZone && 'bg-down-tint/50',
                      !mine && inRiseZone && 'bg-up-tint/50',
                    )}
                  >
                    <Td align="right" className="w-12 font-semibold">
                      {row.rankInDivision}
                    </Td>
                    <Td className={cx('font-medium', mine && 'text-brand-text')}>
                      {row.teamName}
                      {mine && <span className="ml-1.5 text-xs font-normal">(your team)</span>}
                      <MovementBadge movement={row.movement} />
                    </Td>
                    <Td align="right">{formatHours(row.totalMinutes)}</Td>
                    <Td align="right">{row.headcount ?? '—'}</Td>
                    <Td align="right" className="whitespace-nowrap font-semibold">
                      {formatScoreLabel(row.totalMinutes, row.headcount)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </Card>
  );
}
