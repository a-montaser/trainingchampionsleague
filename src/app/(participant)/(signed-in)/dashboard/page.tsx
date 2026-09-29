import Link from 'next/link';
import {
  Alert,
  Card,
  CardBody,
  LinkButton,
  MovementBadge,
  Stat,
} from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { formatHours, formatScoreLabel, scoreGap } from '@/lib/scoring';
import { loadDashboard } from '@/lib/services/dashboard';

export const metadata = { title: 'Dashboard · P&D Training Champions League' };

// Standings must reflect an entry the moment it is saved.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const actor = await requireParticipant();
  const data = await loadDashboard(actor);

  if (!data.round) {
    return (
      <Alert tone="info">
        The tournament has not been scheduled yet. An organiser needs to generate the rounds.
      </Alert>
    );
  }

  const { me, team, round, cutLineRival } = data;
  // Measured between the two displayed scores, so it matches the standings table.
  const gap = team && cutLineRival ? scoreGap(team, cutLineRival) : 0;
  const inDivision1 = team?.division === 1;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Your progress</h1>
          <p className="mt-0.5 text-sm text-muted">
            {round.name} · {data.daysLeft} {data.daysLeft === 1 ? 'day' : 'days'} left (ends{' '}
            {round.endsOn})
          </p>
        </div>
        <LinkButton href="/entries/new" variant="primary">
          Log a training
        </LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="My hours this round"
          value={formatHours(me.roundMinutes)}
          sub={me.roundRank ? `Rank ${me.roundRank} of ${me.entrantCount}` : undefined}
        />
        <Stat
          label="My hours overall"
          value={formatHours(me.tournamentMinutes)}
          sub={me.tournamentRank ? `Rank ${me.tournamentRank} overall` : undefined}
        />
      </div>

      {team ? (
        <Card
          title={team.teamName}
          description={`Division ${team.division} · position ${team.rankInDivision}`}
          actions={<MovementBadge movement={team.movement} />}
        >
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Team score"
                value={formatScoreLabel(team.totalMinutes, team.headcount)}
                sub="hours per person × 100"
              />
              <Stat label="Team hours" value={formatHours(team.totalMinutes)} sub="this round" />
              <Stat
                label="Headcount"
                value={team.headcount ?? '—'}
                sub={team.headcount ? 'people' : 'not set yet'}
              />
            </div>

            {cutLineRival && (
              <div
                className={
                  inDivision1
                    ? 'rounded-lg border border-up/25 bg-up-tint px-3 py-2.5 text-sm text-up'
                    : 'rounded-lg border border-down/25 bg-down-tint px-3 py-2.5 text-sm text-down'
                }
              >
                {inDivision1 ? (
                  gap > 0 ? (
                    <>
                      Clear of the drop by <strong>{gap} {gap === 1 ? 'point' : 'points'}</strong> —{' '}
                      {cutLineRival.teamName} is chasing.
                    </>
                  ) : (
                    <>
                      Level on points with {cutLineRival.teamName} — you&rsquo;re holding Division 1
                      on tie-breakers.
                    </>
                  )
                ) : gap > 0 ? (
                  <>
                    <strong>{gap} {gap === 1 ? 'point' : 'points'}</strong> behind {cutLineRival.teamName} — pass them to move
                    up to Division 1.
                  </>
                ) : (
                  <>
                    Level on points with {cutLineRival.teamName} — they stay above you on
                    tie-breakers. One more training could do it.
                  </>
                )}
              </div>
            )}

            <p className="text-sm text-muted">
              Team score is your team&rsquo;s counted hours this round, divided by its headcount,
              times 100. Ten hours logged by a team of ten is 100 points.{' '}
              <Link href="/standings" className="font-medium text-brand-text underline underline-offset-2">
                See all teams
              </Link>
            </p>
          </CardBody>
        </Card>
      ) : (
        <Alert tone="info">
          Your account is not assigned to a team yet. Ask an organiser to set one.
        </Alert>
      )}
    </div>
  );
}
