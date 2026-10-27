import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { seedFromDir } from './seed';

/**
 * Hai nơi lưu bộ đề, cùng một giao diện `Db`:
 *   - DATABASE_URL=postgresql://...   PostgreSQL (chạy thật, trên máy chủ)
 *   - không có DATABASE_URL           SQLite một file (module `node:sqlite` có sẵn của Node), mặc định data/exams.db,
 *                                     đổi bằng DATABASE_FILE. Dùng khi phát triển và chạy thử trên máy cá nhân.
 * Câu SQL trong repo viết một lần với dấu `?`, adapter tự đổi sang `$1, $2…` cho Postgres.
 * Lần đầu mở mà bảng đề còn trống thì tự nạp `db/seed/*.json`.
 */

export type Dialect = 'sqlite' | 'postgres';
type Row = Record<string, unknown>;

export interface Db {
  readonly dialect: Dialect;
  exec(sql: string): Promise<void>;
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  /** Chạy `fn` trong một giao dịch: lỗi thì huỷ toàn bộ. Gọi lồng nhau thì dùng chung giao dịch ngoài. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS exams (
    id          TEXT PRIMARY KEY,
    seq         INTEGER NOT NULL,
    skill       TEXT NOT NULL CHECK (skill IN ('reading','listening','writing','speaking')),
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT '',
    topic       TEXT NOT NULL DEFAULT '',
    level       TEXT NOT NULL DEFAULT '',
    minutes     INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
    body        TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_exams_skill ON exams (skill, status)',
  'CREATE INDEX IF NOT EXISTS idx_exams_topic ON exams (topic)',
  `CREATE TABLE IF NOT EXISTS questions (
    id          TEXT NOT NULL,
    exam_id     TEXT NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
    pos         INTEGER NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('tfng','mcq','gap')),
    text        TEXT NOT NULL,
    options     TEXT,
    answer      TEXT NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (exam_id, id)
  )`,
  // ----- Người dùng và lịch sử học (mỗi người chỉ thấy dữ liệu của mình) -----
  `CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  )`,
  // Chỉ lưu BĂM của mã phiên: lộ database cũng không dùng lại được cookie.
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id)',
  `CREATE TABLE IF NOT EXISTS attempts (
    id      TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    skill   TEXT NOT NULL CHECK (skill IN ('reading','listening','writing','speaking','vocabulary')),
    exam_id TEXT,
    band    DOUBLE PRECISION,
    note    TEXT NOT NULL DEFAULT '',
    at      TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts (user_id, at)',
  `CREATE TABLE IF NOT EXISTS vocab_progress (
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    word_id TEXT NOT NULL,
    box     INTEGER NOT NULL,
    due     TEXT NOT NULL,
    seen    INTEGER NOT NULL,
    PRIMARY KEY (user_id, word_id)
  )`,
  `CREATE TABLE IF NOT EXISTS prefs (
    user_id   TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    exam_date TEXT NOT NULL DEFAULT ''
  )`,
];

export function sqliteDb(raw: DatabaseSync): Db {
  // Mọi lệnh SQLite chạy đồng bộ nên giao dịch không bị request khác chen vào giữa các `await`.
  const self: Db = {
    dialect: 'sqlite',
    async exec(sql) { raw.exec(sql); },
    async all<T>(sql: string, params: unknown[] = []) { return raw.prepare(sql).all(...(params as SQLInputValue[])) as unknown as T[]; },
    async get<T>(sql: string, params: unknown[] = []) { return raw.prepare(sql).get(...(params as SQLInputValue[])) as unknown as T | undefined; },
    async run(sql, params = []) { return { changes: Number(raw.prepare(sql).run(...(params as SQLInputValue[])).changes) }; },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (raw.isTransaction) return fn(self);
      raw.exec('BEGIN');
      try {
        const result = await fn(self);
        raw.exec('COMMIT');
        return result;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    async close() { raw.close(); },
  };
  return self;
}

interface PgQueryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
}

const toPlaceholders = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

export function postgresDb(pool: Pick<Pool, 'connect' | 'end'> & PgQueryable): Db {
  const make = (q: PgQueryable, inTx: boolean): Db => {
    const self: Db = {
      dialect: 'postgres',
      async exec(sql) {
        for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await q.query(stmt);
      },
      async all<T>(sql: string, params: unknown[] = []) { return (await q.query(toPlaceholders(sql), params)).rows as unknown as T[]; },
      async get<T>(sql: string, params: unknown[] = []) { return (await q.query(toPlaceholders(sql), params)).rows[0] as unknown as T | undefined; },
      async run(sql, params = []) { return { changes: (await q.query(toPlaceholders(sql), params)).rowCount ?? 0 }; },
      async tx<T>(fn: (db: Db) => Promise<T>) {
        if (inTx) return fn(self);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(make(client, true));
          await client.query('COMMIT');
          return result;
        } catch (e) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw e;
        } finally {
          client.release();
        }
      },
      async close() { await pool.end(); },
    };
    return self;
  };
  return make(pool, false);
}

/** Mở (và tạo bảng nếu chưa có) một Db. `seedDir` có giá trị thì tự nạp đề khi bảng còn trống. */
export async function prepareDb(db: Db, seedDir?: string | null): Promise<Db> {
  await db.exec(SCHEMA.join(';\n'));
  if (seedDir) {
    const row = await db.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM exams');
    if (!row || Number(row.n) === 0) await seedFromDir(db, seedDir);
  }
  return db;
}

export async function openSqlite(file: string, seedDir?: string | null): Promise<Db> {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON');
  if (file !== ':memory:') raw.exec('PRAGMA journal_mode = WAL');
  return prepareDb(sqliteDb(raw), seedDir);
}

export async function openPostgres(url: string, seedDir?: string | null): Promise<Db> {
  const pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 8000 });
  return prepareDb(postgresDb(pool), seedDir);
}

const globalForDb = globalThis as unknown as { __examDb?: Promise<Db> };

/** Một kết nối dùng chung cho cả tiến trình (giữ qua các lần nạp lại module khi chạy dev). */
export function getDb(): Promise<Db> {
  if (!globalForDb.__examDb) {
    const seedDir = path.join(process.cwd(), 'db', 'seed');
    const url = process.env.DATABASE_URL;
    const file = process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'exams.db');
    const target = url ? 'PostgreSQL (DATABASE_URL)' : `SQLite "${file}"`;
    globalForDb.__examDb = (url ? openPostgres(url, seedDir) : openSqlite(file, seedDir)).catch((e: Error) => {
      globalForDb.__examDb = undefined; // lần gọi sau thử mở lại thay vì kẹt vĩnh viễn ở lỗi
      throw new Error(
        `Không mở được database ${target}: ${e.message}. ` +
        'Kiểm tra DATABASE_URL / quyền ghi thư mục, và đường dẫn không quá dài (Windows giới hạn khoảng 260 ký tự).',
      );
    });
  }
  return globalForDb.__examDb;
}
