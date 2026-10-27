import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { userFromRequest, type AuthUser } from './auth';
import { getDb, type Db } from './db';

export const fail = (message: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: message, ...extra }, { status });

export function adminState(req: Request): 'ok' | 'disabled' | 'denied' {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return 'disabled';
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'denied';
}

/** Các API ghi đề và quản lý tài khoản cần ADMIN_TOKEN. Chưa cấu hình token thì các API này tắt hẳn. */
export function guardAdmin(req: Request): NextResponse | null {
  const s = adminState(req);
  if (s === 'ok') return null;
  return s === 'disabled'
    ? fail('Chưa cấu hình ADMIN_TOKEN nên chưa dùng được API quản trị.', 503)
    : fail('Thiếu hoặc sai token quản trị (Authorization: Bearer ...).', 401);
}

/** Cần đã đăng nhập (cookie phiên). Trả về người dùng và kết nối database, hoặc câu trả lời 401 để gửi thẳng. */
export async function requireUser(req: Request): Promise<{ user: AuthUser; db: Db } | { res: NextResponse }> {
  const db = await getDb();
  const user = await userFromRequest(req, db);
  return user ? { user, db } : { res: fail('Cần đăng nhập.', 401) };
}

/** Đọc đề: cho người đã đăng nhập, hoặc người quản trị có token (script nhập đề). */
export async function guardUserOrAdmin(req: Request): Promise<NextResponse | null> {
  if (adminState(req) === 'ok') return null;
  const a = await requireUser(req);
  return 'res' in a ? a.res : null;
}

export async function readJson(req: Request): Promise<{ ok: true; data: unknown } | { ok: false; res: NextResponse }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false, res: fail('Dữ liệu gửi lên không phải JSON hợp lệ.', 400) };
  }
}
