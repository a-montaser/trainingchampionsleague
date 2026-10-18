import { notFound } from 'next/navigation';
import { Alert, Card, CardBody } from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { AuthError } from '@/lib/auth/guards';
import { splitDuration } from '@/lib/scoring';
import { getEntryForEdit } from '@/lib/services/entries';
import { listRounds } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { canParticipantMutateEntry } from '@/lib/validation/entry';
import { todayInCairo } from '@/lib/time';
import { EntryForm } from '../../EntryForm';
import { updateEntryAction } from '../../entry-actions';

export const metadata = { title: 'Edit training · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

export default async function EditEntryPage({ params }: PageProps<'/entries/[id]/edit'>) {
  const actor = await requireParticipant();
  const { id } = await params;

  // getEntryForEdit is scoped to the actor, so another user's id reads as
  // "not found" rather than exposing that it exists.
  const entry = await getEntryForEdit(actor, id).catch((error) => {
    if (error instanceof AuthError) notFound();
    throw error;
  });

  const [rounds, settings] = await Promise.all([listRounds(), getSettings()]);
  const editable = canParticipantMutateEntry(rounds, entry.completedOn);
  const round = rounds.find(
    (r) => entry.completedOn >= r.startsOn && entry.completedOn <= r.endsOn,
  );

  const today = todayInCairo();
  const duration = splitDuration(entry.durationMinutes);
  const maxDate = today < (round?.endsOn ?? settings.tournamentEnd) ? today : round!.endsOn;

  const updateThisEntry = updateEntryAction.bind(null, entry.id);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Edit training</h1>
        <p className="mt-0.5 text-sm text-muted">{entry.trainingName}</p>
      </header>

      {editable ? (
        <Card>
          <CardBody>
            <EntryForm
              action={updateThisEntry}
              minDate={round?.startsOn ?? settings.tournamentStart}
              maxDate={maxDate}
              submitLabel="Save changes"
              initial={{
                trainingName: entry.trainingName,
                completedOn: entry.completedOn,
                hours: duration.hours,
                minutes: duration.minutes,
                trainingUrl: entry.trainingUrl ?? '',
                platform: entry.platform ?? '',
                platformOther: entry.platformOther ?? '',
                notes: entry.notes ?? '',
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <Alert tone="info">
          {round?.name ?? 'That round'} is closed, so this entry can no longer be changed. Ask an
          organiser if something is wrong with it.
        </Alert>
      )}
    </div>
  );
}
