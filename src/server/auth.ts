import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Db } from './db';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

/**
 * Đăng nhập bằng tên + mật khẩu (không có đăng ký công khai: tài khoản do quản trị tạo).
 * Mật khẩu chỉ được lưu dưới dạng băm scrypt có muối riêng; mã phiên chỉ lưu bản băm SHA-256.
 */

export const COOKIE_NAME = 'pe_session';
export const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 32;

export interface AuthUser { id: string; username: string }

export const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;
export const MIN_PASSWORD = 8;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Băm mẫu dùng khi tên không tồn tại: thời gian trả lời không tiết lộ tên nào có thật. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(12).toString('hex')));

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

/** Tạo tài khoản, hoặc đặt lại mật khẩu nếu tên đã có (dùng cho script quản trị). Trả về 'created' | 'updated'. */
export async function upsertUser(db: Db, username: string, password: string): Promise<'created' | 'updated'> {
  const name = normalizeUsername(username);
  if (!USERNAME_RE.test(name)) throw new Error('Tên đăng nhập gồm 3–32 ký tự: chữ thường, số, dấu . _ -');
  if (password.length < MIN_PASSWORD) throw new Error(`Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự.`);
  if (password.length > 200) throw new Error('Mật khẩu quá dài.');
  const hash = await hashPassword(password);
  const existing = await db.get<{ id: string }>('SELECT id FROM users WHERE username = ?', [name]);
  if (existing) {
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, existing.id]);
    // Đổi mật khẩu thì mọi phiên đang đăng nhập bằng mật khẩu cũ phải hết hiệu lực.
    await db.run('DELETE FROM auth_sessions WHERE user_id = ?', [existing.id]);
    return 'updated';
  }
  await db.run('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)', [randomUUID(), name, hash, new Date().toISOString()]);
  return 'created';
}

export async function authenticate(db: Db, username: string, password: string): Promise<AuthUser | null> {
  const row = await db.get<{ id: string; username: string; password_hash: string }>(
    'SELECT id, username, password_hash FROM users WHERE username = ?', [normalizeUsername(username)],
  );
  const ok = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()));
  return row && ok ? { id: row.id, username: row.username } : null;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.run('DELETE FROM auth_sessions WHERE expires_at < ?', [now.toISOString()]); // dọn phiên cũ
  await db.run('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [hashToken(token), userId, now.toISOString(), expiresAt.toISOString()]);
  return { token, expiresAt };
}

export async function userFromToken(db: Db, token: string, now = new Date()): Promise<AuthUser | null> {
  const row = await db.get<AuthUser>(
    `SELECT u.id, u.username FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`, [hashToken(token), now.toISOString()],
  );
  return row ? { id: row.id, username: row.username } : null;
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.run('DELETE FROM auth_sessions WHERE token_hash = ?', [hashToken(token)]);
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE_NAME) return decodeURIComponent(part.slice(i + 1).trim()) || null;
  }
  return null;
}

export async function userFromRequest(req: Request, db: Db): Promise<AuthUser | null> {
  const token = tokenFromRequest(req);
  return token ? userFromToken(db, token) : null;
}

/** Cookie chỉ gắn cờ Secure khi trang thật sự chạy HTTPS (Caddy gửi X-Forwarded-Proto); chạy http://localhost thì không. */
export function isHttps(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return proto ? proto === 'https' : new URL(req.url).protocol === 'https:';
}
