'use client';

import Link from 'next/link';
import { useApi } from '@/lib/api';
import { TARGET_BAND, formatBand, overallBand } from '@/lib/bands';
import { daysUntil, skillBand, streak } from '@/lib/progress';
import { useProgress } from '@/components/ProgressProvider';
import { dayKey, isDue, isMastered } from '@/lib/srs';
import type { Skill } from '@/lib/storage';
import { VOCAB } from '@/data/vocabulary';

const SKILLS: { id: Skill; label: string; href: string; task: string }[] = [
  { id: 'listening', label: 'Listening', href: '/listening', task: 'Làm một đề Listening' },
  { id: 'reading', label: 'Reading', href: '/reading', task: 'Làm một đề Reading' },
  { id: 'writing', label: 'Writing', href: '/writing', task: 'Viết một đề Writing' },
  { id: 'speaking', label: 'Speaking', href: '/speaking', task: 'Luyện một chủ đề Speaking' },
];

const pct = (band: number) => `${Math.min(100, (band / 9) * 100)}%`;

export default function Dashboard() {
  const { attempts: sessions, vocab: cards, examDate, setExamDate } = useProgress();
  const stats = useApi<{ total: number }>('/api/exams/stats');
  const today = dayKey();

  const bands = SKILLS.map((s) => ({ ...s, band: skillBand(sessions, s.id) }));
  const known = bands.flatMap((b) => (b.band === null ? [] : [b.band]));
  const overall = overallBand(known);
  const dueCount = VOCAB.filter((w) => isDue(cards[w.id], today)).length;
  const mastered = VOCAB.filter((w) => isMastered(cards[w.id])).length;
  const doneToday = new Set(sessions.filter((s) => dayKey(new Date(s.at)) === today).map((s) => s.skill));
  const examsDone = new Set(sessions.flatMap((s) => (s.examId ? [s.examId] : []))).size;
  const left = examDate ? daysUntil(examDate, today) : null;
  const recent = [...sessions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const gap = overall === null ? null : Math.max(0, TARGET_BAND - overall);

  return (
    <main>
      <div className="page-head">
        <h1><span className="hl hl-lilac">Tổng quan</span></h1>
        <p>Mục tiêu: IELTS Band {TARGET_BAND.toFixed(1)}. Band ước lượng lấy trung bình 3 buổi gần nhất của mỗi kỹ năng.</p>
      </div>

      <div className="grid three" style={{ marginBottom: 18 }}>
        <div className="card tone-yellow">
          <div className="stat-label">Band ước lượng</div>
          <div className="stat">{formatBand(overall)}</div>
          <div className="muted">{gap === null ? 'Chưa có buổi nào được chấm' : gap === 0 ? 'Đã đạt mục tiêu' : `Còn thiếu ${gap.toFixed(1)} band so với mục tiêu`}</div>
        </div>
        <div className="card tone-green">
          <div className="stat-label">Chuỗi ngày học</div>
          <div className="stat">{streak(sessions, today)} ngày</div>
          <div className="muted num">
            Đã làm {examsDone}{stats.data ? `/${stats.data.total}` : ''} đề · {mastered}/{VOCAB.length} từ đã thuộc
          </div>
        </div>
        <div className="card tone-lilac">
          <label className="stat-label" htmlFor="exam">Ngày thi</label>
          <div className="stat">{left === null ? '–' : left >= 0 ? `${left} ngày` : 'Đã qua'}</div>
          <input id="exam" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </div>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Band theo kỹ năng</h2>
          <div className="bands">
            {bands.map((b) => (
              <div key={b.id} className="band-row">
                <span>{b.label}</span>
                <div className="band-track" role="img" aria-label={`${b.label}: ${formatBand(b.band)} trên mục tiêu ${TARGET_BAND}`}>
                  {b.band !== null && <div className="band-fill" style={{ width: pct(b.band) }} />}
                  <div className="band-target" style={{ left: pct(TARGET_BAND) }} />
                </div>
                <span className="num">{formatBand(b.band)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>Vạch đứng là mục tiêu {TARGET_BAND.toFixed(1)}.</p>
        </section>

        <section className="card">
          <h2>Việc hôm nay</h2>
          <ul className="list">
            <li>
              <span>Ôn từ vựng · {dueCount} từ đến hạn</span>
              <Link className="btn" href="/vocabulary">Mở</Link>
            </li>
            {SKILLS.map((s) => (
              <li key={s.id}>
                <span className={doneToday.has(s.id) ? 'todo-done' : ''}>{s.task}</span>
                {doneToday.has(s.id) ? <span className="pill">Xong</span> : <Link className="btn" href={s.href}>Mở</Link>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Lịch sử gần đây</h2>
        {recent.length === 0 ? (
          <p className="empty">Chưa có buổi luyện nào. Làm đề đầu tiên ở một trong các mục phía trên.</p>
        ) : (
          <ul className="list">
            {recent.map((s) => (
              <li key={s.id}>
                <span><b style={{ textTransform: 'capitalize' }}>{s.skill}</b> · {s.note}</span>
                <span className="muted num">
                  {s.band !== undefined && <b style={{ color: 'var(--ink)', marginRight: 10 }}>Band {formatBand(s.band)}</b>}
                  {new Date(s.at).toLocaleDateString('vi-VN')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
