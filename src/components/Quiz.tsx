'use client';

import type { GradeResult, PublicQuestion } from '@/lib/exam-types';
import type { Answer } from '@/lib/grade';

const TFNG = ['True', 'False', 'Not Given'] as const;

/**
 * Danh sách câu hỏi dùng chung cho Reading và Listening.
 * Đáp án đúng không có ở trình duyệt: chỉ sau khi nộp, server trả `results` (đúng/sai + đáp án + giải thích).
 */
export function Quiz({
  questions, answers, onAnswer, results,
}: {
  questions: PublicQuestion[];
  answers: Record<string, Answer>;
  onAnswer: (id: string, value: Answer) => void;
  results?: GradeResult['results'];
}) {
  return (
    <ol className="quiz">
      {questions.map((q, i) => {
        const r = results?.[q.id];
        return (
          <li key={q.id} className={r ? (r.correct ? 'q right' : 'q wrong') : 'q'}>
            <fieldset disabled={!!results}>
              <legend><span className="qn">{i + 1}</span>{q.text}</legend>

              {q.type === 'gap' && (
                <input
                  className="gap-input" type="text" autoComplete="off" spellCheck={false}
                  aria-label={`Câu ${i + 1}`} value={(answers[q.id] as string | undefined) ?? ''}
                  onChange={(e) => onAnswer(q.id, e.target.value)} placeholder="Nhập đáp án"
                />
              )}

              {q.type === 'tfng' && (
                <div className="choices">
                  {TFNG.map((o) => (
                    <label key={o} className={answers[q.id] === o ? 'choice picked' : 'choice'}>
                      <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => onAnswer(q.id, o)} />
                      {o}
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'mcq' && (
                <div className="choices col">
                  {(q.options ?? []).map((o, idx) => (
                    <label key={o} className={answers[q.id] === idx ? 'choice picked' : 'choice'}>
                      <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => onAnswer(q.id, idx)} />
                      <b>{String.fromCharCode(65 + idx)}</b> {o}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {r && (
              <p className="explain">
                <strong>{r.correct ? 'Đúng' : 'Sai'}</strong>
                {!r.correct && <> · Đáp án: <b>{r.answer}</b></>}
                <br />{r.why}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
