import { Card, CardBody, Checkbox, Field, Input } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { getSettings } from '@/lib/services/settings';
import { ActionForm } from '../ActionForm';
import { updateSettingsAction } from '../actions';

export const metadata = { title: 'Settings · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-0.5 text-sm text-muted">
          Tournament dates are {settings.tournamentStart} to {settings.tournamentEnd}, in{' '}
          {settings.timezone}. Those are changed with the seed script.
        </p>
      </header>

      <Card title="Tournament rules">
        <CardBody>
          <ActionForm action={updateSettingsAction} submitLabel="Save settings">
            <Checkbox
              name="approvalRequired"
              defaultChecked={settings.approvalRequired}
              label="Entries need approval before they count"
              hint="Off by default: a training counts the moment it is logged."
            />

            <Field
              label="Maximum hours per entry"
              htmlFor="maxEntryMinutes"
              hint="Leave empty for no limit. Entered in minutes."
            >
              <Input
                id="maxEntryMinutes"
                name="maxEntryMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={settings.maxEntryMinutes ?? ''}
                placeholder="No limit"
                className="max-w-40"
              />
            </Field>

            <Field
              label="Flag a day over this many minutes"
              htmlFor="dailyFlagMinutes"
              hint="Highlights anyone logging more than this on a single day. 600 is ten hours."
            >
              <Input
                id="dailyFlagMinutes"
                name="dailyFlagMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={settings.dailyFlagMinutes}
                required
                className="max-w-40"
              />
            </Field>

            <Field
              label="Teams in Division 1"
              htmlFor="division1Size"
              hint="Where the cut line sits. The top this many teams are Division 1."
            >
              <Input
                id="division1Size"
                name="division1Size"
                type="number"
                inputMode="numeric"
                min={1}
                max={9}
                defaultValue={settings.division1Size}
                required
                className="max-w-40"
              />
            </Field>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
