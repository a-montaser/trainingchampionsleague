'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { PasswordInput } from '@/components/PasswordInput';
import { Alert, Checkbox, Field, Input } from '@/components/ui';
import { loginAction, type FormState } from '../auth-actions';

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && <Alert>{state.message}</Alert>}

      <Field label="Work email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@vodafone.com"
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>

      <Checkbox
        id="remember"
        name="remember"
        defaultChecked
        label="Remember me"
        hint="Stays signed in on this device until you sign out."
      />

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
