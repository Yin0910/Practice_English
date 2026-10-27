'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Quiz } from '@/components/Quiz';
import { postJson, useApi } from '@/lib/api';
import { formatBand } from '@/lib/bands';
import type { Exam, GradeResult, ReadingBody } from '@/lib/exam-types';
import type { Answer } from '@/lib/grade';
import { useProgress } from '@/components/ProgressProvider';
import { fmtTime, useCountdown } from '@/lib/useTimer';

function Runner({ exam }: { exam: Exam<ReadingBody> }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addAttempt } = useProgress();
  const busy = useRef(false);
  const total = exam.questions.length;
  const seconds = (exam.minutes || 20) * 60;

  async function submit() {
    if (busy.current) return;
    busy.current = true;
    timer.pause();
    setError(null);
    try {
      const r = await postJson<GradeResult>(`/api/exams/${exam.id}/grade`, { answers });
      setResult(r);
      await addAttempt({ skill: 'reading', note: `${exam.title} · ${r.correct}/${r.total} câu đúng`, band: r.band ?? undefined, examId: exam.id });
    } catch (e) {
      busy.current = false;
      setError((e as Error).message);
    }
  }

  const timer = useCountdown(seconds, submit);

  function retry() {
    busy.current = false;
    setAnswers({});
    setResult(null);
    setError(null);
    timer.reset(seconds);
  }

  const answered = exam.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length;

  return (
    <main className="wide">
      <div className="page-head">
        <p><Link href="/reading">← Tất cả đề Reading</Link></p>
        <h1><span className="hl hl-yellow">{exam.title}</span></h1>
        <p>{exam.topic} · {exam.level} · {total} câu · {seconds / 60} phút. Đồng hồ chỉ chạy khi bạn bấm Bắt đầu và tự nộp bài khi hết giờ.</p>
      </div>

      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="row">
          <span className={timer.left <= 60 && timer.running ? 'timer low' : 'timer'} role="timer">{fmtTime(timer.left)}</span>
          {!result && (timer.running
            ? <button className="btn" onClick={timer.pause}>Tạm dừng</button>
            : <button className="btn primary" onClick={timer.start}>{timer.left === seconds ? 'Bắt đầu' : 'Tiếp tục'}</button>)}
        </div>
        <span className="muted num">Đã trả lời {answered}/{total}</span>
      </div>

      {result && (
        <div className="notice" style={{ marginBottom: 14 }}>
          <b>{result.correct}/{result.total} câu đúng · Band ước lượng {formatBand(result.band)}</b>
          <span className="muted"> (quy đổi tỉ lệ về thang 40 câu của bài thi thật, chỉ mang tính tham khảo). </span>
          <button className="linkish" onClick={retry}>Làm lại</button>
        </div>
      )}
      {error && <p className="notice bad" style={{ marginBottom: 14 }}>{error}</p>}

      <div className="split">
        <article className="card passage" aria-label="Bài đọc">
          <h2>{exam.title}</h2>
          {exam.body.paragraphs.map((p) => (
            <p key={p.label}><span className="para-label">{p.label}</span>{p.text}</p>
          ))}
        </article>

        <section className="card" aria-label="Câu hỏi">
          <h2>Questions 1–{total}</h2>
          <Quiz
            questions={exam.questions} answers={answers} results={result?.results}
            onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
          />
          {!result && <button className="btn primary" onClick={submit} style={{ marginTop: 16 }}>Nộp bài</button>}
        </section>
      </div>
    </main>
  );
}

export default function ReadingExamPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<Exam<ReadingBody>>(`/api/exams/${id}`);
  if (loading) return <main><p className="empty">Đang tải đề…</p></main>;
  if (error || !data) return <main className="narrow"><p className="notice bad">{error ?? 'Không tìm thấy đề.'}</p><p><Link href="/reading">← Tất cả đề Reading</Link></p></main>;
  if (data.skill !== 'reading') return <main className="narrow"><p className="notice bad">Đây không phải đề Reading.</p></main>;
  return <Runner key={data.id} exam={data} />;
}
