'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loc, SortButton, activeSet, type Option } from '@/components/Loc';
import { Tabs } from '@/components/Tabs';
import { VOCAB, TOPICS } from '@/data/vocabulary';
import { dayKey, isDue, isMastered, newCard, review, type CardState } from '@/lib/srs';
import { useProgress } from '@/components/ProgressProvider';

const BATCH = 10;
type Status = 'new' | 'learning' | 'mastered';
const STATUS_LABEL: Record<Status, string> = { new: 'Mới', learning: 'Đang học', mastered: 'Đã thuộc' };
const TOPIC_OPTIONS: Option[] = TOPICS.map((t) => ({ v: t, label: t }));
const STATUS_OPTIONS: Option[] = (Object.keys(STATUS_LABEL) as Status[]).map((v) => ({ v, label: STATUS_LABEL[v] }));

const statusOf = (c: CardState | undefined): Status => (!c ? 'new' : isMastered(c) ? 'mastered' : 'learning');

type SortKey = 'word' | 'topic' | 'box' | 'due';
// Chữ: A→Z. Hộp: cao (đã thuộc nhiều) lên đầu. Hạn ôn: sắp đến hạn lên đầu.
const FIRST_DESC: Record<SortKey, boolean> = { word: false, topic: false, box: true, due: false };

interface Run { ids: string[]; i: number; shown: boolean; ok: number }

export default function VocabularyPage() {
  const { vocab: cards, saveCard, addAttempt, ready } = useProgress();
  const [tab, setTab] = useState<'review' | 'list'>('review');
  const [run, setRun] = useState<Run | null>(null);
  const today = dayKey();

  const dueWords = useMemo(
    () => VOCAB.filter((w) => isDue(cards[w.id], today))
      // Từ đã học đến hạn trước, từ mới sau.
      .sort((a, b) => Number(!!cards[b.id]) - Number(!!cards[a.id])),
    [cards, today],
  );

  function startRun() {
    setRun({ ids: dueWords.slice(0, BATCH).map((w) => w.id), i: 0, shown: false, ok: 0 });
  }

  useEffect(() => {
    if (ready && run === null) startRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function answer(correct: boolean) {
    if (!run) return;
    const id = run.ids[run.i]!;
    saveCard(id, review(cards[id] ?? newCard(today), correct, today));
    const ok = run.ok + (correct ? 1 : 0);
    const next = run.i + 1;
    if (next >= run.ids.length) {
      void addAttempt({ skill: 'vocabulary', note: `Ôn ${run.ids.length} từ · nhớ ${ok}` });
    }
    setRun({ ...run, i: next, shown: false, ok });
  }

  // ----- Danh sách -----
  const [topics, setTopics] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'word', desc: false });

  const topicSet = activeSet(topics, TOPIC_OPTIONS);
  const statusSet = activeSet(statuses, STATUS_OPTIONS);
  const filtering = !!topicSet || !!statusSet;

  const rows = useMemo(() => {
    const list = VOCAB.map((w, idx) => ({ w, idx, c: cards[w.id] }))
      .filter((r) => (!topicSet || topicSet.has(r.w.topic)) && (!statusSet || statusSet.has(statusOf(r.c))));
    const value = (r: (typeof list)[number]): string | number | undefined =>
      sort.key === 'word' ? r.w.word.toLowerCase() : sort.key === 'topic' ? r.w.topic : sort.key === 'box' ? r.c?.box : r.c?.due;
    return list.sort((a, b) => {
      const x = value(a), y = value(b);
      if (x === undefined && y === undefined) return a.idx - b.idx;
      if (x === undefined) return 1; // ô trống luôn xuống cuối
      if (y === undefined) return -1;
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return cmp !== 0 ? (sort.desc ? -cmp : cmp) : a.idx - b.idx;
    });
  }, [cards, topicSet, statusSet, sort]);

  const pressSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: FIRST_DESC[key] }));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none');

  const current = run && run.i < run.ids.length ? VOCAB.find((w) => w.id === run.ids[run.i]) : undefined;
  const finished = run !== null && run.i >= run.ids.length;

  return (
    <main>
      <div className="page-head">
        <h1>Vocabulary</h1>
        <p>{VOCAB.length} từ và collocation học thuật theo {TOPICS.length} chủ đề thường ra đề. Ôn theo lịch nhắc 1, 2, 4, 8, 16 ngày.</p>
      </div>

      <Tabs
        label="Chế độ" value={tab} onChange={setTab}
        items={[{ id: 'review', label: 'Ôn tập', count: dueWords.length }, { id: 'list', label: 'Danh sách', count: VOCAB.length }]}
      />

      {tab === 'review' && (
        <section className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          {!ready || run === null ? (
            <p className="empty">Đang tải…</p>
          ) : finished ? (
            <div className="empty">
              <h2>Xong phiên ôn</h2>
              <p>Nhớ {run.ok}/{run.ids.length} từ. {dueWords.length > 0 ? `Còn ${dueWords.length} từ đến hạn.` : 'Hôm nay không còn từ nào đến hạn.'}</p>
              {dueWords.length > 0 && <button className="btn primary" onClick={startRun}>Ôn thêm {Math.min(BATCH, dueWords.length)} từ</button>}
            </div>
          ) : current ? (
            <div className="flash">
              <div className="progress-line" aria-hidden="true"><i style={{ width: `${(run.i / run.ids.length) * 100}%` }} /></div>
              <div className="muted">Từ {run.i + 1}/{run.ids.length} · {current.topic}</div>
              <div className="word">{current.word}</div>
              <div className="muted">({current.pos})</div>
              {run.shown ? (
                <>
                  <div className="back">
                    <p><b>{current.vi}</b></p>
                    <p><i>{current.example}</i></p>
                    <p className="muted">Collocation / mẹo: {current.tip}</p>
                  </div>
                  <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
                    <button className="btn" onClick={() => answer(false)}>Chưa nhớ</button>
                    <button className="btn primary" onClick={() => answer(true)}>Nhớ rồi</button>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 22 }}>
                  <p className="muted">Tự nhớ nghĩa và cách dùng, rồi bấm để kiểm tra.</p>
                  <button className="btn primary" onClick={() => setRun({ ...run, shown: true })}>Hiện nghĩa</button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty">
              <h2>Hôm nay không còn từ nào đến hạn</h2>
              <p>Quay lại vào ngày mai, hoặc xem toàn bộ từ ở tab Danh sách.</p>
            </div>
          )}
        </section>
      )}

      {tab === 'list' && (
        <>
          <div className="filters">
            <Loc label="Chủ đề" options={TOPIC_OPTIONS} chosen={topics} onChange={setTopics} />
            <Loc label="Trạng thái" options={STATUS_OPTIONS} chosen={statuses} onChange={setStatuses} />
          </div>
          <div className="table-head">
            <span className="num">
              {rows.length}/{VOCAB.length} từ
              {filtering && <button className="linkish" onClick={() => { setTopics([]); setStatuses([]); }}>Xoá lọc</button>}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th aria-sort={ariaSort('word')}><SortButton label="Từ" active={sort.key === 'word'} desc={sort.desc} onClick={() => pressSort('word')} /></th>
                  <th>Nghĩa</th>
                  <th aria-sort={ariaSort('topic')}><SortButton label="Chủ đề" active={sort.key === 'topic'} desc={sort.desc} onClick={() => pressSort('topic')} /></th>
                  <th>Trạng thái</th>
                  <th className="right" aria-sort={ariaSort('box')}><SortButton label="Hộp" active={sort.key === 'box'} desc={sort.desc} onClick={() => pressSort('box')} /></th>
                  <th aria-sort={ariaSort('due')}><SortButton label="Hạn ôn" active={sort.key === 'due'} desc={sort.desc} onClick={() => pressSort('due')} /></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ w, c }) => (
                  <tr key={w.id}>
                    <td data-label="Từ"><b>{w.word}</b> <span className="muted">({w.pos})</span></td>
                    <td data-label="Nghĩa">{w.vi}</td>
                    <td data-label="Chủ đề">{w.topic}</td>
                    <td data-label="Trạng thái">{STATUS_LABEL[statusOf(c)]}</td>
                    <td className="right" data-label="Hộp">{c ? c.box : '–'}</td>
                    <td data-label="Hạn ôn" className="num">{c ? c.due : '–'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="empty">Không có từ nào khớp bộ lọc.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
