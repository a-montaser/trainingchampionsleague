import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guarantees about the admin site.
 *
 * The runtime rejection is covered in authz.test.ts, which calls every admin
 * service with a participant. These tests cover the other half: that no admin
 * page or route can be *added* without a guard, and that admin code cannot be
 * reached from the participant site.
 */

const SRC = join(process.cwd(), 'src');
const ADMIN_PAGES = join(SRC, 'app', '(admin)');
const ADMIN_API = join(SRC, 'app', 'api', 'admin');
const PARTICIPANT = join(SRC, 'app', '(participant)');

function filesUnder(dir: string, pattern: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !pattern.test(entry.name)) continue;
    found.push(join(entry.parentPath, entry.name));
  }
  return found;
}

const read = (file: string) => readFileSync(file, 'utf8');
const show = (file: string) => relative(SRC, file).split(sep).join('/');

describe('every admin page checks for an admin', () => {
  const pages = filesUnder(ADMIN_PAGES, /^page\.tsx$/).filter(
    // The login page is the one place a signed-out visitor must reach.
    (file) => !file.includes(`login${sep}page.tsx`),
  );

  it('finds the admin pages', () => {
    expect(pages.length).toBeGreaterThanOrEqual(7);
  });

  it.each(pages.map((file) => [show(file), file]))('%s', (_name, file) => {
    // Not the layout: a Next layout does not re-render on navigation, so it
    // cannot be the access check. Each page calls the guard itself.
    expect(read(file)).toMatch(/requireAdmin\(\)/);
  });
});

describe('every admin API route checks for an admin', () => {
  const routes = filesUnder(ADMIN_API, /^route\.ts$/);

  it('finds the admin routes', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((file) => [show(file), file]))('%s', (_name, file) => {
    const source = read(file);
    // The API variant throws a status rather than redirecting, so a participant
    // gets 403 instead of a login page dressed up as a download.
    expect(source).toMatch(/requireAdminApi\(\)/);
    expect(source).toMatch(/error\.status/);
  });
});

describe('every admin mutation checks for an admin', () => {
  const actionFiles = filesUnder(ADMIN_PAGES, /actions\.ts$/);

  it.each(actionFiles.map((file) => [show(file), file]))('%s', (_name, file) => {
    const source = read(file);
    const exported = source.match(/export async function (\w+)/g) ?? [];
    const guards = source.match(/requireAdmin\(\)/g) ?? [];

    // Admin login actions are the exception: they run before anyone is signed in.
    if (file.includes(`login${sep}`)) return;

    expect(exported.length).toBeGreaterThan(0);
    // At least one guard per exported action.
    expect(guards.length).toBeGreaterThanOrEqual(exported.length);
  });
});

describe('admin code stays out of the participant site', () => {
  const participantFiles = filesUnder(PARTICIPANT, /\.tsx?$/);

  it('finds the participant files', () => {
    expect(participantFiles.length).toBeGreaterThan(10);
  });

  it.each(participantFiles.map((file) => [show(file), file]))('%s imports nothing admin', (_name, file) => {
    const source = read(file);
    expect(source).not.toMatch(/from ['"].*\(admin\)/);
    expect(source).not.toMatch(/from ['"]@\/app\/api\/admin/);
  });
});
