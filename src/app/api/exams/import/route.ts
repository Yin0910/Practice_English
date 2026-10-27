import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { parseExams } from '@/server/exam-schema';
import { upsertExam } from '@/server/exams-repo';
import { fail, guardAdmin, readJson } from '@/server/http';

/**
 * POST /api/exams/import: nhập hàng loạt, body là mảng đề (hoặc { "exams": [...] }).
 * Làm theo kiểu tất cả hoặc không: một đề sai thì không đề nào được ghi, và lỗi được liệt kê từng chỗ.
 * Đề đã có cùng id sẽ được thay mới.
 */
export async function POST(req: Request) {
  const denied = guardAdmin(req);
  if (denied) return denied;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const data = body.data && typeof body.data === 'object' && 'exams' in body.data ? (body.data as { exams: unknown }).exams : body.data;
  if (!Array.isArray(data) || data.length === 0) return fail('Cần một mảng đề không rỗng.', 422);
  if (data.length > 500) return fail('Mỗi lượt nhập tối đa 500 đề.', 413);
  const { exams, errors } = parseExams(data);
  if (errors.length) return fail('Có đề không hợp lệ, chưa ghi đề nào.', 422, { details: errors });
  const db = await getDb();
  await db.tx(async (t) => { for (const e of exams) await upsertExam(t, e); });
  return NextResponse.json({ imported: exams.length });
}
