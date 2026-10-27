import { NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { fail, guardAdmin, readJson } from '@/server/http';

const body = z.object({ password: z.string() });

/**
 * PUT /api/admin/users/{username} { "password": "..." }: tạo tài khoản, hoặc đặt lại mật khẩu nếu đã có (cần token quản trị).
 * Mật khẩu chỉ đi qua đây một lần rồi được băm; không được lưu hay ghi log. Dùng script `npm run user:create`.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const denied = guardAdmin(req);
  if (denied) return denied;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const parsed = body.safeParse(raw.data);
  if (!parsed.success) return fail('Cần có "password".', 422);
  const { username } = await params;
  try {
    const result = await upsertUser(await getDb(), decodeURIComponent(username), parsed.data.password);
    return NextResponse.json({ username: decodeURIComponent(username).toLowerCase(), result });
  } catch (e) {
    return fail((e as Error).message, 422);
  }
}
