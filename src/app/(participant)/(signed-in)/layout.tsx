import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { getParticipant } from '@/lib/auth/dal';
import { logoutAction } from '../auth-actions';
import { NavLinks } from './NavLinks';

/**
 * Site chrome only.
 *
 * This layout reads the session to show a name, but it is NOT the access
 * check — Next layouts do not re-render on navigation, so every page below
 * calls `requireParticipant()` for itself.
 */
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const participant = await getParticipant();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Translucent so the stadium backdrop reads through the top bar. The
          blur makes the header its own stacking context, so it needs its own
          z-index or the nav menu drops down behind positioned page content. */}
      <header className="relative z-40 border-b border-line bg-surface/75 backdrop-blur-md">
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold tracking-tight text-ink">
              P&D Training Champions League
            </p>
            {participant && (
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" className="min-h-9 px-2.5 text-sm">
                  Sign out
                </Button>
              </form>
            )}
          </div>
          <div className="mt-2">
            <NavLinks />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
