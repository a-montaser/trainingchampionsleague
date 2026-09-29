'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chevron } from '@/components/Dropdown';
import { claimOpenDropdown, releaseOpenDropdown } from '@/components/dropdown-registry';
import { cx } from '@/components/ui';

const MENU_ID = 'nav-leaderboard';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/entries', label: 'My trainings' },
];

/** The two leaderboards live under one nav item. */
const LEADERBOARDS = [
  { href: '/leaderboard', label: 'Individuals' },
  { href: '/standings', label: 'Teams' },
  { href: '/managers', label: 'Managers' },
];

const ITEM =
  'flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors';

/**
 * A layout cannot read the current path, so the active-link highlight lives in
 * this small client component rather than in the layout itself.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    // Wraps rather than scrolls: a scrolling row would clip the open menu.
    <nav aria-label="Main" className="-mx-1 flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              ITEM,
              active ? 'bg-brand-tint text-brand-text' : 'text-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}

      <LeaderboardMenu pathname={pathname} />
    </nav>
  );
}

/**
 * Opens on click, tap or keyboard — never on hover, so the menu does not drop
 * down over the page when the cursor passes across the nav.
 */
function LeaderboardMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const active = LEADERBOARDS.some((link) => pathname === link.href);

  const close = useCallback(() => {
    setOpen(false);
    releaseOpenDropdown(MENU_ID);
  }, []);

  // Shares the registry with the form dropdowns, so opening either closes the other.
  const openMenu = useCallback(() => {
    claimOpenDropdown(MENU_ID, close);
    setOpen(true);
  }, [close]);

  useEffect(() => () => releaseOpenDropdown(MENU_ID), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    // Opens on click or keyboard only — never on hover.
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-current={active ? 'page' : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
          }
        }}
        className={cx(
          ITEM,
          'gap-1.5',
          active || open ? 'bg-brand-tint text-brand-text' : 'text-muted hover:bg-white/5 hover:text-ink',
        )}
      >
        Leaderboard
        <Chevron pointingUp={open} />
      </button>

      {open && (
        <div className="absolute left-0 z-[60] mt-1 min-w-44 rounded-lg border border-line bg-surface py-1 shadow-lg">
          {LEADERBOARDS.map((link) => {
            const current = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                onClick={close}
                className={cx(
                  'flex min-h-11 items-center px-3 text-sm',
                  current ? 'font-bold text-brand-text' : 'text-ink hover:bg-white/5',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
