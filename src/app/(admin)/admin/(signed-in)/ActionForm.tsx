'use client';

import { useActionState, type ReactNode } from 'react';
import type { ConfirmOptions } from '@/components/ConfirmDialog';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, cx } from '@/components/ui';
import type { ActionState } from './actions';

/**
 * A form wired to one admin action, showing whatever it reports back.
 *
 * Admin screens are mostly small forms that do one thing and say what happened,
 * so they all share this rather than repeating `useActionState` each time.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = 'primary',
  className,
  inline,
  confirm,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  /** Lays the control out as a single row, for table-row actions. */
  inline?: boolean;
  /** Asks "are you sure?" in a dialog before submitting. */
  confirm?: ConfirmOptions;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className={cx(inline ? 'flex flex-wrap items-end gap-2' : 'flex flex-col gap-3', className)}
    >
      {children}

      <SubmitButton
        variant={variant}
        pendingLabel={pendingLabel}
        className={inline ? 'min-h-9 px-3 text-sm' : undefined}
        confirm={confirm}
      >
        {submitLabel}
      </SubmitButton>

      {state.error && (
        <div className={inline ? 'w-full' : undefined}>
          <Alert>{state.error}</Alert>
        </div>
      )}
      {state.notice && !state.error && (
        <div className={inline ? 'w-full' : undefined}>
          <Alert tone="success">{state.notice}</Alert>
        </div>
      )}
    </form>
  );
}
