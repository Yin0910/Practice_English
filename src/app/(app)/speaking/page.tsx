'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Loc, activeSet, type Option } from '@/components/Loc';
import { Tabs } from '@/components/Tabs';
import { useApi } from '@/lib/api';
import { formatBand, overallBand } from '@/lib/bands';
import { SPEAKING_TIPS } from '@/lib/criteria';
import type { ExamListItem, SpeakingBody } from '@/lib/exam-types';
import { useProgress } from '@/components/ProgressProvider';
import { fmtTime, useCountdown } from '@/lib/useTimer';

type SpeakingExam = ExamListItem & { body: SpeakingBody };

const BAND_CHOICES = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4];

/** Ghi âm ngay trong trình duyệt để nghe lại; file không được tải lên đâu cả. */
function Recorder() {
  const [state, setState] = useState<'idle' | 'recording' | 'denied' | 'unsupported'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) setState('unsupported');
    return () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const chunks: Blob[] = [];
      const r = new MediaRecorder(s);
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      r.onstop = () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const next = URL.createObjectURL(new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
        urlRef.current = next;
        setUrl(next);
        s.getTracks().forEach((t) => t.stop());
        setState('idle');
      };
      recorder.current = r;
      r.start();
      setState('recording');
    } catch {
      setState('denied');
    }
  }

  function stop() { recorder.current?.stop(); }

  if (state === 'unsupported') return <p className="muted">Trình duyệt này không hỗ trợ ghi âm. Bạn vẫn luyện nói được, chỉ không nghe lại được.</p>;
  return (
    <div>
      <div className="row">
        {state === 'recording'
          ? <button className="btn" onClick={stop}><Icon name="stop" size={16} /> Dừng ghi</button>
          : <button className="btn" onClick={start}><Icon name="mic" size={16} /> {url ? 'Ghi lại' : 'Ghi âm'}</button>}
        {state === 'recording' && <span className="pill">Đang ghi…</span>}
      </div>
      {state === 'denied' && <p className="notice bad" style={{ marginTop: 10 }}>Chưa được cấp quyền micro. Cho phép micro cho trang này trong trình duyệt rồi thử lại.</p>}
      {url && <audio controls src={url} style={{ width: '100%', marginTop: 10 }} />}
    </div>
  );
}

function Practice({ exam }: { exam: SpeakingExam }) {
  const { body } = exam;
  const { addAttempt } = useProgress();
  const prep = useCountdown(60);
  const talk = useCountdown(120);
  const [self, setSelf] = useState<Record<string, number>>({ FC: 6.5, LR: 6.5, GRA: 6.5, P: 6.5 });
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const band = overallBand(Object.values(self)) ?? 0;

  function save() {
    void addAttempt({ skill: 'speaking', note: `Part ${body.part} · ${exam.title} · tự chấm`, band, examId: exam.id });
    setSaved(true);
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>{exam.title}</h2>
        {body.part === 2 ? (
          <div className="cue">
            <p><b>{body.cue}</b></p>
            <p className="muted" style={{ marginBottom: 4 }}>You should say:</p>
            <ul style={{ marginTop: 0 }}>{body.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
        ) : (
          <ul className="list">
            {body.questions.map((q, i) => (
              <li key={q}>
                <label className="row" style={{ cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
                  <span className={done[i] ? 'todo-done' : ''}>{q}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          {body.part === 1 && 'Trả lời mỗi câu khoảng 2–3 câu: trả lời thẳng, thêm lý do hoặc ví dụ ngắn.'}
          {body.part === 2 && 'Chuẩn bị 1 phút, ghi vài từ khoá, rồi nói liền mạch 1–2 phút.'}
          {body.part === 3 && 'Trả lời mỗi câu 4–5 câu: nêu quan điểm, giải thích, so sánh hoặc đưa ví dụ xã hội.'}
        </p>
      </section>

      {body.part === 2 && (
        <section className="card">
          <div className="grid two">
            <div>
              <div className="stat-label">Chuẩn bị (60 giây)</div>
              <div className="row">
                <span className="timer" role="timer">{fmtTime(prep.left)}</span>
                {prep.running ? <button className="btn" onClick={prep.pause}>Tạm dừng</button> : <button className="btn" onClick={prep.start} disabled={prep.left === 0}>Bắt đầu</button>}
              </div>
            </div>
            <div>
              <div className="stat-label">Nói (tối đa 2 phút)</div>
              <div className="row">
                <span className={talk.left <= 15 && talk.running ? 'timer low' : 'timer'} role="timer">{fmtTime(talk.left)}</span>
                {talk.running ? <button className="btn" onClick={talk.pause}>Tạm dừng</button> : <button className="btn" onClick={talk.start} disabled={talk.left === 0}>Bắt đầu</button>}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Ghi âm và nghe lại</h2>
        <Recorder />
      </section>

      <section className="card">
        <h2>Tự chấm theo 4 tiêu chí</h2>
        <div className="checks">
          {SPEAKING_TIPS.map((c) => (
            <div key={c.key} className="check-row">
              <div><b>{c.key}</b> · {c.name}<div className="muted">{c.tip}</div></div>
              <select aria-label={`Band ${c.key}`} value={self[c.key]} onChange={(e) => { setSelf({ ...self, [c.key]: Number(e.target.value) }); setSaved(false); }}>
                {BAND_CHOICES.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <b>Tự chấm: Band {formatBand(band)}</b>
          <button className="btn" disabled={saved} onClick={save}>{saved ? 'Đã lưu' : 'Lưu vào tiến độ'}</button>
        </div>
      </section>
    </div>
  );
}

export default function SpeakingPage() {
  const { data, error, loading } = useApi<{ items: ExamListItem[]; total: number }>('/api/exams?skill=speaking&include=body&limit=200');
  const [part, setPart] = useState<'1' | '2' | '3'>('1');
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => (data?.items ?? []).filter((e): e is SpeakingExam => !!e.body) as SpeakingExam[], [data]);
  const ofPart = all.filter((e) => String(e.body.part) === part);
  const topicOptions: Option[] = useMemo(
    () => [...new Set(ofPart.map((e) => e.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ v, label: v })),
    [ofPart],
  );
  const topicSet = activeSet(topics, topicOptions);
  const shown = ofPart.filter((e) => !topicSet || topicSet.has(e.topic));
  const exam = shown.find((e) => e.id === selected) ?? shown[0];

  function pickPart(p: '1' | '2' | '3') {
    setPart(p);
    setTopics([]);
    setSelected(null);
  }

  return (
    <main className="wide">
      <div className="page-head">
        <h1><span className="hl hl-yellow">Speaking</span></h1>
        <p>Luyện từng phần của bài thi nói: ghi âm, nghe lại và tự chấm. Không có người chấm hay AI chấm giọng nói trong bản này.</p>
      </div>

      {loading && <p className="empty">Đang tải đề…</p>}
      {error && <p className="notice bad">{error}</p>}
      {data && (
        <>
          <Tabs
            label="Phần thi" value={part} onChange={pickPart}
            items={(['1', '2', '3'] as const).map((p) => ({ id: p, label: `Part ${p}`, count: all.filter((e) => String(e.body.part) === p).length }))}
          />
          <div className="split side">
            <nav className="card" aria-label="Danh sách chủ đề">
              <div className="filters" style={{ marginBottom: 8 }}>
                <Loc label="Chủ đề" options={topicOptions} chosen={topics} onChange={setTopics} />
              </div>
              <div className="muted num" style={{ marginBottom: 6 }}>{shown.length}/{ofPart.length} đề</div>
              <ul className="list pick-list">
                {shown.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="prompt-pick" aria-current={e.id === exam?.id ? 'true' : undefined} onClick={() => setSelected(e.id)}>
                      <b>{e.title}</b>
                      <span className="muted">{e.topic} · {e.level}</span>
                    </button>
                  </li>
                ))}
                {shown.length === 0 && <li className="muted">Không có đề khớp bộ lọc.</li>}
              </ul>
            </nav>
            {exam ? <Practice key={exam.id} exam={exam} /> : <p className="empty">Chọn một chủ đề ở bên trái.</p>}
          </div>
        </>
      )}
    </main>
  );
}
