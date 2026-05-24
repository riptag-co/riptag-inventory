import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var _dbPool: Pool | undefined;
}

const pool =
  global._dbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway')
      ? { rejectUnauthorized: false }
      : false,
  });

if (process.env.NODE_ENV !== 'production') global._dbPool = pool;

export const db = drizzle(pool, { schema });
export * from './schema';
