import Link from 'next/link';
import { formatPlatform } from '@/lib/platforms';
import { SubmitButton } from '@/components/SubmitButton';
import {
  Alert,
  Card,
  EmptyState,
  LinkButton,
  StatusBadge,
  Table,
  TableScroll,
  Td,
  Th,
} from '@/components/ui';
import { requireParticipant } from '@/lib/auth/dal';
import { formatHours } from '@/lib/scoring';
import { listMyEntries } from '@/lib/services/entries';
import { listRounds } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { canParticipantMutateEntry } from '@/lib/validation/entry';
import { deleteEntryAction } from './entry-actions';

export const metadata = { title: 'My trainings · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

const FLASH: Record<string, string> = {
  saved: 'Training saved. It already counts towards your team.',
  updated: 'Changes saved.',
  deleted: 'Training deleted.',
};

export default async function MyEntriesPage({ searchParams }: PageProps<'/entries'>) {
  const actor = await requireParticipant();
  const params = await searchParams;

  const [entries, rounds, settings] = await Promise.all([
    listMyEntries(actor),
    listRounds(),
    getSettings(),
  ]);

  const flashKey = Object.keys(FLASH).find((key) => params[key]);
  const total = entries
    .filter((e) => e.status === 'counted')
    .reduce((sum, e) => sum + e.durationMinutes, 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">My trainings</h1>
          <p className="mt-0.5 text-sm text-muted">
            {formatHours(total)} hours counted across {entries.length}{' '}
            {entries.length === 1 ? 'entry' : 'entries'}.
          </p>
        </div>
        <LinkButton href="/entries/new" variant="primary">
          Log a training
        </LinkButton>
      </header>

      {flashKey && <Alert tone="success">{FLASH[flashKey]}</Alert>}

      <Card>
        {entries.length === 0 ? (
          <EmptyState title="Nothing logged yet">
            <p>
              Once you log a training it counts towards your own total and your team&rsquo;s score
              straight away.
            </p>
          </EmptyState>
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>Training</Th>
                  <Th>Date</Th>
                  <Th align="right">Hours</Th>
                  {settings.approvalRequired && <Th>Status</Th>}
                  <Th />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const editable = canParticipantMutateEntry(rounds, entry.completedOn);

                  return (
                    <tr key={entry.id}>
                      <Td>
                        {entry.trainingUrl ? (
                          <a
                            href={entry.trainingUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="font-medium text-brand-text underline underline-offset-2"
                          >
                            {entry.trainingName}
                          </a>
                        ) : (
                          <span className="font-medium">{entry.trainingName}</span>
                        )}
                        {entry.platform && (
                          <p className="mt-0.5 text-xs text-muted">
                            {formatPlatform(entry.platform, entry.platformOther)}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-muted">
                            {entry.notes}
                          </p>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap numeric">{entry.completedOn}</Td>
                      <Td align="right">{formatHours(entry.durationMinutes)}</Td>
                      {settings.approvalRequired && (
                        <Td>
                          <StatusBadge status={entry.status} />
                        </Td>
                      )}
                      <Td align="right">
                        {editable ? (
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/entries/${entry.id}/edit`}
                              className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-brand-text hover:bg-brand-tint"
                            >
                              Edit
                            </Link>
                            <form action={deleteEntryAction}>
                              <input type="hidden" name="entryId" value={entry.id} />
                              <SubmitButton
                                variant="ghost"
                                pendingLabel="…"
                                className="min-h-9 px-2 text-sm"
                                confirm={{
                                  title: 'Delete this training?',
                                  message: `"${entry.trainingName}" (${formatHours(entry.durationMinutes)} hours) is removed permanently and no longer counts for you or your team.`,
                                  confirmLabel: 'Delete training',
                                }}
                              >
                                Delete
                              </SubmitButton>
                            </form>
                          </div>
                        ) : (
                          <span className="whitespace-nowrap text-xs text-muted">Round closed</span>
                        )}
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
