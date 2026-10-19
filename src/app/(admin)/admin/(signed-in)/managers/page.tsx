import {
  Alert,
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
import { LEAD_ROLES } from '@/lib/managers';
import { listPeopleManagers } from '@/lib/services/people-managers';
import { listTeams } from '@/lib/services/teams';
import { ActionForm } from '../ActionForm';
import {
  createManagerAction,
  deleteManagerAction,
  setLeadManagerAction,
  setTeamManagerAction,
} from '../actions';
import { ManagerPicker } from './ManagerPicker';

export const metadata = { title: 'People managers · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminManagersPage() {
  await requireAdmin();
  const [managers, teams] = await Promise.all([listPeopleManagers(), listTeams()]);

  const byTeam = new Map(
    managers.flatMap((manager) => manager.teams.map((team) => [team.id, manager] as const)),
  );
  const lead = managers.find((manager) => manager.isLead) ?? null;
  const unassigned = teams.filter((team) => !byTeam.has(team.id));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">People managers</h1>
        <p className="mt-0.5 text-sm text-muted">
          Sets who each team reports to. Product Owners and UI/UX Designers roll up to their
          team&rsquo;s manager; {LEAD_ROLES.join(' and ')} roll up to the lead manager.
        </p>
      </header>

      {!lead && (
        <Alert>
          No lead manager is set, so nobody in a lead role is counted on the manager leaderboard.
          Choose one below.
        </Alert>
      )}

      {unassigned.length > 0 && (
        <Alert tone="info">
          {unassigned.map((team) => team.name).join(', ')}{' '}
          {unassigned.length === 1 ? 'has' : 'have'} no manager, so{' '}
          {unassigned.length === 1 ? 'its' : 'their'} people are not counted on the manager
          leaderboard.
        </Alert>
      )}

      <Card title="Which manager owns each team">
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <Th>Team</Th>
                <Th>Manager</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <Td className="font-medium">{team.name}</Td>
                  <Td colSpan={2}>
                    <ActionForm
                      action={setTeamManagerAction}
                      submitLabel="Save"
                      variant="secondary"
                      inline
                    >
                      <input type="hidden" name="teamId" value={team.id} />
                      <div className="min-w-56">
                        <ManagerPicker
                          id={`manager-${team.id}`}
                          managers={managers.map((m) => ({ id: m.id, name: m.name }))}
                          current={byTeam.get(team.id)?.id ?? ''}
                        />
                      </div>
                    </ActionForm>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Card>

      <Card
        title="Managers"
        description="Everyone here appears on the manager leaderboard, even with no teams."
      >
        <CardBody className="flex flex-col gap-4">
          {managers.map((manager) => (
            <div
              key={manager.id}
              className={cx(
                'flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3',
                manager.isLead ? 'border-brand/40 bg-brand-tint' : 'border-line',
              )}
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {manager.name}
                  {manager.isLead && (
                    <span className="ml-2 inline-flex rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white">
                      Lead
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {manager.teams.length > 0
                    ? manager.teams.map((team) => team.name).join(', ')
                    : 'No teams'}
                  {manager.isLead && ' · plus everyone in a lead role'}
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-2">
                {!manager.isLead && (
                  <ActionForm
                    action={setLeadManagerAction}
                    submitLabel="Make lead"
                    variant="secondary"
                    inline
                  >
                    <input type="hidden" name="managerId" value={manager.id} />
                  </ActionForm>
                )}
                <ActionForm
                  action={deleteManagerAction}
                  submitLabel="Remove"
                  variant="danger"
                  inline
                  confirm={{
                    title: `Remove ${manager.name}?`,
                    message:
                      manager.teams.length > 0
                        ? `${manager.teams.map((team) => team.name).join(', ')} will have no manager, so their people drop off the manager leaderboard until you assign a new one.`
                        : 'They are removed from the list of people managers.',
                    confirmLabel: 'Remove manager',
                  }}
                >
                  <input type="hidden" name="managerId" value={manager.id} />
                </ActionForm>
              </div>
            </div>
          ))}

          <div className="border-t border-line pt-4">
            <ActionForm action={createManagerAction} submitLabel="Add manager" inline>
              <Field label="Name" htmlFor="new-manager">
                <Input
                  id="new-manager"
                  name="name"
                  maxLength={120}
                  required
                  placeholder="e.g. Nour Hassan"
                  className="sm:w-72"
                />
              </Field>
            </ActionForm>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
