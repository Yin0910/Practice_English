'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UNAUTHORIZED_EVENT, getJson, postJson } from '@/lib/api';

export interface AuthUser { id: string; username: string }
type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: AuthUser };

interface AuthApi {
  state: State;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    getJson<{ user: AuthUser | null }>('/api/auth/me')
      .then((d) => setState(d.user ? { status: 'in', user: d.user } : { status: 'out' }))
      .catch(() => setState({ status: 'out' }));
    const expired = () => setState({ status: 'out' });
    window.addEventListener(UNAUTHORIZED_EVENT, expired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, expired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const d = await postJson<{ user: AuthUser }>('/api/auth/login', { username, password });
    setState({ status: 'in', user: d.user });
  }, []);

  const logout = useCallback(async () => {
    await postJson('/api/auth/logout', {}).catch(() => undefined);
    setState({ status: 'out' });
  }, []);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider');
  return v;
}

/** Chỉ cho vào khi đã đăng nhập; chưa thì chuyển tới /login và quay lại đúng trang sau khi đăng nhập. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (state.status === 'out') router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [state.status, path, router]);

  if (state.status !== 'in') return <main><p className="empty">Đang kiểm tra đăng nhập…</p></main>;
  return <>{children}</>;
}
