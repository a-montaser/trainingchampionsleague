import type { Metadata, Viewport } from 'next';
import { Manrope, Outfit } from 'next/font/google';
import { cookies } from 'next/headers';
import { ThemeToggle, THEME_COOKIE_KEY } from '@/components/ThemeToggle';
import './globals.css';

// Self-hosted by Next at build time, so there is no request to Google at
// runtime and no flash of fallback text.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

/**
 * A deliberately thin shell. Each site puts its own chrome in its route group's
 * layout — `(participant)` here, `(admin)` alongside it — so no admin markup or
 * script is ever part of a participant page.
 */
export const metadata: Metadata = {
  title: 'P&D Training Champions League',
  description: 'Track training hours across teams.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Read on the server so the colours are correct in the first byte of HTML,
  // with no inline script and no flash. Dark is the default.
  const theme =
    (await cookies()).get(THEME_COOKIE_KEY)?.value === 'light' ? 'light' : 'dark';

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${outfit.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <ThemeToggle initialTheme={theme} />
      </body>
    </html>
  );
}
