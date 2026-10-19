'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog';
import { Button } from './ui';

/**
 * Disables itself while its form is in flight, so a slow connection cannot
 * produce a double submission.
 *
 * With `confirm`, the button opens an "are you sure?" dialog instead of
 * submitting, and the form is only sent once the person confirms. It then also
 * sends `confirm=yes`, which the server actions for irreversible operations
 * require — so skipping the dialog does not skip the check.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className,
  confirm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  confirm?: ConfirmOptions;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmedRef = useRef<HTMLInputElement>(null);

  // Once a submission finishes, the next one has to be confirmed afresh.
  useEffect(() => {
    if (!pending && confirmedRef.current) confirmedRef.current.value = '';
  }, [pending]);

  const label = pending ? (pendingLabel ?? 'Saving…') : children;

  if (!confirm) {
    return (
      <Button type="submit" variant={variant} disabled={pending} className={className}>
        {label}
      </Button>
    );
  }

  return (
    <>
      <input ref={confirmedRef} type="hidden" name="confirm" defaultValue="" />
      <Button
        ref={buttonRef}
        type="button"
        variant={variant}
        disabled={pending}
        className={className}
        onClick={() => dialogRef.current?.showModal()}
      >
        {label}
      </Button>
      <ConfirmDialog
        ref={dialogRef}
        {...confirm}
        onConfirm={() => {
          if (confirmedRef.current) confirmedRef.current.value = 'yes';
          dialogRef.current?.close();
          buttonRef.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
