import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { parseExams } from '@/server/exam-schema';
import { deleteExam, examExists, getExam, upsertExam } from '@/server/exams-repo';
import { adminState, fail, guardAdmin, guardUserOrAdmin, readJson } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/exams/{id}: một đề đầy đủ, KHÔNG có đáp án (chấm bằng POST /api/exams/{id}/grade). Cần đăng nhập (hoặc token quản trị). */
export async function GET(req: Request, { params }: Ctx) {
  const denied = await guardUserOrAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const exam = await getExam(await getDb(), id, { includeDraft: adminState(req) === 'ok' });
  return exam ? NextResponse.json(exam) : fail('Không tìm thấy đề.', 404);
}

/** PUT /api/exams/{id}: thay toàn bộ nội dung một đề đã có (cần token quản trị). */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const db = await getDb();
  if (!(await examExists(db, id))) return fail('Không tìm thấy đề.', 404);
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const { exams, errors } = parseExams(body.data);
  if (errors.length || exams.length !== 1) return fail('Đề không hợp lệ.', 422, { details: errors });
  const exam = exams[0]!;
  if (exam.id !== id) return fail('id trong nội dung không khớp với id trên đường dẫn.', 422);
  await db.tx((t) => upsertExam(t, exam));
  return NextResponse.json({ id });
}

/** DELETE /api/exams/{id}: xoá đề cùng toàn bộ câu hỏi (cần token quản trị). */
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  return (await deleteExam(await getDb(), id)) ? new NextResponse(null, { status: 204 }) : fail('Không tìm thấy đề.', 404);
}
