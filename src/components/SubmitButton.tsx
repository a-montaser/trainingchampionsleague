'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './ui';

/**
 * Disables itself while its form is in flight, so a slow connection cannot
 * produce a double submission.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </Button>
  );
}
