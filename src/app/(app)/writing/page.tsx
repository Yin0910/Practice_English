'use client';

import { useMemo, useState } from 'react';
import { Loc, activeSet, type Option } from '@/components/Loc';
import { Tabs } from '@/components/Tabs';
import { postJson, useApi } from '@/lib/api';
import { formatBand, overallBand } from '@/lib/bands';
import { WRITING_CRITERIA } from '@/lib/criteria';
import type { ExamListItem, WritingBody } from '@/lib/exam-types';
import { useProgress } from '@/components/ProgressProvider';
import { useStored } from '@/lib/storage';
import { fmtTime, useCountdown } from '@/lib/useTimer';

type WritingExam = ExamListItem & { body: WritingBody };

interface Feedback {
  bands: Record<'TR' | 'CC' | 'LR' | 'GRA', number>;
  overall: number;
  strengths: string[];
  issues: { criterion: string; quote: string; fix: string; why: string }[];
  next_steps: string[];
}

const BAND_CHOICES = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4];
const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function Editor({ exam }: { exam: WritingExam }) {
  const { body } = exam;
  const [text, setText] = useStored<string>(`pe:draft:${exam.id}`, '');
  const { addAttempt } = useProgress();
  const timer = useCountdown(exam.minutes * 60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [self, setSelf] = useState<Record<string, number>>({ TR: 6.5, CC: 6.5, LR: 6.5, GRA: 6.5 });
  const [saved, setSaved] = useState(false);

  const words = wordCount(text);
  const selfBand = overallBand(Object.values(self)) ?? 0;

  async function grade() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      setFeedback(await postJson<Feedback>('/api/writing-feedback', { examId: exam.id, essay: text }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function save(band: number, source: string) {
    void addAttempt({ skill: 'writing', note: `Task ${body.task} · ${exam.title} · ${words} từ · ${source}`, band, examId: exam.id });
    setSaved(true);
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row between">
          <div className="row" style={{ gap: 6 }}>
            <span className="pill">Task {body.task}</span> <span className="pill">{exam.kind}</span> <span className="pill">{exam.topic}</span> <span className="pill">{exam.level}</span>
          </div>
          <div className="row">
            <span className={timer.left <= 60 && timer.running ? 'timer low' : 'timer'} role="timer">{fmtTime(timer.left)}</span>
            {timer.running
              ? <button className="btn" onClick={timer.pause}>Tạm dừng</button>
              : <button className="btn" onClick={timer.start} disabled={timer.left === 0}>{timer.left === exam.minutes * 60 ? 'Bấm giờ' : 'Tiếp tục'}</button>}
          </div>
        </div>
        <p style={{ marginTop: 14, fontWeight: 600 }}>{body.prompt}</p>
        {body.table && (
          <div className="table-wrap">
            <table className="data-table">
              <caption>{body.table.caption}</caption>
              <thead><tr>{body.table.head.map((h, i) => <th key={h} className={i > 0 ? 'right' : ''}>{h}</th>)}</tr></thead>
              <tbody>
                {body.table.rows.map((r) => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i > 0 ? 'right' : ''} data-label={body.table!.head[i]}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <textarea
          aria-label="Bài viết" value={text} spellCheck
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          placeholder={`Viết bài của bạn ở đây (tối thiểu ${body.minWords} từ). Bản nháp tự lưu trên trình duyệt này.`}
        />
        <div className="row between" style={{ marginTop: 12 }}>
          <span className="num" style={{ fontWeight: 700, color: words >= body.minWords ? 'var(--ink)' : 'var(--ink-500)' }}>
            {words} từ {words < body.minWords ? `· còn thiếu ${body.minWords - words}` : '· đủ độ dài'}
          </span>
          <button className="btn primary" onClick={grade} disabled={loading || words < 30}>
            {loading ? 'Đang chấm…' : 'Chấm bằng AI'}
          </button>
        </div>
        {error && <p className="notice bad" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}
      </section>

      {feedback && (
        <section className="card" aria-live="polite">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Kết quả: Band {formatBand(feedback.overall)}</h2>
            <button className="btn" disabled={saved} onClick={() => save(feedback.overall, 'AI chấm')}>{saved ? 'Đã lưu' : `Lưu Band ${formatBand(feedback.overall)} vào tiến độ`}</button>
          </div>
          <div className="bands" style={{ margin: '16px 0' }}>
            {WRITING_CRITERIA.map((c) => (
              <div key={c.key} className="band-row">
                <span title={c.name}>{c.key}</span>
                <div className="band-track">
                  <div className="band-fill" style={{ width: `${(feedback.bands[c.key] / 9) * 100}%` }} />
                  <div className="band-target" style={{ left: `${(8 / 9) * 100}%` }} />
                </div>
                <span className="num">{formatBand(feedback.bands[c.key])}</span>
              </div>
            ))}
          </div>
          {feedback.strengths.length > 0 && (<><h3>Điểm tốt</h3><ul>{feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
          {feedback.issues.length > 0 && (
            <>
              <h3>Cần sửa</h3>
              {feedback.issues.map((it, i) => (
                <div key={i} className="feedback-issue">
                  <span className="pill">{it.criterion}</span>{' '}
                  <del>{it.quote}</del> → <ins>{it.fix}</ins>
                  <div className="muted">{it.why}</div>
                </div>
              ))}
            </>
          )}
          {feedback.next_steps.length > 0 && (<><h3 style={{ marginTop: 14 }}>Bước tiếp theo để lên Band 8.0</h3><ul>{feedback.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
        </section>
      )}

      <section className="card">
        <h2>Tự chấm theo 4 tiêu chí</h2>
        <p className="muted">Đọc lại bài, đối chiếu mô tả Band 8 rồi chọn band. Dùng khi chưa bật chấm bằng AI hoặc để so với kết quả của AI.</p>
        <div className="checks">
          {WRITING_CRITERIA.map((c) => (
            <div key={c.key} className="check-row">
              <div><b>{c.key}</b> · {c.name}<div className="muted">Band 8: {c.band8}</div></div>
              <select
                aria-label={`Band ${c.key}`} value={self[c.key]}
                onChange={(e) => { setSelf({ ...self, [c.key]: Number(e.target.value) }); setSaved(false); }}
              >
                {BAND_CHOICES.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <b>Tự chấm: Band {formatBand(selfBand)}</b>
          <button className="btn" disabled={saved || words === 0} onClick={() => save(selfBand, 'tự chấm')}>{saved ? 'Đã lưu' : 'Lưu vào tiến độ'}</button>
        </div>
      </section>
    </div>
  );
}

export default function WritingPage() {
  const { data, error, loading } = useApi<{ items: ExamListItem[]; total: number }>('/api/exams?skill=writing&include=body&limit=200');
  const [task, setTask] = useState<'2' | '1'>('2');
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => (data?.items ?? []).filter((e): e is WritingExam => !!e.body) as WritingExam[], [data]);
  const ofTask = all.filter((e) => String(e.body.task) === task);
  const topicOptions: Option[] = useMemo(
    () => [...new Set(ofTask.map((e) => e.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ v, label: v })),
    [ofTask],
  );
  const topicSet = activeSet(topics, topicOptions);
  const shown = ofTask.filter((e) => !topicSet || topicSet.has(e.topic));
  const exam = shown.find((e) => e.id === selected) ?? shown[0];

  function pickTask(t: '1' | '2') {
    setTask(t);
    setTopics([]);
    setSelected(null);
  }

  return (
    <main className="wide">
      <div className="page-head">
        <h1><span className="hl hl-green">Writing</span></h1>
        <p>Chọn đề, bấm giờ, viết, rồi chấm theo 4 tiêu chí. Chấm bằng AI cần cấu hình ANTHROPIC_API_KEY (xem README); không có key vẫn tự chấm được.</p>
      </div>

      {loading && <p className="empty">Đang tải đề…</p>}
      {error && <p className="notice bad">{error}</p>}
      {data && (
        <>
          <Tabs
            label="Loại bài" value={task} onChange={pickTask}
            items={[
              { id: '2', label: 'Task 2 · Essay', count: all.filter((e) => e.body.task === 2).length },
              { id: '1', label: 'Task 1 · Report', count: all.filter((e) => e.body.task === 1).length },
            ]}
          />
          <div className="split side">
            <nav className="card" aria-label="Danh sách đề">
              <div className="filters" style={{ marginBottom: 8 }}>
                <Loc label="Chủ đề" options={topicOptions} chosen={topics} onChange={setTopics} />
              </div>
              <div className="muted num" style={{ marginBottom: 6 }}>{shown.length}/{ofTask.length} đề</div>
              <ul className="list pick-list">
                {shown.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setSelected(e.id)} className="prompt-pick" aria-current={e.id === exam?.id ? 'true' : undefined}>
                      <b>{e.title}</b>
                      <span className="muted">{e.kind} · {e.topic}</span>
                    </button>
                  </li>
                ))}
                {shown.length === 0 && <li className="muted">Không có đề khớp bộ lọc.</li>}
              </ul>
            </nav>
            {exam ? <Editor key={exam.id} exam={exam} /> : <p className="empty">Chọn một đề ở bên trái.</p>}
          </div>
        </>
      )}
    </main>
  );
}
