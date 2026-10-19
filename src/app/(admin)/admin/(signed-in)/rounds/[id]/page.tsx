import { notFound } from 'next/navigation';
import {
  Alert,
  Card,
  CardBody,
  MovementBadge,
  Table,
  TableScroll,
  Td,
  Th,
  cx,
} from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { AuthError } from '@/lib/auth/guards';
import { formatHours, formatScoreLabel } from '@/lib/scoring';
import { getRound, loadFrozenResults, previewRoundClose } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { ActionForm } from '../../ActionForm';
import { closeRoundAction, recalculateRoundAction } from '../../actions';

export const metadata = { title: 'Round · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminRoundPage({
  params,
  searchParams,
}: PageProps<'/admin/rounds/[id]'>) {
  const actor = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;

  const round = await getRound(id).catch((error) => {
    if (error instanceof AuthError) notFound();
    throw error;
  });

  const [settings, preview, frozen] = await Promise.all([
    getSettings(),
    previewRoundClose(actor, round.id),
    round.status === 'closed' ? loadFrozenResults(round.id) : Promise.resolve([]),
  ]);

  const isClosed = round.status === 'closed';
  const cutIndex = settings.division1Size;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{round.name}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {round.startsOn} to {round.endsOn} · {round.status}
        </p>
      </header>

      {query.closed && <Alert tone="success">Round closed. These results are now frozen.</Alert>}

      <Card
        title={isClosed ? 'Frozen results' : 'Final standings preview'}
        description={
          isClosed
            ? 'Saved when the round was closed. Later edits do not change these until you recalculate.'
            : 'Exactly what will be frozen if you close the round now. Nothing is written yet.'
        }
      >
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
              {preview.teamResults.map((row, index) => (
                <tr
                  key={row.teamId}
                  className={cx(
                    // The line between the two divisions.
                    index === cutIndex && 'border-t-2 border-cut',
                  )}
                >
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Who moves">
          <CardBody className="flex flex-col gap-3 text-sm">
            <Movement label="Promoted" tone="up" names={preview.promoted.map((t) => t.teamName)} />
            <Movement label="Relegated" tone="down" names={preview.relegated.map((t) => t.teamName)} />
            <p className="text-muted">
              Divisions are live, so the table above already reflects these moves. Closing the round
              freezes them rather than making them happen.
            </p>
          </CardBody>
        </Card>

        <Card
          title={isClosed ? 'Recalculate' : 'Close the round'}
          description={
            isClosed
              ? 'Only use this after editing entries or headcounts that affect this round.'
              : 'Freezes the results above and opens the next round.'
          }
        >
          <CardBody>
            {isClosed ? (
              <ActionForm
                action={recalculateRoundAction}
                submitLabel="Recalculate and overwrite"
                pendingLabel="Recalculating…"
                variant="danger"
                confirm={{
                  title: `Recalculate ${round.name}?`,
                  message:
                    'This rewrites the frozen results with the current entries and headcounts. The old values are kept in the audit log.',
                  confirmLabel: 'Recalculate and overwrite',
                }}
              >
                <input type="hidden" name="roundId" value={round.id} />
                <p className="text-xs text-muted">The old values are kept in the audit log.</p>
              </ActionForm>
            ) : (
              <ActionForm
                action={closeRoundAction}
                submitLabel="Close round"
                pendingLabel="Closing…"
                confirm={{
                  title: `Close ${round.name}?`,
                  message:
                    'The standings above are frozen as the final results, and participants can no longer add or edit trainings dated in this round. This cannot be undone.',
                  confirmLabel: 'Close round',
                }}
              >
                <input type="hidden" name="roundId" value={round.id} />
                <p className="text-xs text-muted">
                  Check the standings above first. Participants can no longer add or edit entries
                  dated in this round.
                </p>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      </div>

      {isClosed && frozen.length > 0 && (
        <Card
          title="Saved at close"
          description="What was actually written. If it differs from the preview above, something changed since."
        >
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Team</Th>
                  <Th align="right">Division</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">Headcount</Th>
                </tr>
              </thead>
              <tbody>
                {frozen.map((row) => (
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
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </Card>
      )}
    </div>
  );
}

function Movement({
  label,
  tone,
  names,
}: {
  label: string;
  tone: 'up' | 'down';
  names: string[];
}) {
  return (
    <div>
      <p className={cx('font-medium', tone === 'up' ? 'text-up' : 'text-down')}>
        {label} ({names.length})
      </p>
      <p className="mt-0.5 text-ink">{names.length > 0 ? names.join(', ') : 'Nobody'}</p>
    </div>
  );
}
