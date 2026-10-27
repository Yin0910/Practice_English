import { z } from 'zod';

/**
 * Định dạng nhập đề (dùng cho file seed `db/seed/*.json` và API `POST /api/exams/import`).
 * Mỗi đề: thông tin chung + `body` theo kỹ năng + `questions` (chỉ Reading/Listening).
 */

const questionBase = {
  id: z.string().regex(/^[a-z0-9_-]{1,24}$/i, 'id câu hỏi chỉ gồm chữ, số, - và _'),
  text: z.string().min(1),
  explanation: z.string().default(''),
};

const question = z.discriminatedUnion('type', [
  z.object({ ...questionBase, type: z.literal('tfng'), answer: z.enum(['True', 'False', 'Not Given']) }),
  z.object({
    ...questionBase, type: z.literal('mcq'),
    options: z.array(z.string().min(1)).min(2).max(8),
    answer: z.number().int().min(0),
  }),
  z.object({ ...questionBase, type: z.literal('gap'), answer: z.array(z.string().min(1)).min(1) }),
]);

const common = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'id đề chỉ gồm chữ thường, số và dấu gạch ngang (2–64 ký tự)'),
  title: z.string().min(1).max(200),
  kind: z.string().max(80).default(''),
  topic: z.string().max(60).default(''),
  level: z.string().max(30).default(''),
  minutes: z.number().int().min(0).max(240).default(0),
  status: z.enum(['draft', 'published']).default('published'),
};

const reading = z.object({
  ...common, skill: z.literal('reading'),
  body: z.object({ paragraphs: z.array(z.object({ label: z.string().min(1).max(4), text: z.string().min(1) })).min(1) }),
  questions: z.array(question).min(1),
});

const listening = z.object({
  ...common, skill: z.literal('listening'),
  body: z.object({ script: z.string().min(1), audioUrl: z.string().url().optional() }),
  questions: z.array(question).min(1),
});

const writing = z.object({
  ...common, skill: z.literal('writing'),
  body: z.object({
    task: z.union([z.literal(1), z.literal(2)]),
    prompt: z.string().min(1),
    minWords: z.number().int().min(50).max(500),
    table: z.object({
      caption: z.string().min(1),
      head: z.array(z.string()).min(2),
      rows: z.array(z.array(z.string())).min(1),
    }).optional(),
  }),
  questions: z.array(question).max(0).optional(),
});

const speaking = z.object({
  ...common, skill: z.literal('speaking'),
  body: z.object({
    part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    questions: z.array(z.string().min(1)).min(1),
    cue: z.string().min(1).optional(),
  }),
  questions: z.array(question).max(0).optional(),
});

export const examInput = z
  .discriminatedUnion('skill', [reading, listening, writing, speaking])
  .superRefine((exam, ctx) => {
    const qs = exam.questions ?? [];
    const seen = new Set<string>();
    qs.forEach((q, i) => {
      if (seen.has(q.id)) ctx.addIssue({ code: 'custom', path: ['questions', i, 'id'], message: `trùng id câu hỏi "${q.id}"` });
      seen.add(q.id);
      if (q.type === 'mcq' && q.answer >= q.options.length) {
        ctx.addIssue({ code: 'custom', path: ['questions', i, 'answer'], message: 'đáp án mcq vượt quá số lựa chọn' });
      }
    });
    if (exam.skill === 'speaking' && exam.body.part === 2 && !exam.body.cue) {
      ctx.addIssue({ code: 'custom', path: ['body', 'cue'], message: 'Part 2 cần có cue (đề của cue card)' });
    }
  });

export type ExamInput = z.output<typeof examInput>;

/** Kiểm tra một mảng đề. Trả về đề hợp lệ và danh sách lỗi (kèm vị trí và id) để báo lại người nhập. */
export function parseExams(data: unknown): { exams: ExamInput[]; errors: string[] } {
  const list = Array.isArray(data) ? data : [data];
  const exams: ExamInput[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  list.forEach((raw, i) => {
    const r = examInput.safeParse(raw);
    const label = `#${i + 1}${typeof (raw as { id?: unknown })?.id === 'string' ? ` (${(raw as { id: string }).id})` : ''}`;
    if (!r.success) {
      for (const issue of r.error.issues) errors.push(`${label} ${issue.path.join('.') || '(gốc)'}: ${issue.message}`);
      return;
    }
    if (ids.has(r.data.id)) { errors.push(`${label}: trùng id đề "${r.data.id}" trong cùng lượt nhập`); return; }
    ids.add(r.data.id);
    exams.push(r.data);
  });
  return { exams, errors };
}
