'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

const LINKS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/rounds', label: 'Rounds' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/managers', label: 'Managers' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/entries', label: 'Entries' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="-mx-1 flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-tint text-brand-text'
                : 'text-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
