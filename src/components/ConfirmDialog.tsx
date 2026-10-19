'use client';

import { forwardRef, useId, type ReactNode } from 'react';
import { Button } from './ui';

export interface ConfirmOptions {
  /** A question, e.g. "Delete this training?" */
  title: string;
  /** What will happen, in a sentence or two. */
  message: ReactNode;
  /** Names the action, e.g. "Delete training" — never just "OK". */
  confirmLabel: string;
  /** Destructive actions are red; reversible ones use the primary colour. */
  tone?: 'danger' | 'primary';
}

/**
 * A modal "are you sure?" built on the native <dialog>, so focus is trapped,
 * Escape cancels, and it sits above everything else on the page without any
 * z-index juggling.
 *
 * Cancel comes first and so receives focus when it opens: pressing Enter by
 * reflex never confirms a destructive action. Clicking the backdrop cancels.
 */
export const ConfirmDialog = forwardRef<
  HTMLDialogElement,
  ConfirmOptions & { onConfirm: () => void }
>(function ConfirmDialog({ title, message, confirmLabel, tone = 'danger', onConfirm }, ref) {
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        // A click on the dialog element itself (not its contents) is the backdrop.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      // text-left: the dialog still inherits styles from where it sits in the
      // page, which is often a right-aligned table cell.
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line-strong bg-surface p-0 text-left text-ink shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <div className="mt-1.5 text-sm text-muted">{message}</div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={(event) => event.currentTarget.closest('dialog')?.close()}
          >
            Cancel
          </Button>
          <Button type="button" variant={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
});
