import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { env } from '@/env';
import { listTeams } from '@/lib/services/teams';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Create an account · P&D Training Champions League' };

// The team dropdown is read from the database, so this page is never prerendered.
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const teams = await listTeams();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      {/* Sits at the top of the page, with the form still centred below it. */}
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg pr-3 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.5 15 7.5 10l5-5" />
        </svg>
        Back to sign in
      </Link>

      <div className="flex flex-1 flex-col justify-center py-4">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-muted">
            Join the tournament and start logging your training hours.
          </p>
        </div>

        <Card>
          <CardBody>
            <RegisterForm
              teams={teams.map((t) => ({ id: t.id, name: t.name }))}
              emailDomain={env.allowedEmailDomain}
            />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-muted">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-brand-text underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
