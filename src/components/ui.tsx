import type { ComponentProps, ReactNode } from 'react';

/**
 * Small hand-rolled primitives shared by both sites. Everything is mobile-first
 * and works from 375px upwards; tables scroll horizontally rather than forcing
 * the page to.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx('rounded-2xl border border-line bg-surface', className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('px-4 py-4 sm:px-5', className)}>{children}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-white/25',
  danger: 'border border-down/30 bg-down-tint text-down hover:bg-down/20',
  ghost: 'text-muted hover:bg-white/5 hover:text-ink',
};

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button {...props} className={cx(BUTTON_BASE, BUTTON_STYLES[variant], className)} />;
}

export function LinkButton({
  variant = 'secondary',
  className,
  ...props
}: ComponentProps<'a'> & { variant?: ButtonVariant }) {
  return <a {...props} className={cx(BUTTON_BASE, BUTTON_STYLES[variant], className)} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-bold tracking-[0.04em] text-label">
        {label}
        {required && <span className="ml-0.5 text-brand-text">*</span>}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'min-h-11 w-full rounded-[10px] border border-white/12 bg-input px-3.5 text-sm text-ink transition-colors placeholder:text-muted/60 focus:border-brand';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

// Dropdowns use the site's own `<Dropdown>` rather than a native `<select>`,
// so there is no Select primitive here.

/** A checkbox with its label, sized for a comfortable tap target. */
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode; hint?: string }) {
  return (
    <label className={cx('flex items-start gap-2.5 py-1', className)}>
      <input
        {...props}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-brand"
      />
      <span className="text-sm text-ink">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={cx(CONTROL, 'min-h-24 py-2', className)} />;
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-down/25 bg-down-tint text-down',
    success: 'border-up/25 bg-up-tint text-up',
    info: 'border-line bg-canvas text-muted',
  }[tone];

  return (
    <div role="alert" className={cx('rounded-lg border px-3 py-2.5 text-sm', styles)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Wraps a table so wide columns scroll inside the card, not the page. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>;
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        'whitespace-nowrap border-b border-line px-3 py-3 text-[11px] font-bold uppercase tracking-[0.07em] text-muted',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cx(
        'border-b border-line px-3 py-2.5 text-ink',
        align === 'right' ? 'text-right numeric' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{label}</p>
      <p className="mt-1.5 font-display text-[30px] font-bold leading-none text-ink numeric">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

/** ▲ promoted / ▼ relegated marker used across both standings views. */
export function MovementBadge({ movement }: { movement: 'promoted' | 'relegated' | 'stayed' }) {
  if (movement === 'stayed') return null;

  const up = movement === 'promoted';
  return (
    <span
      className={cx(
        'ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.07em]',
        up ? 'bg-up-tint text-up' : 'bg-down-tint text-down',
      )}
    >
      {up ? '▲' : '▼'} {up ? 'Up' : 'Down'}
    </span>
  );
}

export function StatusBadge({ status }: { status: 'counted' | 'pending' | 'rejected' }) {
  const styles = {
    counted: 'bg-up-tint text-up',
    pending: 'bg-white/5 text-muted border border-line',
    rejected: 'bg-down-tint text-down',
  }[status];

  const label = { counted: 'Counted', pending: 'Pending', rejected: 'Rejected' }[status];

  return (
    <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.07em]', styles)}>
      {label}
    </span>
  );
}
