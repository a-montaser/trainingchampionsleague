import type { ReactNode } from 'react';
import { PageBackground } from '@/components/PageBackground';

/**
 * The participant site's shell. The admin site has its own, so nothing from
 * `/admin` is ever rendered or bundled into these pages.
 */
export default function ParticipantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PageBackground />
      {children}
    </div>
  );
}
