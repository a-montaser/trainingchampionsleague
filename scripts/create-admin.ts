/**
 * Creates or updates an organiser account. There is no admin sign-up page, so
 * this is the only way an admin account comes into existence.
 *
 *   npm run admin:create -- "Full Name" name@vodafone.com [password]
 *
 * With no password one is generated and printed once. Re-running for an
 * existing address resets that account's password rather than failing, which is
 * the recovery path if an organiser is locked out.
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool as TcpPool } from 'pg';
import { hash } from '@node-rs/argon2';
import { createPool, isNeonUrl } from '../src/db/driver';
import { sessions, users } from '../src/db/schema';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

/** Matches src/lib/auth/password.ts — OWASP's argon2id baseline. */
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function main() {
  const [fullName, email, given] = process.argv.slice(2);
  if (!fullName || !email) {
    throw new Error('Usage: npm run admin:create -- "Full Name" name@vodafone.com [password]');
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const normalised = email.trim().toLowerCase();
  const password = given ?? generatePassword();
  if (password.length < 8) throw new Error('Choose a password of at least 8 characters.');

  const pool = createPool(url, 1);
  const db = isNeonUrl(url) ? drizzleNeon(pool as NeonPool) : drizzlePg(pool as TcpPool);

  try {
    const passwordHash = await hash(password, ARGON);
    const [existing] = await db.select().from(users).where(eq(users.email, normalised)).limit(1);

    if (existing) {
      await db
        .update(users)
        .set({ passwordHash, role: 'admin', isActive: true, fullName, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      // Any session issued under the old password stops working.
      await db.delete(sessions).where(eq(sessions.userId, existing.id));
      console.log(`Updated existing account ${normalised} and made it an organiser.`);
    } else {
      await db.insert(users).values({
        fullName,
        email: normalised,
        passwordHash,
        role: 'admin',
        // Organisers do not belong to a team and never appear on leaderboards.
        teamId: null,
      });
      console.log(`Created organiser ${normalised}.`);
    }

    console.log('');
    console.log(`  Email:    ${normalised}`);
    console.log(`  Password: ${password}`);
    console.log('');
    console.log('Shown once. Sign in at http://localhost:3000/admin/login');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
