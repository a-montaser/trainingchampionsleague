/**
 * Renames a team, keeping its id — so every entry, headcount and past result
 * stays attached to it.
 *
 *   npx tsx scripts/rename-team.ts "Old name" "New name"
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool as TcpPool } from 'pg';
import { createPool, isNeonUrl } from '../src/db/driver';
import { teams } from '../src/db/schema';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) throw new Error('Usage: tsx scripts/rename-team.ts "Old name" "New name"');

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const pool = createPool(url, 1);
  const db = isNeonUrl(url) ? drizzleNeon(pool as NeonPool) : drizzlePg(pool as TcpPool);

  try {
    const [team] = await db.select().from(teams).where(eq(teams.name, from)).limit(1);
    if (!team) {
      console.log(`No team named "${from}". Nothing changed.`);
      return;
    }

    await db.update(teams).set({ name: to, slug: slugify(to) }).where(eq(teams.id, team.id));
    console.log(`Renamed "${from}" → "${to}" (id ${team.id}, slug ${slugify(to)}).`);
    console.log('Its entries, headcount history and results are untouched.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
