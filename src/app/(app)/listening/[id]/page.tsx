'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Quiz } from '@/components/Quiz';
import { postJson, useApi } from '@/lib/api';
import { formatBand } from '@/lib/bands';
import type { Exam, GradeResult, ListeningBody } from '@/lib/exam-types';
import type { Answer } from '@/lib/grade';
import { useProgress } from '@/components/ProgressProvider';

/** Tách theo câu để đọc từng đoạn ngắn: giọng đọc của một số trình duyệt tự dừng khi đoạn quá dài. */
const sentences = (text: string) => text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];

function Runner({ exam }: { exam: Exam<ListeningBody> }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addAttempt } = useProgress();
  const busy = useRef(false);
  const total = exam.questions.length;
  const audioUrl = exam.body.audioUrl;

  // ----- Phát bằng giọng đọc của trình duyệt (khi đề chưa có file audio) -----
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [rate, setRate] = useState(0.95);
  const [replay, setReplay] = useState(false);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const token = useRef(0);

  useEffect(() => {
    if (!('speechSynthesis' in window)) { setSupported(false); return; }
    const pick = () => {
      const all = window.speechSynthesis.getVoices();
      voice.current = all.find((v) => v.lang === 'en-GB') ?? all.find((v) => v.lang.startsWith('en')) ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', pick);
      window.speechSynthesis.cancel();
    };
  }, []);

  function play() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const me = ++token.current;
    const parts = sentences(exam.body.script);
    setPlaying(true);
    setPlays((n) => n + 1);
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = rate;
      if (voice.current) u.voice = voice.current;
      const end = () => { if (me === token.current && i === parts.length - 1) setPlaying(false); };
      u.onend = end;
      u.onerror = end;
      synth.speak(u);
    });
  }

  function stop() {
    token.current += 1;
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }

  async function submit() {
    if (busy.current) return;
    busy.current = true;
    stop();
    setError(null);
    try {
      const r = await postJson<GradeResult>(`/api/exams/${exam.id}/grade`, { answers });
      setResult(r);
      await addAttempt({ skill: 'listening', note: `${exam.title} · ${r.correct}/${r.total} câu đúng`, band: r.band ?? undefined, examId: exam.id });
    } catch (e) {
      busy.current = false;
      setError((e as Error).message);
    }
  }

  function retry() {
    busy.current = false;
    stop();
    setAnswers({});
    setResult(null);
    setError(null);
    setPlays(0);
  }

  const locked = plays >= 1 && !replay;

  return (
    <main className="narrow">
      <div className="page-head">
        <p><Link href="/listening">← Tất cả đề Listening</Link></p>
        <h1><span className="hl hl-lilac">{exam.title}</span></h1>
        <p>{exam.topic} · {exam.level} · {total} câu. Chỉ nghe một lần như bài thi thật (có thể bật cho phép nghe lại khi luyện).</p>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        {audioUrl ? (
          <audio controls src={audioUrl} style={{ width: '100%' }} />
        ) : !supported ? (
          <p className="notice bad" style={{ margin: 0 }}>Trình duyệt này không hỗ trợ giọng đọc (speechSynthesis). Hãy mở bằng Chrome hoặc Edge, hoặc xem bản ghi lời thoại sau khi nộp bài.</p>
        ) : (
          <div className="row between">
            <div className="row">
              {playing
                ? <button className="btn" onClick={stop}><Icon name="stop" size={16} /> Dừng</button>
                : <button className="btn primary" onClick={play} disabled={locked || !!result}><Icon name="play" size={16} /> {plays === 0 ? 'Nghe' : 'Nghe lại'}</button>}
              <label className="muted">
                Tốc độ{' '}
                <select value={rate} onChange={(e) => setRate(Number(e.target.value))} disabled={playing}>
                  <option value={0.85}>Chậm</option>
                  <option value={0.95}>Vừa</option>
                  <option value={1.05}>Nhanh</option>
                </select>
              </label>
            </div>
            <label className="row muted">
              <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} />
              Cho phép nghe lại
            </label>
          </div>
        )}
        {!audioUrl && supported && locked && !result && <p className="muted" style={{ margin: '10px 0 0' }}>Đã nghe một lần. Bật “Cho phép nghe lại” nếu muốn nghe thêm.</p>}
      </section>

      {result && (
        <div className="notice" style={{ marginBottom: 14 }}>
          <b>{result.correct}/{result.total} câu đúng · Band ước lượng {formatBand(result.band)}</b>
          <span className="muted"> (quy đổi tỉ lệ về thang 40 câu, chỉ mang tính tham khảo). </span>
          <button className="linkish" onClick={retry}>Làm lại</button>
        </div>
      )}
      {error && <p className="notice bad" style={{ marginBottom: 14 }}>{error}</p>}

      <section className="card">
        <h2>Questions 1–{total}</h2>
        <p className="muted">Nghe và hoàn thành. Điền tối đa MỘT từ hoặc MỘT số cho mỗi câu điền.</p>
        <Quiz
          questions={exam.questions} answers={answers} results={result?.results}
          onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
        />
        {!result && <button className="btn primary" onClick={submit} style={{ marginTop: 16 }}>Nộp bài</button>}
      </section>

      {result && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Bản ghi lời thoại</h2>
          <p className="script">{exam.body.script}</p>
        </section>
      )}
    </main>
  );
}

export default function ListeningExamPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<Exam<ListeningBody>>(`/api/exams/${id}`);
  if (loading) return <main><p className="empty">Đang tải đề…</p></main>;
  if (error || !data) return <main className="narrow"><p className="notice bad">{error ?? 'Không tìm thấy đề.'}</p><p><Link href="/listening">← Tất cả đề Listening</Link></p></main>;
  if (data.skill !== 'listening') return <main className="narrow"><p className="notice bad">Đây không phải đề Listening.</p></main>;
  return <Runner key={data.id} exam={data} />;
}
