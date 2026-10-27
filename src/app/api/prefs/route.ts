import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExamDate, setExamDate } from '@/server/progress-repo';
import { fail, readJson, requireUser } from '@/server/http';

const body = z.object({ examDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]) });

/** GET /api/prefs: ngày thi đã đặt của người đang đăng nhập. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if ('res' in a) return a.res;
  return NextResponse.json({ examDate: await getExamDate(a.db, a.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** PUT /api/prefs { examDate: "YYYY-MM-DD" | "" } */
export async function PUT(req: Request) {
  const a = await requireUser(req);
  if ('res' in a) return a.res;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const parsed = body.safeParse(raw.data);
  if (!parsed.success) return fail('Ngày thi không hợp lệ (định dạng YYYY-MM-DD).', 422);
  await setExamDate(a.db, a.user.id, parsed.data.examDate);
  return NextResponse.json({ examDate: parsed.data.examDate });
}
