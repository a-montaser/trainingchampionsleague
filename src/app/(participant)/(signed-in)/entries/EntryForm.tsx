'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Field, Input, Textarea } from '@/components/ui';
import type { EntryFormState } from './entry-actions';

export interface EntryFormValues {
  trainingName: string;
  completedOn: string;
  hours: number;
  minutes: number;
  trainingUrl: string;
  notes: string;
}

export function EntryForm({
  action,
  initial,
  maxDate,
  minDate,
  submitLabel,
}: {
  action: (prev: EntryFormState, formData: FormData) => Promise<EntryFormState>;
  initial?: Partial<EntryFormValues>;
  /** Today in Cairo — the form cannot offer a future date. */
  maxDate: string;
  minDate: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<EntryFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && <Alert>{state.message}</Alert>}

      <Field
        label="What was the training?"
        htmlFor="trainingName"
        error={state.errors?.trainingName}
        required
      >
        <Input
          id="trainingName"
          name="trainingName"
          defaultValue={initial?.trainingName}
          placeholder="e.g. Secure coding fundamentals"
          maxLength={200}
          required
        />
      </Field>

      <Field
        label="Date completed"
        htmlFor="completedOn"
        error={state.errors?.completedOn}
        required
      >
        <Input
          id="completedOn"
          name="completedOn"
          type="date"
          min={minDate}
          max={maxDate}
          defaultValue={initial?.completedOn ?? maxDate}
          required
        />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-ink">
          How long did it take?<span className="ml-0.5 text-brand-text">*</span>
        </legend>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="hours" className="mb-1 block text-xs text-muted">
              Hours
            </label>
            <Input
              id="hours"
              name="hours"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              step={1}
              defaultValue={initial?.hours ?? 1}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="minutes" className="mb-1 block text-xs text-muted">
              Minutes
            </label>
            <Input
              id="minutes"
              name="minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={5}
              defaultValue={initial?.minutes ?? 0}
            />
          </div>
        </div>
        {state.errors?.durationMinutes && (
          <p role="alert" className="text-sm text-down">
            {state.errors.durationMinutes}
          </p>
        )}
      </fieldset>

      <Field
        label="Link to the training"
        htmlFor="trainingUrl"
        hint="Paste the course or certificate link. This is required."
        error={state.errors?.trainingUrl}
        required
      >
        <Input
          id="trainingUrl"
          name="trainingUrl"
          type="url"
          inputMode="url"
          defaultValue={initial?.trainingUrl}
          placeholder="https://…"
          required
        />
      </Field>

      <Field label="Notes (optional)" htmlFor="notes" error={state.errors?.notes}>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes}
          maxLength={2000}
          placeholder="Anything worth remembering about it."
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/entries"
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-white/5 hover:text-ink"
        >
          Cancel
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
