import { Card, CardBody, Field, Input, Table, TableScroll, Td, Th } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { getHeadcountHistory, getTeamUsage, listTeams } from '@/lib/services/teams';
import { whyTeamCannotBeDeleted } from '@/lib/team-deletion';
import { todayInCairo } from '@/lib/time';
import { ActionForm } from '../ActionForm';
import { createTeamAction, deleteTeamAction, renameTeamAction, setHeadcountAction } from '../actions';
import { TeamSearch } from './TeamSearch';

export const metadata = { title: 'Teams · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminTeamsPage() {
  const actor = await requireAdmin();
  const [teams, usage] = await Promise.all([listTeams(), getTeamUsage(actor)]);
  const today = todayInCairo();

  const histories = await Promise.all(
    teams.map(async (team) => ({
      team,
      history: await getHeadcountHistory(actor, team.id),
      blockedReason: whyTeamCannotBeDeleted(
        usage.get(team.id) ?? { users: 0, entries: 0, frozenResults: 0 },
      ),
    })),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Teams</h1>
        <p className="mt-0.5 text-sm text-muted">
          Headcount is entered by hand and is not the number of registered users. Past values are
          never overwritten, so closed rounds keep the number they were scored with.
        </p>
      </header>

      <Card
        title="Add a team"
        description="It joins the standings straight away and appears in the registration dropdown."
      >
        <CardBody>
          <ActionForm action={createTeamAction} submitLabel="Add team">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Team name" htmlFor="new-team-name" required>
                <Input id="new-team-name" name="name" maxLength={100} required placeholder="e.g. Agent Desktop" />
              </Field>
              <Field
                label="Headcount"
                htmlFor="new-team-headcount"
                hint="Optional — can be set later."
              >
                <Input
                  id="new-team-headcount"
                  name="headcount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Not set"
                />
              </Field>
              <Field label="Effective from" htmlFor="new-team-from">
                <Input id="new-team-from" name="effectiveFrom" type="date" defaultValue={today} />
              </Field>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      <TeamSearch
        teams={histories.map(({ team, history, blockedReason }) => ({
          id: team.id,
          name: team.name,
          card: (
            <Card
              title={team.name}
              description={
                team.currentHeadcount
                  ? `${team.currentHeadcount} people today`
                  : 'No headcount set — this team scores zero'
              }
            >
              <CardBody className="flex flex-col gap-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <ActionForm action={renameTeamAction} submitLabel="Rename team" variant="secondary">
                    <input type="hidden" name="teamId" value={team.id} />
                    <Field label="Team name" htmlFor={`name-${team.id}`}>
                      <Input
                        id={`name-${team.id}`}
                        name="name"
                        defaultValue={team.name}
                        maxLength={100}
                        required
                      />
                    </Field>
                  </ActionForm>

                  <ActionForm action={setHeadcountAction} submitLabel="Set headcount">
                    <input type="hidden" name="teamId" value={team.id} />
                    <div className="flex gap-3">
                      <Field label="Headcount" htmlFor={`headcount-${team.id}`} required>
                        <Input
                          id={`headcount-${team.id}`}
                          name="headcount"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          defaultValue={team.currentHeadcount ?? 1}
                          required
                        />
                      </Field>
                      <Field label="Effective from" htmlFor={`from-${team.id}`} required>
                        <Input
                          id={`from-${team.id}`}
                          name="effectiveFrom"
                          type="date"
                          defaultValue={today}
                          required
                        />
                      </Field>
                    </div>
                  </ActionForm>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                    Delete team
                  </p>
                  {blockedReason ? (
                    <p className="text-sm text-muted">{blockedReason}</p>
                  ) : (
                    <ActionForm
                      action={deleteTeamAction}
                      submitLabel="Delete team"
                      variant="danger"
                      confirm={{
                        title: `Delete ${team.name}?`,
                        message:
                          'The team is removed permanently. This is only possible because nothing depends on it, and it is recorded in the audit log.',
                        confirmLabel: 'Delete team',
                      }}
                    >
                      <input type="hidden" name="teamId" value={team.id} />
                      <p className="text-xs text-muted">
                        Only possible because nothing depends on it. Recorded in the audit log.
                      </p>
                    </ActionForm>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                    Headcount history
                  </p>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted">Nothing set yet.</p>
                  ) : (
                    <TableScroll>
                      <Table>
                        <thead>
                          <tr>
                            <Th>Effective from</Th>
                            <Th align="right">Headcount</Th>
                            <Th align="right">Recorded</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((row) => (
                            <tr key={row.id}>
                              <Td className="numeric">{row.effectiveFrom}</Td>
                              <Td align="right" className="font-semibold">
                                {row.headcount}
                              </Td>
                              <Td align="right" className="text-muted">
                                {row.createdAt.toISOString().slice(0, 10)}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableScroll>
                  )}
                </div>
              </CardBody>
            </Card>
          ),
        }))}
      />
    </div>
  );
}
