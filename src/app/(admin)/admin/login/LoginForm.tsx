'use client';

import { useActionState } from 'react';
import { PasswordInput } from '@/components/PasswordInput';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Field, Input } from '@/components/ui';
import { adminLoginAction, type AdminLoginState } from './auth-actions';

export function AdminLoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<AdminLoginState, FormData>(adminLoginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && <Alert>{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />

      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
