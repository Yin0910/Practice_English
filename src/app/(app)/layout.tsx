import { RequireAuth } from '@/components/AuthProvider';
import { ProgressProvider } from '@/components/ProgressProvider';

/** Mọi trang luyện thi cần đăng nhập; tiến độ được tải một lần và dùng chung cho các trang. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <ProgressProvider>{children}</ProgressProvider>
    </RequireAuth>
  );
}
