import { NextResponse } from 'next/server';
import { isExamSkill } from '@/lib/exam-types';
import { getDb } from '@/server/db';
import { parseExams } from '@/server/exam-schema';
import { examExists, listExams, upsertExam } from '@/server/exams-repo';
import { adminState, fail, guardAdmin, guardUserOrAdmin, readJson } from '@/server/http';

const int = (v: string | null, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
};

/**
 * GET /api/exams?skill=reading&topic=Health&topic=Economy&kind=&q=&limit=50&offset=0&include=body
 * Danh sách đề đã xuất bản. Không bao giờ trả đáp án. `include=body` kèm nội dung (dùng cho Writing/Speaking).
 * Cần đăng nhập (hoặc token quản trị).
 */
export async function GET(req: Request) {
  const denied = await guardUserOrAdmin(req);
  if (denied) return denied;
  const p = new URL(req.url).searchParams;
  const rawSkill = p.get('skill');
  if (rawSkill && !isExamSkill(rawSkill)) return fail('skill phải là reading, listening, writing hoặc speaking.', 400);
  const skill = rawSkill && isExamSkill(rawSkill) ? rawSkill : undefined;
  const body = p.get('include') === 'body';
  const withBody = body && (skill === 'writing' || skill === 'speaking');
  if (body && !withBody) return fail('include=body chỉ dùng cho writing và speaking (Reading/Listening lấy từng đề ở /api/exams/{id}).', 400);
  const result = await listExams(await getDb(), {
    skill,
    topics: p.getAll('topic').filter(Boolean),
    kind: p.get('kind') || undefined,
    q: p.get('q') || undefined,
    includeDrafts: adminState(req) === 'ok' && p.get('drafts') === '1',
    withBody,
    limit: int(p.get('limit'), 50, 1, 200),
    offset: int(p.get('offset'), 0, 0, 100_000),
  });
  return NextResponse.json(result);
}

/** POST /api/exams: tạo một đề mới (cần token quản trị). 409 nếu id đã tồn tại. */
export async function POST(req: Request) {
  const denied = guardAdmin(req);
  if (denied) return denied;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const { exams, errors } = parseExams(body.data);
  if (errors.length || exams.length !== 1) return fail('Đề không hợp lệ.', 422, { details: errors.length ? errors : ['Chỉ nhận một đề mỗi lần; nhiều đề dùng /api/exams/import.'] });
  const db = await getDb();
  const exam = exams[0]!;
  if (await examExists(db, exam.id)) return fail(`Đề "${exam.id}" đã tồn tại. Dùng PUT /api/exams/${exam.id} để sửa.`, 409);
  await db.tx((t) => upsertExam(t, exam));
  return NextResponse.json({ id: exam.id }, { status: 201 });
}
