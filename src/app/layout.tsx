import type { Metadata, Viewport } from 'next';
import { Manrope, Outfit } from 'next/font/google';
import { ThemeToggle, THEME_STORAGE_KEY } from '@/components/ThemeToggle';
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

/**
 * Applies the saved theme before the page paints. Inline and synchronous on
 * purpose: doing this in React would render one frame in the wrong colours
 * first. Dark is the default.
 */
const APPLY_THEME = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The theme attribute is set by the script above, so the server's markup
    // and the client's first render differ by design.
    <html
      lang="en"
      className={`${outfit.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_THEME }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
