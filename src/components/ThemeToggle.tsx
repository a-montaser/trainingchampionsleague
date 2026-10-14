'use client';

import { useSyncExternalStore } from 'react';
import { cx } from './ui';

export const THEME_COOKIE_KEY = 'tcl-theme';

/** A year, so a choice sticks until it is changed. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = 'dark' | 'light';

/**
 * Light/dark switch, pinned bottom-right on every screen.
 *
 * The choice lives in a cookie so the server can put it on <html> before the
 * first byte, which is why there is never a flash of the wrong colours.
 */
/** The <html> attribute is the source of truth, so nothing can drift from it. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

const readTheme = (): Theme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initialTheme);

  function choose(next: Theme) {
    document.documentElement.dataset.theme = next;
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${THEME_COOKIE_KEY}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => choose(isDark ? 'light' : 'dark')}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-line-strong bg-surface p-1 shadow-lg shadow-black/20"
    >
      {/* One circle that slides between the two icons, rather than two that
          light up — so the movement reads as a switch being thrown. 40px is
          one icon (36px) plus the gap (4px). */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute left-1 top-1 h-9 w-9 rounded-full bg-brand transition-transform duration-300 ease-out motion-reduce:transition-none',
          isDark ? 'translate-x-10' : 'translate-x-0',
        )}
      />
      <span
        className={cx(
          'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300',
          isDark ? 'text-muted' : 'text-white',
        )}
      >
        <SunIcon />
      </span>
      <span
        className={cx(
          'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300',
          isDark ? 'text-white' : 'text-muted',
        )}
      >
        <MoonIcon />
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
