import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as TcpPool } from 'pg';

/**
 * Picks a Postgres driver for a connection string.
 *
 *  - **Neon** → the serverless driver over a WebSocket on port **443**.
 *    Many corporate networks (this project's included) block outbound 5432
 *    entirely, so a plain TCP connection fails with EACCES. The WebSocket pool
 *    goes out over HTTPS and, unlike Neon's HTTP driver, still supports the
 *    interactive transactions that closing a round depends on.
 *  - **Anything else** (local Docker Postgres) → plain TCP via `pg`.
 *
 * Shared by the app, the migration runner and the seed scripts so all three
 * behave identically.
 */

export type AnyPool = NeonPool | TcpPool;

export function isNeonUrl(url: string): boolean {
  return url.includes('neon.tech');
}

export function createPool(url: string, max = 10): AnyPool {
  if (!isNeonUrl(url)) {
    return new TcpPool({ connectionString: url, max });
  }

  // Node 22+ exposes a global WebSocket; the driver needs it wired up.
  if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = globalThis.WebSocket as never;
  }

  return new NeonPool({ connectionString: url, max });
}
