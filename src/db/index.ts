import 'server-only';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool as TcpPool } from 'pg';
import { env } from '../env';
import { createPool, isNeonUrl, type AnyPool } from './driver';
import * as schema from './schema';

export { schema };

/**
 * One database handle for both deployment targets. See `driver.ts` for why Neon
 * goes over a WebSocket rather than plain TCP.
 *
 * Cached on `globalThis` so Next's dev server does not open a new pool on every
 * hot reload, and resolved lazily so services can be imported — and their
 * authorisation checks exercised — without a database or a populated
 * environment.
 */
const globalForDb = globalThis as unknown as {
  __tclPool?: AnyPool;
  __tclDb?: ReturnType<typeof createDb>;
};

function createDb() {
  const url = env.databaseUrl;
  const pool = (globalForDb.__tclPool ??= createPool(url, env.isProduction ? 5 : 10));

  return isNeonUrl(url)
    ? drizzleNeon(pool as NeonPool, { schema })
    : drizzlePg(pool as TcpPool, { schema });
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, property, receiver) {
    const instance = (globalForDb.__tclDb ??= createDb());
    return Reflect.get(instance, property, receiver);
  },
});

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Anything a query can run on: the pool, or an open transaction. */
export type Executor = Db | Tx;
