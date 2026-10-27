'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from './Icon';

const QUESTIONS = [
  {
    eyebrow: 'Nâng cấp diễn đạt',
    q: 'Chọn câu nghe giống Band 8 hơn',
    sentence: 'Many people think pollution is a big problem.',
    options: [
      'Pollution is a very big problem for many people.',
      'It is widely argued that pollution poses a serious threat to public health.',
      'Pollution is very very bad problem.',
    ],
    answer: 1,
    why: 'Cấu trúc bị động "It is widely argued that…" cùng collocation "pose a threat to" và một đối tượng cụ thể (public health) cho thấy vốn từ rộng và ý rõ hơn câu A.',
  },
  {
    eyebrow: 'Collocation',
    q: 'Chọn động từ đi đúng với "laws"',
    sentence: 'Governments should ___ stricter laws on plastic waste.',
    options: ['do', 'enact', 'play'],
    answer: 1,
    why: '"Enact laws" là collocation trang trọng, hay dùng trong Task 2. "Do laws" và "play laws" không tồn tại.',
  },
  {
    eyebrow: 'Ngữ pháp',
    q: 'Điền dạng động từ đúng',
    sentence: 'The number of cars on the road ___ increased sharply.',
    options: ['have', 'has'],
    answer: 1,
    why: '"The number of + N" là cụm số ít nên dùng "has". Chỉ "A number of + N số nhiều" mới đi với "have". Đây là lỗi hay làm mất điểm GRA.',
  },
] as const;

/** Ba câu thử nhanh trên trang chủ: chọn đáp án là có giải thích ngay, không cần đăng ký. */
export function TryIt() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const finished = i >= QUESTIONS.length;
  const q = QUESTIONS[Math.min(i, QUESTIONS.length - 1)]!;
  const score = marks.filter(Boolean).length;

  function choose(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    setMarks((m) => [...m, idx === q.answer]);
  }

  function next() {
    setPicked(null);
    setI(i + 1);
  }

  function again() {
    setI(0);
    setPicked(null);
    setMarks([]);
  }

  return (
    <div className="demo-card">
      <div className="demo-top" aria-label={`Câu ${Math.min(i + 1, QUESTIONS.length)} trên ${QUESTIONS.length}`}>
        {QUESTIONS.map((_, idx) => (
          <span key={idx} className={idx < marks.length ? (marks[idx] ? 'seg on' : 'seg bad') : 'seg'} />
        ))}
      </div>

      {finished ? (
        <div className="demo-body">
          <span className="eyebrow">Kết quả</span>
          <div className="demo-q">Bạn đúng {score}/{QUESTIONS.length} câu</div>
          <p>{score === QUESTIONS.length ? 'Tuyệt vời. Vào kho đề để thử sức với bài thật.' : 'Không sao, mỗi đề đều có giải thích từng câu để bạn học lại ngay.'}</p>
        </div>
      ) : (
        <div className="demo-body">
          <span className="eyebrow">{q.eyebrow}</span>
          <div className="demo-q">{q.q}</div>
          <div className="demo-sentence">{q.sentence}</div>
          <div className="demo-options">
            {q.options.map((o, idx) => {
              const state = picked === null ? '' : idx === q.answer ? 'right' : idx === picked ? 'wrong' : '';
              return (
                <button key={o} type="button" className={`demo-opt ${state}`} disabled={picked !== null} onClick={() => choose(idx)}>
                  {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <p className="demo-feedback" aria-live="polite">
              <b>{picked === q.answer ? 'Đúng rồi. ' : 'Chưa đúng. '}</b>{q.why}
            </p>
          )}
        </div>
      )}

      <div className="demo-foot">
        {finished ? (
          <>
            <button type="button" className="btn" onClick={again}>Làm lại</button>
            <Link href="/dashboard" className="btn primary">Vào kho đề <Icon name="arrow" size={16} /></Link>
          </>
        ) : (
          <>
            <span className="muted">{picked === null ? 'Chọn một đáp án' : 'Xem giải thích rồi sang câu tiếp'}</span>
            <button type="button" className="btn primary" disabled={picked === null} onClick={next}>
              {i === QUESTIONS.length - 1 ? 'Xem kết quả' : 'Câu tiếp'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
