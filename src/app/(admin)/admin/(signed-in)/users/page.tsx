import { Card, CardBody, Field, Input, cx } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { listTeams } from '@/lib/services/teams';
import { listUsers } from '@/lib/services/users';
import { todayInCairo } from '@/lib/time';
import { ActionForm } from '../ActionForm';
import {
  changeJobRoleAction,
  changeUserTeamAction,
  resetPasswordAction,
  setUserActiveAction,
} from '../actions';
import { JobRolePicker } from './JobRolePicker';
import { TeamPicker } from './TeamPicker';

export const metadata = { title: 'Users · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const search = typeof params.q === 'string' ? params.q : '';

  const [users, teams] = await Promise.all([listUsers(actor, { search }), listTeams()]);
  const today = todayInCairo();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Users</h1>
        <p className="mt-0.5 text-sm text-muted">
          {users.length} participant {users.length === 1 ? 'account' : 'accounts'}
          {search && ` matching “${search}”`}
        </p>
      </header>

      {/* A plain GET form, so a search can be bookmarked and shared. */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        <Field label="Search by name or email" htmlFor="q">
          <Input id="q" name="q" defaultValue={search} placeholder="e.g. Ahmed" className="sm:w-80" />
        </Field>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:border-white/25"
        >
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">No accounts match.</p>
          </CardBody>
        </Card>
      ) : (
        users.map((user) => (
          <Card
            key={user.id}
            title={user.fullName}
            description={`${user.email}${user.jobRole ? ` · ${user.jobRole}` : ''}`}
            actions={
              <span
                className={cx(
                  'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.07em]',
                  user.isActive ? 'bg-up-tint text-up' : 'bg-down-tint text-down',
                )}
              >
                {user.isActive ? 'Active' : 'Deactivated'}
              </span>
            }
          >
            <CardBody className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
              <ActionForm action={changeJobRoleAction} submitLabel="Save role" variant="secondary">
                <input type="hidden" name="userId" value={user.id} />
                <JobRolePicker id={`role-${user.id}`} current={user.jobRole ?? ''} />
                <p className="text-xs text-muted">
                  Decides who they report to. Leads report to the lead manager; everyone else to
                  their team&rsquo;s manager.
                </p>
              </ActionForm>

              <ActionForm action={changeUserTeamAction} submitLabel="Change team" variant="secondary">
                <input type="hidden" name="userId" value={user.id} />
                <TeamPicker
                  id={`team-${user.id}`}
                  teams={teams.map((t) => ({ id: t.id, name: t.name }))}
                  current={user.teamId ?? ''}
                />
                <Field label="Effective from" htmlFor={`from-${user.id}`} required>
                  <Input
                    id={`from-${user.id}`}
                    name="effectiveFrom"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </Field>
                <p className="text-xs text-muted">
                  Their existing entries stay with {user.teamName ?? 'their old team'}.
                </p>
              </ActionForm>

              <ActionForm
                action={resetPasswordAction}
                submitLabel="Reset password"
                variant="secondary"
                confirm={{
                  title: `Reset ${user.fullName}'s password?`,
                  message:
                    'Their current password stops working and they are signed out everywhere. You will see a temporary password once, to pass on to them.',
                  confirmLabel: 'Reset password',
                }}
              >
                <input type="hidden" name="userId" value={user.id} />
                <p className="text-xs text-muted">
                  Generates a temporary password shown once, and signs them out everywhere.
                </p>
              </ActionForm>

              <ActionForm
                action={setUserActiveAction}
                submitLabel={user.isActive ? 'Deactivate' : 'Reactivate'}
                variant={user.isActive ? 'danger' : 'secondary'}
                confirm={
                  user.isActive
                    ? {
                        title: `Deactivate ${user.fullName}?`,
                        message:
                          'They are signed out and cannot sign in until reactivated. Their logged hours still count for their team.',
                        confirmLabel: 'Deactivate',
                      }
                    : undefined
                }
              >
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="isActive" value={user.isActive ? 'no' : 'yes'} />
                <p className="text-xs text-muted">
                  {user.isActive
                    ? 'Signs them out and blocks sign-in. Their logged hours still count for their team.'
                    : 'Lets them sign in again.'}
                </p>
              </ActionForm>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}
