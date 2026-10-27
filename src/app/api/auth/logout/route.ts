import { NextResponse } from 'next/server';
import { COOKIE_NAME, destroySession, isHttps, tokenFromRequest } from '@/server/auth';
import { getDb } from '@/server/db';

/** POST /api/auth/logout: xoá phiên ở máy chủ và xoá cookie. Luôn thành công. */
export async function POST(req: Request) {
  const token = tokenFromRequest(req);
  if (token) await destroySession(await getDb(), token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: isHttps(req), path: '/', maxAge: 0 });
  return res;
}
