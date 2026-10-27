import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { examStats } from '@/server/exams-repo';

/** GET /api/exams/stats: số đề theo kỹ năng, số câu hỏi và danh sách chủ đề. */
export async function GET() {
  return NextResponse.json(await examStats(await getDb()));
}
