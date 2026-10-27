/**
 * Kiểu dữ liệu của bộ đề. Dùng chung cho server (database, API) và trang web.
 * Đáp án chỉ tồn tại ở `Question`; dữ liệu gửi ra trình duyệt là `PublicQuestion` (không có đáp án).
 */

export const EXAM_SKILLS = ['reading', 'listening', 'writing', 'speaking'] as const;
export type ExamSkill = (typeof EXAM_SKILLS)[number];
export const isExamSkill = (v: unknown): v is ExamSkill => EXAM_SKILLS.includes(v as ExamSkill);

/** Câu hỏi đầy đủ, có đáp án. Chỉ dùng ở server. */
export type Question =
  | { id: string; type: 'tfng'; text: string; answer: 'True' | 'False' | 'Not Given'; why: string }
  | { id: string; type: 'mcq'; text: string; options: string[]; answer: number; why: string }
  | { id: string; type: 'gap'; text: string; answers: string[]; why: string };

export interface PublicQuestion {
  id: string;
  type: 'tfng' | 'mcq' | 'gap';
  text: string;
  options?: string[];
}

export interface ReadingBody { paragraphs: { label: string; text: string }[] }
export interface ListeningBody { script: string; audioUrl?: string }
export interface WritingBody {
  task: 1 | 2;
  prompt: string;
  minWords: number;
  /** Task 1: bảng số liệu (số liệu tự soạn để luyện). */
  table?: { caption: string; head: string[]; rows: string[][] };
}
export interface SpeakingBody {
  part: 1 | 2 | 3;
  /** Part 1/3: câu hỏi. Part 2: các ý gợi ý trên cue card. */
  questions: string[];
  cue?: string;
}
export type ExamBody = ReadingBody | ListeningBody | WritingBody | SpeakingBody;

export interface ExamSummary {
  id: string;
  skill: ExamSkill;
  title: string;
  /** Dạng bài, ví dụ "Discuss both views", "Part 2". */
  kind: string;
  topic: string;
  /** Mức độ, ví dụ "Band 7", "Band 8". */
  level: string;
  minutes: number;
  questionCount: number;
}

export interface Exam<B extends ExamBody = ExamBody> extends ExamSummary {
  body: B;
  questions: PublicQuestion[];
}

export interface ExamListItem extends ExamSummary { body?: ExamBody }

export interface GradeResult {
  correct: number;
  total: number;
  band: number | null;
  results: Record<string, { correct: boolean; answer: string; why: string }>;
}
