'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getParticipant } from '@/lib/auth/dal';
import { COOKIE_NAMES, cookieOptions, destroySession } from '@/lib/auth/session';
import { login, LoginFailed } from '@/lib/services/auth';
import {
  registerParticipant,
  registrationSchema,
  RegistrationError,
} from '@/lib/services/users';

/**
 * Participant sign-up, sign-in and sign-out.
 *
 * Every action authorises for itself — these are ordinary POST endpoints as far
 * as an attacker is concerned, so nothing here relies on the page that rendered
 * the form or on the proxy redirect.
 */

export interface FormState {
  errors?: Record<string, string>;
  message?: string;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const remember = formData.get('remember') === 'on';

  if (!email || !password) {
    return { message: 'Enter your email and password.' };
  }

  try {
    const session = await login(email, password, 'participant', remember);
    const jar = await cookies();
    jar.set(session.cookieName, session.token, cookieOptions(session.expiresAt, remember));
  } catch (error) {
    if (error instanceof LoginFailed) return { message: error.message };
    throw error;
  }

  redirect('/dashboard');
}

/**
 * The form asks for the password twice. Confirmation is a form-level concern,
 * so it lives here rather than in the service's own schema — but it is still
 * checked on the server, because the browser check can be bypassed.
 */
const registrationFormSchema = registrationSchema
  .extend({ confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Those passwords do not match.',
    path: ['confirmPassword'],
  });

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registrationFormSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    teamId: formData.get('teamId'),
    jobRole: formData.get('jobRole'),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { errors };
  }

  try {
    await registerParticipant(parsed.data);
    // Someone who has just created an account is staying, so keep them signed in.
    const session = await login(parsed.data.email, parsed.data.password, 'participant', true);
    const jar = await cookies();
    jar.set(session.cookieName, session.token, cookieOptions(session.expiresAt, true));
  } catch (error) {
    if (error instanceof RegistrationError) return { errors: { [error.field]: error.message } };
    throw error;
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const cookieName = COOKIE_NAMES.participant;

  await destroySession(jar.get(cookieName)?.value);
  jar.delete(cookieName);

  redirect('/login');
}

/** Used by signed-in pages to render the person's name in the header. */
export async function currentParticipant() {
  return getParticipant();
}
