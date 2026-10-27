import Link from 'next/link';
import { Logo } from './Logo';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <div>
          <Logo />
          <small>
            Đề, bài đọc, bài nghe và số liệu Task 1 đều tự soạn để luyện tập. Band hiển thị là ước lượng, không phải kết quả
            của kỳ thi chính thức và không liên kết với British Council, IDP hay Cambridge.
          </small>
        </div>
        <nav aria-label="Liên kết">
          <Link href="/dashboard">Tổng quan</Link>
          <Link href="/reading">Reading</Link>
          <Link href="/listening">Listening</Link>
          <Link href="/writing">Writing</Link>
          <Link href="/speaking">Speaking</Link>
          <Link href="/vocabulary">Vocabulary</Link>
        </nav>
      </div>
    </footer>
  );
}
