import Link from 'next/link';
import { Alert, Card, CardBody, LinkButton, Stat, Table, TableScroll, Td, Th } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { formatHours, formatScoreLabel } from '@/lib/scoring';
import { findFlaggedDays } from '@/lib/services/entries';
import { getCurrentRound } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { loadTeamStandings } from '@/lib/services/standings';
import { listUsers } from '@/lib/services/users';

export const metadata = { title: 'Overview · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const actor = await requireAdmin();

  const [round, settings, users, flagged] = await Promise.all([
    getCurrentRound(),
    getSettings(),
    listUsers(actor),
    findFlaggedDays(actor),
  ]);

  const standings = round ? await loadTeamStandings(round) : [];
  const totalMinutes = standings.reduce((sum, s) => sum + s.totalMinutes, 0);
  const missingHeadcount = standings.filter((s) => !s.headcount);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Overview</h1>
          <p className="mt-0.5 text-sm text-muted">
            {round
              ? `${round.name} · ${round.startsOn} to ${round.endsOn} · ${round.status}`
              : 'No rounds scheduled yet.'}
          </p>
        </div>
        {round && (
          <LinkButton href={`/admin/rounds/${round.id}`} variant="primary">
            Manage this round
          </LinkButton>
        )}
      </header>

      {!round && (
        <Alert tone="info">
          The tournament has no rounds yet.{' '}
          <Link href="/admin/rounds" className="font-medium underline underline-offset-2">
            Generate the schedule
          </Link>{' '}
          to get started.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Registered" value={users.length} sub="participants" />
        <Stat label="Active" value={users.filter((u) => u.isActive).length} sub="accounts" />
        <Stat label="Hours this round" value={formatHours(totalMinutes)} sub="all teams" />
        <Stat
          label="Approval"
          value={settings.approvalRequired ? 'On' : 'Off'}
          sub={settings.approvalRequired ? 'entries need review' : 'entries count at once'}
        />
      </div>

      {missingHeadcount.length > 0 && (
        <Alert>
          {missingHeadcount.map((t) => t.teamName).join(', ')}{' '}
          {missingHeadcount.length === 1 ? 'has' : 'have'} no headcount set, so{' '}
          {missingHeadcount.length === 1 ? 'it scores' : 'they score'} zero.{' '}
          <Link href="/admin/teams" className="font-medium underline underline-offset-2">
            Set headcounts
          </Link>
        </Alert>
      )}

      {round && (
        <Card title="Live standings" description="The same table participants see.">
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Team</Th>
                  <Th align="right">Division</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">People</Th>
                  <Th align="right">Score</Th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.teamId}>
                    <Td align="right" className="w-12 font-semibold">
                      {row.rankOverall}
                    </Td>
                    <Td className="font-medium">{row.teamName}</Td>
                    <Td align="right">{row.division}</Td>
                    <Td align="right">{formatHours(row.totalMinutes)}</Td>
                    <Td align="right">{row.headcount ?? '—'}</Td>
                    <Td align="right" className="whitespace-nowrap font-semibold">
                      {formatScoreLabel(row.totalMinutes, row.headcount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </Card>
      )}

      <Card
        title="Flagged days"
        description={`Someone logging more than ${formatHours(settings.dailyFlagMinutes)} hours on one day.`}
      >
        <CardBody>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted">Nothing unusual.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {flagged.slice(0, 10).map((day) => (
                <li key={`${day.userId}-${day.completedOn}`} className="flex justify-between gap-3">
                  <span className="text-ink">
                    {day.userName} · {day.completedOn}
                  </span>
                  <span className="font-semibold text-down numeric">
                    {formatHours(day.totalMinutes)} h
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
