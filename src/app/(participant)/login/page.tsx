import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in · P&D Training Champions League' };

export default function LoginPage() {
  return (
    // The stadium backdrop comes from the participant layout, so every page has it.
    <main className="flex flex-1 flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            P&D Training Champions League
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to log your training hours.
          </p>
        </div>

        <Card>
          <CardBody>
            <LoginForm />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-muted">
          New here?{' '}
          <Link
            href="/register"
            className="font-medium text-brand-text underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>

        <div className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm text-muted">
          <p className="font-medium text-ink">Having trouble signing in?</p>
          <p className="mt-1">
            Contact one of the tournament admins. They can reset your password
            or sort out any problem with your account.
          </p>
        </div>
      </div>
    </main>
  );
}
