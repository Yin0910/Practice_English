import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVocab, saveVocab } from '@/server/progress-repo';
import { fail, readJson, requireUser } from '@/server/http';

const card = z.object({
  box: z.number().int().min(1).max(5),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seen: z.number().int().min(0).max(100_000),
});
const body = z.object({ cards: z.record(z.string().regex(/^[a-z0-9-]{1,64}$/), card) });

/** GET /api/vocab: tiến độ ôn từ vựng của người đang đăng nhập. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if ('res' in a) return a.res;
  return NextResponse.json({ cards: await getVocab(a.db, a.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** PUT /api/vocab { cards: { wordId: { box, due, seen } } }: ghi đè tiến độ của các từ được gửi (tối đa 200 từ mỗi lần). */
export async function PUT(req: Request) {
  const a = await requireUser(req);
  if ('res' in a) return a.res;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const parsed = body.safeParse(raw.data);
  if (!parsed.success || Object.keys(parsed.data.cards).length > 200) return fail('Dữ liệu từ vựng không hợp lệ.', 422);
  await saveVocab(a.db, a.user.id, parsed.data.cards);
  return NextResponse.json({ saved: Object.keys(parsed.data.cards).length });
}
