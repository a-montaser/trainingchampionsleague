'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAMES, cookieOptions, destroySession } from '@/lib/auth/session';
import { login, LoginFailed } from '@/lib/services/auth';

export interface AdminLoginState {
  message?: string;
}

/**
 * Organiser sign-in.
 *
 * `login(..., 'admin')` rejects a participant account even with the correct
 * password, and the failure message never says which of the two went wrong —
 * so this page cannot be used to find out who has an account.
 */
export async function adminLoginAction(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/admin');

  if (!email || !password) return { message: 'Enter your email and password.' };

  try {
    const session = await login(email, password, 'admin');
    const jar = await cookies();
    jar.set(session.cookieName, session.token, cookieOptions(session.expiresAt, false));
  } catch (error) {
    if (error instanceof LoginFailed) return { message: error.message };
    throw error;
  }

  // Only ever back into the admin site, so the redirect cannot be pointed
  // somewhere else by a crafted link.
  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function adminLogoutAction(): Promise<void> {
  const jar = await cookies();
  const cookieName = COOKIE_NAMES.admin;

  await destroySession(jar.get(cookieName)?.value);
  jar.delete(cookieName);

  redirect('/admin/login');
}
