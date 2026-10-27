'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Loc, SortButton, activeSet, type Option } from '@/components/Loc';
import { useApi } from '@/lib/api';
import { formatBand } from '@/lib/bands';
import type { ExamSummary } from '@/lib/exam-types';
import { useProgress } from '@/components/ProgressProvider';

type SortKey = 'title' | 'topic' | 'level' | 'questionCount' | 'minutes' | 'best';
// Chữ: A→Z. Số câu, thời gian, điểm: lớn lên đầu.
const FIRST_DESC: Record<SortKey, boolean> = { title: false, topic: false, level: false, questionCount: true, minutes: true, best: true };

const uniq = (xs: string[]): Option[] =>
  [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ v, label: v }));

/** Bảng đề của Reading/Listening, lấy từ API `/api/exams`. Bấm một dòng để vào làm đề. */
export function ExamList({ skill, basePath }: { skill: 'reading' | 'listening'; basePath: string }) {
  const { data, error, loading } = useApi<{ items: ExamSummary[]; total: number }>(`/api/exams?skill=${skill}&limit=200`);
  const { attempts: sessions } = useProgress();
  const router = useRouter();
  const [topics, setTopics] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const best = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) if (s.examId && s.band !== undefined) m.set(s.examId, Math.max(m.get(s.examId) ?? 0, s.band));
    return m;
  }, [sessions]);
  const attempted = useMemo(() => new Set(sessions.flatMap((s) => (s.examId ? [s.examId] : []))), [sessions]);

  const topicOptions = useMemo(() => uniq(items.map((i) => i.topic)), [items]);
  const levelOptions = useMemo(() => uniq(items.map((i) => i.level)), [items]);
  const topicSet = activeSet(topics, topicOptions);
  const levelSet = activeSet(levels, levelOptions);
  const filtering = !!topicSet || !!levelSet;

  const rows = useMemo(() => {
    const list = items
      .map((e, idx) => ({ e, idx, best: best.get(e.id) }))
      .filter((r) => (!topicSet || topicSet.has(r.e.topic)) && (!levelSet || levelSet.has(r.e.level)));
    if (!sort) return list;
    const value = (r: (typeof list)[number]): string | number | undefined =>
      sort.key === 'best' ? r.best : sort.key === 'title' ? r.e.title.toLowerCase() : r.e[sort.key];
    return list.sort((a, b) => {
      const x = value(a), y = value(b);
      if (x === undefined && y === undefined) return a.idx - b.idx;
      if (x === undefined) return 1; // chưa làm luôn xuống cuối
      if (y === undefined) return -1;
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return cmp !== 0 ? (sort.desc ? -cmp : cmp) : a.idx - b.idx;
    });
  }, [items, best, topicSet, levelSet, sort]);

  const press = (key: SortKey) => setSort((s) => (s?.key === key ? { key, desc: !s.desc } : { key, desc: FIRST_DESC[key] }));
  const ariaSort = (key: SortKey) => (sort?.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none');
  const next = items.find((i) => !attempted.has(i.id));

  if (loading) return <p className="empty">Đang tải đề…</p>;
  if (error) return <p className="notice bad">{error}</p>;
  if (items.length === 0) return <p className="empty">Chưa có đề nào. Thêm đề vào database (xem README).</p>;

  return (
    <>
      <div className="filters">
        <Loc label="Chủ đề" options={topicOptions} chosen={topics} onChange={setTopics} />
        <Loc label="Mức độ" options={levelOptions} chosen={levels} onChange={setLevels} />
      </div>
      <div className="table-head">
        <span className="num">
          {rows.length}/{items.length} đề
          {filtering && <button className="linkish" onClick={() => { setTopics([]); setLevels([]); }}>Xoá lọc</button>}
        </span>
        {next
          ? <Link className="btn" href={`${basePath}/${next.id}`}>Làm đề chưa làm tiếp theo</Link>
          : <span className="muted">Bạn đã làm hết các đề.</span>}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th aria-sort={ariaSort('title')}><SortButton label="Đề" active={sort?.key === 'title'} desc={!!sort?.desc} onClick={() => press('title')} /></th>
              <th aria-sort={ariaSort('topic')}><SortButton label="Chủ đề" active={sort?.key === 'topic'} desc={!!sort?.desc} onClick={() => press('topic')} /></th>
              <th aria-sort={ariaSort('level')}><SortButton label="Mức độ" active={sort?.key === 'level'} desc={!!sort?.desc} onClick={() => press('level')} /></th>
              <th className="right" aria-sort={ariaSort('questionCount')}><SortButton label="Số câu" active={sort?.key === 'questionCount'} desc={!!sort?.desc} onClick={() => press('questionCount')} /></th>
              <th className="right" aria-sort={ariaSort('minutes')}><SortButton label="Phút" active={sort?.key === 'minutes'} desc={!!sort?.desc} onClick={() => press('minutes')} /></th>
              <th className="right" aria-sort={ariaSort('best')}><SortButton label="Band cao nhất" active={sort?.key === 'best'} desc={!!sort?.desc} onClick={() => press('best')} /></th>
              <th aria-label="Mở đề" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, best: b }) => (
              <tr key={e.id} className="row-link" onClick={() => router.push(`${basePath}/${e.id}`)}>
                <td data-label="Đề"><Link href={`${basePath}/${e.id}`} onClick={(ev) => ev.stopPropagation()}>{e.title}</Link><div className="muted">{e.kind}</div></td>
                <td data-label="Chủ đề">{e.topic}</td>
                <td data-label="Mức độ">{e.level}</td>
                <td className="right" data-label="Số câu">{e.questionCount}</td>
                <td className="right" data-label="Phút">{e.minutes}</td>
                <td className="right" data-label="Band cao nhất">{b === undefined ? (attempted.has(e.id) ? 'Đã làm' : 'Chưa làm') : formatBand(b)}</td>
                <td className="chev" aria-hidden="true">›</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="empty">Không có đề nào khớp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
