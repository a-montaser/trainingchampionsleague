/**
 * Applies pending migrations.
 *
 * `drizzle-kit migrate` connects over plain TCP on 5432, which corporate
 * networks often block. This runner uses the same driver selection as the app
 * (see src/db/driver.ts), so it works against Neon over 443 as well as a local
 * Postgres.
 *
 *   npm run db:migrate
 */
import { config } from 'dotenv';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool as TcpPool } from 'pg';
import { createPool, isNeonUrl } from '../src/db/driver';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const MIGRATIONS_FOLDER = './src/db/migrations';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.');

  const neon = isNeonUrl(url);
  console.log(`Applying migrations over ${neon ? 'Neon WebSocket (443)' : 'TCP (5432)'}…`);

  const pool = createPool(url, 1);
  try {
    if (neon) {
      await migrateNeon(drizzleNeon(pool as NeonPool), { migrationsFolder: MIGRATIONS_FOLDER });
    } else {
      await migratePg(drizzlePg(pool as TcpPool), { migrationsFolder: MIGRATIONS_FOLDER });
    }
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
