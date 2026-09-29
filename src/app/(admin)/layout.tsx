import type { ReactNode } from 'react';

/**
 * The admin site's shell, separate from the participant one.
 *
 * Nothing here is shared with `(participant)`, so no admin markup, action or
 * script can reach a participant page — Next code-splits per route group.
 * Deliberately plain: no stadium backdrop, so the two sites are never confused
 * for one another at a glance.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
