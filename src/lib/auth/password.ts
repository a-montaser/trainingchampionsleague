import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/** OWASP's argon2id baseline: 19 MiB, 2 iterations, 1 lane. */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    // A malformed stored hash must read as "wrong password", never as an error
    // that could distinguish one account from another.
    return false;
  }
}

/** A readable temporary password for the admin "reset password" action. */
export function generateTemporaryPassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
