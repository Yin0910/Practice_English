import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExamSkill, gradeExam } from '@/server/exams-repo';
import { fail, readJson, requireUser } from '@/server/http';

const body = z.object({ answers: z.record(z.string(), z.union([z.string().max(200), z.number()])) });

/**
 * POST /api/exams/{id}/grade  { "answers": { "q1": "False", "q6": 1, "q9": "pesticides" } }
 * Chấm bài Reading/Listening ở server: đáp án không bao giờ rời server trước khi nộp bài. Cần đăng nhập.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ('res' in auth) return auth.res;
  const { id } = await params;
  const { db } = auth;
  const skill = await getExamSkill(db, id);
  if (!skill) return fail('Không tìm thấy đề.', 404);
  if (skill !== 'reading' && skill !== 'listening') return fail('Chỉ Reading và Listening được chấm tự động.', 400);
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const parsed = body.safeParse(raw.data);
  if (!parsed.success) return fail('Cần có "answers" là một object { idCâuHỏi: đáp án }.', 422);
  return NextResponse.json(await gradeExam(db, id, parsed.data.answers));
}
