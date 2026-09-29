import Image from 'next/image';

/**
 * The stadium backdrop behind every participant page.
 *
 * Fixed rather than absolute, so it stays put while a long leaderboard scrolls
 * over it instead of stretching to the page height. Decorative, so it carries
 * no alt text and is hidden from screen readers.
 */
export function PageBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20">
      <Image
        src="/login-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* The photo is bright and busy; this keeps headings, captions and links
          readable on top of it. */}
      <div className="absolute inset-0 bg-canvas/88 backdrop-blur-[2px]" />
    </div>
  );
}
