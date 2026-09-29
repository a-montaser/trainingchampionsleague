import { redirect } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { getAdmin } from '@/lib/auth/dal';
import { AdminLoginForm } from './LoginForm';

export const metadata = { title: 'Organiser sign in · P&D Training Champions League' };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({ searchParams }: PageProps<'/admin/login'>) {
  if (await getAdmin()) redirect('/admin');

  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : '/admin';

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-brand-text">
          Organisers only
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Participant accounts cannot sign in here.
        </p>
      </div>

      <Card>
        <CardBody>
          <AdminLoginForm next={next} />
        </CardBody>
      </Card>

      <p className="mt-5 text-sm text-muted">
        Organiser accounts are created from the command line, not here.
      </p>
    </main>
  );
}
