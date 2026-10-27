'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';

/** Chỉ cho quay lại một đường dẫn trong chính site (chặn chuyển hướng ra trang lạ qua tham số `next`). */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard');

function LoginForm() {
  const { state, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'in') router.replace(next);
  }, [state.status, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="narrow">
      <div className="login-card card">
        <span className="badge"><Icon name="sparkle" size={16} /> Chào bạn quay lại</span>
        <h1 style={{ marginTop: 16 }}>Đăng <span className="hl hl-green">nhập</span></h1>
        <p className="muted">Đăng nhập để làm đề và lưu lại lịch sử học của bạn.</p>

        <form onSubmit={submit} className="login-form">
          <label>
            <span className="loc-label">Tên đăng nhập</span>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus
            />
          </label>
          <label>
            <span className="loc-label">Mật khẩu</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required
            />
          </label>
          {error && <p className="notice bad" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button type="submit" className="btn primary big" disabled={busy || !username || !password}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <p className="muted" style={{ margin: '16px 0 0', fontSize: 13 }}>Chưa có tài khoản? Liên hệ người quản trị để được cấp.</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main><p className="empty">Đang tải…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
