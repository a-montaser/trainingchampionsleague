/**
 * Keeps at most one dropdown open across the whole page.
 *
 * Dropdowns open on hover, so sweeping the cursor across a row of them would
 * otherwise leave a trail of open lists. Each one claims the slot when it
 * opens, which closes whichever was open before — including the nav menu, since
 * they all share this registry.
 */

let current: { id: string; close: () => void } | null = null;

/** Opens exclusively: closes whatever else was open first. */
export function claimOpenDropdown(id: string, close: () => void): void {
  if (current && current.id !== id) {
    const previous = current;
    // Cleared before closing, so the other one's own release is a no-op rather
    // than wiping the slot we are about to take.
    current = null;
    previous.close();
  }
  current = { id, close };
}

export function releaseOpenDropdown(id: string): void {
  if (current?.id === id) current = null;
}
