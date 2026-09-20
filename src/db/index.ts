import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env';
import * as schema from './schema';

export { schema };

/**
 * One client for both deployment targets: Neon's pooled endpoint in production
 * and a local Postgres in development. Both speak the standard protocol, so a
 * single driver covers them — and unlike Neon's HTTP driver, it supports the
 * interactive transactions that closing a round depends on.
 *
 * Cached on `globalThis` so Next's dev server does not open a new pool on every
 * hot reload.
 */
const globalForDb = globalThis as unknown as {
  __tclPool?: Pool;
  __tclDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function createDb() {
  const pool = (globalForDb.__tclPool ??= new Pool({
    connectionString: env.databaseUrl,
    max: env.isProduction ? 5 : 10,
  }));
  return drizzle(pool, { schema });
}

/**
 * Resolved on first use rather than at import time. Services can then be
 * imported — and their authorisation checks exercised — without a database
 * connection or a populated environment.
 */
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
