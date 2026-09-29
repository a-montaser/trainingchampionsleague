import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { getAdmin } from '@/lib/auth/dal';
import { adminLogoutAction } from '../login/auth-actions';
import { AdminNav } from './AdminNav';

/**
 * Chrome only. Every page below calls `requireAdmin()` for itself, because a
 * Next layout does not re-render on navigation and so cannot be the access
 * check.
 */
export default async function AdminSignedInLayout({ children }: { children: ReactNode }) {
  const admin = await getAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-ink">
                P&D Training Champions League
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-brand-text">
                Organiser
              </p>
            </div>
            {admin && (
              <form action={adminLogoutAction}>
                <Button type="submit" variant="ghost" className="min-h-9 px-2.5 text-sm">
                  Sign out
                </Button>
              </form>
            )}
          </div>
          <div className="mt-2">
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
