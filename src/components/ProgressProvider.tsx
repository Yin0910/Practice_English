'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getJson, postJson, putJson } from '@/lib/api';
import type { Attempt, AttemptSkill } from '@/lib/progress-types';
import type { CardState } from '@/lib/srs';

/**
 * Lịch sử học, tiến độ từ vựng và ngày thi của người đang đăng nhập, lưu ở máy chủ nên đổi máy vẫn còn.
 * Mỗi thay đổi được ghi lên máy chủ ngay; ghi lỗi thì báo lên đầu trang và vẫn giữ trong phiên này.
 */

interface ProgressApi {
  ready: boolean;
  attempts: Attempt[];
  addAttempt(a: { skill: AttemptSkill; note: string; band?: number; examId?: string }): Promise<void>;
  vocab: Record<string, CardState>;
  saveCard(wordId: string, card: CardState): void;
  examDate: string;
  setExamDate(date: string): void;
}

const Ctx = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [vocab, setVocab] = useState<Record<string, CardState>>({});
  const [examDate, setExamDateState] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getJson<{ items: Attempt[] }>('/api/history'),
      getJson<{ cards: Record<string, CardState> }>('/api/vocab'),
      getJson<{ examDate: string }>('/api/prefs'),
    ])
      .then(([h, v, p]) => {
        if (!alive) return;
        setAttempts(h.items);
        setVocab(v.cards);
        setExamDateState(p.examDate);
      })
      .catch(() => { if (alive) setError('Không tải được tiến độ học của bạn. Kiểm tra kết nối rồi tải lại trang.'); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const addAttempt = useCallback<ProgressApi['addAttempt']>(async (a) => {
    try {
      const saved = await postJson<Attempt>('/api/history', a);
      setAttempts((p) => [saved, ...p]);
    } catch {
      setError('Chưa lưu được buổi luyện vào lịch sử. Kết quả vẫn hiện trong phiên này; hãy kiểm tra kết nối.');
      setAttempts((p) => [{ id: `local-${Date.now()}`, at: new Date().toISOString(), ...a }, ...p]);
    }
  }, []);

  const saveCard = useCallback((wordId: string, card: CardState) => {
    setVocab((p) => ({ ...p, [wordId]: card }));
    putJson('/api/vocab', { cards: { [wordId]: card } }).catch(() => setError('Chưa lưu được tiến độ từ vựng. Hãy kiểm tra kết nối.'));
  }, []);

  const setExamDate = useCallback((date: string) => {
    setExamDateState(date);
    putJson('/api/prefs', { examDate: date }).catch(() => setError('Chưa lưu được ngày thi. Hãy kiểm tra kết nối.'));
  }, []);

  const value = useMemo(
    () => ({ ready, attempts, addAttempt, vocab, saveCard, examDate, setExamDate }),
    [ready, attempts, addAttempt, vocab, saveCard, examDate, setExamDate],
  );

  return (
    <Ctx.Provider value={value}>
      {error && (
        <div className="notice bad banner" role="alert">
          <span>{error}</span>
          <button type="button" className="linkish" onClick={() => setError(null)}>Đóng</button>
        </div>
      )}
      {ready ? children : <main><p className="empty">Đang tải tiến độ của bạn…</p></main>}
    </Ctx.Provider>
  );
}

export function useProgress(): ProgressApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProgress phải nằm trong ProgressProvider');
  return v;
}
