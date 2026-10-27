import { listeningBand, readingBand } from '@/lib/bands';
import { answerText, isCorrect, type Answer } from '@/lib/grade';
import type {
  Exam, ExamBody, ExamListItem, ExamSkill, ExamSummary, GradeResult, PublicQuestion, Question,
} from '@/lib/exam-types';
import type { Db } from './db';
import type { ExamInput } from './exam-schema';

/**
 * Truy vấn bộ đề, viết một lần cho cả SQLite và PostgreSQL (dấu `?`, CAST thay cho kiểu riêng của từng loại).
 * Hàm ghi không tự mở giao dịch: nơi gọi bọc bằng `db.tx` khi ghi nhiều đề một lúc.
 */

interface ExamRow {
  id: string; skill: ExamSkill; title: string; kind: string; topic: string; level: string;
  minutes: number; status: string; body: string; question_count: number;
}

// Số câu hỏi đếm bằng LEFT JOIN + GROUP BY (không dùng truy vấn con tương quan): chạy giống nhau trên SQLite và PostgreSQL.
const EXAM_SELECT = `SELECT e.id, e.skill, e.title, e.kind, e.topic, e.level, e.minutes, e.status, e.body,
  CAST(COUNT(q.id) AS INTEGER) AS question_count
  FROM exams e LEFT JOIN questions q ON q.exam_id = e.id`;
const EXAM_GROUP = 'GROUP BY e.id, e.seq, e.skill, e.title, e.kind, e.topic, e.level, e.minutes, e.status, e.body';

const toSummary = (r: ExamRow): ExamSummary => ({
  id: r.id, skill: r.skill, title: r.title, kind: r.kind, topic: r.topic, level: r.level,
  minutes: Number(r.minutes), questionCount: Number(r.question_count),
});

export interface ListFilter {
  skill?: ExamSkill;
  topics?: string[];
  kind?: string;
  q?: string;
  includeDrafts?: boolean;
  withBody?: boolean;
  limit?: number;
  offset?: number;
}

export async function listExams(db: Db, f: ListFilter = {}): Promise<{ items: ExamListItem[]; total: number }> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!f.includeDrafts) where.push("e.status = 'published'");
  if (f.skill) { where.push('e.skill = ?'); params.push(f.skill); }
  if (f.topics?.length) {
    where.push(`e.topic IN (${f.topics.map(() => '?').join(',')})`);
    params.push(...f.topics);
  }
  if (f.kind) { where.push('e.kind = ?'); params.push(f.kind); }
  const text = f.q?.trim();
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    // PostgreSQL mặc định đã thoát bằng dấu \ ; SQLite thì phải khai báo.
    const esc = db.dialect === 'sqlite' ? " ESCAPE '\\'" : '';
    where.push(`(LOWER(e.title) LIKE LOWER(?)${esc} OR LOWER(e.topic) LIKE LOWER(?)${esc} OR LOWER(e.kind) LIKE LOWER(?)${esc})`);
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await db.get<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM exams e ${clause}`, params);
  const rows = await db.all<ExamRow>(
    `${EXAM_SELECT} ${clause} ${EXAM_GROUP} ORDER BY e.skill, e.seq, e.id LIMIT ? OFFSET ?`,
    [...params, f.limit ?? 50, f.offset ?? 0],
  );
  return {
    total: Number(count?.n ?? 0),
    items: rows.map((r) => (f.withBody ? { ...toSummary(r), body: JSON.parse(r.body) as ExamBody } : toSummary(r))),
  };
}

interface QuestionRow { id: string; type: 'tfng' | 'mcq' | 'gap'; text: string; options: string | null; answer: string; explanation: string }

export async function getExam(db: Db, id: string, opts: { includeDraft?: boolean } = {}): Promise<Exam | null> {
  const row = await db.get<ExamRow>(`${EXAM_SELECT} WHERE e.id = ? ${EXAM_GROUP}`, [id]);
  if (!row || (row.status !== 'published' && !opts.includeDraft)) return null;
  const qs = await db.all<Pick<QuestionRow, 'id' | 'type' | 'text' | 'options'>>(
    'SELECT id, type, text, options FROM questions WHERE exam_id = ? ORDER BY pos', [id],
  );
  const questions: PublicQuestion[] = qs.map((q) => ({
    id: q.id, type: q.type, text: q.text, ...(q.options ? { options: JSON.parse(q.options) as string[] } : {}),
  }));
  return { ...toSummary(row), body: JSON.parse(row.body) as ExamBody, questions };
}

export async function getExamSkill(db: Db, id: string): Promise<ExamSkill | null> {
  const r = await db.get<{ skill: ExamSkill }>("SELECT skill FROM exams WHERE id = ? AND status = 'published'", [id]);
  return r?.skill ?? null;
}

export async function examExists(db: Db, id: string): Promise<boolean> {
  return !!(await db.get('SELECT 1 AS ok FROM exams WHERE id = ?', [id]));
}

/** Câu hỏi kèm đáp án, chỉ dùng để chấm ở server. */
export async function answerKey(db: Db, id: string): Promise<Question[]> {
  const rows = await db.all<QuestionRow>(
    'SELECT id, type, text, options, answer, explanation FROM questions WHERE exam_id = ? ORDER BY pos', [id],
  );
  return rows.map((r): Question => {
    const answer = JSON.parse(r.answer) as unknown;
    if (r.type === 'tfng') return { id: r.id, type: 'tfng', text: r.text, answer: answer as 'True' | 'False' | 'Not Given', why: r.explanation };
    if (r.type === 'mcq') return { id: r.id, type: 'mcq', text: r.text, options: JSON.parse(r.options ?? '[]') as string[], answer: answer as number, why: r.explanation };
    return { id: r.id, type: 'gap', text: r.text, answers: answer as string[], why: r.explanation };
  });
}

export async function upsertExam(db: Db, e: ExamInput): Promise<void> {
  const now = new Date().toISOString();
  // `seq` giữ thứ tự nhập đề: đề mới lấy số lớn nhất + 1, đề cập nhật giữ nguyên số cũ.
  await db.run(
    `INSERT INTO exams (id, seq, skill, title, kind, topic, level, minutes, status, body, created_at, updated_at)
     VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM exams), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET skill = excluded.skill, title = excluded.title, kind = excluded.kind,
       topic = excluded.topic, level = excluded.level, minutes = excluded.minutes, status = excluded.status,
       body = excluded.body, updated_at = excluded.updated_at`,
    [e.id, e.skill, e.title, e.kind, e.topic, e.level, e.minutes, e.status, JSON.stringify(e.body), now, now],
  );
  await db.run('DELETE FROM questions WHERE exam_id = ?', [e.id]);
  let pos = 0;
  for (const q of e.questions ?? []) {
    pos += 1;
    await db.run(
      'INSERT INTO questions (id, exam_id, pos, type, text, options, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [q.id, e.id, pos, q.type, q.text, q.type === 'mcq' ? JSON.stringify(q.options) : null, JSON.stringify(q.answer), q.explanation],
    );
  }
}

export async function deleteExam(db: Db, id: string): Promise<boolean> {
  return (await db.run('DELETE FROM exams WHERE id = ?', [id])).changes > 0;
}

export async function examStats(db: Db) {
  const bySkill: Record<ExamSkill, number> = { reading: 0, listening: 0, writing: 0, speaking: 0 };
  const rows = await db.all<{ skill: ExamSkill; n: number }>(
    "SELECT skill, CAST(COUNT(*) AS INTEGER) AS n FROM exams WHERE status = 'published' GROUP BY skill",
  );
  for (const r of rows) bySkill[r.skill] = Number(r.n);
  const topics = (await db.all<{ topic: string }>(
    "SELECT DISTINCT topic FROM exams WHERE status = 'published' AND topic <> '' ORDER BY topic",
  )).map((r) => r.topic);
  const q = await db.get<{ n: number }>(
    "SELECT CAST(COUNT(*) AS INTEGER) AS n FROM questions q JOIN exams e ON e.id = q.exam_id WHERE e.status = 'published'",
  );
  return { total: Object.values(bySkill).reduce((a, b) => a + b, 0), bySkill, topics, questions: Number(q?.n ?? 0) };
}

/** Chấm bài Reading/Listening ở server. Trả `null` khi đề không tồn tại hoặc không chấm tự động được. */
export async function gradeExam(db: Db, id: string, answers: Record<string, Answer>): Promise<GradeResult | null> {
  const skill = await getExamSkill(db, id);
  if (skill !== 'reading' && skill !== 'listening') return null;
  const key = await answerKey(db, id);
  const results: GradeResult['results'] = {};
  for (const q of key) results[q.id] = { correct: isCorrect(q, answers[q.id]), answer: answerText(q), why: q.why };
  const correct = Object.values(results).filter((r) => r.correct).length;
  const band = skill === 'reading' ? readingBand(correct, key.length) : listeningBand(correct, key.length);
  return { correct, total: key.length, band, results };
}
