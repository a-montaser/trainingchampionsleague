import { config } from 'dotenv';
import { createPool, isNeonUrl } from '../src/db/driver';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

type Queryable = { query: (q: string) => Promise<{ rows: unknown[] }>; end: () => Promise<void> };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const host = new URL(url.replace(/^postgres(ql)?:\/\//, 'https://')).hostname;
  console.log('host:', host, '| neon driver:', isNeonUrl(url));
  console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY ?? '(unset)');

  const pool = createPool(url, 1) as unknown as Queryable;
  try {
    const r = await pool.query('select 1 as ok');
    console.log('OK', r.rows);
  } catch (e) {
    const err = e as Error & { code?: string; cause?: unknown };
    console.log('FAILED name:', err.name);
    console.log('FAILED message:', err.message);
    console.log('FAILED code:', err.code);
    console.log('FAILED cause:', err.cause);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
