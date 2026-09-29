import { Alert, Card, CardBody } from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { getCurrentRound } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { todayInCairo } from '@/lib/time';
import { EntryForm } from '../EntryForm';
import { createEntryAction } from '../entry-actions';

export const metadata = { title: 'Log a training · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

export default async function NewEntryPage() {
  await requireParticipant();
  const [settings, round] = await Promise.all([getSettings(), getCurrentRound()]);

  const today = todayInCairo();
  // You can only log into an open round, so the picker is bounded by it.
  const minDate = round?.startsOn ?? settings.tournamentStart;
  const maxDate = today < (round?.endsOn ?? settings.tournamentEnd) ? today : round!.endsOn;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Log a training</h1>
        <p className="mt-0.5 text-sm text-muted">
          {round
            ? `It will count towards ${round.name} and your team's score straight away.`
            : 'No round is open at the moment.'}
        </p>
      </header>

      {round?.status === 'open' ? (
        <Card>
          <CardBody>
            <EntryForm
              action={createEntryAction}
              minDate={minDate}
              maxDate={maxDate}
              submitLabel="Save training"
            />
          </CardBody>
        </Card>
      ) : (
        <Alert tone="info">
          There is no open round right now, so trainings cannot be logged. Check back when the next
          round starts.
        </Alert>
      )}
    </div>
  );
}
