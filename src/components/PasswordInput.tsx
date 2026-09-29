'use client';

import { useState, type ComponentProps } from 'react';
import { Input, cx } from './ui';

/**
 * A password field with a show/hide toggle.
 *
 * The button sits inside the field on the right, with the input padded so text
 * never runs underneath it. It is a `type="button"`, so tapping it never
 * submits the form, and it carries its own label for screen readers rather than
 * relying on the icon alone.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cx('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((previous) => !previous)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.6 6.2A8.9 8.9 0 0 1 12 6c6.5 0 10 7 10 7a15.9 15.9 0 0 1-3.2 4" />
      <path d="M6.6 6.8A15.8 15.8 0 0 0 2 13s3.5 7 10 7a9.6 9.6 0 0 0 5.2-1.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
