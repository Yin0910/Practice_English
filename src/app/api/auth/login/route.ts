import { NextResponse } from 'next/server';
import { z } from 'zod';
import { COOKIE_NAME, authenticate, createSession, isHttps, normalizeUsername } from '@/server/auth';
import { getDb } from '@/server/db';
import { fail, readJson } from '@/server/http';
import { clientIp, loginBlocked, loginFailed, loginSucceeded } from '@/server/rate-limit';

const body = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) });

/** POST /api/auth/login { username, password }: đúng thì đặt cookie phiên (HttpOnly, SameSite=Lax, Secure khi chạy HTTPS). */
export async function POST(req: Request) {
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const parsed = body.safeParse(raw.data);
  if (!parsed.success) return fail('Cần nhập tên đăng nhập và mật khẩu.', 400);

  const username = normalizeUsername(parsed.data.username);
  const ip = clientIp(req);
  const limit = loginBlocked(ip, username);
  if (limit.blocked) {
    return NextResponse.json(
      { error: 'Đăng nhập sai quá nhiều lần. Thử lại sau ít phút.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const db = await getDb();
  const user = await authenticate(db, username, parsed.data.password);
  if (!user) {
    loginFailed(ip, username);
    return fail('Sai tên đăng nhập hoặc mật khẩu.', 401); // cố ý không nói sai ở đâu
  }
  loginSucceeded(ip, username);

  const { token, expiresAt } = await createSession(db, user.id);
  const res = NextResponse.json({ user });
  res.cookies.set(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: isHttps(req), path: '/', expires: expiresAt });
  return res;
}
