import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ATTEMPT_SKILLS } from '@/lib/progress-types';
import { addAttempt, listAttempts } from '@/server/progress-repo';
import { fail, readJson, requireUser } from '@/server/http';

const body = z.object({
  skill: z.enum(ATTEMPT_SKILLS),
  examId: z.string().max(64).optional(),
  band: z.number().min(0).max(9).optional(),
  note: z.string().max(300),
});

/** GET /api/history: lịch sử học của chính người đang đăng nhập, mới nhất trước. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if ('res' in a) return a.res;
  return NextResponse.json({ items: await listAttempts(a.db, a.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/history { skill, examId?, band?, note }: ghi thêm một buổi luyện vào lịch sử. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if ('res' in a) return a.res;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const parsed = body.safeParse(raw.data);
  if (!parsed.success) return fail('Buổi luyện không hợp lệ.', 422);
  return NextResponse.json(await addAttempt(a.db, a.user.id, parsed.data), { status: 201 });
}
