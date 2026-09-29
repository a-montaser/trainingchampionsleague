import Link from 'next/link';
import {
  Card,
  CardBody,
  Field,
  Input,
  Table,
  TableScroll,
  Td,
  Th,
  cx,
} from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { listRounds } from '@/lib/services/rounds';
import { getSettings } from '@/lib/services/settings';
import { todayInCairo } from '@/lib/time';
import { ActionForm } from '../ActionForm';
import { generateScheduleAction } from '../actions';

export const metadata = { title: 'Rounds · Admin' };
export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-up-tint text-up',
  closed: 'bg-white/5 text-muted border border-line',
  scheduled: 'bg-accent-tint text-accent',
};

export default async function AdminRoundsPage() {
  await requireAdmin();
  const [rounds, settings] = await Promise.all([listRounds(), getSettings()]);
  const today = todayInCairo();
  const anyClosed = rounds.some((r) => r.status === 'closed');

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Rounds</h1>
        <p className="mt-0.5 text-sm text-muted">
          {settings.tournamentStart} to {settings.tournamentEnd} · today is {today}
        </p>
      </header>

      <Card title="Schedule">
        {rounds.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No rounds yet. Generate them below.</p>
          </CardBody>
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Round</Th>
                  <Th>Starts</Th>
                  <Th>Ends</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.id}>
                    <Td align="right" className="w-12 font-semibold">
                      {round.index}
                    </Td>
                    <Td className="font-medium">{round.name}</Td>
                    <Td className="numeric">{round.startsOn}</Td>
                    <Td className="numeric">{round.endsOn}</Td>
                    <Td>
                      <span
                        className={cx(
                          'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.07em]',
                          STATUS_STYLES[round.status],
                        )}
                      >
                        {round.status}
                      </span>
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/rounds/${round.id}`}
                        className="rounded px-2 py-1 text-sm font-medium text-brand-text hover:bg-brand-tint"
                      >
                        Open
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Card>

      <Card
        title="Generate the schedule"
        description="Splits the tournament dates into equal rounds. This replaces any existing schedule."
      >
        <CardBody>
          {anyClosed ? (
            <p className="text-sm text-muted">
              A round has already been closed, so the schedule can no longer be regenerated —
              doing so would invalidate frozen results.
            </p>
          ) : (
            <ActionForm
              action={generateScheduleAction}
              submitLabel="Generate rounds"
              variant="secondary"
            >
              <Field
                label="Round length in months"
                htmlFor="lengthMonths"
                hint="Three months gives the two rounds this tournament uses."
              >
                <Input
                  id="lengthMonths"
                  name="lengthMonths"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={12}
                  defaultValue={3}
                  className="max-w-32"
                />
              </Field>
            </ActionForm>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
