import { Card, CardBody, EmptyState, LinkButton } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/dal';
import { listAuditLog } from '@/lib/services/audit';

export const metadata = { title: 'Audit log · Admin' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AdminAuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const rows = await listAuditLog(actor, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Audit log</h1>
        <p className="mt-0.5 text-sm text-muted">
          Every organiser action, with the values on either side of the change.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="Nothing recorded yet">
            <p>Actions appear here as soon as an organiser changes something.</p>
          </EmptyState>
        </Card>
      ) : (
        rows.map((row) => (
          <Card
            key={row.id}
            title={row.action}
            description={`${row.actorName ?? 'Unknown'} · ${row.createdAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`}
          >
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Values label="Before" value={row.before} />
              <Values label="After" value={row.after} />
            </CardBody>
          </Card>
        ))
      )}

      <div className="flex justify-between gap-2">
        {page > 1 ? (
          <LinkButton href={`/admin/audit?page=${page - 1}`} variant="secondary">
            Newer
          </LinkButton>
        ) : (
          <span />
        )}
        {rows.length === PAGE_SIZE && (
          <LinkButton href={`/admin/audit?page=${page + 1}`} variant="secondary">
            Older
          </LinkButton>
        )}
      </div>
    </div>
  );
}

function Values({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{label}</p>
      {value === null || value === undefined ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <pre className="max-h-48 overflow-auto rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
