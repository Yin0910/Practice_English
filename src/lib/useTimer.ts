'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Đồng hồ đếm ngược. `onEnd` chạy đúng một lần khi về 0. */
export function useCountdown(totalSec: number, onEnd?: () => void) {
  const [left, setLeft] = useState(totalSec);
  const [running, setRunning] = useState(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && left === 0) {
      setRunning(false);
      endRef.current?.();
    }
  }, [left, running]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback((sec?: number) => { setRunning(false); setLeft(sec ?? totalSec); }, [totalSec]);

  return { left, running, start, pause, reset };
}
