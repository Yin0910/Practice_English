import { NextResponse } from 'next/server';
import { userFromRequest } from '@/server/auth';
import { getDb } from '@/server/db';

/** GET /api/auth/me: { user } nếu đã đăng nhập, { user: null } nếu chưa (không trả 401 để trang chủ không báo lỗi giả). */
export async function GET(req: Request) {
  const user = await userFromRequest(req, await getDb());
  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
