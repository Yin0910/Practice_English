'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Lưu trên trình duyệt (localStorage), chỉ dùng cho thứ tạm của riêng thiết bị này, như bản nháp bài viết.
 * Lịch sử học và tiến độ từ vựng nằm ở máy chủ, theo từng tài khoản (ProgressProvider).
 * Mọi lần đọc/ghi đều bọc try/catch: chế độ riêng tư hoặc bị chặn dữ liệu trang thì app vẫn chạy, chỉ là không nhớ được.
 */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* hết dung lượng hoặc bị chặn — bỏ qua */
  }
}

/** `ready` = false ở lần render đầu (cùng HTML với server) để không lệch hydration. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValue(read(key, initial));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        write(key, v);
        return v;
      });
    },
    [key],
  );

  return [value, update, ready] as const;
}

export type { Attempt as Session, AttemptSkill as Skill } from './progress-types';
