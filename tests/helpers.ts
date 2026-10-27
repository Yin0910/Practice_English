import path from 'node:path';
import { newDb } from 'pg-mem';
import { openSqlite, postgresDb, prepareDb, type Db, type Dialect } from '@/server/db';

export const SEED_DIR = path.join(process.cwd(), 'db', 'seed');

/** SQLite thật trong bộ nhớ, hoặc PostgreSQL giả lập (pg-mem) chạy qua đúng adapter của PostgreSQL. */
export async function open(dialect: Dialect, seed = false): Promise<Db> {
  if (dialect === 'sqlite') return openSqlite(':memory:', seed ? SEED_DIR : null);
  const { Pool } = newDb().adapters.createPg();
  return prepareDb(postgresDb(new Pool()), seed ? SEED_DIR : null);
}
