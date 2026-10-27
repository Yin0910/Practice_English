import type { Question } from '@/lib/exam-types';

export type Answer = string | number | undefined;

const norm = (s: string) => s.toLowerCase().trim().replace(/[.,;]+$/g, '').replace(/\s+/g, ' ').trim();

export function isCorrect(q: Question, a: Answer): boolean {
  if (a === undefined || a === '') return false;
  switch (q.type) {
    case 'tfng':
    case 'mcq':
      return a === q.answer;
    case 'gap':
      return typeof a === 'string' && q.answers.some((x) => norm(x) === norm(a));
  }
}

export function score(questions: Question[], answers: Record<string, Answer>): number {
  return questions.filter((q) => isCorrect(q, answers[q.id])).length;
}

/** Đáp án đúng ở dạng chữ, để hiện sau khi nộp bài. */
export function answerText(q: Question): string {
  switch (q.type) {
    case 'tfng': return q.answer;
    case 'mcq': return q.options[q.answer] ?? '';
    case 'gap': return q.answers[0] ?? '';
  }
}
