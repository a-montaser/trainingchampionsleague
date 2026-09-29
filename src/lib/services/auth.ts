import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import type { Role } from '../auth/guards';
import { verifyPassword } from '../auth/password';
import { createSession, type IssuedSession } from '../auth/session';

export class LoginFailed extends Error {
  constructor(message = 'That email and password do not match.') {
    super(message);
    this.name = 'LoginFailed';
  }
}


/**
 * Signs a user in for one site only.
 *
 * `expectedRole` is enforced here, so a participant's credentials are rejected
 * at the admin login even though they are perfectly valid on the participant
 * site. The failure message never distinguishes "wrong password" from "not an
 * admin", so the admin login cannot be used to enumerate accounts.
 */
export async function login(
  email: string,
  password: string,
  expectedRole: Role,
  remember = false,
): Promise<IssuedSession> {
  const normalised = email.trim().toLowerCase();

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, normalised))
    .limit(1);

  // Always verify against something, so a missing account and a wrong password
  // take the same amount of time.
  const placeholder =
    '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2E$3cS1L1ZhOJ0VQ8sZ5ibp0pQ8dLpeJZpfvgHqM0Zc0ic';
  const ok = await verifyPassword(user?.passwordHash ?? placeholder, password);

  if (!user || !ok) throw new LoginFailed();
  if (user.role !== expectedRole) throw new LoginFailed();
  if (!user.isActive) {
    throw new LoginFailed('This account has been deactivated. Ask an organiser for help.');
  }


  return createSession(user.id, user.role, remember);
}
