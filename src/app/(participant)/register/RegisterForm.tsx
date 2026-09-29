'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { Dropdown } from '@/components/Dropdown';
import { PasswordInput } from '@/components/PasswordInput';
import { Alert, Field, Input } from '@/components/ui';
import { JOB_ROLES } from '@/lib/job-roles';
import { registerAction, type FormState } from '../auth-actions';

export function RegisterForm({
  teams,
  emailDomain,
}: {
  teams: Array<{ id: string; name: string }>;
  emailDomain: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(registerAction, {});

  // Tracked so the mismatch shows while typing, rather than only after a
  // round-trip. The server checks it again regardless.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && <Alert>{state.message}</Alert>}

      <Field label="Full name" htmlFor="fullName" error={state.errors?.fullName} required>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>

      <Field
        label="Work email"
        htmlFor="email"
        hint={`Use your ${emailDomain} address.`}
        error={state.errors?.email}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder={`you${emailDomain}`}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters."
        error={state.errors?.password}
        required
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        hint="Type it again so we know it is right."
        error={state.errors?.confirmPassword ?? (mismatch ? 'Those passwords do not match.' : undefined)}
        required
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          aria-invalid={mismatch || Boolean(state.errors?.confirmPassword)}
        />
      </Field>

      <Field
        label="Your team"
        htmlFor="teamId"
        hint="Choose carefully — only an organiser can change this later."
        error={state.errors?.teamId}
        required
      >
        <Dropdown
          id="teamId"
          name="teamId"
          placeholder="Select your team…"
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
        />
      </Field>

      <Field
        label="Your role"
        htmlFor="jobRole"
        hint="What you do in the company."
        error={state.errors?.jobRole}
        required
      >
        <Dropdown
          id="jobRole"
          name="jobRole"
          placeholder="Select your role…"
          options={JOB_ROLES.map((role) => ({ value: role, label: role }))}
        />
      </Field>

      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
