/**
 * Giới hạn số lần gọi, giữ trong bộ nhớ của tiến trình (đủ cho một máy chủ chạy một tiến trình).
 * Dùng để chặn đoán mật khẩu và chặn gọi API chấm bài bằng AI liên tục làm cạn hạn mức trả phí.
 */

const buckets = new Map<string, number[]>();

const recent = (key: string, windowMs: number, now: number) => (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

function prune(now: number, windowMs: number) {
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
}

/** Đếm một lần gọi; không cho qua nếu đã đủ `max` lần trong cửa sổ `windowMs`. */
export function hit(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const r = recent(key, windowMs, now);
  if (r.length >= max) {
    buckets.set(key, r);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((r[0]! + windowMs - now) / 1000)) };
  }
  r.push(now);
  buckets.set(key, r);
  prune(now, windowMs);
  return { ok: true, retryAfterSec: 0 };
}

/** Chỉ hỏi (không đếm): đã đủ `max` lần trong cửa sổ chưa? Dùng cho đăng nhập, nơi chỉ lần SAI mới được đếm. */
export function isBlocked(key: string, max: number, windowMs: number, now = Date.now()): { blocked: boolean; retryAfterSec: number } {
  const r = recent(key, windowMs, now);
  return r.length >= max
    ? { blocked: true, retryAfterSec: Math.max(1, Math.ceil((r[0]! + windowMs - now) / 1000)) }
    : { blocked: false, retryAfterSec: 0 };
}

export function record(key: string, windowMs: number, now = Date.now()) {
  const r = recent(key, windowMs, now);
  r.push(now);
  buckets.set(key, r);
  prune(now, windowMs);
}

export const clear = (key: string) => { buckets.delete(key); };
export function resetRateLimits() { buckets.clear(); }

export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

const LOGIN_WINDOW = 15 * 60_000;
const LOGIN_IP_MAX = 10;
const LOGIN_USER_MAX = 20;

/** Đoán mật khẩu: mỗi IP tối đa 10 lần sai và mỗi tên tối đa 20 lần sai trong 15 phút (đi qua Vercel thì IP là của Vercel, nên cần cả lớp theo tên). */
export function loginBlocked(ip: string, username: string, now = Date.now()) {
  const a = isBlocked(`login:ip:${ip}`, LOGIN_IP_MAX, LOGIN_WINDOW, now);
  if (a.blocked) return a;
  return isBlocked(`login:user:${username}`, LOGIN_USER_MAX, LOGIN_WINDOW, now);
}
export function loginFailed(ip: string, username: string, now = Date.now()) {
  record(`login:ip:${ip}`, LOGIN_WINDOW, now);
  record(`login:user:${username}`, LOGIN_WINDOW, now);
}
export function loginSucceeded(ip: string, username: string) {
  clear(`login:ip:${ip}`);
  clear(`login:user:${username}`);
}

/**
 * Chấm bài bằng AI tốn tiền, nên có hai lớp: mỗi tài khoản tối đa N lần mỗi giờ, và cả hệ thống tối đa M lần mỗi ngày.
 */
export function checkAiQuota(userId: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number; scope: 'user' | 'global' } {
  const perUser = hit(`ai:user:${userId}`, num(process.env.AI_RATE_LIMIT_PER_HOUR, 10), 3_600_000, now);
  if (!perUser.ok) return { ok: false, retryAfterSec: perUser.retryAfterSec, scope: 'user' };
  const global = hit('ai:global', num(process.env.AI_RATE_LIMIT_PER_DAY, 300), 86_400_000, now);
  if (!global.ok) return { ok: false, retryAfterSec: global.retryAfterSec, scope: 'global' };
  return { ok: true };
}
