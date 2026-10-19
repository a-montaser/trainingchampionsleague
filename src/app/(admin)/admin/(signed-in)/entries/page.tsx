import {
  Card,
  CardBody,
  Field,
  Input,
  LinkButton,
  StatusBadge,
  Table,
  TableScroll,
  Td,
  Th,
  Textarea,
  cx,
} from '@/components/ui';
import { PlatformField } from '@/components/PlatformField';
import { requireAdmin } from '@/lib/auth/dal';
import { formatPlatform } from '@/lib/platforms';
import { formatHours, splitDuration } from '@/lib/scoring';
import type { EntryStatus } from '@/lib/scoring/types';
import { findFlaggedDays, listAllEntries } from '@/lib/services/entries';
import { listRounds } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { listTeams } from '@/lib/services/teams';
import { ActionForm } from '../ActionForm';
import { deleteEntryAction, reviewEntryAction, updateEntryAction } from '../actions';
import { EntryFilters } from './EntryFilters';

export const metadata = { title: 'Entries · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminEntriesPage({ searchParams }: PageProps<'/admin/entries'>) {
  const actor = await requireAdmin();
  const params = await searchParams;

  const teamId = typeof params.team === 'string' ? params.team : '';
  const roundId = typeof params.round === 'string' ? params.round : '';
  const status = typeof params.status === 'string' ? params.status : '';

  const [teams, rounds, settings, flagged] = await Promise.all([
    listTeams(),
    listRounds(),
    getSettings(),
    findFlaggedDays(actor),
  ]);

  const entries = await listAllEntries(actor, {
    teamId: teamId || undefined,
    roundId: roundId || undefined,
    status: (status || undefined) as EntryStatus | undefined,
  });

  // Days already flagged for being unusually long, so rows can be marked.
  const flaggedDays = new Set(flagged.map((day) => `${day.userId}:${day.completedOn}`));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Entries</h1>
          <p className="mt-0.5 text-sm text-muted">
            {entries.length} shown · highlighted rows are over{' '}
            {formatHours(settings.dailyFlagMinutes)} hours in a day
            {settings.maxEntryMinutes !== null &&
              `, or at the ${formatHours(settings.maxEntryMinutes)}-hour per-entry limit`}
          </p>
        </div>
        <LinkButton href="/api/admin/export/entries" variant="secondary">
          Export CSV
        </LinkButton>
      </header>

      <EntryFilters
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        rounds={rounds.map((r) => ({ id: r.id, name: r.name }))}
        approvalRequired={settings.approvalRequired}
        team={teamId}
        round={roundId}
        status={status}
      />

      {entries.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">No entries match these filters.</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>Who</Th>
                  <Th>Training</Th>
                  <Th>Date</Th>
                  <Th align="right">Hours</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const atMax =
                    settings.maxEntryMinutes !== null &&
                    entry.durationMinutes >= settings.maxEntryMinutes;
                  const bigDay = flaggedDays.has(`${entry.userId}:${entry.completedOn}`);

                  return (
                    <tr key={entry.id} className={cx((atMax || bigDay) && 'bg-down-tint/40')}>
                      <Td>
                        <span className="font-medium">{entry.userName}</span>
                        <span className="mt-0.5 block text-xs text-muted">{entry.teamName}</span>
                      </Td>
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
                          <span className="mt-0.5 block text-xs text-muted">
                            {formatPlatform(entry.platform, entry.platformOther)}
                          </span>
                        )}
                        {entry.notes && (
                          <span className="mt-0.5 block max-w-xs truncate text-xs text-muted">
                            {entry.notes}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap numeric">{entry.completedOn}</Td>
                      <Td align="right" className={cx('font-semibold', bigDay && 'text-down')}>
                        {formatHours(entry.durationMinutes)}
                      </Td>
                      <Td>
                        <StatusBadge status={entry.status} />
                      </Td>
                      <Td align="right">
                        <details className="text-left">
                          <summary className="cursor-pointer rounded px-2 py-1 text-sm font-medium text-brand-text hover:bg-brand-tint">
                            Edit
                          </summary>
                          <div className="mt-3 flex min-w-72 flex-col gap-3 rounded-lg border border-line bg-canvas p-3">
                            <ActionForm
                              action={updateEntryAction}
                              submitLabel="Save changes"
                              variant="secondary"
                            >
                              <input type="hidden" name="entryId" value={entry.id} />
                              <Field label="Training" htmlFor={`name-${entry.id}`} required>
                                <Input
                                  id={`name-${entry.id}`}
                                  name="trainingName"
                                  defaultValue={entry.trainingName}
                                  required
                                />
                              </Field>
                              <Field label="Date" htmlFor={`date-${entry.id}`} required>
                                <Input
                                  id={`date-${entry.id}`}
                                  name="completedOn"
                                  type="date"
                                  defaultValue={entry.completedOn}
                                  required
                                />
                              </Field>
                              <div className="flex gap-2">
                                <Field label="Hours" htmlFor={`h-${entry.id}`}>
                                  <Input
                                    id={`h-${entry.id}`}
                                    name="hours"
                                    type="number"
                                    min={0}
                                    defaultValue={splitDuration(entry.durationMinutes).hours}
                                  />
                                </Field>
                                <Field label="Minutes" htmlFor={`m-${entry.id}`}>
                                  <Input
                                    id={`m-${entry.id}`}
                                    name="minutes"
                                    type="number"
                                    min={0}
                                    max={59}
                                    defaultValue={splitDuration(entry.durationMinutes).minutes}
                                  />
                                </Field>
                              </div>
                              <PlatformField
                                idPrefix={`${entry.id}-`}
                                defaultPlatform={entry.platform ?? ''}
                                defaultOther={entry.platformOther ?? ''}
                              />
                              <Field label="Link (optional)" htmlFor={`url-${entry.id}`}>
                                <Input
                                  id={`url-${entry.id}`}
                                  name="trainingUrl"
                                  type="url"
                                  defaultValue={entry.trainingUrl ?? ''}
                                />
                              </Field>
                              <Field label="Notes" htmlFor={`notes-${entry.id}`}>
                                <Textarea
                                  id={`notes-${entry.id}`}
                                  name="notes"
                                  defaultValue={entry.notes ?? ''}
                                />
                              </Field>
                            </ActionForm>

                            {settings.approvalRequired && entry.status !== 'counted' && (
                              <ActionForm action={reviewEntryAction} submitLabel="Approve" inline>
                                <input type="hidden" name="entryId" value={entry.id} />
                                <input type="hidden" name="status" value="counted" />
                              </ActionForm>
                            )}
                            {settings.approvalRequired && entry.status !== 'rejected' && (
                              <ActionForm
                                action={reviewEntryAction}
                                submitLabel="Reject"
                                variant="danger"
                                inline
                                confirm={{
                                  title: 'Reject this entry?',
                                  message: `${entry.userName}'s "${entry.trainingName}" will stop counting towards the standings. You can approve it again later.`,
                                  confirmLabel: 'Reject entry',
                                }}
                              >
                                <input type="hidden" name="entryId" value={entry.id} />
                                <input type="hidden" name="status" value="rejected" />
                              </ActionForm>
                            )}

                            <ActionForm
                              action={deleteEntryAction}
                              submitLabel="Delete entry"
                              variant="danger"
                              inline
                              confirm={{
                                title: 'Delete this entry?',
                                message: `${entry.userName}'s "${entry.trainingName}" (${formatHours(entry.durationMinutes)} hours) is removed permanently and no longer counts. This is recorded in the audit log.`,
                                confirmLabel: 'Delete entry',
                              }}
                            >
                              <input type="hidden" name="entryId" value={entry.id} />
                            </ActionForm>
                          </div>
                        </details>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        </Card>
      )}
    </div>
  );
}
