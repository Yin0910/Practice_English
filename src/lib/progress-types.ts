export const ATTEMPT_SKILLS = ['reading', 'listening', 'writing', 'speaking', 'vocabulary'] as const;
export type AttemptSkill = (typeof ATTEMPT_SKILLS)[number];

/** Một buổi luyện đã lưu trong lịch sử của người dùng. */
export interface Attempt {
  id: string;
  skill: AttemptSkill;
  at: string; // ISO
  /** Band ước lượng của buổi này, nếu có. */
  band?: number;
  note: string;
  /** Đề đã làm (id trong database), để biết đề nào đã làm và điểm cao nhất. */
  examId?: string;
}

/** Tiến độ ôn một từ vựng (hộp Leitner). */
export interface CardProgress { box: number; due: string; seen: number }
