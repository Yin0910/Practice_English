'use client';

import { useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Phát ra khi một API (không phải đăng nhập) trả 401: phiên đã hết hạn, AuthProvider sẽ đưa người dùng về trang đăng nhập. */
export const UNAUTHORIZED_EVENT = 'pe:unauthorized';

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(data?.error ?? `Lỗi ${res.status}`, res.status);
  }
  return data as T;
}

const withBody = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

export const postJson = <T>(url: string, body: unknown) => getJson<T>(url, withBody('POST', body));
export const putJson = <T>(url: string, body: unknown) => getJson<T>(url, withBody('PUT', body));

/** Tải dữ liệu từ API khi `url` đổi. `url = null` nghĩa là chưa cần tải. */
export function useApi<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null, error: null, loading: url !== null,
  });

  useEffect(() => {
    if (url === null) return;
    const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    getJson<T>(url, { signal: ctl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e: Error) => { if (!ctl.signal.aborted) setState({ data: null, error: e.message, loading: false }); });
    return () => ctl.abort();
  }, [url]);

  return state;
}
